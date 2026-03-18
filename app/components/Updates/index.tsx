import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type PendingUpdate = {
  component: "app" | "openclaw" | "skills" | "cognee";
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  requiresApproval: boolean;
  restartRequired: boolean;
};

export function UpdatesPanel() {
  const { t } = useTranslation("common");
  const [items, setItems] = useState<PendingUpdate[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/updates/check`);
    if (!response.ok) {
      setError(t("updates.errorLoad"));
      return;
    }
    const payload = (await response.json()) as { pending?: PendingUpdate[]; badgeCount?: number };
    setItems(payload.pending ?? []);
    setBadgeCount(payload.badgeCount ?? 0);
  }

  useEffect(() => {
    void load();
  }, []);

  async function apply(component: PendingUpdate["component"], requiresApproval: boolean): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/updates/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ component, approved: requiresApproval ? true : false }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? t("updates.errorApply"));
      return;
    }
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? t("updates.applied"));
    setError(null);
    await load();
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("updates.title")} ({badgeCount})</h2>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        {items.map((item) => (
          <article key={item.component} className="border rounded p-3 space-y-1">
            <p>
              <strong>{item.component}</strong>
            </p>
            <p className="text-xs text-slate-600">
              {item.currentVersion} → {item.latestVersion}
            </p>
            <p className="text-sm">{item.changelog}</p>
            <p className="text-xs text-slate-500">
              {item.requiresApproval ? t("updates.approvalRequired") : t("updates.autoAllowed")} |{" "}
              {item.restartRequired ? t("updates.restartRequired") : t("updates.noRestart")}
            </p>
            <button onClick={() => void apply(item.component, item.requiresApproval)}>
              {t("updates.apply")}
            </button>
          </article>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">{t("updates.none")}</p> : null}
      </div>
    </section>
  );
}
