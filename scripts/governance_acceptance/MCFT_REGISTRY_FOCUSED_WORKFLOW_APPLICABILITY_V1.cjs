#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.env.MCFT_REPOSITORY_ROOT
  ? path.resolve(process.env.MCFT_REPOSITORY_ROOT)
  : path.resolve(__dirname, '../..');
const REGISTRY = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const RESOLVER = 'scripts/governance_acceptance/MCFT_REGISTRY_FOCUSED_WORKFLOW_APPLICABILITY_V1.cjs';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_REGISTRY_FOCUSED_WORKFLOW_APPLICABILITY_V1_RESULT.json');
const MODE = process.argv[2] || '--resolve';

function git(root, args, options = {}) {
  return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
}
function same(left, right) {
  try { assert.deepEqual(left, right); return true; } catch { return false; }
}
function getField(value, fieldPath) {
  return String(fieldPath).split('.').filter(Boolean).reduce((current, key) => {
    if (!current || typeof current !== 'object' || !(key in current)) return undefined;
    return current[key];
  }, value);
}
function readJsonAt(root, ref, relative, errorPrefix) {
  const result = cp.spawnSync('git', ['show', `${ref}:${relative}`], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return null;
  try { return JSON.parse(result.stdout); }
  catch { throw new Error(`${errorPrefix}_INVALID_JSON:${relative}`); }
}
function readTextAt(root, ref, relative) {
  const result = cp.spawnSync('git', ['show', `${ref}:${relative}`], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function canonicalCommit(root, value, label) {
  const raw = String(value || '').trim();
  assert.match(raw, /^[0-9a-f]{40}$/, `${label}_INVALID`);
  return git(root, ['rev-parse', `${raw}^{commit}`]);
}
function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}
function changedFiles(root, base, head) {
  const raw = git(root, ['diff', '--name-only', `${base}...${head}`]);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function validateRules(registry, expectedWorkflow) {
  assert.equal(registry.registry_id, 'MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1');
  assert.ok(Array.isArray(registry.capabilities), 'REGISTRY_CAPABILITIES_INVALID');
  const rules = registry.capabilities.flatMap((capability) =>
    (capability.candidate_transition_fields || [])
      .filter((rule) => rule.focused_workflow != null)
      .map((rule) => ({ capability_line: capability.capability_line, ...rule })),
  );
  const keySeen = new Set();
  const workflowSeen = new Set();
  for (const rule of rules) {
    if (typeof rule.status_file !== 'string' || !rule.status_file) fail('REGISTERED_TRANSITION_RULE_AMBIGUOUS', 'STATUS_FILE');
    if (typeof rule.field_path !== 'string' || !rule.field_path) fail('REGISTERED_TRANSITION_RULE_AMBIGUOUS', 'FIELD_PATH');
    if (typeof rule.focused_workflow !== 'string' || !rule.focused_workflow) fail('REGISTERED_TRANSITION_RULE_AMBIGUOUS', 'FOCUSED_WORKFLOW');
    if (!Array.isArray(rule.allowed_candidate_values) || rule.allowed_candidate_values.length === 0) {
      fail('REGISTERED_TRANSITION_RULE_AMBIGUOUS', `${rule.status_file}:${rule.field_path}:ALLOWED_VALUES`);
    }
    const key = `${rule.status_file}#${rule.field_path}`;
    if (keySeen.has(key) || workflowSeen.has(rule.focused_workflow)) {
      fail('REGISTERED_TRANSITION_RULE_AMBIGUOUS', `${key}:${rule.focused_workflow}`);
    }
    keySeen.add(key);
    workflowSeen.add(rule.focused_workflow);
  }
  if (!workflowSeen.has(expectedWorkflow)) fail('EXPECTED_WORKFLOW_NOT_REGISTERED', expectedWorkflow);
  return rules;
}
function registeredStatusPaths(registry) {
  const output = new Set();
  for (const capability of registry.capabilities || []) {
    for (const value of capability.authoritative_candidate_status_paths || []) {
      if (typeof value === 'string' && value) output.add(value);
    }
    for (const rule of capability.candidate_transition_fields || []) {
      if (typeof rule.status_file === 'string' && rule.status_file) output.add(rule.status_file);
    }
  }
  return output;
}
function maintenanceResult({ expectedWorkflow, base, head, changed, reason, authorityRegistrySubject }) {
  return {
    schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_result',
    status: 'PASS',
    disposition: 'NOT_APPLICABLE',
    reason,
    expected_focused_workflow: expectedWorkflow,
    base_sha: base,
    head_sha: head,
    authority_registry_subject: authorityRegistrySubject,
    registered_transition_count: 0,
    owned_transition_count: 0,
    transitions: [],
    changed_files: changed,
    database_execution_required: false,
    foreign_slice_failure: false,
    pr_modified_registry_used_for_candidate_authority: false,
  };
}
function resolveMaintenance(root, { expectedWorkflow, base, head, baseRegistry, changed }) {
  if (same(changed, [RESOLVER])) {
    validateRules(baseRegistry, expectedWorkflow);
    return maintenanceResult({
      expectedWorkflow, base, head, changed,
      reason: 'RESOLVER_SELF_MAINTENANCE_WITHOUT_REGISTERED_STATUS_TRANSITION',
      authorityRegistrySubject: base,
    });
  }
  if (!changed.includes(REGISTRY)) return null;

  const headRegistry = readJsonAt(root, head, REGISTRY, 'HEAD_AUTHORITY_REGISTRY');
  if (!headRegistry) fail('HEAD_AUTHORITY_REGISTRY_MISSING', REGISTRY);
  validateRules(baseRegistry, expectedWorkflow);
  validateRules(headRegistry, expectedWorkflow);

  const supportFiles = changed.filter((file) => file !== REGISTRY);
  if (supportFiles.length < 1 || supportFiles.length > 4) {
    fail('REGISTRY_MAINTENANCE_BOUNDARY_INVALID', JSON.stringify(changed));
  }
  const supportPattern = /^docs\/digital_twin\/mcft\/cap_[0-9]+\/GEOX-MCFT-CAP-[0-9]+-.*REGISTRY.*CORRECTION.*\.json$/;
  for (const file of supportFiles) {
    if (!supportPattern.test(file)) fail('REGISTRY_MAINTENANCE_SUPPORT_PATH_INVALID', file);
    const document = readJsonAt(root, head, file, 'REGISTRY_MAINTENANCE_SUPPORT');
    if (!document) fail('REGISTRY_MAINTENANCE_SUPPORT_MISSING', file);
    if (document.candidate_transition !== false) fail('REGISTRY_MAINTENANCE_SUPPORT_INVALID', `${file}:candidate_transition`);
    if (document.global_applicability_resolver_delta !== 0) fail('REGISTRY_MAINTENANCE_SUPPORT_INVALID', `${file}:global_applicability_resolver_delta`);
    if (document.runtime_source_delta !== 0) fail('REGISTRY_MAINTENANCE_SUPPORT_INVALID', `${file}:runtime_source_delta`);
    const raw = readTextAt(root, head, file) || '';
    if (raw.includes('MCFT_CANDIDATE_DECLARATION_V2')) fail('REGISTRY_MAINTENANCE_CANDIDATE_DECLARATION_FORBIDDEN', file);
  }

  const statusPaths = new Set([
    ...registeredStatusPaths(baseRegistry),
    ...registeredStatusPaths(headRegistry),
  ]);
  const changedRegisteredStatus = changed.filter((file) => statusPaths.has(file));
  if (changedRegisteredStatus.length > 0) {
    fail('REGISTRY_MAINTENANCE_REGISTERED_STATUS_CHANGED', JSON.stringify(changedRegisteredStatus));
  }
  const statusLike = changed.filter((file) =>
    /^docs\/digital_twin\/mcft\/cap_[0-9]+\/.*(?:CURRENT-AUTHORITY|DELIVERY-STATUS).*\.json$/.test(file));
  if (statusLike.length > 0) fail('REGISTRY_MAINTENANCE_STATUS_LIKE_FILE_CHANGED', JSON.stringify(statusLike));

  return maintenanceResult({
    expectedWorkflow, base, head, changed,
    reason: 'TRUSTED_REGISTRY_MAINTENANCE_WITHOUT_REGISTERED_STATUS_TRANSITION',
    authorityRegistrySubject: base,
  });
}
function resolve(root, env) {
  const expectedWorkflow = String(env.MCFT_EXPECTED_FOCUSED_WORKFLOW || '').trim();
  assert.match(expectedWorkflow, /^[A-Za-z0-9_.-]+$/, 'MCFT_EXPECTED_FOCUSED_WORKFLOW_INVALID');
  const base = canonicalCommit(root, env.MCFT_BASE_SHA, 'MCFT_BASE_SHA');
  const head = canonicalCommit(root, env.MCFT_CANDIDATE_SHA || git(root, ['rev-parse', 'HEAD']), 'MCFT_CANDIDATE_SHA');
  const ancestry = cp.spawnSync('git', ['merge-base', '--is-ancestor', base, head], { cwd: root });
  if (ancestry.status !== 0) fail('MCFT_BASE_NOT_ANCESTOR_OF_HEAD', `${base}:${head}`);
  const registry = readJsonAt(root, base, REGISTRY, 'BASE_AUTHORITY_REGISTRY');
  if (!registry) fail('BASE_AUTHORITY_REGISTRY_MISSING', REGISTRY);
  const changed = changedFiles(root, base, head);
  const maintenance = resolveMaintenance(root, {
    expectedWorkflow, base, head, baseRegistry: registry, changed,
  });
  if (maintenance) return maintenance;

  const rules = validateRules(registry, expectedWorkflow);
  const transitions = [];
  for (const rule of rules) {
    const beforeDocument = readJsonAt(root, base, rule.status_file, 'BASE_REGISTERED_STATUS_FILE');
    if (!beforeDocument) fail('BASE_REGISTERED_STATUS_FILE_MISSING', rule.status_file);
    const afterDocument = readJsonAt(root, head, rule.status_file, 'REGISTERED_STATUS_FILE');
    if (!afterDocument) fail('REGISTERED_STATUS_FILE_DELETED', rule.status_file);
    const before = getField(beforeDocument, rule.field_path);
    if (before === undefined) fail('BASE_REGISTERED_CANDIDATE_FIELD_MISSING', `${rule.status_file}:${rule.field_path}`);
    const after = getField(afterDocument, rule.field_path);
    if (after === undefined) fail('REGISTERED_CANDIDATE_FIELD_REMOVED', `${rule.status_file}:${rule.field_path}`);
    if (same(before, after)) continue;
    const allowed = rule.allowed_candidate_values.some((value) => same(value, after));
    if (!allowed) {
      fail('REGISTERED_CANDIDATE_FIELD_CHANGED_TO_UNALLOWED_VALUE',
        `${rule.status_file}:${rule.field_path}:${JSON.stringify(after)}`);
    }
    transitions.push({
      capability_line: rule.capability_line,
      status_file: rule.status_file,
      field_path: rule.field_path,
      before,
      after,
      focused_workflow: rule.focused_workflow,
      standard_workflow: rule.standard_workflow || null,
    });
  }
  if (transitions.length > 1) fail('MULTIPLE_REGISTERED_CANDIDATE_TRANSITIONS', JSON.stringify(transitions));
  const owned = transitions.filter((transition) => transition.focused_workflow === expectedWorkflow);
  const disposition = owned.length === 1 ? 'APPLICABLE' : 'NOT_APPLICABLE';
  const reason = owned.length === 1
    ? 'REGISTERED_TRANSITION_OWNED_BY_EXPECTED_WORKFLOW'
    : transitions.length === 1
      ? 'REGISTERED_TRANSITION_OWNED_BY_FOREIGN_WORKFLOW'
      : 'NO_REGISTERED_CANDIDATE_TRANSITION';
  return {
    schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_result',
    status: 'PASS', disposition, reason, expected_focused_workflow: expectedWorkflow,
    base_sha: base, head_sha: head, authority_registry_subject: base,
    registered_transition_count: transitions.length, owned_transition_count: owned.length,
    transitions, changed_files: changed,
    database_execution_required: disposition === 'APPLICABLE', foreign_slice_failure: false,
    pr_modified_registry_used_for_candidate_authority: false,
  };
}
function writeRepoFile(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function removeRepoFile(root, relative) {
  fs.rmSync(path.join(root, relative), { force: true });
}
function selfTestScenario(name, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `mcft-resolver-${name}-`));
  try {
    git(root, ['init', '-b', 'main']);
    git(root, ['config', 'user.name', 'MCFT Resolver']);
    git(root, ['config', 'user.email', 'mcft-resolver@example.invalid']);
    const rules = options.rules || [
      { status_file: 'docs/s1.json', field_path: 'candidate', allowed_candidate_values: [true], focused_workflow: 'wf-s1', standard_workflow: 'ci' },
      { status_file: 'docs/s2.json', field_path: 'candidate', allowed_candidate_values: [true], focused_workflow: 'wf-s2', standard_workflow: 'ci' },
    ];
    const registry = options.registry || {
      registry_id: 'MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1',
      capabilities: [{
        capability_line: 'MCFT-CAP-08',
        authoritative_candidate_status_paths: [...new Set(rules.map((rule) => rule.status_file))],
        candidate_transition_fields: rules,
      }],
    };
    writeRepoFile(root, REGISTRY, registry);
    if (!options.omitBaseS1) writeRepoFile(root, 'docs/s1.json', options.baseS1 || { candidate: false });
    if (!options.omitBaseS2) writeRepoFile(root, 'docs/s2.json', options.baseS2 || { candidate: false });
    writeRepoFile(root, RESOLVER, 'base resolver\n');
    writeRepoFile(root, 'README.md', 'base\n');
    git(root, ['add', '.']); git(root, ['commit', '-m', 'base']);
    const base = git(root, ['rev-parse', 'HEAD']);
    if (options.mutate) options.mutate(root, registry);
    if (!options.noTouch) writeRepoFile(root, 'touch.txt', `${name}\n`);
    git(root, ['add', '-A']); git(root, ['commit', '-m', name]);
    const head = git(root, ['rev-parse', 'HEAD']);
    try {
      const result = resolve(root, {
        MCFT_BASE_SHA: base,
        MCFT_CANDIDATE_SHA: head,
        MCFT_EXPECTED_FOCUSED_WORKFLOW: options.workflow || 'wf-s2',
      });
      if (options.expectedError) throw new Error(`SELFTEST_EXPECTED_ERROR_NOT_THROWN:${options.expectedError}`);
      assert.equal(result.disposition, options.expectedDisposition);
      if (options.expectedReason) assert.equal(result.reason, options.expectedReason);
      return { name, disposition: result.disposition, reason: result.reason };
    } catch (error) {
      if (!options.expectedError) throw error;
      assert.match(String(error.message), new RegExp(`^${options.expectedError}(?::|$)`));
      return { name, error: options.expectedError };
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function correctionSupport(overrides = {}) {
  return {
    record_status: 'TRUSTED_REGISTRY_EXISTING_PATHS_CORRECTION_CANDIDATE_NOT_EFFECTIVE',
    candidate_transition: false,
    global_applicability_resolver_delta: 0,
    runtime_source_delta: 0,
    ...overrides,
  };
}
function selfTest() {
  const scenarios = [
    selfTestScenario('no-transition', { expectedDisposition: 'NOT_APPLICABLE' }),
    selfTestScenario('owned-transition', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: true }), expectedDisposition: 'APPLICABLE' }),
    selfTestScenario('foreign-transition', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: true }), workflow: 'wf-s1', expectedDisposition: 'NOT_APPLICABLE' }),
    selfTestScenario('status-deleted', { mutate: (r) => removeRepoFile(r, 'docs/s2.json'), expectedError: 'REGISTERED_STATUS_FILE_DELETED' }),
    selfTestScenario('field-removed', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', {}), expectedError: 'REGISTERED_CANDIDATE_FIELD_REMOVED' }),
    selfTestScenario('unalowed-rollback', { baseS2: { candidate: true }, mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: false }), expectedError: 'REGISTERED_CANDIDATE_FIELD_CHANGED_TO_UNALLOWED_VALUE' }),
    selfTestScenario('illegal-type', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: 'true' }), expectedError: 'REGISTERED_CANDIDATE_FIELD_CHANGED_TO_UNALLOWED_VALUE' }),
    selfTestScenario('ambiguous-rule', { rules: [
      { status_file: 'docs/s2.json', field_path: 'candidate', allowed_candidate_values: [true], focused_workflow: 'wf-s2' },
      { status_file: 'docs/s2.json', field_path: 'candidate', allowed_candidate_values: [true], focused_workflow: 'wf-s2-duplicate' },
    ], expectedError: 'REGISTERED_TRANSITION_RULE_AMBIGUOUS' }),
    selfTestScenario('multiple-transitions', { mutate: (r) => { writeRepoFile(r, 'docs/s1.json', { candidate: true }); writeRepoFile(r, 'docs/s2.json', { candidate: true }); }, expectedError: 'MULTIPLE_REGISTERED_CANDIDATE_TRANSITIONS' }),
    selfTestScenario('resolver-self-maintenance', {
      noTouch: true,
      omitBaseS2: true,
      mutate: (r) => writeRepoFile(r, RESOLVER, 'repaired resolver\n'),
      expectedDisposition: 'NOT_APPLICABLE',
      expectedReason: 'RESOLVER_SELF_MAINTENANCE_WITHOUT_REGISTERED_STATUS_TRANSITION',
    }),
    selfTestScenario('registry-maintenance-fixes-missing-path', {
      noTouch: true,
      omitBaseS2: true,
      mutate: (r, baseRegistry) => {
        const headRegistry = structuredClone(baseRegistry);
        headRegistry.capabilities[0].authoritative_candidate_status_paths = ['docs/s1.json'];
        headRegistry.capabilities[0].candidate_transition_fields = [baseRegistry.capabilities[0].candidate_transition_fields[0]];
        writeRepoFile(r, REGISTRY, headRegistry);
        writeRepoFile(r, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-V1.json', correctionSupport());
        writeRepoFile(r, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-BOUNDARY-V1.json', correctionSupport());
      },
      workflow: 'wf-s1',
      expectedDisposition: 'NOT_APPLICABLE',
      expectedReason: 'TRUSTED_REGISTRY_MAINTENANCE_WITHOUT_REGISTERED_STATUS_TRANSITION',
    }),
    selfTestScenario('registry-maintenance-support-candidate-forbidden', {
      noTouch: true,
      mutate: (r, baseRegistry) => {
        const headRegistry = structuredClone(baseRegistry); headRegistry.authority_set_revision = 'test-change';
        writeRepoFile(r, REGISTRY, headRegistry);
        writeRepoFile(r, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-V1.json', correctionSupport({ candidate_transition: true }));
      },
      expectedError: 'REGISTRY_MAINTENANCE_SUPPORT_INVALID',
    }),
    selfTestScenario('registry-maintenance-status-change-forbidden', {
      noTouch: true,
      mutate: (r, baseRegistry) => {
        const headRegistry = structuredClone(baseRegistry); headRegistry.authority_set_revision = 'test-change';
        writeRepoFile(r, REGISTRY, headRegistry);
        writeRepoFile(r, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-V1.json', correctionSupport());
        writeRepoFile(r, 'docs/s2.json', { candidate: true });
      },
      expectedError: 'REGISTRY_MAINTENANCE_SUPPORT_PATH_INVALID',
    }),
    selfTestScenario('registry-maintenance-unsupported-file-forbidden', {
      noTouch: true,
      mutate: (r, baseRegistry) => {
        const headRegistry = structuredClone(baseRegistry); headRegistry.authority_set_revision = 'test-change';
        writeRepoFile(r, REGISTRY, headRegistry);
        writeRepoFile(r, 'README.md', 'changed\n');
      },
      expectedError: 'REGISTRY_MAINTENANCE_SUPPORT_PATH_INVALID',
    }),
  ];
  return {
    schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_selftest',
    status: 'PASS',
    scenario_count: scenarios.length,
    scenarios,
    maintenance_modes: [
      'RESOLVER_SELF_MAINTENANCE_WITHOUT_REGISTERED_STATUS_TRANSITION',
      'TRUSTED_REGISTRY_MAINTENANCE_WITHOUT_REGISTERED_STATUS_TRANSITION',
    ],
    pr_modified_registry_used_for_candidate_authority: false,
  };
}

try {
  if (MODE === '--self-test') {
    console.log(JSON.stringify(selfTest()));
  } else {
    assert.equal(MODE, '--resolve', 'UNKNOWN_MODE');
    const result = resolve(ROOT, process.env);
    write(result);
    console.log(result.disposition);
  }
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_result',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(result.error);
  process.exitCode = 1;
}
