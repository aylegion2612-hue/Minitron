import path from "node:path";
// MCP SDK is ESM-first; require() keeps compatibility with current CommonJS TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require("@modelcontextprotocol/sdk/client/index.js") as {
  Client: new (clientInfo: { name: string; version: string }) => {
    connect: (transport: unknown) => Promise<void>;
    listTools: () => Promise<unknown>;
    callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
  };
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js") as {
  StdioClientTransport: new (params: {
    command: string;
    args?: string[];
    cwd?: string;
    stderr?: "pipe" | "inherit";
  }) => {
    pid: number | null;
    onclose?: () => void;
    onerror?: (error: Error) => void;
  };
};

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

type MClient = InstanceType<typeof Client>;
type MTransport = InstanceType<typeof StdioClientTransport>;

let mcpClient: MClient | null = null;
let mcpTransport: MTransport | null = null;
let connectPromise: Promise<void> | null = null;
let lastError: string | null = null;
let connectedAt: string | null = null;

function resolveCogneePythonCommand(): string {
  if (process.env.COGNEE_PYTHON_CMD) {
    return process.env.COGNEE_PYTHON_CMD;
  }

  const fromVenv = path.resolve(process.cwd(), "sidecars", "cognee", "venv", "Scripts", "python.exe");
  return fromVenv;
}

function resolveCogneeScriptPath(): string {
  return path.resolve(process.cwd(), "sidecars", "cognee", "run.py");
}

async function ensureClientConnected(): Promise<MClient> {
  if (mcpClient && mcpTransport) {
    return mcpClient;
  }

  if (connectPromise) {
    await connectPromise;
    if (!mcpClient) {
      throw new Error("Cognee MCP client unavailable after connect.");
    }
    return mcpClient;
  }

  connectPromise = (async () => {
    const transport = new StdioClientTransport({
      command: resolveCogneePythonCommand(),
      args: [resolveCogneeScriptPath()],
      cwd: process.cwd(),
      stderr: "pipe",
    });

    const client = new Client({
      name: "minitron",
      version: "1.0.0",
    });

    transport.onclose = () => {
      mcpClient = null;
      mcpTransport = null;
    };
    transport.onerror = (error: Error) => {
      lastError = error.message;
      mcpClient = null;
      mcpTransport = null;
    };

    await client.connect(transport);
    await client.listTools();

    mcpTransport = transport;
    mcpClient = client;
    lastError = null;
    connectedAt = new Date().toISOString();
  })();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }

  if (!mcpClient) {
    throw new Error("Failed to initialize Cognee MCP client.");
  }

  return mcpClient;
}

function parseToolPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const structured = payload as { structuredContent?: unknown; content?: Array<{ type?: string; text?: string }> };
  if (structured.structuredContent && typeof structured.structuredContent === "object") {
    return structured.structuredContent as Record<string, unknown>;
  }
  const textItem = Array.isArray(structured.content)
    ? structured.content.find((item) => item?.type === "text" && typeof item.text === "string")
    : undefined;
  if (textItem?.text) {
    try {
      const parsed = JSON.parse(textItem.text) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fallthrough
    }
  }
  return {};
}

export function getCogneeRuntimeStatus(): {
  connected: boolean;
  pid: number | null;
  connectedAt: string | null;
  lastError: string | null;
} {
  return {
    connected: Boolean(mcpClient && mcpTransport),
    pid: mcpTransport?.pid ?? null,
    connectedAt,
    lastError,
  };
}

export async function isCogneeAvailable(): Promise<boolean> {
  try {
    const client = await ensureClientConnected();
    await client.listTools();
    return true;
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Cognee MCP unavailable";
    return false;
  }
}

export async function cogneeSearch(query: string): Promise<CogneeMemoryHit[]> {
  try {
    const client = await ensureClientConnected();
    const result = await client.callTool({
      name: "search_memory",
      arguments: { query },
    });
    const payload = parseToolPayload(result);
    const raw = Array.isArray(payload.results) ? payload.results : [];
    return raw.map((value, index) => ({
      id: `cg-${index + 1}`,
      content: String(value),
      score: Math.max(0.3, 1 - index * 0.08),
      nodeType: "entity",
    }));
  } catch {
    return [];
  }
}

export async function cogneeGraph(query: string): Promise<GraphPayload> {
  const hits = await cogneeSearch(query);
  const nodes = hits.slice(0, 8).map((hit, index) => ({
    id: `n${index + 1}`,
    label: hit.content.slice(0, 96),
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    from: nodes[index].id,
    to: node.id,
    label: "related_to",
  }));

  return { nodes, edges };
}
