import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const appRoot = path.resolve(scriptDir, "..");
const srcRoot = path.join(appRoot, "src");

const focusDirs = [
  path.join(srcRoot, "hooks", "useDashboard.ts"),
  path.join(srcRoot, "viewmodels"),
  path.join(srcRoot, "features", "operations", "pages"),
];

const forbiddenRules = [
  {
    name: "final_status fallback to dispatch_status",
    regex: /final_status\s*(\?\?|\|\|)\s*dispatch_status/g,
  },
  {
    name: "hasReceipt participates in status judgement",
    regex: /hasReceipt[\s\S]{0,120}(status|stage|group|final)/gi,
  },
];

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = [...new Set(focusDirs.flatMap((target) => collectFiles(target)))];
const offenders = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const rule of forbiddenRules) {
    const matches = [...text.matchAll(rule.regex)];
    for (const match of matches) {
      const index = match.index ?? 0;
      const line = text.slice(0, index).split("\n").length;
      offenders.push({
        file: path.relative(appRoot, file),
        line,
        rule: rule.name,
        snippet: String(match[0]).replace(/\s+/g, " ").trim(),
      });
    }
  }
}

if (offenders.length > 0) {
  console.error("❌ Operation status convergence check failed:");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.rule}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("✅ Operation status convergence check passed.");
