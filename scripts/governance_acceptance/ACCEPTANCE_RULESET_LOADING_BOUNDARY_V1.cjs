#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const RULESET_STATUS = 'ruleset_status';

const ALLOWED_RULESET_STATUS_FILES = new Set([
  'packages/control-repo-const-harness/src/ruleset_file_harness.ts',
  'packages/control-repo-const-harness/src/__tests__/run.ts',
  'packages/contracts/src/schema/control_verdict_v0.ts',
  'packages/contracts/control_verdict_v0.schema.json',
  'packages/contracts/fixtures/control_verdict_demo_001.json',
  'docs/audit/CONTRACT_ALIGNMENT_MATRIX_V1.md',
  'docs/audit/FRONTEND_BASE_CONFLICT_MATRIX_V1.md',
  'docs/controlplane/constitution/GEOX-ControlConstitution-RepoConst-Ruleset-Loading-Policy-v0.md',
  'scripts/governance_acceptance/ACCEPTANCE_RULESET_LOADING_BOUNDARY_V1.cjs',
]);

function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_RULESET_LOADING_BOUNDARY_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs|json|md)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function filesUnder(...dirs) {
  return dirs.flatMap((d) => walk(path.join(root, d)));
}

function isAllowedRulesetStatusFile(file) {
  return ALLOWED_RULESET_STATUS_FILES.has(rel(file));
}

function assertHarnessIsAuditOnly() {
  const harnessPath = path.join(root, 'packages/control-repo-const-harness/src/ruleset_file_harness.ts');
  assert(fs.existsSync(harnessPath), 'ruleset file harness must exist');
  const text = read(harnessPath);
  assert(text.includes('ruleset_status'), 'harness must be the explicit ruleset_status source');
  assert(text.includes('audit-only'), 'harness must document ruleset_status as audit-only');
  assert(text.includes('evaluateControlV0'), 'harness may call kernel for admission/audit evaluation');
  for (const forbidden of ['scheduler', 'readiness', 'next_action', 'createTask', 'action.task.create', '/api/v1/actions/task']) {
    assert(!text.toLowerCase().includes(forbidden.toLowerCase()), `harness must not drive action sink ${forbidden}`);
  }
}

function assertNoRulesetStatusInRuntimeScopes() {
  const files = filesUnder('apps/server/src', 'apps/web/src', 'packages')
    .filter((file) => !isAllowedRulesetStatusFile(file));
  const offenders = [];
  for (const file of files) {
    const text = read(file);
    if (!text.includes(RULESET_STATUS)) continue;
    offenders.push(`${rel(file)} contains ${RULESET_STATUS} outside audit/admission boundary`);
  }
  assert(offenders.length === 0, `ruleset_status must not leak into runtime scopes:\n${offenders.join('\n')}`);
}

function assertNoRulesetStatusDrivesForbiddenSinks() {
  const files = filesUnder('apps/server/src', 'apps/web/src', 'packages', 'scripts')
    .filter((file) => !isAllowedRulesetStatusFile(file));
  const forbiddenSinks = [
    'readiness',
    'ready',
    'next_action',
    'nextaction',
    'customer_status',
    'customer status',
    'operator_status',
    'operator status',
    'operation_status',
    'final_status',
    'display_status',
    'scheduler',
    'schedule_action',
    'dispatch',
    'createTask',
    'create_task',
    'action.task.create',
    '/api/v1/actions/task',
    'act_task',
    'recommendation',
    'prescription',
    'operation_plan',
  ];
  const offenders = [];
  for (const file of files) {
    const text = read(file);
    if (!text.includes(RULESET_STATUS)) continue;
    const lower = text.toLowerCase();
    for (const sink of forbiddenSinks) {
      if (lower.includes(sink.toLowerCase())) {
        offenders.push(`${rel(file)} contains ${RULESET_STATUS} with forbidden sink ${sink}`);
      }
    }
  }
  assert(offenders.length === 0, `ruleset_status must not drive UI/scheduler/recommendation/task sinks:\n${offenders.join('\n')}`);
}

function assertCustomerAndOperatorSurfacesDoNotMentionRulesetStatus() {
  const files = filesUnder('apps/web/src', 'apps/server/src/projections', 'apps/server/src/routes')
    .filter((file) => !isAllowedRulesetStatusFile(file));
  const offenders = [];
  for (const file of files) {
    const text = read(file);
    if (text.includes(RULESET_STATUS)) offenders.push(rel(file));
  }
  assert(offenders.length === 0, `ruleset_status must not be displayed as customer/operator work status:\n${offenders.join('\n')}`);
}

assertHarnessIsAuditOnly();
assertNoRulesetStatusInRuntimeScopes();
assertNoRulesetStatusDrivesForbiddenSinks();
assertCustomerAndOperatorSurfacesDoNotMentionRulesetStatus();

console.log('[ACCEPTANCE_RULESET_LOADING_BOUNDARY_V1] PASSED');
