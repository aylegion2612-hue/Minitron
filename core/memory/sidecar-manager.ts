import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { isCogneeAvailable } from "./cognee-client";

let sidecar: ChildProcess | null = null;
let monitorTimer: NodeJS.Timeout | null = null;
let lastStartAt: string | null = null;
let restartCount = 0;

function spawnSidecar(): void {
  const sidecarScript = path.resolve(process.cwd(), "sidecars", "cognee", "run.py");
  const pythonCmd = process.env.COGNEE_PYTHON_CMD ?? "python";
  sidecar = spawn(pythonCmd, [sidecarScript], {
    stdio: "ignore",
    shell: false,
    detached: false,
  });
  lastStartAt = new Date().toISOString();
  sidecar.on("exit", () => {
    sidecar = null;
  });
}

export async function ensureCogneeSidecar(): Promise<void> {
  const available = await isCogneeAvailable();
  if (!available && !sidecar) {
    try {
      spawnSidecar();
    } catch {
      // Ignore start failures; higher layers degrade to SQLite.
    }
  }

  if (!monitorTimer) {
    monitorTimer = setInterval(async () => {
      const alive = await isCogneeAvailable();
      if (!alive) {
        try {
          spawnSidecar();
          restartCount += 1;
        } catch {
          // Continue graceful degradation.
        }
      }
    }, 30_000);
  }
}

export function getSidecarStatus(): {
  running: boolean;
  pid: number | null;
  lastStartAt: string | null;
  restartCount: number;
} {
  return {
    running: Boolean(sidecar && !sidecar.killed),
    pid: sidecar?.pid ?? null,
    lastStartAt,
    restartCount,
  };
}
