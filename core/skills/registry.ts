import fs from "node:fs";
import path from "node:path";
import type { RegistrySkill } from "./types";

const registryPath = path.resolve(process.cwd(), "core", "skills", "registry.json");

type RegistryFile = {
  skills: RegistrySkill[];
};

export function loadRegistrySkills(): RegistrySkill[] {
  const raw = fs.readFileSync(registryPath, "utf8");
  const parsed = JSON.parse(raw) as RegistryFile;
  return parsed.skills ?? [];
}
