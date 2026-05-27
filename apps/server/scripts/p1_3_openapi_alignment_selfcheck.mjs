import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRootFromScript = path.resolve(__dirname, '../../..');
const root = fs.existsSync(path.join(process.cwd(), 'apps/server/src/routes/openapi_v1.ts'))
  ? process.cwd()
  : repoRootFromScript;

const routeRoots = ['apps/server/src/routes'];
const openapiPath = path.join(root, 'apps/server/src/routes/openapi_v1.ts');
const inventoryPath = path.join(root, 'apps/server/src/routes/api_route_inventory_v1.ts');
const openapiSource = fs.readFileSync(openapiPath, 'utf8');
const inventorySource = fs.readFileSync(inventoryPath, 'utf8');

const forbiddenOpenApiPaths = [
  '/api/v1/operations/console',
  '/api/v1/control/approval-requests',
  '/api/devices',
  '/api/devices/{device_id}/credentials',
];

const temporaryOpenApiWarningPatterns = [
  /^\/api\/v1\/operations\/console(?:\/|$)/,
  /^\/api\/v1\/dashboard\//,
  /^\/api\/v1\/dev\/flight-table\//,
  /^\/api\/v1\/dev-lab\//,
  /^\/api\/v1\/simulators\//,
  /^\/api\/v1\/billing\//,
  /^\/api\/v1\/audit-export\//,
  /^\/api\/v1\/service-teams(?:\/|$)/,
  /^\/api\/v1\/human-executors(?:\/|$)/,
  /^\/api\/v1\/work-assignments(?:\/|$)/,
  /^\/api\/v1\/human-ops(?:\/|$)/,
  /^\/api\/v1\/scheduling(?:\/|$)/,
  /^\/api\/v1\/programs\/.+\/scheduling-hint$/,
  /^\/api\/v1\/sla\/summary$/,
  /^\/api\/v1\/operator\/learning-validation$/,
  /^\/api\/v1\/operator\/operations\/.+\/learning-validation$/,
];

const salesCriticalRoutePatterns = [
  /^\/api\/v1\/customer(?:\/|$)/,
  /^\/api\/v1\/reports(?:\/|$)/,
  /^\/api\/v1\/actions(?:\/|$)/,
  /^\/api\/v1\/sense(?:\/|$)/,
  /^\/api\/v1\/acceptance(?:\/|$)/,
  /^\/api\/v1\/evidence-export(?:\/|$)/,
  /^\/api\/v1\/inspection(?:\/|$)/,
  /^\/api\/v1\/devices\/[^/]+\/status$/,
  /^\/api\/v1\/fail-safe(?:\/|$)/,
  /^\/api\/v1\/manual-takeover(?:\/|$)/,
  /^\/api\/v1\/manual-takeovers$/,
];

const salesCriticalOpenApiPaths = [
  '/api/v1/customer/reports',
  '/api/v1/customer/fields',
  '/api/v1/customer/operations',
  '/api/v1/reports/operation/{operation_id}',
  '/api/v1/reports/field/{field_id}',
  '/api/v1/actions/task',
  '/api/v1/actions/receipt',
  '/api/v1/actions/execute',
  '/api/v1/sense/task',
  '/api/v1/sense/receipt',
  '/api/v1/acceptance/evaluate',
  '/api/v1/evidence-export/jobs',
  '/api/v1/inspection/pest-disease/{inspection_id}',
  '/api/v1/devices/{device_id}/status',
  '/api/v1/fail-safe/events',
  '/api/v1/manual-takeovers',
];

const officialRoutesNoLongerExcluded = [
  '/api/v1/acceptance/',
  '/api/v1/reports/customer-dashboard/',
  '/api/v1/customer/',
  '/api/v1/operator/',
  '/api/v1/inspection/pest-disease',
  '/api/v1/roi-ledger',
  '/api/v1/field-memory',
  '/api/v1/sensing',
  '/api/v1/sense',
];

const criticalSchemas = [
  'ActionTaskRequest',
  'ActionTaskResponse',
  'ActionReceiptRequest',
  'ActionReceiptResponse',
  'ActionExecuteRequest',
  'ActionExecuteResponse',
  'ApprovalRequestCreateBody',
  'ApprovalRequestCreateResponse',
  'ApprovalApproveBody',
  'ApprovalApproveResponse',
  'RecommendationGenerateBody',
  'RecommendationGenerateResponse',
  'DeviceUpsertRequest',
  'DeviceUpsertResponse',
  'SenseTaskRequest',
  'SenseTaskResponse',
  'SenseReceiptRequest',
  'SenseReceiptResponse',
  'OperationReportV1',
  'OperationReportSingleResponse',
];

const criticalPathRefs = [
  ['POST /api/v1/actions/task', 'ActionTaskRequest', 'ActionTaskResponse'],
  ['POST /api/v1/actions/receipt', 'ActionReceiptRequest', 'ActionReceiptResponse'],
  ['POST /api/v1/actions/execute', 'ActionExecuteRequest', 'ActionExecuteResponse'],
  ['POST /api/v1/approvals/request', 'ApprovalRequestCreateBody', 'ApprovalRequestCreateResponse'],
  ['POST /api/v1/approvals/approve', 'ApprovalApproveBody', 'ApprovalApproveResponse'],
  ['POST /api/v1/recommendations/generate', 'RecommendationGenerateBody', 'RecommendationGenerateResponse'],
  ['POST /api/v1/devices', 'DeviceUpsertRequest', 'DeviceUpsertResponse'],
  ['POST /api/v1/sense/task', 'SenseTaskRequest', 'SenseTaskResponse'],
  ['POST /api/v1/sense/receipt', 'SenseReceiptRequest', 'SenseReceiptResponse'],
  ['GET /api/v1/reports/operation/{operation_id}', null, 'OperationReportSingleResponse'],
];

function walkTsFiles(target) {
  const abs = path.join(root, target);
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const fp = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(path.relative(root, fp)));
    else if (entry.isFile() && fp.endsWith('.ts') && !fp.endsWith('openapi_v1.ts')) out.push(fp);
  }
  return out;
}

function normalizeRoutePath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function routePatternToRegex(routePath) {
  const normalized = normalizeRoutePath(routePath).replace(/\/$/, '');
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[A-Za-z0-9_]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}(?:/|$)`);
}

function collectV1Routes(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const regex = /app\.(get|post|put|delete|patch)\("([^"]+)"/g;
  const items = [];
  for (const match of text.matchAll(regex)) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    if (!routePath.startsWith('/api/v1/')) continue;
    items.push({ method, path: routePath, normalized: normalizeRoutePath(routePath), file: path.relative(root, filePath) });
  }
  return items;
}

function extractPathBlocks(source) {
  const pathBlocks = new Map();
  const pathCounts = new Map();
  const pathRegex = /"(\/api(?:\/v1)?\/[^"]+)":/g;
  const matches = [...source.matchAll(pathRegex)];
  for (let i = 0; i < matches.length; i += 1) {
    const routePath = matches[i][1];
    pathCounts.set(routePath, (pathCounts.get(routePath) ?? 0) + 1);
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? source.length) : source.length;
    if (!pathBlocks.has(routePath)) pathBlocks.set(routePath, source.slice(start, end));
  }
  return { pathBlocks, pathCounts };
}

function countSchemaDefinitions(source, key) {
  const needle = `${key}: {`;
  let count = 0;
  let idx = source.indexOf(needle);
  while (idx >= 0) {
    count += 1;
    idx = source.indexOf(needle, idx + needle.length);
  }
  return count;
}

function inventoryEntries() {
  const chunks = inventorySource.split('entry({').slice(1).map((chunk) => chunk.split('}),')[0]);
  return chunks.map((chunk) => {
    const get = (field) => {
      const re = new RegExp(`${field}:\\s*"([^"]+)"`);
      return re.exec(chunk)?.[1] ?? '';
    };
    return {
      method: get('method'),
      route_path: get('route_path'),
      path_match: get('path_match'),
      boundary: get('boundary'),
      audience: get('audience'),
      gate_maturity: get('gate_maturity'),
      auth_scope: get('auth_scope'),
      contract_ref: get('contract_ref'),
      error_model: get('error_model'),
    };
  }).filter((entry) => entry.route_path);
}

function methodMatches(entry, route) {
  return entry.method === 'ANY' || entry.method === route.method;
}

function routeMatchesInventory(route, inventory) {
  const exactMatches = inventory
    .filter((entry) => entry.path_match === 'exact' && methodMatches(entry, route) && normalizeRoutePath(entry.route_path) === route.normalized)
    .sort((a, b) => b.route_path.length - a.route_path.length);
  if (exactMatches[0]) return exactMatches[0];

  const groupMatches = inventory
    .filter((entry) => entry.path_match === 'group' && methodMatches(entry, route))
    .map((entry) => {
      const pattern = entry.route_path.endsWith('/*') ? entry.route_path.slice(0, -2) : entry.route_path;
      return { entry, pattern, regex: routePatternToRegex(pattern) };
    })
    .filter((candidate) => candidate.regex.test(route.path))
    .sort((a, b) => b.pattern.length - a.pattern.length);
  return groupMatches[0]?.entry ?? null;
}

function isSalesCriticalRoute(routePath) {
  return salesCriticalRoutePatterns.some((re) => re.test(normalizeRoutePath(routePath)) || re.test(routePath));
}

function warningOnly(route, inventoryEntry) {
  if (isSalesCriticalRoute(route.path)) return false;
  if (temporaryOpenApiWarningPatterns.some((re) => re.test(route.path))) return true;
  if (!inventoryEntry) return false;
  return inventoryEntry.gate_maturity === 'inventory_baseline' || inventoryEntry.gate_maturity === 'debug_exempt' || inventoryEntry.gate_maturity === 'legacy_exempt';
}

const routeFiles = routeRoots.flatMap(walkTsFiles);
const routes = routeFiles.flatMap(collectV1Routes);
const inventory = inventoryEntries();
const { pathBlocks, pathCounts } = extractPathBlocks(openapiSource);
const errors = [];
const warnings = [];

for (const removedPattern of officialRoutesNoLongerExcluded) {
  if (openapiSource.includes(`excluded:${removedPattern}`)) errors.push(`official_route_still_excluded:${removedPattern}`);
}

for (const [routePath, count] of [...pathCounts.entries()].sort()) {
  if (count > 1) errors.push(`duplicate_path:${routePath}:${count}`);
}

for (const badPath of forbiddenOpenApiPaths) {
  if (openapiSource.includes(`"${badPath}":`)) errors.push(`forbidden_path:${badPath}`);
}

for (const requiredPath of salesCriticalOpenApiPaths) {
  if (!pathBlocks.has(requiredPath)) errors.push(`sales_critical_missing_openapi_path:${requiredPath}`);
}

for (const route of routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`))) {
  const inv = routeMatchesInventory(route, inventory);
  if (!inv && !temporaryOpenApiWarningPatterns.some((re) => re.test(route.path))) {
    errors.push(`missing_inventory:${route.method} ${route.path}:${route.file}`);
    continue;
  }
  const block = pathBlocks.get(route.normalized);
  if (!block) {
    const msg = `missing_openapi_path:${route.method} ${route.normalized}:${route.file}`;
    if (warningOnly(route, inv)) warnings.push(msg);
    else errors.push(msg);
    continue;
  }
  const methodRegex = new RegExp(`\\b${route.method.toLowerCase()}\\s*:`);
  if (!methodRegex.test(block)) {
    const msg = `missing_openapi_method:${route.method} ${route.normalized}:${route.file}`;
    if (warningOnly(route, inv)) warnings.push(msg);
    else errors.push(msg);
  }
}

for (const schemaName of criticalSchemas) {
  const definitionCount = countSchemaDefinitions(openapiSource, schemaName);
  if (definitionCount !== 1) errors.push(`duplicate_or_missing_schema_definition:${schemaName}:${definitionCount}`);
}

for (const [routeKey, requestSchema, responseSchema] of criticalPathRefs) {
  const [method, routePath] = routeKey.split(' ');
  const block = pathBlocks.get(routePath);
  if (!block) {
    errors.push(`critical_missing_path:${routeKey}`);
    continue;
  }
  if (!new RegExp(`\\b${method.toLowerCase()}\\s*:`).test(block)) errors.push(`critical_missing_method:${routeKey}`);
  if (requestSchema && !block.includes(requestSchema)) errors.push(`missing_request_ref:${routeKey}:${requestSchema}`);
  if (responseSchema && !block.includes(responseSchema)) errors.push(`missing_response_ref:${routeKey}:${responseSchema}`);
}

const salesCriticalWarnings = warnings.filter((warning) => /\/api\/v1\/(customer|reports|actions|sense|acceptance|evidence-export|inspection|devices\/[^/]+\/status|fail-safe|manual-takeover|manual-takeovers)/.test(warning));
if (salesCriticalWarnings.length) errors.push(...salesCriticalWarnings.map((warning) => `sales_critical_warn_only:${warning}`));

if (errors.length) {
  console.error('[p1-3-openapi-selfcheck] FAIL');
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) {
    console.error('[p1-3-openapi-selfcheck] WARN');
    for (const warning of warnings.slice(0, 80)) console.error(`- ${warning}`);
    if (warnings.length > 80) console.error(`- ... ${warnings.length - 80} more warnings`);
  }
  process.exit(1);
}

if (warnings.length) {
  console.warn('[p1-3-openapi-selfcheck] WARN');
  for (const warning of warnings.slice(0, 80)) console.warn(`- ${warning}`);
  if (warnings.length > 80) console.warn(`- ... ${warnings.length - 80} more warnings`);
}

console.log('[p1-3-openapi-selfcheck] OK', JSON.stringify({
  checked_routes: routes.length,
  inventory_entries: inventory.length,
  checked_files: routeFiles.length,
  checked_critical_schemas: criticalSchemas.length,
  checked_critical_paths: criticalPathRefs.length,
  checked_sales_critical_paths: salesCriticalOpenApiPaths.length,
  sales_critical_warnings: salesCriticalWarnings.length,
  warnings: warnings.length,
}));
