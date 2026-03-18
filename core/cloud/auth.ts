import crypto from "node:crypto";
import { db } from "../db/client";

type AuthSession = {
  email: string;
  uid: string;
};

function getOrCreateDeviceSalt(): string {
  const existing = db
    .prepare("SELECT value FROM settings WHERE key = 'cloud.device_salt'")
    .get() as { value: string } | undefined;

  if (existing?.value) {
    return existing.value;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('cloud.device_salt', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(salt);
  return salt;
}

export async function signInWithGoogle(email: string): Promise<AuthSession> {
  const normalized = email.trim().toLowerCase();
  const uid = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);

  const deviceSalt = getOrCreateDeviceSalt();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('cloud.last_uid', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(uid);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('cloud.last_email', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(normalized);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('cloud.last_device_salt', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(deviceSalt);

  return { email: normalized, uid };
}
