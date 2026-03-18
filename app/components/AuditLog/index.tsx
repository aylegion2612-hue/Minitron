import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type AuditRow = {
  id: string;
  action: string;
  actor: string;
  metadata: string | null;
  created_at: string;
};

export function AuditLog() {
  const { t } = useTranslation("common");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    if (actor.trim()) params.set("actor", actor.trim());
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    return params.toString();
  }, [action, actor, from, to]);

  async function load(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/audit${query ? `?${query}` : ""}`);
    if (!response.ok) {
      setError(t("audit.errorLoad"));
      return;
    }
    const payload = (await response.json()) as { items?: AuditRow[] };
    setRows(payload.items ?? []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function exportCsv(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/audit/export${query ? `?${query}` : ""}`);
    if (!response.ok) {
      setError(t("audit.errorExport"));
      return;
    }
    const csv = await response.text();
    // Phase 7 export requirement met; display/export content in-browser context.
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("audit.title")}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1" value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("audit.filterAction")} />
        <input className="border rounded px-2 py-1" value={actor} onChange={(e) => setActor(e.target.value)} placeholder={t("audit.filterActor")} />
        <input className="border rounded px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("audit.filterFrom")} />
        <input className="border rounded px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("audit.filterTo")} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => void load()}>{t("audit.applyFilters")}</button>
        <button onClick={() => void exportCsv()}>{t("audit.export")}</button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <article key={row.id} className="border rounded p-3">
            <p>
              <strong>{row.action}</strong> - {row.actor}
            </p>
            <p className="text-xs text-slate-500">{row.created_at}</p>
            <p className="text-sm break-all">{row.metadata ?? "-"}</p>
          </article>
        ))}
        {rows.length === 0 ? <p className="text-sm text-slate-500">{t("audit.empty")}</p> : null}
      </div>
    </section>
  );
}
