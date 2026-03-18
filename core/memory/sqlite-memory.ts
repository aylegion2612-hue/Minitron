import { db } from "../db/client";

export type SqliteMemoryHit = {
  id: string;
  content: string;
  created_at: string;
  score: number;
};

export function searchMessageHistory(query: string): SqliteMemoryHit[] {
  return db
    .prepare(
      `SELECT id, content, created_at,
              CASE WHEN lower(content) = lower(?) THEN 1.0 ELSE 0.7 END AS score
       FROM messages
       WHERE content LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .all(query, `%${query}%`) as SqliteMemoryHit[];
}
