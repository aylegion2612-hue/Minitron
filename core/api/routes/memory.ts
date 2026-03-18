import { Router } from "express";
import { z } from "zod";
import { queryMemory, queryMemoryGraph } from "../../memory/bridge";
import { isCogneeAvailable } from "../../memory/cognee-client";
import { getSidecarStatus } from "../../memory/sidecar-manager";
import { db } from "../../db/client";

const router = Router();
const searchSchema = z.object({
  query: z.string().min(1),
});

router.post("/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const query = parsed.data.query.trim();
  const merged = await queryMemory(query);
  const graph = await queryMemoryGraph(query);

  return res.json({
    query,
    results: merged.results,
    source: merged.sources,
    graph,
  });
});

router.get("/status", async (_req, res) => {
  const sqliteStatus = (() => {
    try {
      const row = db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number };
      return { state: "up", messageCount: row.count };
    } catch {
      return { state: "down", messageCount: 0 };
    }
  })();

  const cogneeUp = await isCogneeAvailable();
  const sidecar = getSidecarStatus();

  return res.json({
    sqlite: sqliteStatus,
    cognee: {
      state: cogneeUp ? "up" : "down",
      sidecar,
    },
    degradationLevel: cogneeUp ? 1 : 2,
  });
});

export { router as memoryRouter };
