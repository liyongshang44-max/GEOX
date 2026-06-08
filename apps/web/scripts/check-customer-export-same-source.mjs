import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const requiredImports = [
  { file: "src/views/CustomerDashboardExportPage.tsx", symbol: "buildCustomerDashboardVm" },
  { file: "src/views/FieldReportExportPage.tsx", symbol: "buildFieldReportVm" },
  { file: "src/views/CustomerReportExportPage.tsx", symbol: "buildOperationReportVm" },
];

const optionalCompatOperationExport = "src/views/OperationReportExportPage.tsx";
const unifiedExportPage = "src/views/CustomerReportExportPage.tsx";
const fieldCompatExportPage = "src/views/FieldReportExportPage.tsx";
const exportBlocksFile = "src/components/customer/CustomerExportBlocks.tsx";

const forbiddenMapSymbols = ["STATUS_MAP", "RISK_MAP", "ACCEPTANCE_MAP"];
const forbiddenApiTokens = [
  "../api/admin",
  "../api/debug",
  "../api/devtools",
  "../api/weather",
  "../api/operatorEvidence",
  "../api/operatorSkillTrace",
  "../api/operatorFieldMemory",
  "../api/operatorRoiLedger",
  "raw_telemetry",
  "legacy/control",
];
const forbiddenExportBusinessApiCalls = [
  "fetchWeatherHistory",
  "fetchWeatherForecast",
  "fetchOperationEnvironmentContext",
  "fetchOperatorEvidence",
  "fetchOperatorEvidenceJobDetail",
  "createOperatorEvidenceExportJob",
  "fetchOperatorSkillTraces",
  "fetchOperatorSkillPerformance",
  "fetchOperatorFieldMemory",
  "fetchOperatorRoiLedger",
];
const forbiddenExportBlockTokens = [
  "FieldGisMap",
  "createOperatorEvidenceExportJob",
  "fetchWeatherHistory",
  "fetchWeatherForecast",
  "fetchOperatorEvidence",
  "fetchOperatorSkillTraces",
  "download_url",
  "downloadUrl:",
  "href={sameSource",
  "href={row.download",
  "type: \"FeatureCollection\"",
  "type:'FeatureCollection'",
  "customerC8FormalReportVm",
  "buildC8FieldMainVisualVm",
  "buildC8OperationMainVisualVm",
  "buildFormalScenarioVm",
  "buildEvidenceVm",
  "customerGuardedStatusText",
  "customerGuardedEvidenceText",
  "customerGuardedAcceptanceText",
  "buildOperationSameSourceExportSummary",
  "buildFieldSameSourceExportSummary",
];

const requiredUnifiedExportSnippets = [
  "fetchFieldReport(fieldId)",
  "fetchOperationReport(operationId)",
  "buildFieldReportVm(report)",
  "buildOperationReportVm(report)",
  "<FieldExportBlocks vm={vm} report={report} />",
  "<OperationExportBlocks vm={vm} report={report} />",
];

const requiredFieldCompatSnippets = [
  "fetchFieldReport(fieldId)",
  "setReport(nextReport)",
  "buildFieldReportVm(nextReport)",
  "<FieldExportBlocks vm={vm} report={report} />",
];

const requiredExportBlockSnippets = [
  "buildCustomerFieldReportMainVisualVm",
  "buildCustomerOperationReportMainVisualVm",
  "mainVisual.rows.map",
  "<MainVisualExportBlocks mainVisual={mainVisual} />",
];

const offenders = [];

function readFile(file) {
  const fullPath = path.join(appRoot, file);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

function addOffender(file, line, rule, snippet) {
  offenders.push({ file, line, rule, snippet: snippet.trim() });
}

function lineNumber(text, snippet) {
  const index = text.indexOf(snippet);
  if (index < 0) return 0;
  return text.slice(0, index).split("\n").length;
}

function requireSnippets(file, text, snippets, rule) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) addOffender(file, 1, rule, `Missing required same-source snippet: ${snippet}`);
  }
}

function scanForbiddenTokens(file, text) {
  const lines = text.split("\n");
  lines.forEach((lineText, index) => {
    for (const token of forbiddenMapSymbols) {
      if (lineText.includes(token)) addOffender(file, index + 1, "forbidden-local-map", `${token} must not be defined in export pages`);
    }
    for (const token of forbiddenApiTokens) {
      if (lineText.includes("import") && lineText.includes(token)) addOffender(file, index + 1, "forbidden-api-import", lineText);
    }
    for (const token of forbiddenExportBusinessApiCalls) {
      if (lineText.includes(token) && !lineText.includes("fetchFieldReport") && !lineText.includes("fetchOperationReport") && !lineText.includes("fetchCustomerDashboardAggregate")) {
        addOffender(file, index + 1, "forbidden-export-business-call", lineText);
      }
    }
  });
}

for (const item of requiredImports) {
  const text = readFile(item.file);
  if (!text) {
    addOffender(item.file, 0, "missing-file", "Target export page does not exist");
    continue;
  }

  const lines = text.split("\n");
  const hasImport = lines.some((line) => line.includes("import") && line.includes(item.symbol));
  if (!hasImport) addOffender(item.file, 1, "missing-required-vm-import", `Export page must import ${item.symbol}`);

  scanForbiddenTokens(item.file, text);
}

const unifiedText = readFile(unifiedExportPage);
if (unifiedText) {
  requireSnippets(unifiedExportPage, unifiedText, requiredUnifiedExportSnippets, "missing-unified-same-source-chain");
}

const fieldCompatText = readFile(fieldCompatExportPage);
if (fieldCompatText) {
  requireSnippets(fieldCompatExportPage, fieldCompatText, requiredFieldCompatSnippets, "missing-field-compat-same-source-chain");
}

const blocksText = readFile(exportBlocksFile);
if (!blocksText) {
  addOffender(exportBlocksFile, 0, "missing-file", "CustomerExportBlocks does not exist");
} else {
  requireSnippets(exportBlocksFile, blocksText, requiredExportBlockSnippets, "missing-p2-same-source-export-field");
  scanForbiddenTokens(exportBlocksFile, blocksText);
  for (const token of forbiddenExportBlockTokens) {
    if (blocksText.includes(token)) addOffender(exportBlocksFile, lineNumber(blocksText, token), "forbidden-export-block-token", token);
  }

  const reportMainVisualText = readFile("src/viewmodels/customerReportMainVisualVm.ts") ?? "";
  for (const snippet of ["INSUFFICIENT_REPORT", "缺少正式 report API 数据"]) {
    if (!reportMainVisualText.includes(snippet)) addOffender("src/viewmodels/customerReportMainVisualVm.ts", 1, "missing-insufficient-report-vm", `Customer report main visual VM must own insufficient wording: ${snippet}`);
  }
  const operationBlockSignature = "export function OperationExportBlocks({";
  const fieldBlockSignature = "export function FieldExportBlocks({";
  if (!blocksText.includes(operationBlockSignature) || !blocksText.includes("report?: OperationReportV1 | null")) addOffender(exportBlocksFile, 1, "operation-block-must-receive-report", "OperationExportBlocks must receive report");
  if (!blocksText.includes(fieldBlockSignature) || !blocksText.includes("report?: FieldReportDetailV1 | null")) addOffender(exportBlocksFile, 1, "field-block-must-receive-report", "FieldExportBlocks must receive report");
}

const compatFullPath = path.join(appRoot, optionalCompatOperationExport);
if (fs.existsSync(compatFullPath)) {
  const compatText = fs.readFileSync(compatFullPath, "utf8");
  const isPureReExport = /^\s*export\s+\{\s*default\s*\}\s+from\s+["']\.\/CustomerReportExportPage["'];?\s*$/m.test(compatText)
    && !compatText.includes("function ")
    && !compatText.includes("buildOperationReportVm");
  if (!isPureReExport) {
    addOffender(optionalCompatOperationExport, 1, "operation-export-must-reexport", "OperationReportExportPage must be a pure re-export to ./CustomerReportExportPage");
  }
}

if (offenders.length > 0) {
  console.error("❌ Customer export same-source check failed:");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.rule}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("✅ Customer export same-source check passed.");
