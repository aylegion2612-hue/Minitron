import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db/client";

type CloudBlob = {
  iv: string;
  authTag: string;
  cipherText: string;
  updatedAt: string;
};

type CloudStore = Record<string, CloudBlob>;

function getCloudStorePath(): string {
  const dir = path.resolve(process.cwd(), "data", "cloud");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "firestore.json");
}

function readCloudStore(): CloudStore {
  const filePath = getCloudStorePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as CloudStore;
}

function writeCloudStore(store: CloudStore): void {
  fs.writeFileSync(getCloudStorePath(), JSON.stringify(store, null, 2), "utf8");
}

function getDeviceSalt(): string {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'cloud.device_salt'")
    .get() as { value: string } | undefined;
  return row?.value ?? "";
}

function deriveKey(uid: string): Buffer {
  const salt = getDeviceSalt();
  return crypto.createHash("sha256").update(`${uid}:${salt}`).digest();
}

function encryptBlob(uid: string, plainText: string): Omit<CloudBlob, "updatedAt"> {
  const key = deriveKey(uid);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    cipherText: cipherText.toString("base64"),
  };
}

function decryptBlob(uid: string, blob: CloudBlob): string {
  const key = deriveKey(uid);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function collectSyncPayload(): {
  settings: unknown[];
  rules: unknown[];
  connectors: unknown[];
  secrets: unknown[];
} {
  const settings = db
    .prepare("SELECT key, value, updated_at FROM settings WHERE key NOT LIKE 'cloud.%'")
    .all();
  const rules = db
    .prepare("SELECT id, name, rule_type, scope, value, enabled, created_at FROM rules")
    .all();
  const connectors = db
    .prepare(
      `SELECT id, status, access_token, refresh_token, expires_at, channel_token, allow_from, updated_at
       FROM connectors`,
    )
    .all();
  const secrets = db
    .prepare("SELECT secret_name, secret_value, iv, auth_tag, created_at FROM secrets")
    .all();
  return { settings, rules, connectors, secrets };
}

export async function syncEncryptedBlob(uid: string): Promise<{ updatedAt: string }> {
  const payload = JSON.stringify(collectSyncPayload());
  const encrypted = encryptBlob(uid, payload);
  const updatedAt = new Date().toISOString();

  const store = readCloudStore();
  store[uid] = { ...encrypted, updatedAt };
  writeCloudStore(store);

  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('cloud.last_sync_at', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(updatedAt);

  return { updatedAt };
}

export async function restoreEncryptedBlob(uid: string): Promise<{ restored: boolean; updatedAt?: string }> {
  const store = readCloudStore();
  const blob = store[uid];
  if (!blob) {
    return { restored: false };
  }

  const parsed = JSON.parse(decryptBlob(uid, blob)) as {
    settings?: Array<{ key: string; value: string }>;
    rules?: Array<{ id: string; name: string; rule_type: string; scope: string; value: string; enabled: number }>;
    connectors?: Array<{
      id: string;
      status: string;
      access_token: string | null;
      refresh_token: string | null;
      expires_at: string | null;
      channel_token: string | null;
      allow_from: string | null;
    }>;
    secrets?: Array<{
      secret_name: string;
      secret_value: string;
      iv: string;
      auth_tag: string;
    }>;
  };

  const tx = db.transaction(() => {
    for (const setting of parsed.settings ?? []) {
      db.prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      ).run(setting.key, setting.value);
    }

    for (const rule of parsed.rules ?? []) {
      db.prepare(
        `INSERT INTO rules (id, name, rule_type, scope, value, enabled)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, rule_type=excluded.rule_type, scope=excluded.scope, value=excluded.value, enabled=excluded.enabled`,
      ).run(rule.id, rule.name, rule.rule_type, rule.scope, rule.value, rule.enabled);
    }

    for (const connector of parsed.connectors ?? []) {
      db.prepare(
        `INSERT INTO connectors
          (id, status, access_token, refresh_token, expires_at, channel_token, allow_from, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
          status=excluded.status,
          access_token=excluded.access_token,
          refresh_token=excluded.refresh_token,
          expires_at=excluded.expires_at,
          channel_token=excluded.channel_token,
          allow_from=excluded.allow_from,
          updated_at=datetime('now')`,
      ).run(
        connector.id,
        connector.status,
        connector.access_token,
        connector.refresh_token,
        connector.expires_at,
        connector.channel_token,
        connector.allow_from,
      );
    }

    for (const secret of parsed.secrets ?? []) {
      db.prepare(
        `INSERT INTO secrets (id, secret_name, secret_value, iv, auth_tag)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
         ON CONFLICT(secret_name) DO UPDATE SET
          secret_value=excluded.secret_value, iv=excluded.iv, auth_tag=excluded.auth_tag`,
      ).run(secret.secret_name, secret.secret_value, secret.iv, secret.auth_tag);
    }
  });

  tx();
  return { restored: true, updatedAt: blob.updatedAt };
}
