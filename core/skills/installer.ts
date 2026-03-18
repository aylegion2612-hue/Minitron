import { db } from "../db/client";
import { writeAuditLog } from "../security/auditor";
import { auditSkillContent } from "./auditor";
import { discoverCustomSkills } from "./custom";
import { loadRegistrySkills } from "./registry";

export async function installSkill(slug: string): Promise<{ ok: boolean; reason?: string }> {
  const registry = loadRegistrySkills();
  const custom = discoverCustomSkills().skills;
  const candidate = [...registry, ...custom].find((skill) => skill.slug === slug);

  if (!candidate) {
    return { ok: false, reason: "Skill not found." };
  }

  const audit = auditSkillContent(
    `${candidate.name}\n${candidate.description}\n${candidate.sourceUrl}\n${candidate.changelog ?? ""}`,
  );
  if (!audit.safe) {
    writeAuditLog({
      action: "skill.install_blocked",
      actor: "local-user",
      metadata: { slug, findings: audit.findings },
    });
    return { ok: false, reason: `Skill audit failed: ${audit.findings.join(", ")}` };
  }

  db.prepare(
    `INSERT INTO installed_skills (slug, name, version, source, enabled, updated_at)
     VALUES (@slug, @name, @version, @source, 1, datetime('now'))
     ON CONFLICT(slug) DO UPDATE SET
       name=excluded.name,
       version=excluded.version,
       source=excluded.source,
       enabled=1,
       updated_at=datetime('now')`,
  ).run({
    slug: candidate.slug,
    name: candidate.name,
    version: candidate.version,
    source: candidate.category === "custom" ? "custom" : "registry",
  });

  writeAuditLog({
    action: "skill.installed",
    actor: "local-user",
    metadata: { slug: candidate.slug, version: candidate.version },
  });

  return { ok: true };
}
