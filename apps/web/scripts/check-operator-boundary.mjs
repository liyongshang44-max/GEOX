import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const srcRoot = path.join(appRoot, "src");

const OPERATOR_SCOPED_PATTERNS = [
  /^src\/layouts\/OperatorLayout\.tsx$/,
  /^src\/views\/operator\/.+\.(ts|tsx)$/,
  /^src\/features\/operator\/pages\/.+\.(ts|tsx)$/,
  /^src\/components\/operator\/.+\.(ts|tsx)$/,
  /^src\/api\/operator.+\.ts$/,
  /^src\/viewmodels\/operator.+\.ts$/,
];

const OPERATOR_ADAPTER_OR_VM_PATTERNS = [
  /^src\/api\/operator.+\.ts$/,
  /^src\/viewmodels\/operator.+\.ts$/,
];

const FORBIDDEN_IMPORT_PATTERNS = [
  { token: "admin", pattern: /from\s+["'][^"']*admin[^"']*["']|import\([^)]*["'][^"']*admin[^"']*["'][^)]*\)/i },
  { token: "debug", pattern: /from\s+["'][^"']*debug[^"']*["']|import\([^)]*["'][^"']*debug[^"']*["'][^)]*\)/i },
  { token: "legacy", pattern: /from\s+["'][^"']*legacy[^"']*["']|import\([^)]*["'][^"']*legacy[^"']*["'][^)]*\)/i },
  { token: "healthz", pattern: /from\s+["'][^"']*healthz[^"']*["']|import\([^)]*["'][^"']*healthz[^"']*["'][^)]*\)/i },
  { token: "raw facts", pattern: /from\s+["'][^"']*(raw[-_]?facts|facts)[^"']*["']|import\([^)]*["'][^"']*(raw[-_]?facts|facts)[^"']*["'][^)]*\)/i },
  { token: "device credential secret payload", pattern: /from\s+["'][^"']*(credential|secret)[^"']*["']|import\([^)]*["'][^"']*(credential|secret)[^"']*["'][^)]*\)/i },
  { token: "migration", pattern: /from\s+["'][^"']*migration[^"']*["']|import\([^)]*["'][^"']*migration[^"']*["'][^)]*\)/i },
  { token: "OpenAPI", pattern: /from\s+["'][^"']*(openapi|swagger)[^"']*["']|import\([^)]*["'][^"']*(openapi|swagger)[^"']*["'][^)]*\)/i },
];

const FORBIDDEN_ROUTE_PATTERNS = [
  { token: "admin route", pattern: /["'`]\/api\/v\d+\/admin\b|["'`]\/admin\b/i },
  { token: "debug route", pattern: /["'`]\/api\/v\d+\/debug\b|["'`]\/debug\b/i },
  { token: "legacy route", pattern: /["'`]\/api\/(?:legacy|control)\b|["'`]\/legacy\b/i },
  { token: "healthz route", pattern: /["'`]\/api\/admin\/healthz\b|["'`]\/api\/healthz\b|["'`]\/healthz\b/i },
  { token: "raw facts route", pattern: /["'`]\/api\/v\d+\/(?:raw[-_]?facts|facts)\b|["'`]\/api\/(?:raw[-_]?facts|facts)\b/i },
  { token: "device credential secret payload route", pattern: /["'`]\/api\/v\d+\/devices\/[^"'`]*credentials?|secret[_-]?payload|credential[_-]?secret/i },
  { token: "migration route", pattern: /["'`]\/api\/v\d+\/migration\b|["'`]\/api\/migration\b/i },
  { token: "OpenAPI route", pattern: /["'`]\/api\/v\d+\/openapi(?:\.json)?\b|["'`]\/api\/openapi(?:\.json)?\b|["'`]\/openapi(?:\.json)?\b|swagger/i },
];

const FORBIDDEN_RAW_CONTENT = [
  { token: "bucket secret", pattern: /bucket[_-]?secret|access[_-]?key|secret[_-]?key|AWS_SECRET|MINIO_SECRET/i },
  { token: "stack trace", pattern: /stack\s*trace|error\.stack/i },
  { token: "local absolute path", pattern: /[A-Za-z]:\\\\|file:\/\/|\/var\/|\/tmp\/|\/home\/|\/mnt\//i },
];

const ALLOWED_OPERATOR_ADAPTER_ROUTE_PREFIXES = [
  /["'`]\/api\/v1\/operator\//,
  /["'`]\/api\/v1\/approvals\/requests["'`]/,
  /["'`]\/api\/v1\/reports\/customer-dashboard\/aggregate["'`]/,
  /["'`]\/api\/v1\/alerts["'`]/,
  /["'`]\/api\/v1\/devices["'`]/,
  /["'`]\/api\/v1\/actions\/index["'`]/,
  /["'`]\/api\/v1\/evidence\/export-jobs["'`]/,
];

const offenders = [];

function addOffender(file, line, token, snippet) {
  offenders.push({ file, line, token, snippet: String(snippet ?? "").trim() });
}

function listFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursively(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function isOperatorScopedFile(relativeFile) {
  return OPERATOR_SCOPED_PATTERNS.some((pattern) => pattern.test(relativeFile));
}

function isOperatorAdapterOrVm(relativeFile) {
  return OPERATOR_ADAPTER_OR_VM_PATTERNS.some((pattern) => pattern.test(relativeFile));
}

function isAllowedOperatorAdapterRouteLine(line) {
  return ALLOWED_OPERATOR_ADAPTER_ROUTE_PREFIXES.some((pattern) => pattern.test(line));
}

function isSanitizerImplementationLine(relativeFile, line) {
  if (!isOperatorAdapterOrVm(relativeFile)) return false;
  return (
    line.includes("本地路径已隐藏") ||
    line.includes("敏感凭据已隐藏") ||
    line.includes("下载链接已隐藏") ||
    /raw\.startsWith\(["']\/["']\)/.test(line) ||
    /\^\[A-Za-z\]:/.test(line) ||
    /raw\.includes\(["']file:\/\//.test(line)
  );
}

function scanFile(relativeFile) {
  if (!isOperatorScopedFile(relativeFile)) return;
  const fullPath = path.join(appRoot, relativeFile);
  const text = fs.readFileSync(fullPath, "utf8");
  const lines = text.split("\n");
  const isAdapterOrVm = isOperatorAdapterOrVm(relativeFile);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return;

    for (const rule of FORBIDDEN_IMPORT_PATTERNS) {
      if (rule.pattern.test(line)) addOffender(relativeFile, index + 1, rule.token, line);
    }

    for (const rule of FORBIDDEN_ROUTE_PATTERNS) {
      if (rule.pattern.test(line)) {
        if (isAdapterOrVm && isAllowedOperatorAdapterRouteLine(line)) continue;
        addOffender(relativeFile, index + 1, rule.token, line);
      }
    }

    for (const rule of FORBIDDEN_RAW_CONTENT) {
      if (rule.pattern.test(line)) {
        if (isSanitizerImplementationLine(relativeFile, line)) continue;
        addOffender(relativeFile, index + 1, rule.token, line);
      }
    }
  });
}

const files = listFilesRecursively(srcRoot).map((file) => path.relative(appRoot, file).replace(/\\/g, "/"));
for (const file of files) scanFile(file);

if (offenders.length > 0) {
  console.error("OPERATOR_BOUNDARY_CHECK FAIL");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("OPERATOR_BOUNDARY_CHECK PASS");
