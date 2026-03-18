export type RegistrySkill = {
  slug: string;
  name: string;
  category: string;
  description: string;
  version: string;
  sourceUrl: string;
  changelog?: string;
};

export type InstalledSkill = {
  slug: string;
  name: string;
  version: string;
  source: "registry" | "custom";
  enabled: number;
  installed_at: string;
  updated_at: string;
};
