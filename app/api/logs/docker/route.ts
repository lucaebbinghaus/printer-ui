import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runtime = "nodejs";

type DockerService = {
  name: string;
  status: string;
  health?: string;
  logs: string;
  error?: string;
};

async function getDockerLogs(containerName: string, lines: number = 100): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker logs --tail ${lines} ${containerName} 2>&1`,
      { timeout: 5000 }
    );
    return stdout;
  } catch (e: any) {
    return `Error fetching logs: ${e.message}`;
  }
}

async function getDockerStatus(containerName: string): Promise<{ status: string; health?: string }> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}|{{.State.Health.Status}}' ${containerName} 2>&1`,
      { timeout: 3000 }
    );
    const [status, health] = stdout.trim().split("|");
    return {
      status: status || "unknown",
      health: health && health !== "<no value>" ? health : undefined,
    };
  } catch (e: any) {
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
      
      services.push({
        name,
        status,
        health,
        logs,
      });
    } catch (e: any) {
      services.push({
        name,
        status: "error",
        logs: "",
        error: e.message,
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

