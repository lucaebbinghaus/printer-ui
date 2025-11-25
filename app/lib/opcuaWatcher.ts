// app/lib/opcuaWatcher.ts
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

// ------------------------------------------------------------------
function emitStatus() {
  statusEmitter.emit("update", { ...lastStatus, nodes: [...lastStatus.nodes] });
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

// ------------------------------------------------------------------
// Watcher starten (idempotent)
// ------------------------------------------------------------------
export async function startOpcUaWatcher(endpoint: string) {
  if (watcherStarted) return;
  watcherStarted = true;

  console.log("[OPC-UA Watcher] starting…", endpoint);

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

    await client.connect(endpoint);
    session = await client.createSession();
    console.log("[OPC-UA Watcher] session established");

    lastStatus.connected = true;
    lastStatus.endpoint = endpoint;
    lastStatus.error = undefined;

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
      updateNode(def.name, raw);
    });

    emitStatus();

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
      lastStatus.connected = true;
      emitStatus();
    });

    subscription.on("terminated", () => {
      console.log("[OPC-UA Watcher] subscription terminated");
      lastStatus.connected = false;
      lastStatus.error = "Subscription beendet";
      emitStatus();
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
        updateNode(node.name, raw);
        lastStatus.connected = true;
        lastStatus.error = undefined;
        emitStatus();
      });
    }
  } catch (e: any) {
    console.error("[OPC-UA Watcher] ERROR:", e);
    lastStatus.connected = false;
    lastStatus.error = e?.message || String(e);
    emitStatus();
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
