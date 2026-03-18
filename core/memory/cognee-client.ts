export type CogneeMemoryHit = {
  id: string;
  content: string;
  score: number;
  nodeType?: string;
};

type GraphPayload = {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
};

const COGNEE_BASE_URL = process.env.COGNEE_BASE_URL ?? "http://127.0.0.1:7777";

export async function isCogneeAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${COGNEE_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function cogneeSearch(query: string): Promise<CogneeMemoryHit[]> {
  try {
    const response = await fetch(`${COGNEE_BASE_URL}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { items?: CogneeMemoryHit[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}

export async function cogneeGraph(query: string): Promise<GraphPayload> {
  try {
    const response = await fetch(`${COGNEE_BASE_URL}/graph`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return { nodes: [], edges: [] };
    const payload = (await response.json()) as GraphPayload;
    return {
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}
