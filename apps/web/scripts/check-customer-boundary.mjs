import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const appRoot = path.resolve(scriptDir, "..");

const pageFiles = [
  "src/views/CustomerDashboardPage.tsx",
  "src/views/CustomerDashboardExportPage.tsx",
];

const vmDir = path.join(appRoot, "src/viewmodels");
const labelsFile = "src/lib/customerLabels.ts";

const forbiddenPageImports = [
  "../api/reports",
  "../api/admin",
  "../api/debug",
  "../api/devtools",
];

const forbiddenTokens = [
  "trace_id",
  "operation_plan_id",
  "receipt_id",
  "recommendation_id",
];

const vmRawCodePattern = /["']([A-Z]+_[A-Z0-9_]+)["']/;
const offenders = [];

function addOffender(file, line, token, snippet) {
  offenders.push({ file, line, token, snippet: snippet.trim() });
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
          addOffender(relativeFile, index + 1, token, lineText);
        }
      }
      for (const token of forbiddenTokens) {
        if (lineText.includes(token)) {
          addOffender(relativeFile, index + 1, token, lineText);
        }
      }
    });
  }
}

function getVmFiles() {
  if (!fs.existsSync(vmDir)) return [];
  return fs.readdirSync(vmDir)
    .filter((name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && /customer/i.test(name))
    .map((name) => path.join(vmDir, name));
}

function scanVmLayer() {
  const vmFiles = getVmFiles();
  for (const fullPath of vmFiles) {
    const relativeFile = path.relative(appRoot, fullPath).split(path.sep).join("/");
    if (relativeFile === labelsFile) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split("\n");
    const hasRawCode = lines.some((line) => vmRawCodePattern.test(line));

    if (!hasRawCode) continue;

    const hasLabelMapping =
      content.includes("../lib/customerLabels")
      && (content.includes("CUSTOMER_LABELS") || /\blabel[A-Z]\w*/.test(content));

    if (!hasLabelMapping) {
      addOffender(relativeFile, 1, "customerLabels.ts", "VM has raw code but no customerLabels mapping import/usage");
    }
  }
}

scanPageLayer();
scanVmLayer();

if (offenders.length > 0) {
  console.error("CUSTOMER_BOUNDARY_CHECK FAIL");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("CUSTOMER_BOUNDARY_CHECK PASS");
