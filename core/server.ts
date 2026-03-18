import cors from "cors";
import express from "express";
import { chatRouter } from "./api/routes/chat";
import { skillsRouter } from "./api/routes/skills";
import { agentsRouter } from "./api/routes/agents";
import { rulesRouter } from "./api/routes/rules";
import { connectorsRouter } from "./api/routes/connectors";
import { memoryRouter } from "./api/routes/memory";
import { settingsRouter } from "./api/routes/settings";
import { updatesRouter } from "./api/routes/updates";
import { cloudRouter } from "./api/routes/cloud";
import { auditRouter } from "./api/routes/audit";
import { rateLimit } from "./middleware/rate-limit";
import { auditAction } from "./middleware/audit-action";

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit);
  app.use(auditAction);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "minitron-core" }));

  app.use("/chat", chatRouter);
  app.use("/skills", skillsRouter);
  app.use("/agents", agentsRouter);
  app.use("/rules", rulesRouter);
  app.use("/connectors", connectorsRouter);
  app.use("/memory", memoryRouter);
  app.use("/settings", settingsRouter);
  app.use("/updates", updatesRouter);
  app.use("/cloud", cloudRouter);
  app.use("/audit", auditRouter);

  return app;
}
