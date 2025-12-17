import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { createConnection } from "net";

export const runtime = "nodejs";

// Docker API endpoint (when socket is mounted)
const DOCKER_SOCKET = "/var/run/docker.sock";

// Helper to make HTTP request over Unix socket
function requestUnixSocket(path: string, method: string = "GET"): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(DOCKER_SOCKET);
    const request = `${method} ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`;

    let responseData = Buffer.alloc(0);
    let headersReceived = false;
    let statusCode = 0;

    socket.on("connect", () => {
      socket.write(request);
    });

    socket.on("data", (data: Buffer) => {
      responseData = Buffer.concat([responseData, data]);

      if (!headersReceived) {
        const responseText = responseData.toString();
        const headerEnd = responseText.indexOf("\r\n\r\n");

        if (headerEnd !== -1) {
          headersReceived = true;
          const headers = responseText.substring(0, headerEnd);
          const statusMatch = headers.match(/HTTP\/1\.\d+ (\d+)/);
          if (statusMatch) {
            statusCode = parseInt(statusMatch[1], 10);
          }
          // Remove headers from response data
          responseData = responseData.slice(headerEnd + 4);
        }
      }
    });

    socket.on("end", () => {
      resolve({ status: statusCode, body: responseData });
    });

    socket.on("error", (err) => {
      reject(err);
    });

    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

type DockerService = {
  name: string;
  status: string;
  health?: string;
  logs: string;
  error?: string;
};

async function checkDockerSocketAvailable(): Promise<boolean> {
  try {
    // Check if socket file exists
    return existsSync(DOCKER_SOCKET);
  } catch {
    return false;
  }
}

async function getDockerLogsViaAPI(containerName: string, lines: number = 100): Promise<string> {
  try {
    // Use Docker API via Unix socket
    // Docker API endpoint: GET /containers/{id}/logs
    const path = `/containers/${containerName}/logs?stdout=1&stderr=1&tail=${lines}`;
    const response = await requestUnixSocket(path, "GET");

    if (response.status !== 200) {
      throw new Error(`Docker API error: ${response.status}`);
    }

    // Docker logs are in a special format (8-byte header + log content)
    // Format: [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4] + payload
    let logText = "";
    let offset = 0;
    
    while (offset < response.body.length) {
      if (offset + 8 > response.body.length) break;
      
      const streamType = response.body[offset];
      const size = response.body.readUInt32BE(offset + 4);
      
      if (offset + 8 + size > response.body.length) break;
      
      const payload = response.body.slice(offset + 8, offset + 8 + size);
      logText += payload.toString("utf-8");
      
      offset += 8 + size;
    }
    
    return logText || "";
  } catch (e: any) {
    throw e;
  }
}

async function getDockerLogs(containerName: string, lines: number = 100): Promise<string> {
  try {
    // Check if Docker socket is available
    const socketAvailable = await checkDockerSocketAvailable();
    
    if (!socketAvailable) {
      return `[Hinweis] Docker Socket nicht verfügbar.\n\nDer Docker Socket muss in docker-compose.yml gemountet werden:\nvolumes:\n  - /var/run/docker.sock:/var/run/docker.sock\n\nNach dem Hinzufügen Container neu starten:\ndocker compose down\ndocker compose up -d`;
    }

    // Try to get logs via Docker API
    return await getDockerLogsViaAPI(containerName, lines);
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    
    if (errorMsg.includes("ENOENT") || errorMsg.includes("not found")) {
      return `[Hinweis] Docker Socket nicht verfügbar oder Container nicht gefunden.\n\nDer Docker Socket muss in docker-compose.yml gemountet werden:\nvolumes:\n  - /var/run/docker.sock:/var/run/docker.sock\n\nFehler: ${errorMsg}`;
    }
    
    return `[Fehler] Logs konnten nicht abgerufen werden:\n${errorMsg}`;
  }
}

async function getDockerStatusViaAPI(containerName: string): Promise<{ status: string; health?: string }> {
  try {
    // Use Docker API to inspect container
    const path = `/containers/${containerName}/json`;
    const response = await requestUnixSocket(path, "GET");

    if (response.status !== 200) {
      throw new Error(`Docker API error: ${response.status}`);
    }

    const containerInfo = JSON.parse(response.body.toString("utf-8"));
    const status = containerInfo.State?.Status || "unknown";
    const health = containerInfo.State?.Health?.Status;
    
    return {
      status,
      health: health && health !== "none" ? health : undefined,
    };
  } catch (e: any) {
    throw e;
  }
}

async function getDockerStatus(containerName: string): Promise<{ status: string; health?: string }> {
  try {
    const socketAvailable = await checkDockerSocketAvailable();
    
    if (!socketAvailable) {
      return { status: "unavailable" };
    }

    return await getDockerStatusViaAPI(containerName);
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    if (errorMsg.includes("ENOENT") || errorMsg.includes("not found") || errorMsg.includes("404")) {
      return { status: "unavailable" };
    }
    return { status: "unknown" };
  }
}

async function getDockerServices(): Promise<DockerService[]> {
  const services: DockerService[] = [];
  const containerNames = ["printer-ui", "zplbox"];

  for (const name of containerNames) {
    try {
      const { status, health } = await getDockerStatus(name);
      const logs = await getDockerLogs(name, 200);
      
      // Check if logs contain the "unavailable" message
      const isUnavailable = logs.includes("[Hinweis] Docker-Zugriff nicht verfügbar") || 
                           status === "unavailable";
      
      services.push({
        name,
        status: isUnavailable ? "unavailable" : status,
        health,
        logs,
        ...(isUnavailable ? { error: "Docker-Zugriff nicht verfügbar" } : {}),
      });
    } catch (e: any) {
      services.push({
        name,
        status: "error",
        logs: "",
        error: e.message || "Unbekannter Fehler",
      });
    }
  }

  return services;
}

export async function GET() {
  try {
    const services = await getDockerServices();
    
    // Check if all services are healthy
    const allHealthy = services.every(
      (s) => s.status === "running" && (!s.health || s.health === "healthy")
    );

    return NextResponse.json({
      ok: true,
      services,
      allHealthy,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to fetch docker logs",
        services: [],
        allHealthy: false,
      },
      { status: 500 }
    );
  }
}

