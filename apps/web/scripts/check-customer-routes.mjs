import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..", "..");

const offenders = [];

function addOffender(file, line, token, snippet) {
  offenders.push({ file, line, token, snippet: String(snippet ?? "").trim() });
}

function read(relativeFile) {
  const fullPath = path.join(appRoot, relativeFile);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
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

function lineNumberFor(text, token) {
  const index = text.indexOf(token);
  if (index < 0) return 0;
  return text.slice(0, index).split("\n").length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linePointsNavigationTo(line, token) {
  const escaped = escapeRegExp(token);
  return new RegExp(`\\bto\\s*[:=]\\s*["']${escaped}["']`).test(line);
}

function scanCustomerNavigation() {
  const file = "src/layouts/CustomerLayout.tsx";
  const text = read(file);
  if (!text) {
    addOffender(file, 0, "missing-file", "CustomerLayout.tsx does not exist");
    return;
  }

  const lines = text.split("\n");
  const forbiddenNavTargets = ["/customer/fields/index", "/customer/operations/index"];
  lines.forEach((line, index) => {
    for (const token of forbiddenNavTargets) {
      if (linePointsNavigationTo(line, token)) addOffender(file, index + 1, token, line);
    }
  });
}

function scanCustomerScopedFiles() {
  const roots = [
    "src/layouts",
    "src/views",
    "src/viewmodels",
    "src/components/customer",
    "src/components/cockpit",
    "src/features/customer/pages",
    "src/features/fields/pages",
    "src/features/operations/pages",
  ];
  const scopedFiles = roots.flatMap((root) => listFilesRecursively(path.join(appRoot, root))).map((file) => path.relative(appRoot, file));
  const customerFilePatterns = [
    /^src\/layouts\/CustomerLayout\.tsx$/,
    /^src\/views\/Customer.*\.tsx$/,
    /^src\/views\/(FieldReportPage|FieldReportExportPage|OperationReportPage|OperationReportExportPage|CustomerReportExportPage|CustomerWorkIndexPage|CustomerFieldsIndexPage|CustomerOperationsIndexPage|CustomerReportsCenterPage)\.tsx$/,
    /^src\/viewmodels\/(customerDashboardVm|customerFieldsIndexVm|customerOperationsIndexVm|customerReportsCenterVm|fieldReportVm|operationReportVm)\.ts$/,
    /^src\/components\/customer\/.+$/,
    /^src\/components\/cockpit\/.+$/,
    /^src\/features\/customer\/pages\/.+$/,
    /^src\/features\/fields\/pages\/(FieldReportPage|FieldReportExportPage)\.tsx$/,
    /^src\/features\/operations\/pages\/(OperationReportPage|CustomerReportExportPage)\.tsx$/,
  ];
  const forbiddenRouteTokens = ["/admin", "/debug", "/legacy", "healthz", "/healthz"];

  for (const file of scopedFiles) {
    if (!customerFilePatterns.some((pattern) => pattern.test(file))) continue;
    const text = read(file);
    if (!text) continue;
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      for (const token of forbiddenRouteTokens) {
        if (line.includes(token)) addOffender(file, index + 1, token, line);
      }
    });
  }
}

function scanExportRoutes() {
  const appFile = "src/app/App.tsx";
  const routeMapFullPath = path.join(repoRoot, "docs", "frontend", "CUSTOMER_FRONTEND_ROUTE_MAP_V1.md");
  const appText = read(appFile);
  const routeMapText = fs.existsSync(routeMapFullPath) ? fs.readFileSync(routeMapFullPath, "utf8") : "";

  if (!appText) addOffender(appFile, 0, "missing-file", "App.tsx does not exist");
  if (!routeMapText) addOffender("docs/frontend/CUSTOMER_FRONTEND_ROUTE_MAP_V1.md", 0, "missing-file", "Route map document does not exist");

  const requiredAppRouteFragments = ["export", "fields/:fieldId/export", "operations/:operationId/export"];
  const requiredRouteMapPaths = ["/customer/export", "/customer/fields/:fieldId/export", "/customer/operations/:operationId/export"];

  if (appText) {
    for (const token of requiredAppRouteFragments) {
      if (!appText.includes(`path=\"${token}\"`) && !appText.includes(`path='${token}'`)) {
        addOffender(appFile, lineNumberFor(appText, token), token, "Required customer export route is missing from CustomerRoutes");
      }
    }
  }

  if (routeMapText) {
    for (const token of requiredRouteMapPaths) {
      if (!routeMapText.includes(token)) {
        addOffender("docs/frontend/CUSTOMER_FRONTEND_ROUTE_MAP_V1.md", lineNumberFor(routeMapText, token), token, "Export route must be documented in customer route map");
      }
    }
  }
}

scanCustomerNavigation();
scanCustomerScopedFiles();
scanExportRoutes();

if (offenders.length > 0) {
  console.error("CUSTOMER_ROUTE_CHECK FAIL");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("CUSTOMER_ROUTE_CHECK PASS");
