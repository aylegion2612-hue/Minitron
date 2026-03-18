import { useState } from "react";
import { useTranslation } from "react-i18next";

type MemoryResult = {
  id: string;
  source: "sqlite" | "cognee";
  content: string;
  score: number;
};

type GraphNode = {
  id: string;
  label: string;
  source: "sqlite" | "cognee";
};

type GraphEdge = {
  from: string;
  to: string;
  label?: string;
};

export function MemoryBrowser() {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [source, setSource] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("-");
  const [error, setError] = useState<string | null>(null);

  async function runSearch(): Promise<void> {
    if (!query.trim()) return;
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/memory/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      setError(t("memory.errorSearch"));
      return;
    }
    const payload = (await response.json()) as {
      results?: MemoryResult[];
      source?: string[];
      graph?: { nodes?: GraphNode[]; edges?: GraphEdge[] };
    };
    setResults(payload.results ?? []);
    setSource(payload.source ?? []);
    setNodes(payload.graph?.nodes ?? []);
    setEdges(payload.graph?.edges ?? []);
    setError(null);
  }

  async function refreshStatus(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/memory/status`);
    if (!response.ok) {
      setStatus(t("memory.statusUnknown"));
      return;
    }
    const payload = (await response.json()) as {
      sqlite?: { state?: string };
      cognee?: { state?: string };
      degradationLevel?: number;
    };
    setStatus(
      `L${payload.degradationLevel ?? "-"} | sqlite=${payload.sqlite?.state ?? "unknown"} | cognee=${payload.cognee?.state ?? "unknown"}`,
    );
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("memory.title")}</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("memory.searchPlaceholder")}
        />
        <button onClick={() => void runSearch()}>{t("memory.search")}</button>
        <button onClick={() => void refreshStatus()}>{t("memory.status")}</button>
      </div>
      <p className="text-sm text-slate-600">{t("memory.sources")}: {source.join(", ") || "-"}</p>
      <p className="text-sm text-slate-600">{t("memory.currentStatus")}: {status}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="border rounded p-3">
        <p className="font-medium mb-2">{t("memory.results")}</p>
        {results.map((item) => (
          <article key={item.id} className="border rounded p-2 mb-2">
            <p className="text-sm">{item.content}</p>
            <p className="text-xs text-slate-500">
              {item.source} | score {item.score.toFixed(2)}
            </p>
          </article>
        ))}
        {results.length === 0 ? <p className="text-sm text-slate-500">{t("memory.empty")}</p> : null}
      </div>

      <div className="border rounded p-3">
        <p className="font-medium mb-2">{t("memory.graph")}</p>
        <p className="text-xs text-slate-500">
          {t("memory.nodes")}: {nodes.length} | {t("memory.edges")}: {edges.length}
        </p>
        <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
          {nodes.map((node) => (
            <p key={node.id} className="text-xs">
              [{node.source}] {node.label}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
