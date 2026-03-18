import { db } from "../db/client";
import { writeAuditLog } from "../security/auditor";
import { loadRegistrySkills } from "./registry";

type SkillUpdate = {
  slug: string;
  currentVersion: string;
  nextVersion: string;
  changelog: string;
};

export async function checkSkillUpdates(): Promise<SkillUpdate[]> {
  const registry = loadRegistrySkills();
  const installed = db
    .prepare("SELECT slug, version FROM installed_skills WHERE source = 'registry'")
    .all() as Array<{ slug: string; version: string }>;

  const updates: SkillUpdate[] = [];
  for (const row of installed) {
    const target = registry.find((skill) => skill.slug === row.slug);
    if (!target) continue;
    if (target.version !== row.version) {
      updates.push({
        slug: row.slug,
        currentVersion: row.version,
        nextVersion: target.version,
        changelog: target.changelog ?? "No changelog available.",
      });
    }
  }
  return updates;
}

export async function applySkillUpdate(
  slug: string,
  approved: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  if (!approved) {
    return { ok: false, reason: "User approval required." };
  }

  const registry = loadRegistrySkills();
  const target = registry.find((skill) => skill.slug === slug);
  if (!target) {
    return { ok: false, reason: "Skill not found in registry." };
  }

  db.prepare("UPDATE installed_skills SET version = ?, updated_at = datetime('now') WHERE slug = ?").run(
    target.version,
    slug,
  );

  writeAuditLog({
    action: "skill.updated",
    actor: "local-user",
    metadata: { slug, version: target.version },
  });

  return { ok: true };
}
