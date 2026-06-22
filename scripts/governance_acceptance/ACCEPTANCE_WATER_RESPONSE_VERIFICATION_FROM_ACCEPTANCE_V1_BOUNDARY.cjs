// scripts/governance_acceptance/ACCEPTANCE_WATER_RESPONSE_VERIFICATION_FROM_ACCEPTANCE_V1_BOUNDARY.cjs

const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function ok(condition, message, detail) {
  if (!condition) {
    console.error('[h45-boundary] FAIL', message, detail || '');
    process.exit(1);
  }
}

function firstLineIsPathComment(path, prefix) {
  return read(path).split(/\r?\n/, 1)[0] === prefix;
}

function collectTextFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];

  for (const name of fs.readdirSync(dir)) {
    const path = `${dir}/${name}`;
    const stat = fs.statSync(path);

    if (stat.isDirectory()) {
      out.push(...collectTextFiles(path));
      continue;
    }

    if (/\.(ts|tsx|js|jsx|json|css|html|md)$/.test(name)) {
      out.push(path);
    }
  }

  return out;
}

function scanFilesForPattern(dir, pattern) {
  return collectTextFiles(dir)
    .map((path) => ({ path, text: fs.readFileSync(path, 'utf8') }))
    .filter((x) => pattern.test(x.text));
}

const files = {
  migration: 'apps/server/db/migrations/2026_06_22_water_response_verification_v1.sql',
  builder: 'apps/server/src/domain/water_response/water_response_verification_from_acceptance_v1.ts',
  route: 'apps/server/src/routes/water_response_verification_v1.ts',
  runtime: 'scripts/runtime_acceptance/ACCEPTANCE_WATER_RESPONSE_VERIFICATION_FROM_ACCEPTANCE_V1_RUNTIME.cjs',
  governance: 'scripts/governance_acceptance/ACCEPTANCE_WATER_RESPONSE_VERIFICATION_FROM_ACCEPTANCE_V1_BOUNDARY.cjs',
};

ok(firstLineIsPathComment(files.migration, `-- ${files.migration}`), 'migration first line is path comment');
ok(firstLineIsPathComment(files.builder, `// ${files.builder}`), 'builder first line is path comment');
ok(firstLineIsPathComment(files.route, `// ${files.route}`), 'route first line is path comment');
ok(firstLineIsPathComment(files.runtime, `// ${files.runtime}`), 'runtime first line is path comment');
ok(firstLineIsPathComment(files.governance, `// ${files.governance}`), 'governance first line is path comment');

const route = read(files.route);
const builder = read(files.builder);
const runtime = read(files.runtime);
const governance = read(files.governance);
const roles = read('apps/server/src/domain/auth/roles.ts');
const auth = read('apps/server/src/auth/ao_act_authz_v0.ts');
const openapi = read('apps/server/src/routes/openapi_v1.ts');
const inventory = read('apps/server/src/routes/api_route_inventory_v1.ts');
const h44Route = read('apps/server/src/routes/acceptance_v1.ts');

ok(route.includes('app.post("/api/v1/water-response/verify-from-acceptance"'), 'route exists');
for (const source of ['acceptance_result_v1', 'as_executed_record_v1', 'root_zone_soil_water_state_index_v1']) {
  ok(route.includes(source), `route reads ${source}`);
}
for (const target of ['operator_water_response_verification_submission_v1', 'water_response_verification_v1', 'water_response_verification_index_v1']) {
  ok(route.includes(target), `route writes/upserts ${target}`);
}
for (const forbidden of ['roi_ledger_v1', 'field_memory_v1', 'operation_state_v1', 'projectReportV1', 'customer delivery']) {
  ok(!new RegExp(`INSERT\\s+INTO\\s+${forbidden}`, 'i').test(route), `route does not write ${forbidden}`);
}

ok(!/from\s+["']pg["']|Fastify|routes\//.test(builder), 'builder does not import pg/Fastify/routes');
ok(!builder.includes('process.env'), 'builder does not read process.env');
ok(!/Date\.now|new Date|randomUUID/.test(builder), 'builder does not create time/id');
ok(builder.includes('function timestampValue'), 'builder defines Date-object-safe timestamp extractor');
ok(builder.includes('value instanceof Date'), 'builder handles pg Date objects');
ok(builder.includes('toISOString()'), 'builder serializes pg Date objects to ISO timestamp');
ok(builder.includes('const preComputedAt = timestampValue(input.preState, "computed_at");'), 'builder uses timestamp extractor for preState.computed_at');
ok(builder.includes('const postComputedAt = timestampValue(input.postState, "computed_at");'), 'builder uses timestamp extractor for postState.computed_at');
ok(builder.includes('executionEndAtFromAsExecuted'), 'builder extracts execution_end_at');
ok(builder.includes('postComputedMs <= executionEndMs'), 'builder enforces post state after execution_end_at');
ok(builder.includes('postComputedMs - executionEndMs'), 'builder computes delay from execution_end_at when available');

ok(auth.includes('"water_response.verify"') && route.includes('["water_response.verify"]'), 'route requires water_response.verify');
ok(roles.includes('operator: ["water_response.verify"'), 'operator allowed');
ok(roles.includes('agronomist: ["water_response.verify"'), 'agronomist allowed');
ok(roles.includes('admin: ["*"]'), 'admin allowed by wildcard');
for (const deniedRole of ['executor', 'approver', 'client', 'viewer']) {
  ok(!new RegExp(`${deniedRole}: \\[([^\\]]*)water_response\\.verify`).test(roles), `${deniedRole} is rejected by role matrix`);
}

ok(
  openapi.includes('/api/v1/water-response/verify-from-acceptance')
    && openapi.includes('security: [{ bearerAuth: [] }]')
    && openapi.includes('auth_scope: "water_response.verify"')
    && openapi.includes('audience: "operator/agronomist"')
    && openapi.includes('boundary: "official"')
    && openapi.includes('owner: "water-response-service / acceptance-service"'),
  'OpenAPI includes exact route with security/auth_scope/governance metadata',
);
ok(
  inventory.includes('route_path: "/api/v1/water-response/verify-from-acceptance"')
    && inventory.includes('customer_navigation_allowed: false'),
  'API inventory includes exact route and customer_navigation_allowed=false',
);

for (const requiredEnv of [
  'GEOX_OPERATOR_ACCEPTANCE_TOKEN',
  'GEOX_AGRONOMIST_ACCEPTANCE_TOKEN',
  'GEOX_ACCEPTANCE_TOKEN',
  'GEOX_EXECUTOR_ACCEPTANCE_TOKEN',
  'GEOX_APPROVER_ONLY_TOKEN',
  'GEOX_CLIENT_TOKEN',
  'GEOX_VIEWER_TOKEN',
]) {
  ok(runtime.includes(requiredEnv), `runtime requires ${requiredEnv}`);
}
ok(!runtime.includes("'dev-token'") && !runtime.includes('"dev-token"'), 'runtime does not fallback to dev-token');
for (const requiredCase of [
  'missing_as_executed',
  'missing_pre_state',
  'missing_post_state',
  'scope_mismatch',
  'post_before_pre',
  'post_before_execution_end_at',
  'not_verifiable',
  'executor_auth',
  'approver_auth',
  'client_auth',
  'viewer_auth',
  'operator_auth',
  'admin_auth',
  'agronomist_auth',
]) {
  ok(runtime.includes(requiredCase), `runtime covers ${requiredCase}`);
}
ok(runtime.includes('REJECTED_AS_EXECUTED_NOT_FOUND'), 'runtime asserts missing as_executed rejection');
ok(runtime.includes('REJECTED_PRE_STATE_NOT_FOUND'), 'runtime asserts missing pre state rejection');
ok(runtime.includes('REJECTED_POST_STATE_NOT_FOUND'), 'runtime asserts missing post state rejection');
ok(runtime.includes('REJECTED_SCOPE_MISMATCH'), 'runtime asserts scope mismatch rejection');
ok(runtime.includes('REJECTED_STATE_TIME_ORDER'), 'runtime asserts state time order rejection');
ok(runtime.includes('NOT_VERIFIABLE'), 'runtime asserts NOT_VERIFIABLE');

const webMatches = scanFilesForPattern(
  'apps/web/src',
  /water_response_verification_v1|verify-from-acceptance/,
);
const web = webMatches.map((x) => `${x.path}\n${x.text}`).join('\n');
ok(!/confirmed delivery|customer final|customer delivery/i.test(web), 'customer files do not expose water_response_verification_v1 as confirmed delivery');
ok(!h44Route.includes('type: "water_response_verification_v1"') && !h44Route.includes("type:'water_response_verification_v1'"), 'H44 acceptance route remains separate');
ok(!/\bexecSync\s*\([^)]*\brg\b/.test(governance), 'governance does not depend on ripgrep');
ok(!governance.includes('||' + ' true'), 'governance does not depend on shell true fallback');

console.log('[h45-boundary] PASS');
