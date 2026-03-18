import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RulesEditor } from "../RulesEditor";
import { SkillStore } from "../SkillStore";
import { AgentStudio } from "../AgentStudio";
import { ConnectorHub } from "../ConnectorHub";
import { MemoryBrowser } from "../MemoryBrowser";
import { UpdatesPanel } from "../Updates";
import { Settings } from "../Settings";
import { CostsDashboard } from "../CostsDashboard";
import { AuditLog } from "../AuditLog";
import { Onboarding } from "../Onboarding";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  costUsd?: number;
};
type ChatErrorPayload = { error?: string; reasons?: string[]; confirmRuleIds?: string[] };
type Session = { id: string; title: string };
type HistoryRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  cost_usd?: number;
};

export function ChatApp() {
  const { t } = useTranslation("common");
  const [view, setView] = useState<
    | "chat"
    | "rules"
    | "skills"
    | "agents"
    | "connectors"
    | "memory"
    | "updates"
    | "settings"
    | "costs"
    | "audit"
    | "onboarding"
  >("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRuleIds, setConfirmRuleIds] = useState<string[]>([]);
  const [lastPendingContent, setLastPendingContent] = useState<string | null>(null);
  const defaultSessionId = useMemo(() => "default-session", []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function fetchSessions(): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/chat/sessions`);
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { items?: Array<{ id: string; title: string }> };
    const serverSessions = (payload.items ?? []).map((item) => ({
      id: item.id,
      title: item.title || t("chat.sessionUntitled"),
    }));

    if (!serverSessions.some((item) => item.id === defaultSessionId)) {
      serverSessions.unshift({ id: defaultSessionId, title: t("chat.sessionUntitled") });
    }

    setSessions((prev) => {
      const merged = [...serverSessions];
      for (const existing of prev) {
        if (!merged.some((item) => item.id === existing.id)) {
          merged.push(existing);
        }
      }
      return merged;
    });
  }

  async function fetchHistory(targetSessionId: string): Promise<void> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/chat/history?sessionId=${encodeURIComponent(targetSessionId)}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { items?: HistoryRow[] };
    const next = (payload.items ?? []).map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      model: item.model,
      costUsd: item.cost_usd ?? 0,
    }));
    setMessages(next);
  }

  function scrollMessagesToBottom(): void {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function createSession(title: string): Promise<Session | null> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/chat/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Session;
    return payload;
  }

  async function renameSession(sessionId: string, title: string): Promise<boolean> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    return response.ok;
  }

  async function deleteSession(sessionId: string): Promise<boolean> {
    const coreUrl = await window.minitron.getCoreUrl();
    const response = await fetch(`${coreUrl}/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    return response.ok;
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await fetchSessions();
        if (!active) return;
        setActiveSessionId(defaultSessionId);
        await fetchHistory(defaultSessionId);
      } catch {
        // ignore history preload errors in phase 1
      }
    })();

    return () => {
      active = false;
    };
  }, [defaultSessionId, t]);

  useEffect(() => {
    scrollMessagesToBottom();
  }, [messages, isStreaming]);

  async function sendMessage(overrideContent?: string, confirmIds?: string[]) {
    const content = (overrideContent ?? input).trim();
    if (!content || isStreaming || !activeSessionId) return;

    setError(null);
    setLastPendingContent(null);
    setConfirmRuleIds([]);
    setInput("");
    const tempUserId = crypto.randomUUID();
    const tempAssistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content, model: "user", costUsd: 0 },
      { id: tempAssistantId, role: "assistant", content: "", model: "google/gemini-2.0-flash", costUsd: 0 },
    ]);
    setIsStreaming(true);
    try {
      const coreUrl = await window.minitron.getCoreUrl();
      const response = await fetch(`${coreUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          sender: "desktop-user",
          content,
          confirmedRuleIds: confirmIds,
        }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 409) {
          const payload = (await response.json()) as ChatErrorPayload;
          setMessages((prev) => prev.filter((item) => item.id !== tempUserId && item.id !== tempAssistantId));
          setLastPendingContent(content);
          setConfirmRuleIds(payload.confirmRuleIds ?? []);
          setInput(content);
          setError(payload.error ?? t("chat.confirmNeeded"));
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as ChatErrorPayload;
        setMessages((prev) => prev.filter((item) => item.id !== tempAssistantId));
        setError(payload.error ?? t("chat.error"));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const eventBlock = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = JSON.parse(line.slice(6)) as { type: "chunk" | "done"; text?: string };
            if (payload.type === "chunk" && payload.text) {
              assistantText += payload.text;
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === tempAssistantId ? { ...item, content: assistantText } : item,
                ),
              );
            }
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
      setMessages((prev) =>
        prev.map((item) =>
          item.id === tempAssistantId ? { ...item, content: assistantText.trim() } : item,
        ),
      );
      await fetchSessions();
    } catch {
      setMessages((prev) => prev.filter((item) => item.id !== tempAssistantId));
      setError(t("chat.error"));
    } finally {
      setIsStreaming(false);
    }
  }

  function clearComposerState(): void {
    setInput("");
    setError(null);
    setLastPendingContent(null);
    setConfirmRuleIds([]);
  }

  async function createNewSession(): Promise<void> {
    const title = window.prompt(t("chat.newSessionPrompt"), t("chat.newSessionTitle"))?.trim();
    if (!title) return;
    const created = await createSession(title);
    if (!created) {
      setError(t("chat.error"));
      return;
    }
    setSessions((prev) => [created, ...prev]);
    setActiveSessionId(created.id);
    setMessages([]);
    clearComposerState();
  }

  async function onRenameSession(session: Session): Promise<void> {
    const title = window.prompt(t("chat.renamePrompt"), session.title)?.trim();
    if (!title) return;
    const ok = await renameSession(session.id, title);
    if (!ok) {
      setError(t("chat.error"));
      return;
    }
    setSessions((prev) => prev.map((item) => (item.id === session.id ? { ...item, title } : item)));
  }

  async function onDeleteSession(session: Session): Promise<void> {
    const confirmed = window.confirm(t("chat.deleteConfirm", { title: session.title }));
    if (!confirmed) return;

    const ok = await deleteSession(session.id);
    if (!ok) {
      setError(t("chat.error"));
      return;
    }

    const nextSessions = sessions.filter((item) => item.id !== session.id);
    setSessions(nextSessions);
    if (activeSessionId === session.id) {
      const fallback = nextSessions[0];
      if (fallback) {
        setActiveSessionId(fallback.id);
        await fetchHistory(fallback.id);
      } else {
        setActiveSessionId("");
        setMessages([]);
      }
    }
  }

  return (
    <main className="h-screen p-4 bg-slate-50">
      <div className="mb-2 flex gap-2">
        <button onClick={() => setView("chat")}>{t("nav.chat")}</button>
        <button onClick={() => setView("rules")}>{t("nav.rules")}</button>
        <button onClick={() => setView("skills")}>{t("nav.skills")}</button>
        <button onClick={() => setView("agents")}>{t("nav.agents")}</button>
        <button onClick={() => setView("connectors")}>{t("nav.connectors")}</button>
        <button onClick={() => setView("memory")}>{t("nav.memory")}</button>
        <button onClick={() => setView("updates")}>{t("nav.updates")}</button>
        <button onClick={() => setView("settings")}>{t("nav.settings")}</button>
        <button onClick={() => setView("costs")}>{t("nav.costs")}</button>
        <button onClick={() => setView("audit")}>{t("nav.audit")}</button>
        <button onClick={() => setView("onboarding")}>{t("nav.onboarding")}</button>
      </div>
      {view === "rules" ? <RulesEditor /> : null}
      {view === "skills" ? <SkillStore /> : null}
      {view === "agents" ? <AgentStudio /> : null}
      {view === "connectors" ? <ConnectorHub /> : null}
      {view === "memory" ? <MemoryBrowser /> : null}
      {view === "updates" ? <UpdatesPanel /> : null}
      {view === "settings" ? <Settings /> : null}
      {view === "costs" ? <CostsDashboard /> : null}
      {view === "audit" ? <AuditLog /> : null}
      {view === "onboarding" ? <Onboarding /> : null}
      {view === "chat" ? (
      <div className="h-full flex rounded-lg border bg-white overflow-hidden">
        <aside className="w-80 border-r flex flex-col min-h-0">
          <header className="p-3 border-b">
            <h1 className="font-semibold">{t("app.title")}</h1>
            <p className="text-sm text-slate-600">{t("app.subtitle")}</p>
            <button className="mt-3 w-full" onClick={() => void createNewSession()} disabled={isStreaming}>
              {t("chat.newSession")}
            </button>
          </header>

          <div className="p-2 text-xs text-slate-500">{t("chat.sessions")}</div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`border rounded p-2 ${activeSessionId === session.id ? "bg-slate-100" : "bg-white"}`}
              >
                <button
                  className="w-full text-left font-medium"
                  onClick={() => {
                    setActiveSessionId(session.id);
                    void fetchHistory(session.id);
                  }}
                  disabled={isStreaming}
                >
                  {session.title}
                </button>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => void onRenameSession(session)} disabled={isStreaming}>
                    {t("chat.rename")}
                  </button>
                  <button onClick={() => void onDeleteSession(session)} disabled={isStreaming}>
                    {t("chat.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-h-0">
          <header className="p-3 border-b">
            <p className="font-medium">
              {sessions.find((item) => item.id === activeSessionId)?.title ?? t("chat.sessionUntitled")}
            </p>
          </header>

          {error ? <p className="mx-3 mt-3 text-sm text-red-600">{error}</p> : null}
          {lastPendingContent && confirmRuleIds.length > 0 ? (
            <div className="mx-3 mt-2">
              <button onClick={() => void sendMessage(lastPendingContent, confirmRuleIds)} disabled={isStreaming}>
                {t("chat.confirmAndSend")}
              </button>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? <p className="text-sm text-slate-500">{t("chat.noMessages")}</p> : null}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`border rounded p-2 ${
                  message.role === "user" ? "bg-slate-100 border-slate-200" : "bg-white border-slate-300"
                }`}
              >
                <p>
                  <strong>{message.role}:</strong> {message.content || t("chat.streaming")}
                </p>
                <p className="text-xs text-slate-500">
                  {message.model ? `[${message.model}]` : ""}
                  {typeof message.costUsd === "number" ? ` ($${message.costUsd.toFixed(4)})` : ""}
                </p>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <footer className="border-t p-3 bg-white sticky bottom-0">
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-2 py-1"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={t("chat.placeholder")}
              />
              <button onClick={() => void sendMessage()} disabled={isStreaming || !activeSessionId}>
                {t("chat.send")}
              </button>
            </div>
          </footer>
        </section>
      </div>
      ) : null}
    </main>
  );
}
