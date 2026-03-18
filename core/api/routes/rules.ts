import { Router } from "express";
import { z } from "zod";
import { parseNaturalLanguageRule } from "../../rules/parser";
import { createRule, listRules, updateRule } from "../../rules/store";
import { writeAuditLog } from "../../security/auditor";

const router = Router();

const createRuleSchema = z.object({
  name: z.string().min(1),
  input: z.string().min(1),
});
const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  input: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

router.get("/", (_req, res) => {
  res.json({ items: listRules() });
});

router.post("/", (req, res) => {
  const parsed = createRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const structured = parseNaturalLanguageRule(parsed.data.input);
  const id = createRule(parsed.data.name, structured);
  writeAuditLog({
    action: "rule.created",
    actor: "local-user",
    metadata: { id, name: parsed.data.name, structured },
  });
  return res.status(201).json({ id, structured });
});

router.patch("/:id", (req, res) => {
  const parsed = updateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const updateData = parsed.data;
  const structured = updateData.input ? parseNaturalLanguageRule(updateData.input) : null;
  const ok = updateRule(req.params.id, {
    name: updateData.name,
    ruleType: structured?.type,
    scope: structured?.scope,
    value: structured?.value,
    enabled: typeof updateData.enabled === "boolean" ? Number(updateData.enabled) : undefined,
  });

  if (!ok) {
    return res.status(404).json({ error: "Rule not found." });
  }

  writeAuditLog({
    action: "rule.updated",
    actor: "local-user",
    metadata: { id: req.params.id, updateData, structured },
  });

  return res.json({ ok: true });
});

export { router as rulesRouter };
