import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const pageFiles = [
  "src/views/CustomerDashboardPage.tsx",
  "src/views/CustomerDashboardExportPage.tsx",
  "src/views/FieldReportPage.tsx",
  "src/views/FieldReportExportPage.tsx",
  "src/views/OperationReportPage.tsx",
  "src/views/OperationReportExportPage.tsx",
  "src/views/CustomerReportExportPage.tsx",
];

const vmFiles = [
  "src/viewmodels/customerDashboardVm.ts",
  "src/viewmodels/fieldReportVm.ts",
  "src/viewmodels/operationReportVm.ts",
];

const labelsFile = "src/lib/customerLabels.ts";

const forbiddenPageImports = ["../api/admin", "../api/debug", "../api/devtools", "../api/reports"];
const allowedReportApiImport = "../api/customerReports";

const forbiddenTokens = [
  "trace_id",
  "operation_plan_id",
  "receipt_id",
  "recommendation_id",
  "/api/v1/facts",
  "/api/admin",
  "/healthz",
  "/openapi",
  "debug",
  "raw_telemetry",
  "raw facts",
  "migration",
  "devtools",
  "legacy/control",
];

const scopedMatchers = [
  /^src\/views\/Customer[^/]*\.tsx$/,
  /^src\/views\/(FieldReportPage|OperationReportPage)\.tsx$/,
  /^src\/viewmodels\/[^/]*ReportVm\.ts$/,
  /^src\/viewmodels\/customerDashboardVm\.ts$/,
  /^src\/components\/customer\/.+$/,
  /^src\/components\/cockpit\/.+$/,
];

const vmRawCodePattern = /["']([A-Z]+_[A-Z0-9_]+)["']/;
const allowPattern = /customer-boundary-allow:\s*(.+)$/;
const offenders = [];
const exemptions = [];

function addOffender(file, line, token, snippet) {
  offenders.push({ file, line, token, snippet: snippet.trim() });
}

function addExemption(file, line, reason, token, snippet) {
  exemptions.push({ file, line, reason: reason.trim(), token, snippet: snippet.trim() });
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
  const previous = lines[lineIndex - 1] ?? "";
  const current = lines[lineIndex] ?? "";
  const next = lines[lineIndex + 1] ?? "";
  for (const candidate of [previous, current, next]) {
    if (!candidate.includes("customer-boundary-allow:")) continue;
    const match = candidate.match(allowPattern);
    if (!match || !match[1]?.trim()) return { valid: false, reason: "" };
    return { valid: true, reason: match[1].trim() };
  }
  return { valid: null, reason: "" };
}

function evaluateLine(relativeFile, lines, lineText, index, token, snippet = lineText) {
  if (!lineText.includes(token)) return;
  const allow = hasAllowComment(lines, index);
  if (allow.valid === true) addExemption(relativeFile, index + 1, allow.reason, token, snippet);
  else if (allow.valid === false) addOffender(relativeFile, index + 1, token, `${snippet} [missing allow reason]`);
  else addOffender(relativeFile, index + 1, token, snippet);
}

function scanPageLayer() {
  for (const relativeFile of pageFiles) {
    const fullPath = path.join(appRoot, relativeFile);
    if (!fs.existsSync(fullPath)) {
      addOffender(relativeFile, 0, "<missing-file>", "Target page file does not exist");
      continue;
    }

    const lines = fs.readFileSync(fullPath, "utf8").split("\n");
    lines.forEach((lineText, index) => {
      for (const token of forbiddenPageImports) {
        if (lineText.includes("import") && lineText.includes(token)) {
          evaluateLine(relativeFile, lines, lineText, index, token);
        }
      }
      if (lineText.includes("import") && lineText.includes("../api/") && lineText.includes("report") && !lineText.includes(allowedReportApiImport)) {
        evaluateLine(relativeFile, lines, lineText, index, allowedReportApiImport, `Report API import must come from ${allowedReportApiImport}: ${lineText.trim()}`);
      }
      for (const token of forbiddenTokens) evaluateLine(relativeFile, lines, lineText, index, token);
    });
  }
}

function scanDynamicRoots() {
  const files = listFilesRecursively(path.join(appRoot, "src")).map((file) => path.relative(appRoot, file));
  for (const relativeFile of files) {
    if (!scopedMatchers.some((pattern) => pattern.test(relativeFile))) continue;
    const fullPath = path.join(appRoot, relativeFile);
    const lines = fs.readFileSync(fullPath, "utf8").split("\n");
    lines.forEach((lineText, index) => {
      for (const token of forbiddenTokens) evaluateLine(relativeFile, lines, lineText, index, token);
    });
  }
}

function scanVmLayer() {
  for (const relativeFile of vmFiles) {
    if (relativeFile === labelsFile) continue;
    const fullPath = path.join(appRoot, relativeFile);
    if (!fs.existsSync(fullPath)) {
      addOffender(relativeFile, 0, "<missing-file>", "Target VM file does not exist");
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split("\n");
    const hasRawCode = lines.some((line) => vmRawCodePattern.test(line));

    if (!hasRawCode) continue;

    const hasLabelMapping = content.includes("../lib/customerLabels") && (content.includes("CUSTOMER_LABELS") || /\blabel[A-Z]\w*/.test(content));
    if (!hasLabelMapping) addOffender(relativeFile, 1, "customerLabels.ts", "VM has raw code but no customerLabels mapping import/usage");
  }
}

scanPageLayer();
scanVmLayer();
scanDynamicRoots();

if (exemptions.length > 0) {
  console.log("CUSTOMER_BOUNDARY_CHECK EXEMPTIONS");
  for (const exemption of exemptions) {
    console.log(` - ${exemption.file}:${exemption.line} [${exemption.token}] reason=${exemption.reason} :: ${exemption.snippet}`);
  }
}

if (offenders.length > 0) {
  console.error("CUSTOMER_BOUNDARY_CHECK FAIL");
  for (const offender of offenders) console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  process.exit(1);
}

console.log("CUSTOMER_BOUNDARY_CHECK PASS");
