import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { evaluateRules } from "../../rules/engine";
import { sanitizeOutput, validateRequest } from "../../security/validator";
import { writeAuditLog } from "../../security/auditor";
import { OpenClawGateway } from "../../openclaw/gateway";
import { db } from "../../db/client";
import { resolveSandbox } from "../../security/sandbox";

const chatSchema = z.object({
  sessionId: z.string().min(1),
  sender: z.string().min(1).default("local-user"),
  message: z.string().min(1),
  confirmedRuleIds: z.array(z.string()).optional(),
  requestedTool: z.string().optional(),
  sandboxLevel: z.enum(["standard", "strict", "open"]).optional(),
});
const createSessionSchema = z.object({
  title: z.string().min(1).max(120),
});
const updateSessionSchema = z.object({
  title: z.string().min(1).max(120),
});

const router = Router();
const gateway = new OpenClawGateway();
const allowFrom = (process.env.MINITRON_ALLOW_FROM ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowedTools = (process.env.MINITRON_ALLOWED_TOOLS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

router.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { sessionId, sender, message, confirmedRuleIds, requestedTool, sandboxLevel } = parsed.data;
  const content = message;
  const validation = validateRequest({
    content,
    sender,
    allowFrom,
    requestedTool,
    allowedTools,
  });
  if (!validation.ok) {
    writeAuditLog({ action: "chat.rejected", actor: sender, metadata: { reason: validation.reason } });
    return res.status(403).json({ error: validation.reason });
  }

  const ruleDecision = evaluateRules({ content, confirmedRuleIds });
  if (ruleDecision.blocked) {
    writeAuditLog({
      action: "chat.blocked",
      actor: sender,
      metadata: { reasons: ruleDecision.reasons },
    });
    return res.status(403).json({ error: "Blocked by rules engine.", reasons: ruleDecision.reasons });
  }

  if (ruleDecision.requiresConfirmation) {
    writeAuditLog({
      action: "chat.confirmation_required",
      actor: sender,
      metadata: { reasons: ruleDecision.reasons },
    });
    return res.status(409).json({
      error: "Confirmation required.",
      reasons: ruleDecision.reasons,
      confirmRuleIds: ruleDecision.matchedRuleIds,
    });
  }

  const insertMessage = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, cost_usd)
    VALUES (@id, @session_id, @role, @content, @model, @cost_usd)
  `);
  const upsertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions (id, title)
    VALUES (@id, @title)
  `);

  const inferredTitle = content.trim().slice(0, 48) || "Untitled Session";
  upsertSession.run({ id: sessionId, title: inferredTitle });
  const sandbox = resolveSandbox(sandboxLevel);
  writeAuditLog({
    action: "chat.sandbox_policy",
    actor: sender,
    metadata: { sessionId, level: sandbox.level, flags: sandbox.flags },
  });

  insertMessage.run({
    id: crypto.randomUUID(),
    session_id: sessionId,
    role: "user",
    content,
    model: "user",
    cost_usd: 0,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  let clientClosed = false;
  const onClose = () => {
    clientClosed = true;
    writeAuditLog({
      action: "chat.client_disconnected",
      actor: sender,
      metadata: { sessionId },
    });
  };
  res.on("close", onClose);

  let assistantContent = "";
  for await (const chunk of gateway.sendMessageStream(sessionId, content)) {
    if (clientClosed) {
      break;
    }
    if (chunk.text) {
      const safeText = sanitizeOutput(chunk.text);
      assistantContent += safeText;
      res.write(`data: ${JSON.stringify({ type: "chunk", text: safeText })}\n\n`);
    }
    if (chunk.done) {
      break;
    }
  }

  insertMessage.run({
    id: crypto.randomUUID(),
    session_id: sessionId,
    role: "assistant",
    content: assistantContent.trim(),
    model: "google/gemini-2.0-flash",
    cost_usd: 0,
  });

  writeAuditLog({
    action: "chat.completed",
    actor: sender,
    metadata: { sessionId, gateway: gateway.getEndpoint() },
  });

  res.off("close", onClose);
  if (clientClosed) {
    return;
  }
  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
});

router.get("/sessions", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, created_at,
              (SELECT MAX(created_at) FROM messages WHERE messages.session_id = sessions.id) AS last_message_at
       FROM sessions
       ORDER BY COALESCE(last_message_at, created_at) DESC
       LIMIT 100`,
    )
    .all();
  res.json({ items: rows });
});

router.post("/sessions", (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const id = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (id, title) VALUES (?, ?)").run(id, parsed.data.title.trim());
  return res.status(201).json({ id, title: parsed.data.title.trim() });
});

router.patch("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const result = db
    .prepare("UPDATE sessions SET title = ? WHERE id = ?")
    .run(parsed.data.title.trim(), sessionId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Session not found." });
  }

  return res.json({ id: sessionId, title: parsed.data.title.trim() });
});

router.delete("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  const tx = db.transaction((id: string) => {
    db.prepare("DELETE FROM messages WHERE session_id = ?").run(id);
    return db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  });
  const result = tx(sessionId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Session not found." });
  }

  return res.status(204).send();
});

router.get("/history", (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const rows = db
    .prepare(
      `SELECT id, role, content, model, cost_usd, created_at
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC`,
    )
    .all(sessionId);

  return res.json({ items: rows });
});

export { router as chatRouter };
