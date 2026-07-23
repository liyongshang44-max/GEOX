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
function resolve(root, env) {
  const expectedWorkflow = String(env.MCFT_EXPECTED_FOCUSED_WORKFLOW || '').trim();
  assert.match(expectedWorkflow, /^[A-Za-z0-9_.-]+$/, 'MCFT_EXPECTED_FOCUSED_WORKFLOW_INVALID');
  const base = canonicalCommit(root, env.MCFT_BASE_SHA, 'MCFT_BASE_SHA');
  const head = canonicalCommit(root, env.MCFT_CANDIDATE_SHA || git(root, ['rev-parse', 'HEAD']), 'MCFT_CANDIDATE_SHA');
  const ancestry = cp.spawnSync('git', ['merge-base', '--is-ancestor', base, head], { cwd: root });
  if (ancestry.status !== 0) fail('MCFT_BASE_NOT_ANCESTOR_OF_HEAD', `${base}:${head}`);
  const registry = readJsonAt(root, base, REGISTRY, 'BASE_AUTHORITY_REGISTRY');
  if (!registry) fail('BASE_AUTHORITY_REGISTRY_MISSING', REGISTRY);
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
  const changedRaw = git(root, ['diff', '--name-only', `${base}...${head}`]);
  return {
    schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_result',
    status: 'PASS', disposition, reason, expected_focused_workflow: expectedWorkflow,
    base_sha: base, head_sha: head, authority_registry_subject: base,
    registered_transition_count: transitions.length, owned_transition_count: owned.length,
    transitions, changed_files: changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [],
    database_execution_required: disposition === 'APPLICABLE', foreign_slice_failure: false,
  };
}
function writeRepoFile(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
    writeRepoFile(root, REGISTRY, { registry_id: 'MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1', capabilities: [{ capability_line: 'MCFT-CAP-08', candidate_transition_fields: rules }] });
    if (!options.omitBaseS1) writeRepoFile(root, 'docs/s1.json', options.baseS1 || { candidate: false });
    if (!options.omitBaseS2) writeRepoFile(root, 'docs/s2.json', options.baseS2 || { candidate: false });
    writeRepoFile(root, 'README.md', 'base\n');
    git(root, ['add', '.']); git(root, ['commit', '-m', 'base']);
    const base = git(root, ['rev-parse', 'HEAD']);
    if (options.mutate) options.mutate(root);
    writeRepoFile(root, 'touch.txt', `${name}\n`);
    git(root, ['add', '-A']); git(root, ['commit', '-m', name]);
    const head = git(root, ['rev-parse', 'HEAD']);
    try {
      const result = resolve(root, { MCFT_BASE_SHA: base, MCFT_CANDIDATE_SHA: head, MCFT_EXPECTED_FOCUSED_WORKFLOW: options.workflow || 'wf-s2' });
      if (options.expectedError) throw new Error(`SELFTEST_EXPECTED_ERROR_NOT_THROWN:${options.expectedError}`);
      assert.equal(result.disposition, options.expectedDisposition);
      return { name, disposition: result.disposition };
    } catch (error) {
      if (!options.expectedError) throw error;
      assert.match(String(error.message), new RegExp(`^${options.expectedError}(?::|$)`));
      return { name, error: options.expectedError };
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function selfTest() {
  const scenarios = [
    selfTestScenario('no-transition', { expectedDisposition: 'NOT_APPLICABLE' }),
    selfTestScenario('owned-transition', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: true }), expectedDisposition: 'APPLICABLE' }),
    selfTestScenario('foreign-transition', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: true }), workflow: 'wf-s1', expectedDisposition: 'NOT_APPLICABLE' }),
    selfTestScenario('status-deleted', { mutate: (r) => fs.rmSync(path.join(r, 'docs/s2.json')), expectedError: 'REGISTERED_STATUS_FILE_DELETED' }),
    selfTestScenario('field-removed', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', {}), expectedError: 'REGISTERED_CANDIDATE_FIELD_REMOVED' }),
    selfTestScenario('unalowed-rollback', { baseS2: { candidate: true }, mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: false }), expectedError: 'REGISTERED_CANDIDATE_FIELD_CHANGED_TO_UNALLOWED_VALUE' }),
    selfTestScenario('illegal-type', { mutate: (r) => writeRepoFile(r, 'docs/s2.json', { candidate: 'true' }), expectedError: 'REGISTERED_CANDIDATE_FIELD_CHANGED_TO_UNALLOWED_VALUE' }),
    selfTestScenario('ambiguous-rule', { rules: [
      { status_file: 'docs/s2.json', field_path: 'candidate', allowed_candidate_values: [true], focused_workflow: 'wf-s2' },
      { status_file: 'docs/s2.json', field_path: 'candidate', allowed_candidate_values: [true], focused_workflow: 'wf-s2-duplicate' },
    ], expectedError: 'REGISTERED_TRANSITION_RULE_AMBIGUOUS' }),
    selfTestScenario('multiple-transitions', { mutate: (r) => { writeRepoFile(r, 'docs/s1.json', { candidate: true }); writeRepoFile(r, 'docs/s2.json', { candidate: true }); }, expectedError: 'MULTIPLE_REGISTERED_CANDIDATE_TRANSITIONS' }),
  ];
  return { schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_selftest', status: 'PASS', scenario_count: scenarios.length, scenarios };
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
  const result = { schema_version: 'geox_mcft_registry_focused_workflow_applicability_v1_result', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result); console.error(result.error); process.exitCode = 1;
}
