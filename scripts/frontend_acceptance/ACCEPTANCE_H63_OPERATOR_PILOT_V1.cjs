// scripts/frontend_acceptance/ACCEPTANCE_H63_OPERATOR_PILOT_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  app: 'apps/web/src/app/App.tsx',
  layout: 'apps/web/src/layouts/OperatorLayout.tsx',
  page: 'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
  vm: 'apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts',
  css: 'apps/web/src/styles/operatorPilotReadiness.css',
  doc: 'docs/frontend-productization/H63-PILOT-READINESS-PRODUCT-SURFACE.md',
  p53: 'docs/field_pilot_plan/GEOX-P53-CONTROLLED-FIELD-PILOT-PLAN-GATE-V1.md',
  p54: 'docs/field_pilot_readiness/GEOX-P54-FIELD-PILOT-READINESS-REVIEW-GATE-CLOSURE-REVIEW.json',
};

const allow = [
  /^apps\/web\/src\/layouts\/OperatorLayout\.tsx$/,
  /^apps\/web\/src\/features\/operator\/pilotReadiness\//,
  /^apps\/web\/src\/styles\/operatorPilotReadiness\.css$/,
  /^docs\/frontend-productization\/H63-PILOT-READINESS-PRODUCT-SURFACE\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H63_OPERATOR_PILOT_V1\.cjs$/,
];

const block = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];

const assertions = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function hasAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function lacksAll(content, tokens) {
  return tokens.every((token) => !content.includes(token));
}

function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h63-operator-pilot] ok:', name);
}

function changedFiles() {
  for (const args of [['diff', '--name-only', 'origin/main...HEAD'], ['diff', '--name-only', 'main...HEAD']]) {
    try {
      return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_error) {}
  }
  return [];
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file));
}

try {
  Object.entries(files).forEach(([key, file]) => assert(key + '_exists', exists(file), { file }));

  const diff = changedFiles();

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => matchesAny(file, allow)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !matchesAny(file, block)), { diff });

  const app = read(files.app);
  const layout = read(files.layout);
  const page = read(files.page);
  const vm = read(files.vm);
  const css = read(files.css);
  const doc = read(files.doc);
  const p54 = read(files.p54);

  assert('app_unchanged', !diff.includes(files.app) && !app.includes('OperatorPilotPage'), { file: files.app });
  assert('app_routes_operator_shell', hasAll(app, ['path="/operator/*"', '<OperatorShell />']), { file: files.app });

  assert('layout_exposes_pilot_route', hasAll(layout, [
    'OperatorPilotPage',
    '/operator/pilot',
    'data-h63="pilot-readiness-product-surface"',
    'isPilotReadiness ? <OperatorPilotPage /> : children',
    'key: "pilot"',
    'to: "/operator/pilot"',
    'status: "enabled"',
  ]), { file: files.layout });

  assert('page_imports_css', page.includes('operatorPilotReadiness.css'), { file: files.page });

  assert('page_has_core_sections', hasAll(page, [
    'P53 Pilot Planning Gate',
    'P54 Readiness Review Gate',
    'Readiness Dimensions',
    'Capability Matrix',
    'Traceability',
    'Boundary / Nonclaims',
    'Next Allowed Gate',
  ]), { file: files.page });

  assert('page_has_required_product_panels', hasAll(page, [
    'Candidate Site Scope',
    'Evidence Protocol',
    'Device / Gateway Readiness Plan',
    'Human Role Matrix',
    'Safety / Stop Rules and Rollback Plan',
    'Go / No-Go Gate',
  ]), { file: files.page });

  assert('page_has_no_forbidden_action_copy', lacksAll(page, [
    'Start Pilot',
    'Launch Pilot',
    'Dispatch Pilot',
  ]), { file: files.page });

  assert('vm_has_gates', hasAll(vm, [
    'field_pilot_readiness_product_v1',
    'controlled_pilot_readiness_review',
    'PLAN_READY_WITH_LIMITATIONS',
    'READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS',
    'p55_runtime_health_service_gate_allowed',
    'field_pilot_execution_allowed',
    'false',
  ]), { file: files.vm });

  assert('vm_has_boundaries', hasAll(vm, [
    'field_pilot_started',
    'real_device_deployed',
    'production_gateway_online',
    'live_runtime_monitoring_active',
    'ao_act_task_created',
    'dispatch_enabled',
    'execution_happened',
    'roi_computed',
    'field_memory_learned',
    'full_runtime_v1_frozen',
    'backend_contract_changed',
  ]), { file: files.vm });

  assert('css_has_product_surface_classes', hasAll(css, [
    'operatorPilotReadiness',
    'operatorPilotReadiness__hero',
    'operatorPilotReadiness__panel',
    'operatorPilotReadiness__grid',
    'operatorPilotReadiness__tableRow',
  ]), { file: files.css });

  assert('p54_preserved', hasAll(p54, [
    'p55_runtime_health_service_gate_allowed',
    'field_pilot_execution_allowed',
    'false',
  ]), { file: files.p54 });

  assert('doc_records_surface', hasAll(doc, [
    '/operator/pilot',
    'field_pilot_readiness_product_v1',
    'controlled_pilot_readiness_review',
    'It does not start a field pilot.',
    'It does not create AO-ACT tasks.',
    'It does not dispatch.',
    'It does not compute ROI.',
    'It does not write Field Memory.',
  ]), { file: files.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H63_OPERATOR_PILOT_V1',
    changed_files_checked: diff,
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H63_OPERATOR_PILOT_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}