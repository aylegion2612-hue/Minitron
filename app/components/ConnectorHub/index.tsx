import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Connector = {
  id: string;
  status: "connected" | "expired" | "error" | "not_connected";
  expiresAt?: string | null;
  lastError?: string | null;
  allowFrom?: string[];
  channelToken?: string | null;
};

export function ConnectorHub() {
  const { t } = useTranslation("common");
  const [items, setItems] = useState<Connector[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [channelTokens, setChannelTokens] = useState<Record<string, string>>({});
  const [allowFrom, setAllowFrom] = useState<Record<string, string>>({});

  async function load(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/connectors`);
    if (!response.ok) {
      setError(t("connectors.errorLoad"));
      return;
    }
    const payload = (await response.json()) as { items?: Connector[] };
    const connectors = payload.items ?? [];
    setItems(connectors);
    setChannelTokens(
      Object.fromEntries(connectors.map((item) => [item.id, item.channelToken ?? ""])),
    );
    setAllowFrom(
      Object.fromEntries(connectors.map((item) => [item.id, (item.allowFrom ?? []).join(", ")])),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(id: string): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/connectors`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      setError(t("connectors.errorSave"));
      return;
    }
    setError(null);
    await load();
  }

  async function refresh(id: string): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/connectors/${encodeURIComponent(id)}/refresh`, { method: "POST" });
    if (!response.ok) {
      setError(t("connectors.errorSave"));
      return;
    }
    setError(null);
    await load();
  }

  async function saveChannel(id: string): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/connectors/${encodeURIComponent(id)}/channel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channelToken: channelTokens[id] ?? "",
        allowFrom: (allowFrom[id] ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    if (!response.ok) {
      setError(t("connectors.errorSave"));
      return;
    }
    setError(null);
    await load();
  }

  async function testMessage(id: string): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/connectors/${encodeURIComponent(id)}/test-message`, {
      method: "POST",
    });
    if (!response.ok) {
      setError(t("connectors.errorSave"));
      return;
    }
    setError(null);
    await load();
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("connectors.title")}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        {items.map((item) => (
          <article key={item.id} className="border rounded p-3 space-y-2">
            <p>
              <strong>{item.id}</strong> - {item.status}
            </p>
            <p className="text-xs text-slate-500">
              {item.expiresAt ? `${t("connectors.expiresAt")}: ${item.expiresAt}` : ""}
              {item.lastError ? ` | ${t("connectors.lastError")}: ${item.lastError}` : ""}
            </p>
            <div className="flex gap-2">
              <button onClick={() => void connect(item.id)}>{t("connectors.connect")}</button>
              <button onClick={() => void refresh(item.id)}>{t("connectors.refresh")}</button>
            </div>
            <input
              className="w-full border rounded px-2 py-1"
              value={channelTokens[item.id] ?? ""}
              onChange={(event) =>
                setChannelTokens((prev) => ({ ...prev, [item.id]: event.target.value }))
              }
              placeholder={t("connectors.channelToken")}
            />
            <input
              className="w-full border rounded px-2 py-1"
              value={allowFrom[item.id] ?? ""}
              onChange={(event) =>
                setAllowFrom((prev) => ({ ...prev, [item.id]: event.target.value }))
              }
              placeholder={t("connectors.allowFrom")}
            />
            <div className="flex gap-2">
              <button onClick={() => void saveChannel(item.id)}>{t("connectors.saveChannel")}</button>
              <button onClick={() => void testMessage(item.id)}>{t("connectors.testMessage")}</button>
            </div>
          </article>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">{t("connectors.empty")}</p> : null}
      </div>
    </section>
  );
}
