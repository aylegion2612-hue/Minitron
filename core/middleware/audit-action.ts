import type { NextFunction, Request, Response } from "express";
import { writeAuditLog } from "../security/auditor";

export function auditAction(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health") {
    next();
    return;
  }

  const startedAt = Date.now();
  const actor = (req.headers["x-minitron-actor"] as string | undefined) ?? "local-user";

  res.on("finish", () => {
    writeAuditLog({
      action: "http.request",
      actor,
      metadata: {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
    });
  });

  next();
}
