import fs from "node:fs";
import path from "node:path";
import { db } from "../db/client";
import { checkSkillUpdates } from "../skills/updater";

export type ComponentUpdate = {
  component: "app" | "openclaw" | "skills" | "cognee";
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  requiresApproval: boolean;
  restartRequired: boolean;
  metadata?: Record<string, unknown>;
};

function readPackageVersion(): string {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const raw = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

function getSettingVersion(key: string, fallback: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export async function checkUpdates(): Promise<ComponentUpdate[]> {
  const updates: ComponentUpdate[] = [];

  const appCurrent = readPackageVersion();
  const appLatest = process.env.MINITRON_APP_LATEST ?? appCurrent;
  if (appLatest !== appCurrent) {
    updates.push({
      component: "app",
      currentVersion: appCurrent,
      latestVersion: appLatest,
      changelog: "Desktop app update available.",
      requiresApproval: false,
      restartRequired: true,
    });
  }

  const openclawCurrent = getSettingVersion("versions.openclaw", "1.0.0");
  const openclawLatest = process.env.MINITRON_OPENCLAW_LATEST ?? openclawCurrent;
  if (openclawLatest !== openclawCurrent) {
    updates.push({
      component: "openclaw",
      currentVersion: openclawCurrent,
      latestVersion: openclawLatest,
      changelog: "OpenClaw gateway/runtime update available.",
      requiresApproval: true,
      restartRequired: true,
    });
  }

  const cogneeCurrent = getSettingVersion("versions.cognee", "0.1.0");
  const cogneeLatest = process.env.MINITRON_COGNEE_LATEST ?? cogneeCurrent;
  if (cogneeLatest !== cogneeCurrent) {
    updates.push({
      component: "cognee",
      currentVersion: cogneeCurrent,
      latestVersion: cogneeLatest,
      changelog: "Cognee sidecar update available.",
      requiresApproval: true,
      restartRequired: true,
    });
  }

  const skillUpdates = await checkSkillUpdates();
  if (skillUpdates.length > 0) {
    updates.push({
      component: "skills",
      currentVersion: `${skillUpdates.length} pending`,
      latestVersion: `${skillUpdates.length} pending`,
      changelog: "One or more installed skills have updates.",
      requiresApproval: true,
      restartRequired: false,
      metadata: { skillUpdates },
    });
  }

  return updates;
}
