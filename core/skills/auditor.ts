import fs from "node:fs";

type AuditResult = {
  safe: boolean;
  findings: string[];
};

const suspiciousPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "shell_exec", pattern: /\b(rm\s+-rf|powershell\s+-enc|curl\s+.*\|\s*sh)\b/i },
  { label: "network_exfil", pattern: /\b(fetch|axios|request)\s*\(/i },
  { label: "env_access", pattern: /\bprocess\.env\b/i },
];

export function auditSkillContent(content: string): AuditResult {
  const findings = suspiciousPatterns
    .filter((item) => item.pattern.test(content))
    .map((item) => item.label);
  return { safe: findings.length === 0, findings };
}

export function assertNotSymlink(filePath: string): AuditResult {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) {
    return { safe: false, findings: ["symlink_detected"] };
  }
  return { safe: true, findings: [] };
}
