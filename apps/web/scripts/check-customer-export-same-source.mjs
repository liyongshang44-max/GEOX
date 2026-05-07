import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const appRoot = path.resolve(scriptDir, "..");

const requiredImports = [
  { file: "src/views/CustomerDashboardExportPage.tsx", symbol: "buildCustomerDashboardVm" },
  { file: "src/views/FieldReportExportPage.tsx", symbol: "buildFieldReportVm" },
  { file: "src/views/CustomerReportExportPage.tsx", symbol: "buildOperationReportVm" },
];

const forbiddenMapSymbols = ["STATUS_MAP", "RISK_MAP", "ACCEPTANCE_MAP"];
const forbiddenApiTokens = ["../api/reports", "../api/admin", "../api/debug", "../api/devtools", "raw_telemetry", "legacy/control"];

const offenders = [];

function addOffender(file, line, rule, snippet) {
  offenders.push({ file, line, rule, snippet: snippet.trim() });
}

for (const item of requiredImports) {
  const fullPath = path.join(appRoot, item.file);
  if (!fs.existsSync(fullPath)) {
    addOffender(item.file, 0, "missing-file", "Target export page does not exist");
    continue;
  }

  const text = fs.readFileSync(fullPath, "utf8");
  const lines = text.split("\n");

  const hasImport = lines.some((line) => line.includes("import") && line.includes(item.symbol));
  if (!hasImport) addOffender(item.file, 1, "missing-required-vm-import", `Export page must import ${item.symbol}`);

  lines.forEach((lineText, index) => {
    for (const token of forbiddenMapSymbols) {
      if (lineText.includes(token)) addOffender(item.file, index + 1, "forbidden-local-map", `${token} must not be defined in export pages`);
    }
    for (const token of forbiddenApiTokens) {
      if (lineText.includes("import") && lineText.includes(token)) addOffender(item.file, index + 1, "forbidden-api-import", lineText);
    }
  });
}

if (offenders.length > 0) {
  console.error("❌ Customer export same-source check failed:");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.rule}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("✅ Customer export same-source check passed.");
