import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client";
import { writeAuditLog } from "../../security/auditor";
import { discoverCustomSkills } from "../../skills/custom";
import { installSkill } from "../../skills/installer";
import { loadRegistrySkills } from "../../skills/registry";
import { applySkillUpdate, checkSkillUpdates } from "../../skills/updater";

const router = Router();
const installSchema = z.object({
  slug: z.string().min(1),
});
const updateSchema = z.object({
  slug: z.string().min(1),
  approved: z.boolean().default(false),
});

router.get("/", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const registrySkills = loadRegistrySkills();
  const custom = discoverCustomSkills();
  const installed = db
    .prepare("SELECT slug, version, enabled FROM installed_skills")
    .all() as Array<{ slug: string; version: string; enabled: number }>;
  const updates = await checkSkillUpdates();

  const merged = [...registrySkills, ...custom.skills]
    .map((skill) => {
      const installedRow = installed.find((row) => row.slug === skill.slug);
      const update = updates.find((row) => row.slug === skill.slug);
      return {
        ...skill,
        installed: Boolean(installedRow),
        enabled: installedRow?.enabled ?? 0,
        installedVersion: installedRow?.version ?? null,
        updateAvailable: Boolean(update),
        updateTo: update?.nextVersion ?? null,
      };
    })
    .filter((item) => {
      if (!query) return true;
      return (
        item.slug.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    });

  res.json({ items: merged, customAuditFindings: custom.findings });
});

router.post("/install", async (req, res) => {
  const parsed = installSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const result = await installSkill(parsed.data.slug);
  if (!result.ok) {
    return res.status(400).json({ error: result.reason ?? "Install failed." });
  }

  writeAuditLog({
    action: "skill.install_requested",
    actor: "local-user",
    metadata: { slug: parsed.data.slug },
  });
  return res.status(201).json({ ok: true });
});

router.get("/updates", async (_req, res) => {
  const updates = await checkSkillUpdates();
  res.json({ items: updates });
});

router.post("/update", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const result = await applySkillUpdate(parsed.data.slug, parsed.data.approved);
  if (!result.ok) {
    return res.status(400).json({ error: result.reason ?? "Update failed." });
  }

  return res.json({ ok: true });
});

export { router as skillsRouter };
