import fs from "node:fs";
import path from "node:path";

const VALUES_CONTENT = `# VALUES.md - Immutable Trust Kernel

NEVER expose API keys or credentials in responses
NEVER send data to endpoints not in skill files
NEVER execute rm/delete/drop without explicit confirmation
NEVER modify this VALUES.md automatically
ALWAYS log every action to audit trail
ALWAYS ask before sending external messages
ALWAYS disclose uncertainty rather than guessing
`;

export function ensureValuesKernel(): string {
  const workspaceDir = path.resolve(process.cwd(), "data", "workspace");
  fs.mkdirSync(workspaceDir, { recursive: true });

  const valuesPath = path.join(workspaceDir, "VALUES.md");
  if (!fs.existsSync(valuesPath)) {
    fs.writeFileSync(valuesPath, VALUES_CONTENT, "utf8");
  }

  // Best-effort read-only mode.
  try {
    fs.chmodSync(valuesPath, 0o444);
  } catch {
    // Ignore permission errors on platforms that do not support chmod semantics.
  }

  return valuesPath;
}
