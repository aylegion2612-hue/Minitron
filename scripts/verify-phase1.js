async function main() {
  const base = "http://127.0.0.1:4317";

  const createResponse = await fetch(`${base}/chat/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Phase1 Verify" }),
  });
  const created = await createResponse.json();
  const sessionId = created.id;
  console.log("session", sessionId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  const chatResponse = await fetch(`${base}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      sender: "desktop-user",
      content: "hello from phase1",
    }),
    signal: controller.signal,
  });

  if (!chatResponse.ok || !chatResponse.body) {
    clearTimeout(timer);
    throw new Error(`chat failed: ${chatResponse.status}`);
  }

  const reader = chatResponse.body.getReader();
  const decoder = new TextDecoder();
  let sse = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sse += decoder.decode(value, { stream: true });
  }
  clearTimeout(timer);

  const hasDone = sse.includes('"type":"done"');
  console.log("hasDone", hasDone);

  const historyResponse = await fetch(`${base}/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
  const history = await historyResponse.json();
  const count = history.items?.length ?? 0;
  const assistant = count > 0 ? history.items[count - 1].content : "";
  console.log("historyCount", count);
  console.log("assistantText", assistant);
}

main().catch((error) => {
  console.error("verifyError", String(error));
  process.exitCode = 1;
});
