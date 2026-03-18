import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type AgentTemplate = {
  key: string;
  name: string;
  role: string;
  personality: string;
  tools: string[];
  model: string;
  channel: string;
  sandboxLevel: "standard" | "strict" | "open";
};

type AgentRow = {
  id: string;
  name: string;
  role: string;
  personality: string;
  tools: string[];
  model: string;
  channel: string;
  sandbox_level: "standard" | "strict" | "open";
  template_key?: string;
  status: string;
};

export function AgentStudio() {
  const { t } = useTranslation("common");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personality, setPersonality] = useState("");
  const [tools, setTools] = useState("");
  const [model, setModel] = useState("google/gemini-2.0-flash");
  const [channel, setChannel] = useState("telegram");
  const [sandboxLevel, setSandboxLevel] = useState<"standard" | "strict" | "open">("standard");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/agents`);
    if (!response.ok) {
      setError(t("agents.errorLoad"));
      return;
    }
    const payload = (await response.json()) as { items?: AgentRow[]; templates?: AgentTemplate[] };
    setAgents(payload.items ?? []);
    setTemplates(payload.templates ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  function applyTemplate(key: string): void {
    setSelectedTemplate(key);
    const template = templates.find((item) => item.key === key);
    if (!template) return;
    setName(template.name);
    setRole(template.role);
    setPersonality(template.personality);
    setTools(template.tools.join(", "));
    setModel(template.model);
    setChannel(template.channel);
    setSandboxLevel(template.sandboxLevel);
  }

  async function runAgent(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/agents/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        role,
        personality,
        tools: tools
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        model,
        channel,
        sandboxLevel,
        templateKey: selectedTemplate || undefined,
      }),
    });
    if (!response.ok) {
      setError(t("agents.errorSave"));
      return;
    }
    setError(null);
    await load();
  }

  async function terminateAgent(id: string): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      setError(t("agents.errorSave"));
      return;
    }
    await load();
  }

  return (
    <section className="p-4 space-y-3">
      <h2 className="font-semibold">{t("agents.title")}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="border rounded p-3 space-y-2">
        <select
          className="w-full border rounded px-2 py-1"
          value={selectedTemplate}
          onChange={(event) => applyTemplate(event.target.value)}
        >
          <option value="">{t("agents.templatePlaceholder")}</option>
          {templates.map((template) => (
            <option key={template.key} value={template.key}>
              {template.name}
            </option>
          ))}
        </select>
        <input className="w-full border rounded px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("agents.name")} />
        <input className="w-full border rounded px-2 py-1" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("agents.role")} />
        <input className="w-full border rounded px-2 py-1" value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder={t("agents.personality")} />
        <input className="w-full border rounded px-2 py-1" value={tools} onChange={(e) => setTools(e.target.value)} placeholder={t("agents.tools")} />
        <input className="w-full border rounded px-2 py-1" value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("agents.model")} />
        <input className="w-full border rounded px-2 py-1" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder={t("agents.channel")} />
        <select className="w-full border rounded px-2 py-1" value={sandboxLevel} onChange={(e) => setSandboxLevel(e.target.value as "standard" | "strict" | "open")}>
          <option value="standard">standard</option>
          <option value="strict">strict</option>
          <option value="open">open</option>
        </select>
        <button onClick={() => void runAgent()}>{t("agents.run")}</button>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => (
          <article key={agent.id} className="border rounded p-3">
            <p>
              <strong>{agent.name}</strong> - {agent.status}
            </p>
            <p className="text-sm text-slate-600">{agent.role}</p>
            <p className="text-xs text-slate-500">
              {agent.channel} / {agent.model} / {agent.sandbox_level}
            </p>
            <button onClick={() => void terminateAgent(agent.id)}>{t("agents.terminate")}</button>
          </article>
        ))}
        {agents.length === 0 ? <p className="text-sm text-slate-500">{t("agents.empty")}</p> : null}
      </div>
    </section>
  );
}
