import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

let openClawProcess: ChildProcess | null = null;

function resolveOpenClawBin(): string {
  const vendorBinDir = path.resolve(process.cwd(), "vendor", "openclaw", "node_modules", ".bin");
  const binName = process.platform === "win32" ? "openclaw.cmd" : "openclaw";
  const vendorBin = path.join(vendorBinDir, binName);

  if (fs.existsSync(vendorBin)) {
    return vendorBin;
  }

  return "openclaw";
}

export async function startOpenClaw(): Promise<void> {
  if (process.env.MINITRON_OPENCLAW_LIVE !== "1") {
    return;
  }

  if (openClawProcess && !openClawProcess.killed) {
    return;
  }

  const binary = resolveOpenClawBin();
  const port = process.env.MINITRON_OPENCLAW_PORT ?? "18789";
  const args = ["gateway", "--port", port];

  openClawProcess = spawn(binary, args, {
    cwd: path.resolve(process.cwd(), "vendor", "openclaw"),
    stdio: "ignore",
    shell: process.platform === "win32",
    detached: false,
    env: {
      ...process.env,
    },
  });

  openClawProcess.on("exit", () => {
    openClawProcess = null;
  });
}

export async function stopOpenClaw(): Promise<void> {
  if (!openClawProcess || openClawProcess.killed) {
    return;
  }

  const processToStop = openClawProcess;
  openClawProcess = null;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (!processToStop.killed) {
        processToStop.kill();
      }
      resolve();
    }, 1_500);

    processToStop.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    processToStop.kill();
  });
}
