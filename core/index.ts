import { createServer } from "./server";
import { ensureCogneeSidecar } from "./memory/sidecar-manager";
import { startOpenClaw, stopOpenClaw } from "./openclaw/cli";
import { ensureValuesKernel } from "./security/values";

const port = Number(process.env.CORE_PORT ?? 4317);
const app = createServer();
const valuesPath = ensureValuesKernel();
void ensureCogneeSidecar();
void startOpenClaw();

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of shutdownSignals) {
  process.once(signal, () => {
    void stopOpenClaw().finally(() => {
      process.exit(0);
    });
  });
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Minitron core listening on http://127.0.0.1:${port} (values: ${valuesPath})`);
});
