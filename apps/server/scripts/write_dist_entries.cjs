const fs = require("node:fs");
const path = require("node:path");

const base = path.resolve(__dirname, "..");
const dist = path.join(base, "dist");
fs.mkdirSync(dist, { recursive: true });

const entries = [
  {
    name: "server.js",
    content: `import "./apps/server/src/server.js";\n`,
  },
  {
    name: path.join("jobs", "runtime.js"),
    content: `import { runJobsRuntime } from "../apps/server/src/jobs/runtime.js";

runJobsRuntime().catch((error) => {
  console.error(\`FATAL: jobs runtime crashed: \${error instanceof Error ? error.stack ?? error.message : String(error)}\`);
  process.exit(1);
});
`,
  },
];

for (const entry of entries) {
  const fp = path.join(dist, entry.name);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, entry.content, "utf8");
}
