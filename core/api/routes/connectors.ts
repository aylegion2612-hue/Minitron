import { Router } from "express";
import { z } from "zod";
import { listConnectors, supportedConnectors, upsertConnectorState } from "../../connectors/manager";
import { writeAuditLog } from "../../security/auditor";

const router = Router();
const connectSchema = z.object({
  id: z.enum(["notion", "github", "gdrive", "stripe", "hubspot"]),
});
const configureChannelSchema = z.object({
  channelToken: z.string().min(1),
  allowFrom: z.array(z.string()).default([]),
});

router.get("/", (_req, res) => {
  res.json({ items: listConnectors() });
});

router.post("/", (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  upsertConnectorState(parsed.data.id, {
    status: "connected",
    accessToken: `token-${parsed.data.id}`,
    refreshToken: `refresh-${parsed.data.id}`,
    expiresAt,
    lastError: null,
  });

  writeAuditLog({
    action: "connector.connected",
    actor: "local-user",
    metadata: { id: parsed.data.id, expiresAt },
  });
  return res.status(201).json({ id: parsed.data.id, status: "connected", expiresAt });
});

router.post("/:id/refresh", (req, res) => {
  const id = req.params.id;
  if (!supportedConnectors.includes(id as (typeof supportedConnectors)[number])) {
    return res.status(404).json({ error: "Connector not found." });
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  upsertConnectorState(id, {
    status: "connected",
    expiresAt,
    lastError: null,
  });

  writeAuditLog({
    action: "connector.refreshed",
    actor: "local-user",
    metadata: { id, expiresAt },
  });
  return res.json({ id, status: "connected", expiresAt });
});

router.post("/:id/channel", (req, res) => {
  const id = req.params.id;
  if (!supportedConnectors.includes(id as (typeof supportedConnectors)[number])) {
    return res.status(404).json({ error: "Connector not found." });
  }

  const parsed = configureChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  upsertConnectorState(id, {
    status: "connected",
    channelToken: parsed.data.channelToken,
    allowFrom: parsed.data.allowFrom,
    lastError: null,
  });

  writeAuditLog({
    action: "connector.channel_configured",
    actor: "local-user",
    metadata: { id, allowFrom: parsed.data.allowFrom },
  });
  return res.json({ id, ok: true });
});

router.post("/:id/test-message", (req, res) => {
  const id = req.params.id;
  if (!supportedConnectors.includes(id as (typeof supportedConnectors)[number])) {
    return res.status(404).json({ error: "Connector not found." });
  }

  upsertConnectorState(id, {
    status: "connected",
    lastTestAt: new Date().toISOString(),
    lastError: null,
  });
  writeAuditLog({
    action: "connector.test_message",
    actor: "local-user",
    metadata: { id, result: "ok" },
  });
  return res.json({ ok: true, message: "Test message sent." });
});

export { router as connectorsRouter };
