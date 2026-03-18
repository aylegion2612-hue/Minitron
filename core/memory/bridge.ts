import { cogneeGraph, cogneeSearch, isCogneeAvailable } from "./cognee-client";
import { searchMessageHistory } from "./sqlite-memory";

export type MemoryResult = {
  id: string;
  source: "sqlite" | "cognee";
  content: string;
  score: number;
};

export async function queryMemory(query: string): Promise<{
  results: MemoryResult[];
  sources: Array<"sqlite" | "cognee">;
}> {
  const sqlite = searchMessageHistory(query).map((row) => ({
    id: row.id,
    source: "sqlite" as const,
    content: row.content,
    score: row.score,
  }));

  const cogneeUp = await isCogneeAvailable();
  const cognee = cogneeUp
    ? (await cogneeSearch(query)).map((row) => ({
        id: row.id,
        source: "cognee" as const,
        content: row.content,
        score: row.score,
      }))
    : [];

  const merged = [...sqlite, ...cognee].sort((a, b) => b.score - a.score);
  const sources: Array<"sqlite" | "cognee"> = cogneeUp ? ["sqlite", "cognee"] : ["sqlite"];
  return { results: merged, sources };
}

export async function queryMemoryGraph(query: string): Promise<{
  nodes: Array<{ id: string; label: string; source: "sqlite" | "cognee" }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}> {
  const cogneeUp = await isCogneeAvailable();
  const graph = cogneeUp ? await cogneeGraph(query) : { nodes: [], edges: [] };
  const sqliteHits = searchMessageHistory(query).slice(0, 8);

  const sqliteNodes = sqliteHits.map((hit) => ({
    id: `sqlite:${hit.id}`,
    label: hit.content.slice(0, 80),
    source: "sqlite" as const,
  }));

  const cogneeNodes = graph.nodes.map((node) => ({
    id: `cognee:${node.id}`,
    label: node.label,
    source: "cognee" as const,
  }));

  return {
    nodes: [...sqliteNodes, ...cogneeNodes],
    edges: graph.edges,
  };
}
