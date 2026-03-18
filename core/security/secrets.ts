import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGO = "aes-256-gcm";
const IV_SIZE = 12;

function getMasterKey(): Buffer {
  const raw = process.env.MINITRON_SECRET_KEY;
  if (raw) {
    // Derive a fixed 32-byte key from arbitrary input material.
    return crypto.createHash("sha256").update(raw).digest();
  }

  // Local fallback key for development/runtime continuity.
  const keyDir = path.resolve(process.cwd(), "data");
  const keyFile = path.join(keyDir, "secret.key");
  fs.mkdirSync(keyDir, { recursive: true });
  if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString("base64"), "utf8");
  }
  const persisted = fs.readFileSync(keyFile, "utf8").trim();
  return crypto.createHash("sha256").update(persisted).digest();
}

export type EncryptedSecret = {
  cipherText: string;
  iv: string;
  authTag: string;
};

export function encryptSecret(plainText: string): EncryptedSecret {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_SIZE);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret): string {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
