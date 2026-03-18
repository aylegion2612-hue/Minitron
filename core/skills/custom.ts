import fs from "node:fs";
import path from "node:path";
import { auditSkillContent, assertNotSymlink } from "./auditor";
import type { RegistrySkill } from "./types";

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
}

export function discoverCustomSkills(): { skills: RegistrySkill[]; findings: Record<string, string[]> } {
  const workspaceRoot = path.resolve(process.cwd(), "data", "workspace");
  const candidates: string[] = [];
  walk(path.join(workspaceRoot, "skills"), candidates);
  walk(path.join(workspaceRoot, "agents"), candidates);

  const skills: RegistrySkill[] = [];
  const findings: Record<string, string[]> = {};

  for (const filePath of candidates) {
    const linkAudit = assertNotSymlink(filePath);
    const content = fs.readFileSync(filePath, "utf8");
    const contentAudit = auditSkillContent(content);
    const issues = [...linkAudit.findings, ...contentAudit.findings];
    if (issues.length > 0) {
      findings[filePath] = issues;
    }

    const base = path.basename(filePath, path.extname(filePath));
    const slug = `custom/${base.toLowerCase().replace(/[^a-z0-9\-]+/g, "-")}`;
    skills.push({
      slug,
      name: base,
      category: "custom",
      description: `Custom SKILL.md from ${filePath}`,
      version: "local",
      sourceUrl: filePath,
      changelog: issues.length > 0 ? `Audit findings: ${issues.join(", ")}` : "No findings",
    });
  }

  return { skills, findings };
}
