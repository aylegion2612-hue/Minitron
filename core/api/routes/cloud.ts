import { Router } from "express";
import { z } from "zod";
import { signInWithGoogle } from "../../cloud/auth";
import { restoreEncryptedBlob, syncEncryptedBlob } from "../../cloud/sync";
import { writeAuditLog } from "../../security/auditor";

const router = Router();
const authSchema = z.object({
  email: z.string().email(),
});

router.post("/sync", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const auth = await signInWithGoogle(parsed.data.email);
  const result = await syncEncryptedBlob(auth.uid);
  writeAuditLog({
    action: "cloud.sync",
    actor: "local-user",
    metadata: { uid: auth.uid, updatedAt: result.updatedAt },
  });
  return res.json({ ok: true, uid: auth.uid, updatedAt: result.updatedAt });
});

router.post("/restore", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const auth = await signInWithGoogle(parsed.data.email);
  const result = await restoreEncryptedBlob(auth.uid);
  if (!result.restored) {
    return res.status(404).json({ error: "No cloud backup found for this account." });
  }
  writeAuditLog({
    action: "cloud.restore",
    actor: "local-user",
    metadata: { uid: auth.uid, updatedAt: result.updatedAt ?? null },
  });
  return res.json({ ok: true, uid: auth.uid, updatedAt: result.updatedAt ?? null });
});

router.post("/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  const auth = await signInWithGoogle(parsed.data.email);
  return res.json({ ok: true, uid: auth.uid, email: auth.email });
});

export { router as cloudRouter };
