import { Router } from "express";
import { db } from "../../db/client";

const router = Router();

router.get("/", (req, res) => {
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const actor = typeof req.query.actor === "string" ? req.query.actor.trim() : "";
  const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
  const to = typeof req.query.to === "string" ? req.query.to.trim() : "";

  const rows = db
    .prepare(
      `SELECT id, action, actor, metadata, created_at
       FROM audit_log
       WHERE (@action = '' OR action = @action)
         AND (@actor = '' OR actor = @actor)
         AND (@from = '' OR created_at >= @from)
         AND (@to = '' OR created_at <= @to)
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    .all({ action, actor, from, to });
  res.json({ items: rows });
});

router.get("/export", (req, res) => {
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const actor = typeof req.query.actor === "string" ? req.query.actor.trim() : "";
  const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
  const to = typeof req.query.to === "string" ? req.query.to.trim() : "";

  const rows = db
    .prepare(
      `SELECT id, action, actor, metadata, created_at
       FROM audit_log
       WHERE (@action = '' OR action = @action)
         AND (@actor = '' OR actor = @actor)
         AND (@from = '' OR created_at >= @from)
         AND (@to = '' OR created_at <= @to)
       ORDER BY created_at DESC
       LIMIT 5000`,
    )
    .all({ action, actor, from, to }) as Array<{
    id: string;
    action: string;
    actor: string;
    metadata: string | null;
    created_at: string;
  }>;

  const header = "id,action,actor,metadata,created_at";
  const lines = rows.map((row) =>
    [
      row.id,
      row.action,
      row.actor,
      (row.metadata ?? "").replaceAll('"', '""'),
      row.created_at,
    ]
      .map((item) => `"${item}"`)
      .join(","),
  );

  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
  res.send(csv);
});

export { router as auditRouter };
