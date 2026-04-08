#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const scanRoots = [
  path.join(repoRoot, "apps", "server", "src", "routes"),
  path.join(repoRoot, "apps", "executor", "src"),
];

const scopePattern = /simulator|sim[-_]?runner|runner/i;
const forbiddenPattern = /(insert\s+into\s+(facts|telemetry_index_v1|device_status_index_v1))|(update\s+device_status_index_v1)/i;
const sqlTagPattern = /`[^`]*`|"[^"]*"|'[^']*'/gs;

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!full.endsWith(".ts") && !full.endsWith(".tsx") && !full.endsWith(".js") && !full.endsWith(".mjs") && !full.endsWith(".cjs")) continue;
    const rel = path.relative(repoRoot, full).replace(/\\/g, "/");
    if (!scopePattern.test(rel)) continue;

    const text = fs.readFileSync(full, "utf8");
    const matches = text.match(sqlTagPattern) || [];
    for (const snippet of matches) {
      const normalized = snippet.replace(/\s+/g, " ");
      if (forbiddenPattern.test(normalized)) {
        violations.push(rel);
        break;
      }
    }
  }
}

for (const root of scanRoots) walk(root);

if (violations.length > 0) {
  console.error("Simulator ingest guard failed: direct SQL write found in simulator code path.");
  for (const file of violations) console.error(` - ${file}`);
  process.exit(1);
}

console.log("Simulator ingest guard passed: no direct SQL write found in simulator code path.");
