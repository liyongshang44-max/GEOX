const fs = require("node:fs");
const path = require("node:path");
const base = path.resolve(__dirname, "..");
const dist = path.join(base, "dist");
fs.mkdirSync(dist, { recursive: true });
const entries = [
  ["server.js", "./apps/server/src/server.js"],
  [path.join("jobs", "runtime.js"), "../apps/server/src/jobs/runtime.js"],
];
for (const [name, target] of entries) {
  const fp = path.join(dist, name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `import ${JSON.stringify(target)};
`, "utf8");
}
