import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type SessionRow = { id: string; title: string };
type HistoryRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  cost_usd?: number;
  created_at?: string;
};

export function CostsDashboard() {
  const { t } = useTranslation("common");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const coreUrl = await window.minitron.getCoreUrl();
      const sessionsRes = await fetch(`${coreUrl}/chat/sessions`);
      if (!sessionsRes.ok) {
        setError(t("costs.errorLoad"));
        return;
      }
      const sessionsPayload = (await sessionsRes.json()) as { items?: SessionRow[] };
      const sessions = sessionsPayload.items ?? [];

      const merged: HistoryRow[] = [];
      for (const session of sessions) {
        const histRes = await fetch(`${coreUrl}/chat/history?sessionId=${encodeURIComponent(session.id)}`);
        if (!histRes.ok) continue;
        const hist = (await histRes.json()) as { items?: HistoryRow[] };
        merged.push(...(hist.items ?? []));
      }
      setRows(merged);
    })();
  }, []);

  const totalCost = useMemo(
    () => rows.reduce((sum, item) => sum + (typeof item.cost_usd === "number" ? item.cost_usd : 0), 0),
    [rows],
  );

  const byModel = useMemo(() => {
    const map = new Map<string, { count: number; cost: number }>();
    for (const row of rows) {
      const model = row.model ?? "unknown";
      const current = map.get(model) ?? { count: 0, cost: 0 };
      current.count += 1;
      current.cost += typeof row.cost_usd === "number" ? row.cost_usd : 0;
      map.set(model, current);
    }
    return [...map.entries()].map(([model, stats]) => ({ model, ...stats }));
  }, [rows]);

  const monthlyForecast = useMemo(() => totalCost * 30, [totalCost]);

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("costs.title")}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p>{t("costs.total")}: ${totalCost.toFixed(4)}</p>
      <p>{t("costs.forecast")}: ${monthlyForecast.toFixed(4)}</p>

      <div className="space-y-2">
        {byModel.map((row) => (
          <article key={row.model} className="border rounded p-3">
            <p>
              <strong>{row.model}</strong>
            </p>
            <p className="text-sm">{t("costs.messages")}: {row.count}</p>
            <p className="text-sm">{t("costs.cost")}: ${row.cost.toFixed(4)}</p>
          </article>
        ))}
        {byModel.length === 0 ? <p className="text-sm text-slate-500">{t("costs.empty")}</p> : null}
      </div>
    </section>
  );
}
