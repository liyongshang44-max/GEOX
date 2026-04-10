import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const AO_ACT_TASK_SCHEMA_RULES_V0 = Object.freeze({
  irrigate_minimal_example: {
    action_type: "IRRIGATE",
    parameter_schema: {
      keys: [{ name: "duration_sec", type: "number", min: 1 }],
    },
  },
});

const ALLOWED_KEYS = new Set(AO_ACT_TASK_SCHEMA_RULES_V0.irrigate_minimal_example.parameter_schema.keys.map((k) => k.name));

function listSmokeScripts() {
  return fs
    .readdirSync(ROOT)
    .filter((name) => /\.(mjs|ts)$/.test(name) && /(?:smoke|p1_skill_loop_minimal)/i.test(name))
    .map((name) => path.join(ROOT, name));
}

function extractParameterKeys(content) {
  const hits = [];
  const pattern = /parameters\s*:\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = pattern.exec(content))) {
    const block = m[1];
    const keys = [...block.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((x) => x[1]);
    hits.push(...keys);
  }
  return hits;
}

const violations = [];
for (const file of listSmokeScripts()) {
  const content = fs.readFileSync(file, "utf8");
  for (const key of extractParameterKeys(content)) {
    if (!ALLOWED_KEYS.has(key)) violations.push({ file, key });
  }
}

if (violations.length > 0) {
  console.error("[check_smoke_parameter_keys] out-of-bound keys found:");
  for (const v of violations) {
    console.error(`- ${path.relative(process.cwd(), v.file)} :: ${v.key}`);
  }
  process.exit(1);
}

console.log("[check_smoke_parameter_keys] ok");
