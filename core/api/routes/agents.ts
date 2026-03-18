import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "../../db/client";
import { writeAuditLog } from "../../security/auditor";

const router = Router();
const runSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  personality: z.string().min(1),
  tools: z.array(z.string()).default([]),
  model: z.string().min(1),
  channel: z.string().min(1),
  sandboxLevel: z.enum(["standard", "strict", "open"]).default("standard"),
  templateKey: z.string().optional(),
});

const templates = [
  {
    key: "personal_assistant",
    name: "Personal Assistant",
    role: "General personal helper",
    personality: "Helpful, calm, organized",
    tools: ["calendar", "notes", "email"],
    model: "google/gemini-2.0-flash",
    channel: "telegram",
    sandboxLevel: "standard",
  },
  {
    key: "sales_bot",
    name: "Sales Bot",
    role: "Handle sales inquiries",
    personality: "Concise, persuasive, friendly",
    tools: ["crm", "calendar", "stripe", "email"],
    model: "google/gemini-2.0-flash",
    channel: "telegram",
    sandboxLevel: "standard",
  },
  {
    key: "support_bot",
    name: "Support Bot",
    role: "Resolve support questions",
    personality: "Empathetic, accurate, patient",
    tools: ["faq", "ticketing", "email"],
    model: "google/gemini-2.0-flash",
    channel: "whatsapp",
    sandboxLevel: "standard",
  },
  {
    key: "research_bot",
    name: "Research Bot",
    role: "Perform research and briefings",
    personality: "Analytical, structured",
    tools: ["web-search", "browser", "summarizer"],
    model: "google/gemini-2.0-flash",
    channel: "discord",
    sandboxLevel: "strict",
  },
  {
    key: "dev_bot",
    name: "Dev Bot",
    role: "Assist with development workflow",
    personality: "Technical, direct",
    tools: ["github", "vercel", "docker"],
    model: "google/gemini-2.0-flash",
    channel: "slack",
    sandboxLevel: "strict",
  },
] as const;

router.get("/", (_req, res) => {
  const items = db
    .prepare(
      `SELECT id, name, role, personality, tools, model, channel, sandbox_level, template_key, status, created_at
       FROM agents
       ORDER BY created_at DESC`,
    )
    .all()
    .map((row) => {
      const typed = row as {
        id: string;
        name: string;
        role: string;
        personality: string;
        tools: string;
        model: string;
        channel: string;
        sandbox_level: string;
        template_key: string | null;
        status: string;
        created_at: string;
      };
      return {
        id: typed.id,
        name: typed.name,
        role: typed.role,
        personality: typed.personality,
        tools: JSON.parse(typed.tools) as string[],
        model: typed.model,
        channel: typed.channel,
        sandbox_level: typed.sandbox_level,
        template_key: typed.template_key,
        status: typed.status,
        created_at: typed.created_at,
      };
    });
  res.json({ items, templates });
});

router.post("/run", (req, res) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const data = parsed.data;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO agents
      (id, name, role, personality, tools, model, channel, sandbox_level, template_key, status)
     VALUES
      (@id, @name, @role, @personality, @tools, @model, @channel, @sandbox_level, @template_key, 'running')`,
  ).run({
    id,
    name: data.name,
    role: data.role,
    personality: data.personality,
    tools: JSON.stringify(data.tools),
    model: data.model,
    channel: data.channel,
    sandbox_level: data.sandboxLevel,
    template_key: data.templateKey ?? null,
  });

  writeAuditLog({
    action: "agent.run",
    actor: "local-user",
    metadata: { id, name: data.name, channel: data.channel, template: data.templateKey ?? null },
  });

  return res.status(201).json({ id, status: "running" });
});

router.delete("/:id", (req, res) => {
  const result = db
    .prepare("UPDATE agents SET status = 'terminated' WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Agent not found." });
  }

  writeAuditLog({
    action: "agent.terminated",
    actor: "local-user",
    metadata: { id: req.params.id },
  });

  return res.status(204).send();
});

export { router as agentsRouter };
