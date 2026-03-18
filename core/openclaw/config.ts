import fs from "node:fs";
import path from "node:path";

export type OpenClawConfig = {
  agent: {
    model: string;
    workspace: string;
  };
  channels: Record<string, Record<string, unknown>>;
};

export function writeOpenClawConfig(config: OpenClawConfig): void {
  const outDir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "openclaw.json"), JSON.stringify(config, null, 2), "utf8");
}
