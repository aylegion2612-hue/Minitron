import { useState } from "react";
import { useTranslation } from "react-i18next";

export function Settings() {
  const { t, i18n } = useTranslation("common");
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(i18n.language || "en");
  const [primaryModel, setPrimaryModel] = useState("google/gemini-2.0-flash");
  const [fastModel, setFastModel] = useState("google/gemini-2.0-flash");
  const [fallbackModel, setFallbackModel] = useState("google/gemini-2.0-flash");
  const [apiKeyProvider, setApiKeyProvider] = useState("google");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [tunnelProvider, setTunnelProvider] = useState<"localtunnel" | "cloudflare" | "ngrok" | "none">(
    "none",
  );
  const [tunnelCommand, setTunnelCommand] = useState("-");

  async function login(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/cloud/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      setError(t("cloud.errorLogin"));
      return;
    }
    const payload = (await response.json()) as { uid?: string };
    setUid(payload.uid ?? null);
    setMessage(t("cloud.loggedIn"));
    setError(null);
  }

  async function sync(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/cloud/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? t("cloud.errorSync"));
      return;
    }
    const payload = (await response.json()) as { updatedAt?: string };
    setMessage(`${t("cloud.syncedAt")}: ${payload.updatedAt ?? "-"}`);
    setError(null);
  }

  async function restore(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/cloud/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? t("cloud.errorRestore"));
      return;
    }
    const payload = (await response.json()) as { updatedAt?: string };
    setMessage(`${t("cloud.restoredAt")}: ${payload.updatedAt ?? "-"}`);
    setError(null);
  }

  async function saveAppSettings(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language,
        primaryModel,
        fastModel,
        fallbackModel,
        tunnelProvider,
      }),
    });
    if (!response.ok) {
      setError(t("settings.errorSave"));
      return;
    }
    await i18n.changeLanguage(language);
    setMessage(t("settings.saved"));
    setError(null);
  }

  async function saveApiKey(): Promise<void> {
    if (!apiKeyProvider.trim() || !apiKeyValue.trim()) {
      setError(t("settings.errorApiKey"));
      return;
    }
    const coreUrl = await window.minitron.getCoreUrl();
    const verify = await fetch(`${coreUrl}/settings/verify-api-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: apiKeyProvider, apiKey: apiKeyValue }),
    });
    if (!verify.ok) {
      setError(t("onboarding.errorVerify"));
      return;
    }
    const save = await fetch(`${coreUrl}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKeys: { [apiKeyProvider]: apiKeyValue },
      }),
    });
    if (!save.ok) {
      setError(t("settings.errorApiKey"));
      return;
    }
    setApiKeyValue("");
    setMessage(t("settings.apiKeySaved"));
    setError(null);
  }

  async function fetchTunnelCommand(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(
      `${coreUrl}/settings/tunnel-command?provider=${encodeURIComponent(tunnelProvider)}&port=4317`,
    );
    if (!response.ok) {
      setError(t("settings.errorTunnel"));
      return;
    }
    const payload = (await response.json()) as { command?: string };
    setTunnelCommand(payload.command ?? "-");
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("settings.title")}</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">{t("settings.language")}</label>
        <select
          className="border rounded px-2 py-1"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="ur">Urdu</option>
          <option value="ar">Arabic</option>
          <option value="es">Spanish</option>
        </select>

        <label className="text-sm">{t("settings.primaryModel")}</label>
        <input className="border rounded px-2 py-1" value={primaryModel} onChange={(e) => setPrimaryModel(e.target.value)} />

        <label className="text-sm">{t("settings.fastModel")}</label>
        <input className="border rounded px-2 py-1" value={fastModel} onChange={(e) => setFastModel(e.target.value)} />

        <label className="text-sm">{t("settings.fallbackModel")}</label>
        <input className="border rounded px-2 py-1" value={fallbackModel} onChange={(e) => setFallbackModel(e.target.value)} />
      </div>
      <button onClick={() => void saveAppSettings()}>{t("settings.save")}</button>

      <div className="border rounded p-3 space-y-2">
        <p className="font-medium">{t("settings.apiKeyTitle")}</p>
        <input
          className="w-full border rounded px-2 py-1"
          value={apiKeyProvider}
          onChange={(event) => setApiKeyProvider(event.target.value)}
          placeholder={t("onboarding.provider")}
        />
        <input
          className="w-full border rounded px-2 py-1"
          value={apiKeyValue}
          onChange={(event) => setApiKeyValue(event.target.value)}
          placeholder={t("onboarding.apiKey")}
        />
        <button onClick={() => void saveApiKey()}>{t("settings.saveApiKey")}</button>
      </div>

      <div className="border rounded p-3 space-y-2">
        <p className="font-medium">{t("settings.tunnelTitle")}</p>
        <select
          className="w-full border rounded px-2 py-1"
          value={tunnelProvider}
          onChange={(event) => setTunnelProvider(event.target.value as "localtunnel" | "cloudflare" | "ngrok" | "none")}
        >
          <option value="none">none</option>
          <option value="localtunnel">localtunnel</option>
          <option value="cloudflare">cloudflare</option>
          <option value="ngrok">ngrok</option>
        </select>
        <button onClick={() => void fetchTunnelCommand()}>{t("settings.getTunnelCommand")}</button>
        <p className="text-xs break-all">{tunnelCommand}</p>
      </div>

      <input
        className="w-full border rounded px-2 py-1"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t("cloud.emailPlaceholder")}
      />
      <div className="flex gap-2">
        <button onClick={() => void login()}>{t("cloud.login")}</button>
        <button onClick={() => void sync()}>{t("cloud.sync")}</button>
        <button onClick={() => void restore()}>{t("cloud.restore")}</button>
      </div>
      <p className="text-xs text-slate-500">{t("cloud.uid")}: {uid ?? "-"}</p>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
