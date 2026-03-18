import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client";
import { encryptSecret } from "../../security/secrets";
import { writeAuditLog } from "../../security/auditor";
import { writeOpenClawConfig } from "../../openclaw/config";

const router = Router();
const updateSchema = z.object({
  language: z.enum(["en", "hi", "ur", "ar", "es"]).optional(),
  primaryModel: z.string().min(1).optional(),
  fastModel: z.string().min(1).optional(),
  fallbackModel: z.string().min(1).optional(),
  tunnelProvider: z.enum(["localtunnel", "cloudflare", "ngrok", "none"]).optional(),
  apiKeys: z.record(z.string()).optional(),
});
const verifyKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(10),
});

router.get("/", (_req, res) => {
  const rows = db.prepare("SELECT key, value, updated_at FROM settings").all() as Array<{
    key: string;
    value: string;
    updated_at: string;
  }>;

  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  res.json({ settings });
});

router.post("/", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  try {
    const tx = db.transaction((payload: z.infer<typeof updateSchema>) => {
      for (const [key, value] of Object.entries(payload)) {
        if (key === "apiKeys") continue;
        if (typeof value === "undefined") continue;
        db.prepare(
          `INSERT INTO settings (key, value, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        ).run(`app.${key}`, String(value));
      }

      if (payload.apiKeys) {
        for (const [provider, apiKey] of Object.entries(payload.apiKeys)) {
          const encrypted = encryptSecret(apiKey);
          db.prepare(
            `INSERT INTO secrets (id, secret_name, secret_value, iv, auth_tag)
             VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
             ON CONFLICT(secret_name) DO UPDATE SET
              secret_value=excluded.secret_value, iv=excluded.iv, auth_tag=excluded.auth_tag`,
          ).run(`api.${provider}`, encrypted.cipherText, encrypted.iv, encrypted.authTag);
        }
      }
    });

    tx(parsed.data);

    const settingsRows = db.prepare("SELECT key, value FROM settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
    const workspacePath = process.env.MINITRON_WORKSPACE_PATH ?? "data/workspace";
    writeOpenClawConfig({
      agent: {
        model: settings["app.primaryModel"] ?? "gemini-2.0-flash",
        workspace: workspacePath,
      },
      channels: {
        tunnel: {
          provider: settings["app.tunnelProvider"] ?? "none",
        },
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to securely store settings." });
  }
  writeAuditLog({
    action: "settings.updated",
    actor: "local-user",
    metadata: { keys: Object.keys(parsed.data) },
  });

  return res.json({ ok: true });
});

router.post("/verify-api-key", (req, res) => {
  const parsed = verifyKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const key = parsed.data.apiKey.trim();
  const looksValid = key.length >= 20 && /[A-Za-z0-9]/.test(key);
  if (!looksValid) {
    return res.status(400).json({ ok: false, error: "API key validation failed." });
  }
  return res.json({ ok: true, provider: parsed.data.provider });
});

router.get("/tunnel-command", (req, res) => {
  const provider = typeof req.query.provider === "string" ? req.query.provider : "localtunnel";
  const port = typeof req.query.port === "string" ? req.query.port : "4317";
  const commands: Record<string, string> = {
    localtunnel: `npx localtunnel --port ${port}`,
    cloudflare: `cloudflared tunnel --url http://127.0.0.1:${port}`,
    ngrok: `ngrok http ${port}`,
  };
  const command = commands[provider] ?? commands.localtunnel;
  return res.json({ provider, command });
});

export { router as settingsRouter };
