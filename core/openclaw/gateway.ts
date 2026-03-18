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

  constructor(endpoint = "ws://127.0.0.1:18789") {
    this.endpoint = endpoint;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  async *sendMessageStream(sessionId: string, content: string): AsyncGenerator<StreamChunk> {
    const liveGatewayEnabled = process.env.MINITRON_OPENCLAW_LIVE === "1";

    if (liveGatewayEnabled && (await this.healthCheck())) {
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
            break;
          }
        }

        if (yielded) {
          yield { text: "", done: true };
          return;
        }
      } catch {
        // Use local fallback below.
      }
    }

    // Deterministic local fallback for offline/dev-first behavior.
    const synthetic = `Minitron received: ${content}`;
    const words = synthetic.split(" ");

    for (const word of words) {
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
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
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

    socket.close();
  }

  async healthCheck(): Promise<boolean> {
    if (this.healthy) {
      return true;
    }

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
          socket.close();
          resolve();
        });
        socket.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      this.healthy = true;
      return true;
    } catch {
      this.healthy = false;
      return false;
    }
  }
}
