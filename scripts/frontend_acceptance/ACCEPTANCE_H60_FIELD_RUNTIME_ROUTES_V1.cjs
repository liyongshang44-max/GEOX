// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_ROUTES_V1.cjs
// Purpose: statically verify H60-B Field Runtime route ownership without running frontend code or touching backend state.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  placeholder: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePlaceholder.tsx',
  h60aContract: 'docs/frontend-productization/H60-FIELD-RUNTIME-CONSOLIDATION.md',
  h60bDoc: 'docs/frontend-productization/H60-FIELD-RUNTIME-ROUTE-OWNERSHIP.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_ROUTES_V1.cjs',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
};

const H60B_ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/,
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/FieldRuntimeRoutePlaceholder\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-ROUTE-OWNERSHIP\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_ROUTES_V1\.cjs$/,
];

const assertions = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h60-field-runtime-routes] ok:', name);
}

function normalizeForTokenScan(value) {
  return value
    .replace(/[\uFEFF]/g, '')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/[，。；、：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAll(content, tokens) {
  const normalizedContent = normalizeForTokenScan(content);
  return tokens.every((token) => normalizedContent.includes(normalizeForTokenScan(token)));
}

function lacksAll(content, tokens) {
  const normalizedContent = normalizeForTokenScan(content);
  return tokens.every((token) => !normalizedContent.includes(normalizeForTokenScan(token)));
}

function extractFunctionBlock(content, functionName) {
  const marker = `function ${functionName}`;
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) return '';
  const firstBraceIndex = content.indexOf('{', markerIndex);
  if (firstBraceIndex < 0) return '';
  let depth = 0;
  for (let index = firstBraceIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(markerIndex, index + 1);
  }
  return '';
}

function getChangedFiles() {
  const commands = [
    ['git', ['diff', '--name-only', 'origin/main...HEAD']],
    ['git', ['diff', '--name-only', 'main...HEAD']],
  ];
  for (const [command, args] of commands) {
    try {
      const output = childProcess.execFileSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return output
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_error) {
      // Try the next read-only diff command.
    }
  }
  return [];
}

function isAllowedH60BChangedFile(filePath) {
  return H60B_ALLOWED_CHANGED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const changedFiles = getChangedFiles();
  assert('h60b_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every(isAllowedH60BChangedFile), {
    changed_files: changedFiles,
    allowed_patterns: H60B_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const placeholder = read(FILES.placeholder);
  const h60aContract = read(FILES.h60aContract);
  const h60bDoc = read(FILES.h60bDoc);
  const operatorLayout = read(FILES.operatorLayout);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const routeAndPlaceholder = routeModule + '\n' + placeholder;

  assert('h60a_baseline_records_lettered_numbering', containsAll(h60aContract, [
    'H60-A = former H60.0 Field Runtime IA Contract',
    'H60-B = former H60.1 Field Runtime Route Ownership',
    'H60-C = former H60.2 Field Runtime Layout + Tabs',
  ]), { file: FILES.h60aContract });

  assert('app_mounts_operator_shell_and_thin_field_runtime_route_module', containsAll(app, [
    'import OperatorFieldRuntimeRoutes from "./routes/operatorFieldRuntimeRoutes"',
    'path="/operator/*" element={<OperatorShell />} />',
    '<Route path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
  ]), { file: FILES.app });

  assert('operator_routes_block_preserves_legacy_routes', containsAll(operatorRoutesBlock, [
    'path="twin" element={<OperatorTwinOverviewPage />}',
    'path="twin/gateway-demo" element={<OperatorGatewayDemoViewerPage />}',
    'path="twin/fields/:fieldId" element={<OperatorFieldTwinWorkspacePage />}',
    'path="twin/fields/:fieldId/forecast" element={<OperatorFieldTwinForecastPage />}',
    'path="twin/fields/:fieldId/scenarios" element={<OperatorFieldTwinScenarioComparePage />}',
    'path="twin/fields/:fieldId/evidence" element={<OperatorFieldTwinEvidencePage />}',
    'path="twin/fields/:fieldId/calibration" element={<OperatorFieldTwinCalibrationPage />}',
    'path="twin/fields/:fieldId/post-irrigation" element={<OperatorFieldTwinPostIrrigationPage />}',
  ]), { file: FILES.app, scope: 'OperatorRoutes' });

  assert('app_does_not_add_broad_app_operator_wildcard_or_legacy_redirect', lacksAll(app, [
    'path="/app/operator/*"',
    'to="/operator/fields',
    'replace to="/operator/fields',
  ]), { file: FILES.app });

  assert('route_module_defines_canonical_field_runtime_routes', containsAll(routeModule, [
    'function OperatorFieldRuntimeRoutes',
    'FieldRuntimeRoutePlaceholder',
    '<Route index element={<FieldRuntimeRoutePlaceholder tab="fields" />} />',
    'path=":fieldId"',
    'path=":fieldId/evidence"',
    'path=":fieldId/state"',
    'path=":fieldId/forecast"',
    'path=":fieldId/scenario"',
    'path=":fieldId/residual"',
    'path=":fieldId/calibration"',
    'path=":fieldId/health"',
    'path=":fieldId/audit"',
  ]), { file: FILES.routeModule });

  assert('route_module_does_not_import_legacy_field_pages', lacksAll(routeModule, [
    'OperatorFieldTwinWorkspacePage',
    'OperatorFieldTwinForecastPage',
    'OperatorFieldTwinScenarioComparePage',
    'OperatorFieldTwinEvidencePage',
    'OperatorFieldTwinCalibrationPage',
    'OperatorFieldTwinPostIrrigationPage',
    'SubmitScenarioToRecommendationPanel',
  ]), { file: FILES.routeModule });

  assert('canonical_placeholder_displays_runtime_nonclaims_and_route_ownership', containsAll(placeholder, [
    'Field Runtime',
    'Read-only Field Runtime',
    'Runtime Mode: Replay-backed Demo',
    'Live Device: Not connected',
    'Production Gateway: Not online',
    'Field Pilot: Not started',
    'AO-ACT Dispatch: Disabled',
    'Canonical route family: /operator/fields/*',
    'Legacy route family preserved: /operator/twin/fields/*',
  ]), { file: FILES.placeholder });

  assert('canonical_placeholder_displays_tab_boundary_copy', containsAll(placeholder, [
    'Field Runtime list route is reserved for H60.',
    'No field list data is loaded in H60-B.',
    'Overview route is reserved for H60-C/H60-D.',
    'This placeholder does not load workspace data.',
    'Evidence route is reserved for H60-E.',
    'This placeholder does not write facts.',
    'State route is reserved for H60-D.',
    'This placeholder does not generate state estimates.',
    'Forecast route is reserved for H60-F.',
    'Forecast is not a recommendation.',
    'Forecast does not create task.',
    'Forecast does not imply action.',
    'Scenario route is reserved for H60-G.',
    'Scenario is a projection, not a task.',
    'Scenario is not a recommendation.',
    'No approval / dispatch / AO-ACT.',
    'Residual route is reserved for H60-H.',
    'Residual is an accuracy / response review.',
    'Residual is not causal proof.',
    'Residual does not write ROI.',
    'Residual does not write Field Memory.',
    'Calibration route is reserved for H60-I.',
    'Calibration Review is read-only.',
    'No model update.',
    'No Field Memory write.',
    'Health route is reserved for H62.',
    'Runtime Health product surface is planned for H62.',
    'This tab does not claim production monitoring.',
    'Audit route is reserved for H60-K.',
    'Audit can show refs and contracts later, but does not create product conclusions.',
  ]), { file: FILES.placeholder });

  assert('canonical_routes_and_placeholders_have_no_writer_or_api_tokens', lacksAll(routeAndPlaceholder, [
    'SubmitScenarioToRecommendationPanel',
    'submitRecommendation',
    'createAoActTask',
    'writeFact',
    'fetch(',
    'axios',
    'POST',
    '/api/control',
    '/api/control/ao_act',
    'approvalClient',
    'dispatchClient',
    'roiWriter',
    'fieldMemoryWriter',
    'modelUpdate',
  ]), { files: [FILES.routeModule, FILES.placeholder] });

  assert('h60b_doc_records_route_ownership_scope', containsAll(h60bDoc, [
    'H60-B implements route ownership only',
    'H60-B does not implement Field Runtime Layout',
    'H60-B does not migrate field tab contents',
    'H60-B does not redirect legacy routes',
    'H60-B does not open write surfaces',
    'H60-B canonical routes render read-only placeholders',
    'H60-C will implement layout + tabs',
    '/operator/fields/* = canonical Field Runtime product route family',
    '/operator/twin/fields/* = legacy Operator Twin field route family',
  ]), { file: FILES.h60bDoc });

  assert('operator_layout_remains_shell_only_for_h60b', containsAll(operatorLayout, [
    'GEOX Operator Runtime Console',
    '操作员运行控制台',
    '{children}',
  ]) && lacksAll(operatorLayout, [
    'FieldRuntimeRoutePlaceholder',
    'OperatorFieldRuntimeRoutes',
  ]), { file: FILES.operatorLayout });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_ROUTES_V1',
    scope: 'static H60-B route ownership only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: H60B_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
    files_checked: FILES,
    assertions,
    next_step: 'H60-C_FIELD_RUNTIME_LAYOUT_AND_TABS',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_ROUTES_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
