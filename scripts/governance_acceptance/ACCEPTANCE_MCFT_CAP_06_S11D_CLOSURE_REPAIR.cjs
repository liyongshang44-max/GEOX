#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = 'docs/digital_twin/mcft/cap_06';
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S11D_CLOSURE_REPAIR_RESULT.json');
const DEFAULT_BASE = 'f889db7d336661f85198f4b377bc07cc00da4dc0';
const SLICE = 'MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1';
const EXPECTED_FAILS = ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'];
const REQUIRED_ITEM_FIELDS = ['acceptance_id', 'category', 'assertion', 'status', 'evidence_refs', 'workflow_refs', 'canonical_refs', 'notes'];
const ZERO_KEYS = [
  'canonical_fact_append_count', 'canonical_fact_update_count', 'canonical_fact_delete_count',
  'candidate_append_count', 'evaluation_append_count', 'projection_write_count',
  'model_activation_count', 'active_config_switch_count', 'runtime_parameter_change_count',
  'state_mutation_count', 'checkpoint_mutation_count', 'migration_count',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/', 'apps/server/scripts/', 'apps/server/db/migrations/',
  'apps/web/', 'fixtures/', 'docker/',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function write(value) {
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sorted(values) {
  return [...values].sort();
}

function assertZero(delta, label) {
  assert.ok(delta && typeof delta === 'object', `${label}_RUNTIME_DELTA_MISSING`);
  for (const key of ZERO_KEYS) assert.equal(delta[key], 0, `${label}_${key.toUpperCase()}_NONZERO`);
}

function taskbookClaims() {
  const source = read(`${DIR}/GEOX-MCFT-CAP-06-TASK.md`);
  const start = source.indexOf('# 45. Completion Claims Candidate');
  const end = source.indexOf('# 46. Closure lifecycle', start);
  const match = source.slice(start, end).match(/```text\s*\n([\s\S]*?MCFT_CAP_07_REMAINS_UNAUTHORIZED[\s\S]*?)```/);
  assert.ok(match, 'TASKBOOK_COMPLETION_CLAIMS_MISSING');
  const claims = match[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  assert.equal(claims.length, 48, 'TASKBOOK_COMPLETION_CLAIM_COUNT_INVALID');
  return claims;
}

function verifyWrapper(deliverable) {
  assert.equal(exists(deliverable.required_path), true, `REQUIRED_DELIVERABLE_MISSING:${deliverable.required_path}`);
  assert.equal(exists(deliverable.implementation_authority), true, `DELIVERABLE_AUTHORITY_MISSING:${deliverable.implementation_authority}`);
  assert.equal(deliverable.mode, 'COMPATIBILITY_WRAPPER', `DELIVERABLE_MODE_INVALID:${deliverable.required_path}`);
  assert.equal(deliverable.exit_code_propagation, true, `DELIVERABLE_EXIT_PROPAGATION_INVALID:${deliverable.required_path}`);
  assert.equal(deliverable.independent_pass_logic, false, `DELIVERABLE_INDEPENDENT_PASS_LOGIC_INVALID:${deliverable.required_path}`);
  const wrapper = read(deliverable.required_path);
  assert.equal(wrapper.includes(deliverable.implementation_authority), true, `DELIVERABLE_AUTHORITY_NOT_BOUND:${deliverable.required_path}`);
  assert.equal(wrapper.includes('COMPATIBILITY_WRAPPER'), true, `DELIVERABLE_WRAPPER_MARKER_MISSING:${deliverable.required_path}`);

  const command = deliverable.required_path.endsWith('.ts')
    ? ['pnpm', ['exec', 'tsx', deliverable.required_path]]
    : [process.execPath, [deliverable.required_path]];
  const result = cp.spawnSync(command[0], command[1], {
    cwd: ROOT,
    env: { ...process.env, MCFT_CAP_06_COMPATIBILITY_DISCOVERY_ONLY: '1' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `DELIVERABLE_DISCOVERY_FAILED:${deliverable.required_path}:${result.stderr || result.stdout}`);
  const output = JSON.parse(String(result.stdout).trim());
  assert.equal(output.status, 'PASS', `DELIVERABLE_DISCOVERY_STATUS_INVALID:${deliverable.required_path}`);
  assert.equal(output.required_path, deliverable.required_path, `DELIVERABLE_DISCOVERY_PATH_INVALID:${deliverable.required_path}`);
  assert.equal(output.implementation_authority, deliverable.implementation_authority, `DELIVERABLE_DISCOVERY_AUTHORITY_INVALID:${deliverable.required_path}`);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S11D_REPAIR_BASE_REF || DEFAULT_BASE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const exactHead = git(['rev-parse', 'HEAD']);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S11D_REPAIR_PRODUCT_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S11D_REPAIR_FORBIDDEN_SURFACE_CHANGED');

  const repair = json(`${DIR}/GEOX-MCFT-CAP-06-S11D-CLOSURE-REPAIR-STATUS.json`);
  if (Array.isArray(repair.exact_changed_file_boundary)) {
    assert.deepEqual(changed, sorted(repair.exact_changed_file_boundary), 'S11D_REPAIR_CHANGED_FILE_BOUNDARY_INVALID');
  }
  assert.equal(repair.status, 'REPAIR_CANDIDATE');
  assert.equal(repair.repair_classification, 'IMPLEMENTATION_DEFECT');
  assert.equal(repair.new_capability_slice, false);
  assert.equal(repair.task_order_changed, false);
  assert.equal(repair.new_prerequisite_inserted, false);
  assert.equal(repair.active_delivery_slice_id, SLICE);
  assert.equal(repair.next_repository_action, 'S11D_REPAIR_MERGED_MAIN_PROOF');
  assert.equal(repair.pending_completion_claim_count, 48);
  assert.equal(repair.effective_completion_claim_count, 0);
  assert.equal(repair.closure_effective, false);
  assert.equal(repair.capability_complete, false);
  assert.equal(repair.runtime_source_authorized, false);
  assert.equal(repair.successor_capability_line_authorized, false);
  assertZero(repair.runtime_delta, 'REPAIR');

  const deliverables = json(`${DIR}/GEOX-MCFT-CAP-06-REQUIRED-DELIVERABLES-MANIFEST.json`);
  assert.equal(deliverables.required_deliverable_count, 13);
  assert.equal(deliverables.runtime_acceptance_count, 12);
  assert.equal(deliverables.governance_acceptance_count, 1);
  assert.equal(deliverables.wrapper_discovery_execution_required, true);
  assert.equal(deliverables.underlying_authority_regression_required, true);
  assert.equal(deliverables.deliverables.length, 13);
  for (const deliverable of deliverables.deliverables) verifyWrapper(deliverable);

  const ledger = json(`${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`);
  assert.equal(ledger.schema_version, 'geox_mcft_cap_06_hard_acceptance_item_ledger_v2');
  assert.equal(ledger.item_shape_inheritance, 'FORBIDDEN');
  assert.equal(ledger.each_item_self_contained, true);
  assert.equal(ledger.total_check_count, 255);
  assert.deepEqual(ledger.status_counts, { PASS: 253, FAIL: 2, NOT_APPLICABLE: 0 });
  assert.equal(ledger.category_count, 10);
  assert.equal(ledger.category_records.length, 10);
  assert.equal(ledger.completion_claims_effective, false);
  assert.equal(ledger.verified, false);

  const ids = new Set();
  const statusCounts = { PASS: 0, FAIL: 0, NOT_APPLICABLE: 0 };
  const failedIds = [];
  let itemCount = 0;
  for (const recordPath of ledger.category_records) {
    assert.equal(exists(recordPath), true, `LEDGER_CATEGORY_RECORD_MISSING:${recordPath}`);
    const raw = read(recordPath);
    assert.equal(ledger.category_record_digests[recordPath], sha256(raw), `LEDGER_CATEGORY_DIGEST_INVALID:${recordPath}`);
    const record = JSON.parse(raw);
    assert.equal(record.item_shape_inheritance, 'FORBIDDEN', `CATEGORY_ITEM_INHERITANCE_INVALID:${recordPath}`);
    assert.equal(record.each_item_self_contained, true, `CATEGORY_ITEM_SELF_CONTAINED_INVALID:${recordPath}`);
    assert.equal(record.item_count, record.items.length, `CATEGORY_ITEM_COUNT_INVALID:${recordPath}`);
    itemCount += record.items.length;
    for (const item of record.items) {
      assert.equal(ids.has(item.acceptance_id), false, `LEDGER_ITEM_ID_DUPLICATE:${item.acceptance_id}`);
      ids.add(item.acceptance_id);
      for (const field of REQUIRED_ITEM_FIELDS) assert.equal(Object.hasOwn(item, field), true, `LEDGER_ITEM_FIELD_MISSING:${item.acceptance_id}:${field}`);
      assert.equal(item.category, record.category, `LEDGER_ITEM_CATEGORY_INVALID:${item.acceptance_id}`);
      assert.equal(['PASS', 'FAIL', 'NOT_APPLICABLE'].includes(item.status), true, `LEDGER_ITEM_STATUS_INVALID:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.evidence_refs) && item.evidence_refs.length > 0, true, `LEDGER_ITEM_EVIDENCE_REQUIRED:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.workflow_refs) && item.workflow_refs.length > 0, true, `LEDGER_ITEM_WORKFLOW_REQUIRED:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.canonical_refs), true, `LEDGER_ITEM_CANONICAL_REFS_INVALID:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.notes) && item.notes.length > 0, true, `LEDGER_ITEM_NOTES_REQUIRED:${item.acceptance_id}`);
      for (const ref of [...item.evidence_refs, ...item.workflow_refs]) assert.equal(exists(ref), true, `LEDGER_ITEM_REF_MISSING:${item.acceptance_id}:${ref}`);
      statusCounts[item.status] += 1;
      if (item.status === 'FAIL') failedIds.push(item.acceptance_id);
    }
  }
  assert.equal(itemCount, 255);
  assert.equal(ids.size, 255);
  assert.deepEqual(statusCounts, ledger.status_counts);
  assert.deepEqual(sorted(failedIds), sorted(EXPECTED_FAILS));

  const claims = taskbookClaims();
  const closure = json(`${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`);
  const frontier = json(`${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`);
  const verification = json(`${DIR}/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json`);
  const finalization = json(`${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`);
  const reconciliation = json(`${DIR}/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json`);
  const s11a = json(`${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`);
  const s11c = json(`${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`);
  const s11d = json(`${DIR}/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json`);
  const manifest = json(`${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`);

  assert.deepEqual(closure.pending_completion_claims, claims);
  assert.deepEqual(closure.effective_completion_claims, []);
  assert.equal(closure.status, 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED');
  assert.equal(frontier.status, 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED');
  assert.equal(frontier.active_delivery_slice_id, SLICE);
  assert.equal(frontier.next_repository_action, 'S11D_REPAIR_MERGED_MAIN_PROOF');
  assert.equal(manifest.execution_control.active_delivery_slice_id, SLICE);
  assert.equal(manifest.execution_control.next_action, 'S11D_REPAIR_MERGED_MAIN_PROOF');

  for (const [label, value] of Object.entries({ closure, verification, finalization, reconciliation, s11a, s11c, s11d })) {
    assert.equal(value.closure_effective, false, `${label.toUpperCase()}_CLOSURE_EFFECTIVE_INVALID`);
    assert.equal(value.capability_complete, false, `${label.toUpperCase()}_CAPABILITY_COMPLETE_INVALID`);
    assert.equal(value.active_delivery_slice_id, SLICE, `${label.toUpperCase()}_ACTIVE_SLICE_INVALID`);
    assert.equal(value.runtime_source_authorized, false, `${label.toUpperCase()}_RUNTIME_AUTHORITY_INVALID`);
    assertZero(value.runtime_delta, label.toUpperCase());
  }
  assert.equal(verification.completion_claims.pending_count, 48);
  assert.equal(verification.completion_claims.effective_count, 0);
  assert.equal(s11d.hard_acceptance_pass_count, 253);
  assert.equal(s11d.hard_acceptance_fail_count, 2);
  assert.equal(reconciliation.postmerge_ssot_writeback_allowed, false);

  const result = {
    schema_version: 'geox_mcft_cap_06_s11d_closure_repair_result_v1',
    status: 'PASS',
    baseline,
    exact_head: exactHead,
    changed_file_count: changed.length,
    changed_files: changed,
    required_deliverable_count: 13,
    hard_acceptance_total_check_count: 255,
    hard_acceptance_pass_count: 253,
    hard_acceptance_fail_count: 2,
    failed_acceptance_ids: EXPECTED_FAILS,
    pending_completion_claim_count: 48,
    effective_completion_claim_count: 0,
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: 'S11D_REPAIR_MERGED_MAIN_PROOF',
    runtime_source_authorized: false,
    successor_capability_line_authorized: false,
    runtime_delta: repair.runtime_delta,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const result = { schema_version: 'geox_mcft_cap_06_s11d_closure_repair_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
