import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Rule = {
  id: string;
  name: string;
  rule_type: "block" | "confirm" | "log" | "allow";
  scope: "all" | "file" | "network" | "exec" | "payment";
  value: string;
  enabled: number;
};

export function RulesEditor() {
  const { t } = useTranslation("common");
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadRules(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/rules`);
    if (!response.ok) {
      setError(t("rules.errorLoad"));
      return;
    }
    const payload = (await response.json()) as { items?: Rule[] };
    setRules(payload.items ?? []);
  }

  useEffect(() => {
    void loadRules();
  }, []);

  async function createRule(): Promise<void> {
    if (!name.trim() || !input.trim()) return;
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), input: input.trim() }),
    });
    if (!response.ok) {
      setError(t("rules.errorSave"));
      return;
    }
    setName("");
    setInput("");
    setError(null);
    await loadRules();
  }

  async function toggleRule(rule: Rule): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/rules/${encodeURIComponent(rule.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: rule.enabled === 1 ? false : true }),
    });
    if (!response.ok) {
      setError(t("rules.errorSave"));
      return;
    }
    await loadRules();
  }

  async function editRule(rule: Rule): Promise<void> {
    const nextName = window.prompt(t("rules.editNamePrompt"), rule.name)?.trim();
    if (!nextName) return;
    const nextInput = window.prompt(t("rules.editInputPrompt"), `${rule.rule_type} ${rule.scope}: ${rule.value}`)?.trim();
    if (!nextInput) return;

    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/rules/${encodeURIComponent(rule.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nextName, input: nextInput }),
    });
    if (!response.ok) {
      setError(t("rules.errorSave"));
      return;
    }
    await loadRules();
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("rules.title")}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="border rounded p-3 space-y-2">
        <input
          className="w-full border rounded px-2 py-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("rules.namePlaceholder")}
        />
        <input
          className="w-full border rounded px-2 py-1"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("rules.inputPlaceholder")}
        />
        <button onClick={() => void createRule()}>{t("rules.create")}</button>
      </div>

      <div className="space-y-2">
        {rules.length === 0 ? <p className="text-sm text-slate-500">{t("rules.empty")}</p> : null}
        {rules.map((rule) => (
          <article key={rule.id} className="border rounded p-3">
            <p>
              <strong>{rule.name}</strong> - {rule.rule_type}/{rule.scope}
            </p>
            <p className="text-sm text-slate-600">{rule.value}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => void toggleRule(rule)}>
                {rule.enabled === 1 ? t("rules.disable") : t("rules.enable")}
              </button>
              <button onClick={() => void editRule(rule)}>{t("rules.edit")}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
