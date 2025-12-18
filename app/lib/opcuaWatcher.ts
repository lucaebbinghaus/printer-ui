import {
  OPCUAClient,
  ClientSession,
  ClientSubscription,
  ClientMonitoredItem,
  AttributeIds,
  TimestampsToReturn,
  MessageSecurityMode,
  SecurityPolicy,
} from "node-opcua";
import { EventEmitter } from "events";

export type LampStatus = "ok" | "warning" | "error" | "unknown";

export type PrinterNode = {
  id: string;
  name: string;
  status: LampStatus;
  rawValue: any;
  nodeId: string;
};

export type PrinterStatus = {
  connected: boolean;
  endpoint: string | null;
  nodes: PrinterNode[];
  error?: string;
};

// ------------------------------------------------------------------
// Nodes, die wir überwachen (NodeIds aus UAExpert)
// ------------------------------------------------------------------
const WATCH_NODES = [
  // I/O / Status
  { name: "ERROR", nodeId: "ns=3;i=10021", type: "error" as const },
  { name: "READY", nodeId: "ns=3;i=10027", type: "ready" as const },

  // Interpreter / Job
  { name: "ACTIVE", nodeId: "ns=3;i=10032", type: "generic" as const },
  { name: "LABELS_TO_PRINT", nodeId: "ns=3;i=10038", type: "generic" as const },
  { name: "ERROR_TEXT", nodeId: "ns=3;i=10049", type: "generic" as const },
];

// ------------------------------------------------------------------
// interner Zustand + EventEmitter
// ------------------------------------------------------------------
let watcherStarted = false;
let client: OPCUAClient | null = null;
let session: ClientSession | null = null;
let subscription: ClientSubscription | null = null;

let lastStatus: PrinterStatus = {
  connected: false,
  endpoint: null,
  nodes: [],
  error: "Noch kein Status verfügbar",
};

const statusEmitter = new EventEmitter();

// Zeitstempel des letzten „Lebenszeichens" vom Drucker
let lastUpdateAt: number | null = null;
// Health-Check-Timer nur einmal starten
let healthTimerStarted = false;
let healthTimerId: ReturnType<typeof setInterval> | null = null;

// ------------------------------------------------------------------
function emitStatus() {
  statusEmitter.emit("update", {
    ...lastStatus,
    nodes: [...lastStatus.nodes],
  });
}

// zentraler Helper für Disconnect
function markDisconnected(message: string) {
  lastStatus.connected = false;
  lastStatus.error = message;
  // optional, wenn du bei Disconnect alle alten Werte verstecken willst:
  // lastStatus.nodes = [];
  emitStatus();
}

// bei jedem sinnvollen Update aufrufen
function markAlive() {
  lastStatus.connected = true;
  lastStatus.error = undefined;
  lastUpdateAt = Date.now();
  emitStatus();
}

function mapBoolToLamp(
  val: boolean,
  type: "error" | "ready" | "generic"
): LampStatus {
  if (type === "error") return val ? "error" : "ok";
  if (type === "ready") return val ? "ok" : "warning";
  // generic = reine Info-Signale → Status immer OK
  return "ok";
}

function updateNode(name: string, val: any) {
  const def = WATCH_NODES.find((n) => n.name === name);
  if (!def) return;

  const status = mapBoolToLamp(Boolean(val), def.type);

  const existing = lastStatus.nodes.find((n) => n.name === name);
  if (existing) {
    existing.rawValue = val;
    existing.status = status;
  } else {
    lastStatus.nodes.push({
      id: def.nodeId,
      nodeId: def.nodeId,
      name,
      rawValue: val,
      status,
    });
  }
}

// Health-Check: wenn länger kein Update → „nicht verbunden"
function startHealthTimer(timeoutMs = 10_000, intervalMs = 3_000) {
  if (healthTimerStarted) return;
  healthTimerStarted = true;

  // Cleanup existing timer if any
  if (healthTimerId) {
    clearInterval(healthTimerId);
    healthTimerId = null;
  }

  healthTimerId = setInterval(() => {
    // wenn wir eh schon als disconnected markiert sind, nichts tun
    if (!lastStatus.connected) return;

    if (lastUpdateAt == null) return;

    const diff = Date.now() - lastUpdateAt;
    if (diff > timeoutMs) {
      console.warn(
        `[OPC-UA Watcher] Timeout (${diff}ms) – keine Antwort vom Drucker`
      );
      markDisconnected("OPC-UA Timeout – Drucker vermutlich nicht erreichbar");
    }
  }, intervalMs);
}

// Cleanup function for health timer
function stopHealthTimer() {
  if (healthTimerId) {
    clearInterval(healthTimerId);
    healthTimerId = null;
  }
  healthTimerStarted = false;
}

// ------------------------------------------------------------------
// Watcher starten (idempotent)
// ------------------------------------------------------------------
export async function startOpcUaWatcher(endpoint: string) {
  if (watcherStarted) return;
  watcherStarted = true;

  console.log("[OPC-UA Watcher] starting…", endpoint);

  // Health-Check-Timer früh starten
  startHealthTimer();

  // Hilfsfunktion: macht OPC-UA Werte "frontend-freundlich"
  function normalizeValue(raw: any): any {
    if (raw && typeof raw === "object") {
      // typischer LocalizedText: { text: "Fehler", locale: "de-DE" }
      if ("text" in raw && typeof (raw as any).text === "string") {
        return (raw as any).text;
      }

      // Fallback: andere Objekte wenigstens als JSON anzeigen
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return raw;
  }

  try {
    client = OPCUAClient.create({
      endpointMustExist: false,
      securityMode: MessageSecurityMode.Sign,
      securityPolicy: SecurityPolicy.Basic256Sha256,
      applicationName: "printer-ui",
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 3,
      },
    });

    // optional: Events vom Client nutzen (falls die in deinem Setup feuern)
    client.on("close", () => {
      console.warn("[OPC-UA Watcher] client connection closed");
      markDisconnected("OPC-UA Verbindung geschlossen");
    });

    client.on("backoff", (retry: number, delay: number) => {
      console.warn(
        `[OPC-UA Watcher] backoff – Versuch ${retry}, nächste in ${delay}ms`
      );
      // markDisconnect, aber Health-Checker fängt das sowieso ab
      markDisconnected(`Reconnecting (Versuch ${retry})…`);
    });

    await client.connect(endpoint);
    session = await client.createSession();
    console.log("[OPC-UA Watcher] session established");

    lastStatus.endpoint = endpoint;

    // 1) Initial Read aller Nodes
    const dataValues = await session.read(
      WATCH_NODES.map((n) => ({
        nodeId: n.nodeId,
        attributeId: AttributeIds.Value,
      })),
      0
    );

    dataValues.forEach((dv, idx) => {
      const def = WATCH_NODES[idx];
      const raw = dv.value?.value;
      const value = normalizeValue(raw);
      updateNode(def.name, value);
    });

    // Initiales Lebenszeichen
    markAlive();

    // 2) Subscription für Realtime-Updates
    subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: 250,
      requestedLifetimeCount: 120,
      requestedMaxKeepAliveCount: 20,
      maxNotificationsPerPublish: 20,
      publishingEnabled: true,
      priority: 10,
    });

    subscription.on("keepalive", () => {
      // keepalive = Verbindung ok
      // Kein Node-Wert geändert, aber Lebenszeichen:
      lastUpdateAt = Date.now();
      lastStatus.connected = true;
      lastStatus.error = undefined;
      emitStatus();
    });

    subscription.on("terminated", () => {
      console.log("[OPC-UA Watcher] subscription terminated");
      markDisconnected("Subscription beendet");
    });

    for (const node of WATCH_NODES) {
      const monitoredItem = ClientMonitoredItem.create(
        subscription,
        {
          nodeId: node.nodeId,
          attributeId: AttributeIds.Value,
        },
        {
          samplingInterval: 200,
          discardOldest: true,
          queueSize: 5,
        },
        TimestampsToReturn.Neither
      );

      monitoredItem.on("changed", (dataValue) => {
        const raw = dataValue.value?.value;
        const value = normalizeValue(raw);

        updateNode(node.name, value);
        // Node-Update = klares Lebenszeichen
        markAlive();
      });
    }
  } catch (e: any) {
    console.error("[OPC-UA Watcher] ERROR:", e);
    markDisconnected(e?.message || String(e));
  }
}

// ------------------------------------------------------------------
// Getter + Subscription für SSE
// ------------------------------------------------------------------
export function getCurrentStatus(): PrinterStatus {
  return { ...lastStatus, nodes: [...lastStatus.nodes] };
}

export function subscribeToStatus(
  listener: (status: PrinterStatus) => void
): () => void {
  statusEmitter.on("update", listener);
  // sofort initialen Status schicken
  listener(getCurrentStatus());
  return () => {
    statusEmitter.off("update", listener);
  };
}
