import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRootFromScript = path.resolve(__dirname, '../../..');
const root = fs.existsSync(path.join(process.cwd(), 'apps/server/src/routes/openapi_v1.ts'))
  ? process.cwd()
  : repoRootFromScript;
const routeRoots = [
  'apps/server/src/routes',
];
const excludedPathPatterns = [
  /^\/api\/v1\/operations\/console(?:\/|$)/,
  /^\/api\/v1\/operations\/plans(?:\/|$)/,
  /^\/api\/v1\/approval-requests(?:\/|$)/,
  /^\/api\/v1\/dashboard\//,
  /^\/api\/v1\/evidence-export\//,
  /^\/api\/v1\/reports\/customer-dashboard\//,
  /^\/api\/v1\/simulators\//,
  /^\/api\/v1\/operations\/.+\/handoff$/,
  /^\/api\/v1\/operations\/.+\/evidence-bundle$/,
  /^\/api\/v1\/acceptance\//,
  /^\/api\/v1\/agronomy\/inference\//,
  /^\/api\/v1\/agronomy\/observations\//,
  /^\/api\/v1\/alerts\/workboard\//,
  /^\/api\/v1\/audit-export\//,
  /^\/api\/v1\/billing\//,
  /^\/api\/v1\/evidence\/control-plane$/,
  /^\/api\/v1\/evidence-reports\//,
  /^\/api\/v1\/dev-lab\//,
  /^\/api\/v1\/fields\/.+\/geometry$/,
  /^\/api\/v1\/fields\/.+\/sensing-read-models$/,
  /^\/api\/v1\/devices\/.+\/positions$/,
  /^\/api\/v1\/fields\/.+\/device-positions$/,
  /^\/api\/v1\/fields\/.+\/trajectories$/,
  /^\/api\/v1\/tasks\/.+\/trajectory$/,
  /^\/api\/v1\/fields\/.+\/polygon$/,
  /^\/api\/v1\/fields\/.+\/seasons$/,
  /^\/api\/v1\/field-programs(?:\/|$)/,
  /^\/api\/v1\/fields\/.+\/timeline$/,
  /^\/api\/v1\/service-teams(?:\/|$)/,
  /^\/api\/v1\/human-executors(?:\/|$)/,
  /^\/api\/v1\/work-assignments(?:\/|$)/,
  /^\/api\/v1\/human-ops(?:\/|$)/,
  /^\/api\/v1\/scheduling(?:\/|$)/,
  /^\/api\/v1\/fields\/.+\/conflicts$/,
  /^\/api\/v1\/devices\/.+\/conflicts$/,
  /^\/api\/v1\/programs\/.+\/scheduling-hint$/,
  /^\/api\/v1\/skills\/rules(?:\/|$)/,
  /^\/api\/v1\/sla\/summary$/,
  /^\/api\/v1\/telemetry\/metrics$/,
  /^\/api\/v1\/alerts\/rules\/.+\/disable$/,
  /^\/api\/v1\/agronomy\/inference(?:\/|$)/,
  /^\/api\/v1\/agronomy\/inputs\/.+$/,
  /^\/api\/v1\/devices\/.+\/status$/,
  /^\/api\/v1\/devices\/.+\/bind-field$/,
  /^\/api\/v1\/evidence-reports(?:\/|$)/,
  /^\/api\/v1\/fields(?:\/|$)/,
];
const forbiddenOpenApiPaths = [
  '/api/v1/operations/console',
  '/api/v1/approval-requests',
  '/api/v1/approval-requests/{request_id}/approve',
  '/api/v1/control/approval-requests',
  '/api/devices',
  '/api/devices/{device_id}/credentials',
];
const criticalSchemas = [
  'ActionTaskRequest',
  'ActionTaskResponse',
  'ActionReceiptRequest',
  'ActionReceiptResponse',
  'ActionExecuteRequest',
  'ActionExecuteResponse',
  'OperationManualRequest',
  'OperationManualResponse',
  'ApprovalRequestCreateBody',
  'ApprovalRequestCreateResponse',
  'ApprovalApproveBody',
  'ApprovalApproveResponse',
  'ApprovalRequestListResponse',
  'RecommendationGenerateBody',
  'RecommendationGenerateResponse',
  'RecommendationSubmitApprovalBody',
  'RecommendationSubmitApprovalResponse',
  'DeviceUpsertRequest',
  'DeviceUpsertResponse',
  'DevicesListResponse',
  'DeviceDetailResponse',
  'DeviceCredentialIssueRequest',
  'DeviceCredentialIssueResponse',
  'DeviceCredentialRevokeResponse',
  'DeviceCapabilitiesRequest',
  'DeviceCapabilitiesResponse',
  'DeviceOnboardingStatusResponse',
  'SenseTaskRequest',
  'SenseTaskResponse',
  'SenseReceiptRequest',
  'SenseReceiptResponse',
  'SenseTasksResponse',
  'SenseReceiptsResponse',
  'SenseNextTaskResponse',
  'SkillBindingCreateRequest',
  'SkillBindingWriteResponse',
  'SkillBindingOverrideRequest',
  'SkillsListResponse',
  'SkillBindingsResponse',
  'SkillRunsResponse',
  'OperationListResponse',
  'OperationDetailResponse',
  'OperationEvidenceResponse',
  'OperationDetailPageResponse',
  'ActionIndexResponse',
];
const criticalPathRefs = [
  ['POST /api/v1/actions/task', 'ActionTaskRequest', 'ActionTaskResponse'],
  ['POST /api/v1/actions/receipt', 'ActionReceiptRequest', 'ActionReceiptResponse'],
  ['POST /api/v1/actions/execute', 'ActionExecuteRequest', 'ActionExecuteResponse'],
  ['POST /api/v1/operations/manual', 'OperationManualRequest', 'OperationManualResponse'],
  ['POST /api/v1/approvals/request', 'ApprovalRequestCreateBody', 'ApprovalRequestCreateResponse'],
  ['GET /api/v1/approvals/requests', null, 'ApprovalRequestListResponse'],
  ['POST /api/v1/approvals/approve', 'ApprovalApproveBody', 'ApprovalApproveResponse'],
  ['POST /api/v1/recommendations/generate', 'RecommendationGenerateBody', 'RecommendationGenerateResponse'],
  ['POST /api/v1/recommendations/{recommendation_id}/submit-approval', 'RecommendationSubmitApprovalBody', 'RecommendationSubmitApprovalResponse'],
  ['POST /api/v1/devices', 'DeviceUpsertRequest', 'DeviceUpsertResponse'],
  ['GET /api/v1/devices', null, 'DevicesListResponse'],
  ['GET /api/v1/devices/{device_id}', null, 'DeviceDetailResponse'],
  ['POST /api/v1/devices/{device_id}', 'DeviceUpsertRequest', 'DeviceUpsertResponse'],
  ['POST /api/v1/devices/{device_id}/credentials', 'DeviceCredentialIssueRequest', 'DeviceCredentialIssueResponse'],
  ['POST /api/v1/devices/{device_id}/credentials/{credential_id}/revoke', 'DeviceCredentialRevokeRequest', 'DeviceCredentialRevokeResponse'],
  ['GET /api/v1/devices/{device_id}/onboarding-status', null, 'DeviceOnboardingStatusResponse'],
  ['POST /api/v1/sense/task', 'SenseTaskRequest', 'SenseTaskResponse'],
  ['POST /api/v1/sense/receipt', 'SenseReceiptRequest', 'SenseReceiptResponse'],
  ['GET /api/v1/sense/tasks', null, 'SenseTasksResponse'],
  ['GET /api/v1/sense/receipts', null, 'SenseReceiptsResponse'],
  ['GET /api/v1/sense/next-task', null, 'SenseNextTaskResponse'],
  ['POST /api/v1/skills/bindings', 'SkillBindingCreateRequest', 'SkillBindingWriteResponse'],
  ['POST /api/v1/skills/bindings/override', 'SkillBindingOverrideRequest', 'SkillBindingWriteResponse'],
  ['GET /api/v1/operations', null, 'OperationListResponse'],
  ['GET /api/v1/operations/{operation_id}', null, 'OperationDetailResponse'],
  ['GET /api/v1/operations/{operation_id}/evidence', null, 'OperationEvidenceResponse'],
  ['GET /api/v1/operations/{operationPlanId}/detail', null, 'OperationDetailPageResponse'],
  ['GET /api/v1/actions/index', null, 'ActionIndexResponse'],
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

function collectV1Routes(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const regex = /app\.(get|post|put|delete|patch)\("([^"]+)"/g;
  const items = [];
  for (const match of text.matchAll(regex)) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    if (!routePath.startsWith('/api/v1/')) continue;
    if (excludedPathPatterns.some((re) => re.test(routePath))) continue;
    items.push(`${method} ${normalizeRoutePath(routePath)}`);
  }
  return items;
}

function extractPathBlocks(openapiSource) {
  const pathBlocks = new Map();
  const pathCounts = new Map();
  const pathRegex = /"(\/api(?:\/v1)?\/[^"]+)":/g;
  const matches = [...openapiSource.matchAll(pathRegex)];
  for (let i = 0; i < matches.length; i += 1) {
    const routePath = matches[i][1];
    pathCounts.set(routePath, (pathCounts.get(routePath) ?? 0) + 1);
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? openapiSource.length) : openapiSource.length;
    if (!pathBlocks.has(routePath)) pathBlocks.set(routePath, openapiSource.slice(start, end));
  }
  return { pathBlocks, pathCounts };
}

function extractObjectLiteral(source, key) {
  const anchor = `${key}: {`;
  const start = source.lastIndexOf(anchor);
  if (start < 0) return null;
  let i = source.indexOf('{', start);
  let depth = 0;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(source.indexOf('{', start), i + 1);
    }
  }
  return null;
}

const routeFiles = routeRoots.flatMap(walkTsFiles);
const expected = new Set();
for (const fp of routeFiles) {
  for (const item of collectV1Routes(fp)) expected.add(item);
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

function hasLegacyPlaceholderDefinition(source, key) {
  return source.includes(`${key}: { type: "object", additionalProperties: true }`);
}

const openapiSource = fs.readFileSync(path.join(root, 'apps/server/src/routes/openapi_v1.ts'), 'utf8');
const { pathBlocks, pathCounts } = extractPathBlocks(openapiSource);
const errors = [];


for (const [routePath, count] of [...pathCounts.entries()].sort()) {
  if (count > 1) errors.push(`duplicate_path:${routePath}:${count}`);
}

for (const badPath of forbiddenOpenApiPaths) {
  if (openapiSource.includes(`"${badPath}":`)) errors.push(`forbidden_path:${badPath}`);
}

for (const item of [...expected].sort()) {
  const [method, routePath] = item.split(' ');
  const block = pathBlocks.get(routePath);
  if (!block) {
    errors.push(`missing_path:${item}`);
    continue;
  }
  const methodRegex = new RegExp(`\\b${method.toLowerCase()}\\s*:`);
  if (!methodRegex.test(block)) errors.push(`missing_method:${item}`);
}

for (const schemaName of criticalSchemas) {
  const definitionCount = countSchemaDefinitions(openapiSource, schemaName);
  if (definitionCount !== 1) {
    errors.push(`duplicate_or_missing_schema_definition:${schemaName}:${definitionCount}`);
  }
  const block = extractObjectLiteral(openapiSource, schemaName);
  if (!block) {
    errors.push(`missing_schema:${schemaName}`);
    continue;
  }
  if (!/additionalProperties:\s*false/.test(block)) {
    errors.push(`loose_schema:${schemaName}`);
  }
  if (hasLegacyPlaceholderDefinition(openapiSource, schemaName)) {
    errors.push(`legacy_placeholder_schema:${schemaName}`);
  }
}

const requiredOpenApiFragments = [
  ['POST /api/v1/devices', ['requestBody', 'DeviceUpsertRequest', 'DeviceUpsertResponse']],
  ['GET /api/v1/devices', ['DevicesListResponse']],
  ['GET /api/v1/devices/{device_id}', ['DeviceDetailResponse']],
  ['POST /api/v1/devices/{device_id}/credentials', ['DeviceCredentialIssueRequest', 'DeviceCredentialIssueResponse']],
];

for (const [routeKey, fragments] of requiredOpenApiFragments) {
  const [method, routePath] = routeKey.split(' ');
  const block = pathBlocks.get(routePath);
  if (!block) continue;
  const methodMatch = new RegExp(`${method.toLowerCase()}\s*:\s*\{([\s\S]*?)\n\s*\}`, 'm').exec(block);
  const methodBlock = methodMatch ? methodMatch[1] : block;
  for (const fragment of fragments) {
    if (!methodBlock.includes(fragment)) errors.push(`incomplete_path_block:${routeKey}:${fragment}`);
  }
}

for (const [routeKey, requestSchema, responseSchema] of criticalPathRefs) {
  const [method, routePath] = routeKey.split(' ');
  const block = pathBlocks.get(routePath);
  if (!block) {
    errors.push(`critical_missing_path:${routeKey}`);
    continue;
  }
  if (requestSchema && !block.includes(`ref("${requestSchema}")`)) errors.push(`missing_request_ref:${routeKey}:${requestSchema}`);
  if (responseSchema && !block.includes(`ref("${responseSchema}")`)) errors.push(`missing_response_ref:${routeKey}:${responseSchema}`);
}

if (errors.length) {
  console.error('[p1-3-openapi-selfcheck] FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('[p1-3-openapi-selfcheck] OK', JSON.stringify({
  checked_routes: expected.size,
  checked_files: routeFiles.length,
  checked_critical_schemas: criticalSchemas.length,
  checked_critical_paths: criticalPathRefs.length,
}));
