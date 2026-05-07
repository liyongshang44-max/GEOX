import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const targetFiles = [
  "src/views/OperationReportPage.tsx",
  "src/views/CustomerReportExportPage.tsx",
  "src/viewmodels/operationReportVm.ts",
  "src/viewmodels/customerDashboardVm.ts",
  "src/viewmodels/fieldReportVm.ts",
];

const forbiddenPatterns = [
  { name: "receipt => success/pass inference", regex: /if\s*\([^\n)]*(receipt|receipt_id|hasReceipt)[^\n)]*\)\s*[^\n;{]*(SUCCESS|PASS|COMPLETED|DONE)/gi },
  { name: "task completed => pass/success inference", regex: /if\s*\([^\n)]*(task|completed|done)[^\n)]*\)\s*[^\n;{]*(PASS|SUCCESS|COMPLETED|DONE)/gi },
  { name: "no error => success/pass inference", regex: /if\s*\([^\n)]*(no\s*error|!\s*error|error\s*===\s*null|error\s*==\s*null)[^\n)]*\)\s*[^\n;{]*(PASS|SUCCESS|COMPLETED|DONE)/gi },
  { name: "ternary status inference to SUCCESS/PASS", regex: /(receipt|task|error)[^\n]{0,80}\?[^\n]{0,80}(SUCCESS|PASS|COMPLETED|DONE)\s*:[^\n]{0,80}/gi },
];

const allowSignals = [
  "labelFinalStatus",
  "mapOperationStatusToCustomerLabel",
  "operation_state",
  "customerTimelineStatusLabel",
];

const offenders = [];

function addOffender(file, line, rule, snippet) {
  offenders.push({ file, line, rule, snippet: snippet.replace(/\s+/g, " ").trim() });
}

function lineOfIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

for (const relativeFile of targetFiles) {
  const fullPath = path.join(appRoot, relativeFile);
  if (!fs.existsSync(fullPath)) {
    addOffender(relativeFile, 0, "missing-target-file", "Target file does not exist");
    continue;
  }

  const text = fs.readFileSync(fullPath, "utf8");

  for (const rule of forbiddenPatterns) {
    for (const match of text.matchAll(rule.regex)) {
      addOffender(relativeFile, lineOfIndex(text, match.index ?? 0), rule.name, String(match[0]));
    }
  }

  const isVm = relativeFile.endsWith("Vm.ts");
  if (isVm) {
    const hasAllowSignal = allowSignals.some((signal) => text.includes(signal));
    if (!hasAllowSignal) addOffender(relativeFile, 1, "missing-unified-status-mapping", "VM must map status from operation report / operation_state via unified mapping");
  }
}

if (offenders.length > 0) {
  console.error("❌ Operation status convergence check failed:");
  console.error("   Customer pages must not derive final operation status locally.");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.rule}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("✅ Operation status convergence check passed.");
