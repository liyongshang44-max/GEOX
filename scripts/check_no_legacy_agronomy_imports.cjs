#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const scanRoot = path.join(repoRoot, "apps", "server", "src");

const allowlist = new Set([
  "apps/server/src/domain/acceptance/engine_v1.ts",
]);

const violations = [];
const pattern = /from\s+["'][^"']*agronomy\/skills[^"']*["']/g;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!full.endsWith(".ts") && !full.endsWith(".tsx")) continue;
    const rel = path.relative(repoRoot, full).replace(/\\/g, "/");
    const text = fs.readFileSync(full, "utf8");
    if (!pattern.test(text)) continue;
    if (allowlist.has(rel)) continue;
    violations.push(rel);
  }
}

walk(scanRoot);

if (violations.length > 0) {
  console.error("Found forbidden imports from \"agronomy/skills\".");
  console.error("New runtime features must not introduce new entrypoints from apps/server/src/domain/agronomy/skills/*.");
  for (const v of violations) console.error(` - ${v}`);
  process.exit(1);
}

console.log("No forbidden agronomy/skills imports found.");
