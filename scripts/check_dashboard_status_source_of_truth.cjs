#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const target = path.join(repoRoot, "apps", "server", "src", "routes", "dashboard_v1.ts");

if (!fs.existsSync(target)) {
  console.error("Dashboard status source-of-truth guard failed: target file not found.");
  console.error(` - ${path.relative(repoRoot, target).replace(/\\/g, "/")}`);
  process.exit(1);
}

const text = fs.readFileSync(target, "utf8");
const rel = path.relative(repoRoot, target).replace(/\\/g, "/");
const forbiddenPatterns = [
  /final_status\s*\?\?\s*dispatch_status/,
  /final_status\s*\|\|\s*dispatch_status/
];

const violations = forbiddenPatterns.filter((pattern) => pattern.test(text));
if (violations.length > 0) {
  console.error("Dashboard status source-of-truth guard failed.");
  console.error("Forbidden fallback found: do not use dispatch_status as fallback of final_status.");
  console.error(` - ${rel}`);
  process.exit(1);
}

console.log("Dashboard status source-of-truth guard passed.");
