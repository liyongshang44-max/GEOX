import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const RAW_ENUMS = [
  "SUCCESS",
  "FAILED",
  "PENDING",
  "MISSING",
  "AVAILABLE",
  "PASS",
  "DONE",
  "INVALID_EXECUTION",
  "PENDING_ACCEPTANCE",
];

const STRICT_CUSTOMER_PATTERNS = [
  /^src\/layouts\/CustomerLayout\.tsx$/,
  /^src\/views\/Customer.*\.tsx$/,
  /^src\/views\/(FieldReportPage|FieldReportExportPage|OperationReportPage|OperationReportExportPage|CustomerReportExportPage|CustomerWorkIndexPage|CustomerFieldsIndexPage)\.tsx$/,
  /^src\/components\/customer\/.+\.(ts|tsx)$/,
  /^src\/components\/cockpit\/.+\.(ts|tsx)$/,
  /^src\/features\/customer\/pages\/.+\.(ts|tsx)$/,
  /^src\/features\/fields\/pages\/(FieldReportPage|FieldReportExportPage)\.tsx$/,
  /^src\/features\/operations\/pages\/(OperationReportPage|CustomerReportExportPage)\.tsx$/,
];

const VM_PATTERNS = [
  /^src\/viewmodels\/(customerDashboardVm|fieldReportVm|operationReportVm)\.ts$/,
];

const ALLOWED_FILES = [
  /^src\/lib\/customerLabels\.ts$/,
  /^src\/lib\/customerEmptyStates\.ts$/,
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
];

const VM_ALLOWED_CONTEXTS = [
  /type\s+\w+/,
  /const\s+\w+/,
  /function\s+\w+/,
  /=>/,
  /case\s+["']/,
  /\.includes\(/,
  /\.toUpperCase\(/,
  /switch\s*\(/,
  /status\s*[:=]/,
  /state\s*[:=]/,
  /finalStatus/i,
  /timeline/i,
  /label[A-Z]/,
  /customerTimelineStatusLabel/,
  /map[A-Z].*Status/,
  /buildOperationEvidenceSummaryVm/,
  /MAIN_VIEW_BLOCK_PATTERNS/,
];

const VM_FORBIDDEN_CUSTOMER_TEXT_FIELDS = /\b(title|summary|description|detail|label|value|displayText|headline|subtitle|placeholder)\s*:/;
const ALLOW_COMMENT = /no-raw-enum-customer-allow:\s*(.+)$/;

const offenders = [];
const exemptions = [];

function addOffender(file, line, token, snippet) {
  offenders.push({ file, line, token, snippet: String(snippet ?? "").trim() });
}

function addExemption(file, line, token, reason, snippet) {
  exemptions.push({ file, line, token, reason: reason.trim(), snippet: String(snippet ?? "").trim() });
}

function listFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursively(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function hasAllowComment(lines, index) {
  const candidates = [lines[index - 1] ?? "", lines[index] ?? "", lines[index + 1] ?? ""];
  for (const candidate of candidates) {
    if (!candidate.includes("no-raw-enum-customer-allow:")) continue;
    const match = candidate.match(ALLOW_COMMENT);
    if (match?.[1]?.trim()) return { allowed: true, reason: match[1].trim() };
    return { allowed: false, reason: "missing reason" };
  }
  return { allowed: null, reason: "" };
}

function enumRegex(token) {
  return new RegExp(`(^|[^A-Za-z0-9_])${token}([^A-Za-z0-9_]|$)`);
}

function isAllowedFile(relativeFile) {
  return ALLOWED_FILES.some((pattern) => pattern.test(relativeFile));
}

function isStrictCustomerFile(relativeFile) {
  return STRICT_CUSTOMER_PATTERNS.some((pattern) => pattern.test(relativeFile));
}

function isVmFile(relativeFile) {
  return VM_PATTERNS.some((pattern) => pattern.test(relativeFile));
}

function isVmAllowedContext(line) {
  if (VM_FORBIDDEN_CUSTOMER_TEXT_FIELDS.test(line)) return false;
  return VM_ALLOWED_CONTEXTS.some((pattern) => pattern.test(line));
}

function scanFile(relativeFile) {
  if (isAllowedFile(relativeFile)) return;
  const strict = isStrictCustomerFile(relativeFile);
  const vm = isVmFile(relativeFile);
  if (!strict && !vm) return;

  const fullPath = path.join(appRoot, relativeFile);
  const lines = fs.readFileSync(fullPath, "utf8").split("\n");

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    for (const token of RAW_ENUMS) {
      if (!enumRegex(token).test(line)) continue;
      const allow = hasAllowComment(lines, index);
      if (allow.allowed === true) {
        addExemption(relativeFile, index + 1, token, allow.reason, line);
        continue;
      }
      if (allow.allowed === false) {
        addOffender(relativeFile, index + 1, token, `${line} [missing allow reason]`);
        continue;
      }

      if (vm && isVmAllowedContext(line)) continue;
      addOffender(relativeFile, index + 1, token, line);
    }
  });
}

const srcRoot = path.join(appRoot, "src");
const files = listFilesRecursively(srcRoot).map((file) => path.relative(appRoot, file));
for (const file of files) scanFile(file);

if (exemptions.length > 0) {
  console.log("NO_RAW_ENUM_CUSTOMER_CHECK EXEMPTIONS");
  for (const item of exemptions) {
    console.log(` - ${item.file}:${item.line} [${item.token}] reason=${item.reason} :: ${item.snippet}`);
  }
}

if (offenders.length > 0) {
  console.error("NO_RAW_ENUM_CUSTOMER_CHECK FAIL");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("NO_RAW_ENUM_CUSTOMER_CHECK PASS");
