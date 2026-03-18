import { useState } from "react";
import { useTranslation } from "react-i18next";

type Step = 1 | 2 | 3 | 4 | 5;

export function Onboarding() {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [provider, setProvider] = useState("google");
  const [apiKey, setApiKey] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [firstSkill, setFirstSkill] = useState("calendar-assistant");
  const [passed, setPassed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verifyKey(): Promise<boolean> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/settings/verify-api-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    return response.ok;
  }

  async function complete(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "en",
        primaryModel: "google/gemini-2.0-flash",
        fastModel: "google/gemini-2.0-flash",
        fallbackModel: "google/gemini-2.0-flash",
        apiKeys: { [provider]: apiKey },
      }),
    });
    if (!response.ok) {
      setError(t("onboarding.errorSave"));
      return;
    }
    setPassed(true);
    setMessage(t("onboarding.completed"));
    setError(null);
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("onboarding.title")} ({step}/5)</h2>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {step === 1 ? (
        <div className="space-y-2">
          <input className="w-full border rounded px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("onboarding.name")} />
          <input className="w-full border rounded px-2 py-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder={t("onboarding.timezone")} />
          <button onClick={() => setStep(2)} disabled={!name.trim() || !timezone.trim()}>{t("onboarding.next")}</button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2">
          <input className="w-full border rounded px-2 py-1" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={t("onboarding.provider")} />
          <input className="w-full border rounded px-2 py-1" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t("onboarding.apiKey")} />
          <div className="flex gap-2">
            <button
              onClick={() =>
                void (async () => {
                  const ok = await verifyKey();
                  if (!ok) {
                    setError(t("onboarding.errorVerify"));
                    return;
                  }
                  setError(null);
                  setStep(3);
                })()
              }
            >
              {t("onboarding.verifyAndNext")}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2">
          <input className="w-full border rounded px-2 py-1" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder={t("onboarding.channel")} />
          <button onClick={() => setStep(4)}>{t("onboarding.next")}</button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-2">
          <input className="w-full border rounded px-2 py-1" value={firstSkill} onChange={(e) => setFirstSkill(e.target.value)} placeholder={t("onboarding.firstSkill")} />
          <button onClick={() => setStep(5)}>{t("onboarding.next")}</button>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-2">
          <p className="text-sm">{t("onboarding.securityCheck")}</p>
          <button onClick={() => void complete()}>{t("onboarding.finish")}</button>
        </div>
      ) : null}

      {passed ? (
        <div className="text-xs text-slate-500">
          {t("onboarding.summary")}: {name} / {timezone} / {provider} / {channel} / {firstSkill}
        </div>
      ) : null}
    </section>
  );
}
