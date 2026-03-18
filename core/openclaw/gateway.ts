import { spawn } from "node:child_process";
import path from "node:path";

type StreamChunk = {
  text: string;
  done?: boolean;
};

type GatewayMessage =
  | { type: "chunk"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export class OpenClawGateway {
  private readonly endpoint: string;
  private healthy = false;
  private connected = false;

  constructor(endpoint = "ws://127.0.0.1:18789") {
    this.endpoint = endpoint;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async *sendMessage(sessionId: string, content: string): AsyncGenerator<StreamChunk> {
    yield* this.sendMessageStream(sessionId, content);
  }

  async *sendMessageStream(sessionId: string, content: string): AsyncGenerator<StreamChunk> {
    // Always attempt live gateway first; only fallback when unreachable/failed.
    let wsAttempted = false;
    if (await this.healthCheck()) {
      wsAttempted = true;
      this.log(`connected=${this.connected} endpoint=${this.endpoint}`);
      try {
        let yielded = false;
        for await (const msg of this.sendGatewayRequest(sessionId, content)) {
          if (msg.type === "chunk") {
            yielded = true;
            yield { text: msg.text };
          }
          if (msg.type === "done") {
            yield { text: "", done: true };
            return;
          }
          if (msg.type === "error") {
            this.log(`gateway-stream-error: ${msg.message}`);
            break;
          }
        }

        if (yielded) {
          yield { text: "", done: true };
          return;
        }
      } catch (error) {
        this.log(`gateway-request-failed: ${error instanceof Error ? error.message : "unknown"}`);
      }
    } else {
      this.log(`gateway-unreachable: ${this.endpoint}`);
    }

    // Secondary live path: call OpenClaw agent CLI against the gateway session.
    // This still uses OpenClaw runtime and avoids fake synthetic output.
    const cli = await this.sendViaCli(sessionId, content);
    if (cli.ok && cli.text.trim().length > 0) {
      yield { text: cli.text.trim() };
      yield { text: "", done: true };
      return;
    }
    if (cli.error) {
      yield { text: cli.error.trim() };
      yield { text: "", done: true };
      return;
    }

    // Deterministic local fallback only when live gateway request is unavailable.
    if (wsAttempted) {
      this.log("ws attempted but no output; using synthetic fallback");
    } else {
      this.log("ws unreachable and cli unavailable; using synthetic fallback");
    }
    const synthetic = `Minitron received: ${content}`;
    for (const word of synthetic.split(" ")) {
      await new Promise((resolve) => setTimeout(resolve, 35));
      yield { text: `${word} ` };
    }
    yield { text: "", done: true };
  }

  private async *sendGatewayRequest(
    sessionId: string,
    content: string,
  ): AsyncGenerator<GatewayMessage> {
    type WsLike = {
      close(): void;
      once(event: "open", cb: () => void): void;
      once(event: "error", cb: (error: Error) => void): void;
      on(event: "message", cb: (raw: unknown) => void): void;
      send(payload: string): void;
    };
    type WsCtor = new (url: string) => WsLike;

    const wsModule = await import("ws");
    const wsExport = wsModule as unknown as { default?: WsCtor; WebSocket?: WsCtor };
    const WebSocketCtor = wsExport.WebSocket ?? wsExport.default;
    if (!WebSocketCtor) {
      throw new Error("WebSocket constructor unavailable");
    }

    const socket = new WebSocketCtor(this.endpoint);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Gateway connect timeout")), 1200);
      socket.once("open", () => {
        clearTimeout(timer);
        this.connected = true;
        this.log(`ws-open ${this.endpoint}`);
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        this.connected = false;
        this.log(`ws-error ${error.message}`);
        reject(error);
      });
    });

    const queue: GatewayMessage[] = [];
    let closed = false;
    let errored = false;

    socket.on("message", (raw) => {
      try {
        const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
        const parsed = JSON.parse(text) as Partial<GatewayMessage> & { event?: string; content?: string };
        if (parsed.type === "chunk" && typeof parsed.text === "string") {
          queue.push({ type: "chunk", text: parsed.text });
          return;
        }
        if (parsed.type === "done" || parsed.event === "done") {
          queue.push({ type: "done" });
          closed = true;
          return;
        }
        if (parsed.event === "chunk" && typeof parsed.content === "string") {
          queue.push({ type: "chunk", text: parsed.content });
          return;
        }
      } catch {
        // ignore non-JSON messages
      }
    });

    socket.once("error", () => {
      this.connected = false;
      errored = true;
      queue.push({ type: "error", message: "Gateway stream error" });
    });

    socket.send(
      JSON.stringify({
        type: "sendMessage",
        sessionId,
        content,
      }),
    );

    const startedAt = Date.now();
    while (!closed && !errored) {
      if (queue.length > 0) {
        const next = queue.shift() as GatewayMessage;
        yield next;
        if (next.type === "done" || next.type === "error") {
          closed = true;
        }
        continue;
      }

      if (Date.now() - startedAt > 4000) {
        queue.push({ type: "error", message: "Gateway stream timeout" });
      }

      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    this.connected = false;
    socket.close();
  }

  async healthCheck(): Promise<boolean> {
    try {
      type WsLike = {
        close(): void;
        once(event: "open", cb: () => void): void;
        once(event: "error", cb: (error: Error) => void): void;
      };

      type WsCtor = new (url: string) => WsLike;

      const wsModule = await import("ws");
      const wsExport = wsModule as unknown as { default?: WsCtor; WebSocket?: WsCtor };
      const WebSocketCtor = wsExport.WebSocket ?? wsExport.default;
      if (!WebSocketCtor) {
        throw new Error("WebSocket constructor unavailable");
      }

      const socket = new WebSocketCtor(this.endpoint);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error("Gateway health check timeout"));
        }, 900);

        socket.once("open", () => {
          clearTimeout(timer);
          this.connected = true;
          socket.close();
          resolve();
        });
        socket.once("error", (error) => {
          clearTimeout(timer);
          this.connected = false;
          reject(error);
        });
      });
      this.healthy = true;
      this.log(`health-ok ${this.endpoint}`);
      return true;
    } catch (error) {
      this.healthy = false;
      this.connected = false;
      this.log(`health-failed ${error instanceof Error ? error.message : "unknown"}`);
      return false;
    }
  }

  private log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`[openclaw-gateway] ${message}`);
  }

  private sendViaCli(
    sessionId: string,
    content: string,
  ): Promise<{ ok: boolean; text: string; error?: string }> {
    return new Promise((resolve) => {
      const vendorDir = path.resolve(process.cwd(), "vendor", "openclaw");
      const child = spawn(
        "npx",
        ["openclaw", "agent", "--session-id", sessionId, "--message", content, "--thinking", "low"],
        {
          cwd: vendorDir,
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      });

      child.once("error", (error) => {
        this.log(`cli-spawn-error: ${error.message}`);
        resolve({ ok: false, text: "", error: error.message });
      });

      child.once("close", (code) => {
        const text = stdout.trim();
        const err = stderr.trim();
        if (code === 0 && text.length > 0) {
          this.log("cli-response-ok");
          resolve({ ok: true, text });
          return;
        }
        const merged = [text, err].filter(Boolean).join("\n").trim();
        this.log(`cli-response-failed code=${String(code ?? "null")}`);
        resolve({ ok: false, text: "", error: merged || "OpenClaw CLI request failed." });
      });
    });
  }
}
