export type ConnectorStatus = "connected" | "expired" | "error" | "not_connected";

export type ConnectorState = {
  id: string;
  status: ConnectorStatus;
  expiresAt?: string | null;
  lastError?: string | null;
  allowFrom?: string[];
  channelToken?: string | null;
  updatedAt?: string;
};
import { db } from "../db/client";

export const supportedConnectors = ["notion", "github", "gdrive", "stripe", "hubspot"] as const;

export function listConnectors(): ConnectorState[] {
  const rows = db
    .prepare(
      `SELECT id, status, expires_at, last_error, allow_from, channel_token, updated_at
       FROM connectors`,
    )
    .all() as Array<{
    id: string;
    status: ConnectorStatus;
    expires_at: string | null;
    last_error: string | null;
    allow_from: string | null;
    channel_token: string | null;
    updated_at: string;
  }>;

  const existing = new Map(rows.map((row) => [row.id, row]));
  return supportedConnectors.map((id) => {
    const row = existing.get(id);
    if (!row) {
      return { id, status: "not_connected" };
    }
    return {
      id: row.id,
      status: row.status,
      expiresAt: row.expires_at,
      lastError: row.last_error,
      allowFrom: row.allow_from ? row.allow_from.split(",").map((item) => item.trim()).filter(Boolean) : [],
      channelToken: row.channel_token,
      updatedAt: row.updated_at,
    };
  });
}

export function upsertConnectorState(
  id: string,
  updates: Partial<{
    status: ConnectorStatus;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: string | null;
    channelToken: string | null;
    allowFrom: string[] | null;
    lastError: string | null;
    lastTestAt: string | null;
  }>,
): void {
  const current = db
    .prepare(
      `SELECT status, access_token, refresh_token, expires_at, channel_token, allow_from, last_error, last_test_at
       FROM connectors WHERE id = ?`,
    )
    .get(id) as
    | {
        status: ConnectorStatus;
        access_token: string | null;
        refresh_token: string | null;
        expires_at: string | null;
        channel_token: string | null;
        allow_from: string | null;
        last_error: string | null;
        last_test_at: string | null;
      }
    | undefined;

  const next = {
    status: updates.status ?? current?.status ?? ("not_connected" as ConnectorStatus),
    access_token: updates.accessToken ?? current?.access_token ?? null,
    refresh_token: updates.refreshToken ?? current?.refresh_token ?? null,
    expires_at: updates.expiresAt ?? current?.expires_at ?? null,
    channel_token: updates.channelToken ?? current?.channel_token ?? null,
    allow_from:
      updates.allowFrom === null
        ? null
        : updates.allowFrom
          ? updates.allowFrom.join(",")
          : current?.allow_from ?? null,
    last_error: updates.lastError ?? current?.last_error ?? null,
    last_test_at: updates.lastTestAt ?? current?.last_test_at ?? null,
  };

  db.prepare(
    `INSERT INTO connectors
      (id, status, access_token, refresh_token, expires_at, channel_token, allow_from, last_error, last_test_at, updated_at)
     VALUES
      (@id, @status, @access_token, @refresh_token, @expires_at, @channel_token, @allow_from, @last_error, @last_test_at, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
      status=excluded.status,
      access_token=excluded.access_token,
      refresh_token=excluded.refresh_token,
      expires_at=excluded.expires_at,
      channel_token=excluded.channel_token,
      allow_from=excluded.allow_from,
      last_error=excluded.last_error,
      last_test_at=excluded.last_test_at,
      updated_at=datetime('now')`,
  ).run({
    id,
    ...next,
  });
}
