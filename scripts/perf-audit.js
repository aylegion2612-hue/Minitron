async function main() {
  const base = process.env.MINITRON_PERF_BASE_URL ?? "http://127.0.0.1:4317";

  const t0 = Date.now();
  const health = await fetch(`${base}/health`);
  const startupMs = Date.now() - t0;
  if (!health.ok) {
    throw new Error("Core is not healthy");
  }

  const memory = process.memoryUsage();
  const rssMb = memory.rss / (1024 * 1024);

  const report = {
    startupMs,
    rssMb: Number(rssMb.toFixed(2)),
    startupTargetMs: 3000,
    memoryTargetMb: 200,
    startupPass: startupMs < 3000,
    memoryPass: rssMb < 200,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Performance audit failed:", error);
  process.exitCode = 1;
});
