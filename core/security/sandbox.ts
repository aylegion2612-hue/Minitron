export type SandboxLevel = "standard" | "strict" | "open";

export function getSandboxFlags(level: SandboxLevel): string[] {
  if (level === "strict") {
    return ["--network", "none", "--memory", "512m", "--read-only"];
  }
  if (level === "open") {
    return [];
  }
  return ["--memory", "1g"];
}

export function resolveSandbox(level?: string): { level: SandboxLevel; flags: string[] } {
  const normalized: SandboxLevel =
    level === "strict" || level === "open" || level === "standard" ? level : "standard";
  return { level: normalized, flags: getSandboxFlags(normalized) };
}
