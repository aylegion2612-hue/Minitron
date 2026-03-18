const fs = require("fs");
const path = require("path");

function exists(p) {
  return fs.existsSync(path.resolve(process.cwd(), p));
}

function read(p) {
  return fs.readFileSync(path.resolve(process.cwd(), p), "utf8");
}

function check() {
  const results = [];

  // Required files
  const requiredFiles = [
    "package.json",
    "electron-builder.yml",
    ".github/workflows/release.yml",
    "landing/index.html",
    "landing/landing-config.js",
    "RELEASE_CHECKLIST.md",
  ];
  for (const file of requiredFiles) {
    results.push({
      name: `file:${file}`,
      ok: exists(file),
      detail: exists(file) ? "present" : "missing",
    });
  }

  // Placeholder checks
  const pkg = JSON.parse(read("package.json"));
  const repoUrl = pkg.repository?.url ?? "";
  const landingCfg = read("landing/landing-config.js");
  results.push({
    name: "repository.url",
    ok: typeof repoUrl === "string" && !repoUrl.includes("owner/repo"),
    detail: repoUrl || "missing",
  });
  results.push({
    name: "landing.MINITRON_REPO",
    ok: !landingCfg.includes("owner/repo"),
    detail: landingCfg.includes("owner/repo") ? "placeholder detected" : "configured",
  });

  return results;
}

const results = check();
const failed = results.filter((r) => !r.ok);

for (const row of results) {
  // eslint-disable-next-line no-console
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name} :: ${row.detail}`);
}

if (failed.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Release-ready check failed (${failed.length} issue(s)).`);
  process.exitCode = 1;
} else {
  // eslint-disable-next-line no-console
  console.log("Release-ready check passed.");
}
