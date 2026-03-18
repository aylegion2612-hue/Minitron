import { db } from "../db/client";
import { writeAuditLog } from "../security/auditor";
import { checkSkillUpdates, applySkillUpdate } from "../skills/updater";

type UpdateComponent = "app" | "openclaw" | "skills" | "cognee";

function setVersionSetting(key: string, version: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(key, version);
}

export async function applyUpdate(
  component: UpdateComponent,
  approved: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (!approved && component !== "app") {
    return { ok: false, message: "Approval required for this update." };
  }

  if (component === "app") {
    const latest = process.env.MINITRON_APP_LATEST ?? "0.1.0";
    setVersionSetting("versions.app", latest);
    writeAuditLog({
      action: "update.applied",
      actor: "local-user",
      metadata: { component, version: latest },
    });
    return { ok: true, message: "App update will apply on next restart." };
  }

  if (component === "openclaw") {
    const latest = process.env.MINITRON_OPENCLAW_LATEST ?? "1.0.0";
    setVersionSetting("versions.openclaw", latest);
    writeAuditLog({
      action: "update.applied",
      actor: "local-user",
      metadata: { component, version: latest },
    });
    return { ok: true, message: "OpenClaw update applied." };
  }

  if (component === "cognee") {
    const latest = process.env.MINITRON_COGNEE_LATEST ?? "0.1.0";
    setVersionSetting("versions.cognee", latest);
    writeAuditLog({
      action: "update.applied",
      actor: "local-user",
      metadata: { component, version: latest },
    });
    return { ok: true, message: "Cognee sidecar update applied." };
  }

  const pending = await checkSkillUpdates();
  for (const item of pending) {
    await applySkillUpdate(item.slug, true);
  }
  writeAuditLog({
    action: "update.applied",
    actor: "local-user",
    metadata: { component, updatedSkills: pending.map((item) => item.slug) },
  });
  return { ok: true, message: `Updated ${pending.length} skills.` };
}
