import { getCogneeRuntimeStatus, isCogneeAvailable } from "./cognee-client";

let monitorTimer: NodeJS.Timeout | null = null;
let restartCount = 0;

export async function ensureCogneeSidecar(): Promise<void> {
  // Stdio MCP transport spawns the sidecar process lazily on first client connect.
  void isCogneeAvailable();

  if (!monitorTimer) {
    monitorTimer = setInterval(async () => {
      const alive = await isCogneeAvailable();
      if (!alive) {
        restartCount += 1;
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
  const runtime = getCogneeRuntimeStatus();
  return {
    running: runtime.connected,
    pid: runtime.pid,
    lastStartAt: runtime.connectedAt,
    restartCount,
  };
}
