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

const forbiddenPageImports = [
  "../api/admin",
  "../api/debug",
  "../api/devtools",
  "../api/reports",
];

const allowedReportApiImport = "../api/customerReports";

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
      if (
        lineText.includes("import")
        && lineText.includes("../api/")
        && lineText.includes("report")
        && !lineText.includes(allowedReportApiImport)
      ) {
        addOffender(relativeFile, index + 1, allowedReportApiImport, `Report API import must come from ${allowedReportApiImport}: ${lineText.trim()}`);
      }
      for (const token of forbiddenTokens) {
        if (lineText.includes(token)) {
          addOffender(relativeFile, index + 1, token, lineText);
        }
      }
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

const requiredScopeMarkers = [
  "CustomerDashboardPage",
  "CustomerDashboardExportPage",
  "FieldReportPage",
  "FieldReportExportPage",
  "OperationReportPage",
  "OperationReportExportPage",
];

for (const marker of requiredScopeMarkers) {
  const inScope = pageFiles.some((file) => file.includes(marker));
  if (!inScope) {
    addOffender("check-customer-boundary.mjs", 1, "<scope-missing>", `Missing ${marker} in pageFiles scan scope`);
  }
}

if (offenders.length > 0) {
  console.error("CUSTOMER_BOUNDARY_CHECK FAIL");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("CUSTOMER_BOUNDARY_CHECK PASS");


const dashboardForbiddenTokens = ["PageHeader", "KpiStrip", "ReportExportCTA", "/customer/acceptance", "/customer/devices", "/customer/reports"];
const fieldForbiddenTokens = ["天气", "weather"];
const operationForbiddenTokens = ["DONE", "MISSING", "PENDING", "NOT_APPLICABLE", "AVAILABLE", "Skill trace"];

function scanSmokeChecklist() {
  const dashboardFile = path.join(appRoot, "src/views/CustomerDashboardPage.tsx");
  const fieldFile = path.join(appRoot, "src/views/FieldReportPage.tsx");
  const operationFile = path.join(appRoot, "src/views/OperationReportPage.tsx");

  if (fs.existsSync(dashboardFile)) {
    const text = fs.readFileSync(dashboardFile, "utf8");
    for (const token of dashboardForbiddenTokens) {
      if (text.includes(token)) addOffender("src/views/CustomerDashboardPage.tsx", 1, token, "Forbidden token/link in dashboard customer page");
    }
  }

  if (fs.existsSync(fieldFile)) {
    const text = fs.readFileSync(fieldFile, "utf8");
    for (const token of fieldForbiddenTokens) {
      if (text.includes(token)) addOffender("src/views/FieldReportPage.tsx", 1, token, "Field page should not render weather card wording");
    }
  }

  if (fs.existsSync(operationFile)) {
    const text = fs.readFileSync(operationFile, "utf8");
    for (const token of operationForbiddenTokens) {
      if (text.includes(token)) addOffender("src/views/OperationReportPage.tsx", 1, token, "Forbidden raw status or technical wording in operation customer page");
    }
    if (!text.includes("<details")) addOffender("src/views/OperationReportPage.tsx", 1, "<details", "Technical details should be collapsible by default");
  }
}

scanSmokeChecklist();
