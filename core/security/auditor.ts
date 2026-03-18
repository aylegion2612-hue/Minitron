import crypto from "node:crypto";
import { db } from "../db/client";

type AuditRecord = {
  action: string;
  actor: string;
  metadata?: Record<string, unknown>;
};

export function writeAuditLog(record: AuditRecord): void {
  const stmt = db.prepare(`
    INSERT INTO audit_log (id, action, actor, metadata)
    VALUES (@id, @action, @actor, @metadata)
  `);

  stmt.run({
    id: crypto.randomUUID(),
    action: record.action,
    actor: record.actor,
    metadata: record.metadata ? JSON.stringify(record.metadata) : null,
  });
}
