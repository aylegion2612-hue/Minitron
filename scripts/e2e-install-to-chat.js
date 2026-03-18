async function main() {
  const base = process.env.MINITRON_E2E_BASE_URL ?? "http://127.0.0.1:4317";

  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error("Health check failed");

  const sessionRes = await fetch(`${base}/chat/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "E2E Install To Chat" }),
  });
  if (!sessionRes.ok) throw new Error("Session creation failed");
  const session = await sessionRes.json();

  const chatRes = await fetch(`${base}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: session.id,
      sender: "e2e-user",
      content: "hello from e2e",
    }),
  });
  if (!chatRes.ok || !chatRes.body) throw new Error("Chat request failed");

  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let all = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    all += decoder.decode(value, { stream: true });
  }

  if (!all.includes('"type":"done"')) {
    throw new Error("SSE stream did not finish");
  }

  const historyRes = await fetch(`${base}/chat/history?sessionId=${encodeURIComponent(session.id)}`);
  if (!historyRes.ok) throw new Error("History fetch failed");
  const history = await historyRes.json();

  if (!Array.isArray(history.items) || history.items.length < 2) {
    throw new Error("History entries missing");
  }

  // eslint-disable-next-line no-console
  console.log("E2E passed:", {
    sessionId: session.id,
    entries: history.items.length,
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("E2E failed:", error);
  process.exitCode = 1;
});
