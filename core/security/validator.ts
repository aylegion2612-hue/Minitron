import path from "node:path";
import { hasPromptInjection } from "./injection";
import { isSenderAllowed } from "./allowlist";

export type ValidationInput = {
  content: string;
  sender: string;
  allowFrom: string[];
  workspacePath?: string;
  requestedTool?: string;
  allowedTools?: string[];
};

export function validateRequest(input: ValidationInput): { ok: true } | { ok: false; reason: string } {
  if (!isSenderAllowed(input.sender, input.allowFrom)) {
    return { ok: false, reason: "Sender not in allowlist." };
  }

  if (hasPromptInjection(input.content)) {
    return { ok: false, reason: "Prompt injection pattern detected." };
  }

  if (input.workspacePath) {
    const root = path.resolve(process.cwd(), "data", "workspace");
    const resolved = path.resolve(input.workspacePath);
    if (!resolved.startsWith(root)) {
      return { ok: false, reason: "Workspace path escapes allowed directory." };
    }
  }

  if (input.requestedTool && input.allowedTools && input.allowedTools.length > 0) {
    if (!input.allowedTools.includes(input.requestedTool)) {
      return { ok: false, reason: "Requested tool is not permitted for this session." };
    }
  }

  return { ok: true };
}

export function sanitizeOutput(output: string): string {
  return output
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/sk-[0-9A-Za-z]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9\-_\.=]{12,}/gi, "Bearer [REDACTED]");
}
