import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const targetFiles = [
  "src/views/CustomerDashboardPage.tsx",
  "src/views/CustomerDashboardExportPage.tsx",
  "src/views/FieldReportPage.tsx",
  "src/views/FieldReportExportPage.tsx",
  "src/views/OperationReportPage.tsx",
  "src/views/CustomerReportExportPage.tsx",
  "src/viewmodels/customerDashboardVm.ts",
  "src/viewmodels/fieldReportVm.ts",
  "src/viewmodels/operationReportVm.ts",
];

const targetDirectories = ["src/components/customer", "src/components/cockpit"];

const forbiddenTokens = [
  "field_sensing_overview_v1",
  "field_fertility_state_v1",
  "source_observation_ids",
  "execution_trace",
  "skill_trace",
  "trace_gap",
  "/api/v1/",
  "PageHeader",
  "KpiStrip",
  "ReportExportCTA",
  "Skill trace",
];

const allowPattern = /customer-boundary-allow:\s*(.+)$/;
const highWeightLinePattern = /(title\s*=|sectionTitle|decisionItemTitle|decisionItemMeta|<h[1-6]|eyebrow\s*=|description\s*=)/;
const offenders = [];
const exemptions = [];

function hasNearby(lines, lineIndex, pattern, distance = 80) {
  const from = Math.max(0, lineIndex - distance);
  const to = Math.min(lines.length - 1, lineIndex + distance);
  for (let i = from; i <= to; i += 1) if (pattern.test(lines[i])) return true;
  return false;
}

function listFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) result.push(...listFilesRecursively(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

function hasAllowComment(lines, lineIndex) {
  for (const candidate of [lines[lineIndex - 1] ?? "", lines[lineIndex] ?? "", lines[lineIndex + 1] ?? ""]) {
    if (!candidate.includes("customer-boundary-allow:")) continue;
    const match = candidate.match(allowPattern);
    if (!match || !match[1]?.trim()) return { valid: false, reason: "" };
    return { valid: true, reason: match[1].trim() };
  }
  return { valid: null, reason: "" };
}

function recordFinding({ file, line, token, snippet }) {
  const lines = fs.readFileSync(path.join(appRoot, file), "utf8").split("\n");
  const allow = hasAllowComment(lines, line - 1);
  if (allow.valid === true) exemptions.push({ ...arguments[0], reason: allow.reason });
  else if (allow.valid === false) offenders.push({ ...arguments[0], snippet: `${snippet} [missing allow reason]` });
  else offenders.push(arguments[0]);
}

const allTargets = [...targetFiles];
for (const directory of targetDirectories) {
  const directoryFiles = listFilesRecursively(path.join(appRoot, directory)).map((file) => path.relative(appRoot, file));
  allTargets.push(...directoryFiles);
}

for (const relativeFile of [...new Set(allTargets)]) {
  const fullPath = path.join(appRoot, relativeFile);
  if (!fs.existsSync(fullPath)) {
    offenders.push({ file: relativeFile, line: 0, token: "<missing-file>", snippet: "Target file does not exist" });
    continue;
  }

  const lines = fs.readFileSync(fullPath, "utf8").split("\n");

  lines.forEach((lineText, index) => {
    if (!highWeightLinePattern.test(lineText)) return;
    for (const token of forbiddenTokens) {
      if (!lineText.includes(token)) continue;
      recordFinding({ file: relativeFile, line: index + 1, token, snippet: lineText.trim() });
    }
  });
}

if (exemptions.length > 0) {
  console.log("CUSTOMER_FACING_BOUNDARY EXEMPTIONS");
  for (const exemption of exemptions) {
    console.log(` - ${exemption.file}:${exemption.line} [${exemption.token}] reason=${exemption.reason} :: ${exemption.snippet}`);
  }
}

if (offenders.length > 0) {
  console.error("❌ Customer-facing boundary check failed:");
  console.error("   Do not expose internal object names in customer-facing high-weight fields.");
  for (const offender of offenders) console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  process.exit(1);
}

console.log("✅ Customer-facing boundary check passed.");
