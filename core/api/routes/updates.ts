import { Router } from "express";
import { z } from "zod";
import { applyUpdate } from "../../updates/applier";
import { checkUpdates } from "../../updates/checker";

const router = Router();
const applySchema = z.object({
  component: z.enum(["app", "openclaw", "skills", "cognee"]),
  approved: z.boolean().default(false),
});

router.get("/check", async (_req, res) => {
  const pending = await checkUpdates();
  res.json({ pending, badgeCount: pending.length });
});

router.post("/apply", async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const result = await applyUpdate(parsed.data.component, parsed.data.approved);
  if (!result.ok) {
    return res.status(400).json({ error: result.message });
  }
  return res.json({ ok: true, message: result.message });
});

export { router as updatesRouter };
