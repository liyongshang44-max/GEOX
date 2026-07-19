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
const NEXT = 'S11D_REPAIR_MERGE_SHA_ATTESTATION';
const RESOLVED = `${DIR}/GEOX-MCFT-CAP-06-RESOLVED-TASK-MANIFEST-V2.json`;
const EXPECTED_PENDING = ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'];
const REQUIRED_ITEM_FIELDS = [
  'acceptance_id', 'category', 'assertion', 'lifecycle_phase', 'status', 'predicate',
  'evidence_refs', 'workflow_refs', 'subject_commit', 'canonical_refs', 'notes',
];
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
const LEGACY_FRONTIERS = [
  `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json`,
  `${DIR}/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json`,
];

function git(args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }
function json(relativePath) { return JSON.parse(read(relativePath)); }
function exists(relativePath) { return fs.existsSync(path.join(ROOT, relativePath)); }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function sorted(values) { return [...values].sort(); }
function write(value) {
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function assertZero(delta, label) {
  assert.ok(delta && typeof delta === 'object', `${label}_RUNTIME_DELTA_MISSING`);
  for (const key of ZERO_KEYS) assert.equal(delta[key], 0, `${label}_${key.toUpperCase()}_NONZERO`);
}

function verifyWrapper(deliverable) {
  assert.equal(exists(deliverable.required_path), true, `REQUIRED_DELIVERABLE_MISSING:${deliverable.required_path}`);
  assert.equal(exists(deliverable.implementation_authority), true, `DELIVERABLE_AUTHORITY_MISSING:${deliverable.implementation_authority}`);
  assert.equal(deliverable.mode, 'COMPATIBILITY_WRAPPER', `DELIVERABLE_MODE_INVALID:${deliverable.required_path}`);
  assert.equal(deliverable.exit_code_propagation, true, `DELIVERABLE_EXIT_PROPAGATION_INVALID:${deliverable.required_path}`);
  assert.equal(deliverable.independent_pass_logic, false, `DELIVERABLE_INDEPENDENT_PASS_LOGIC_INVALID:${deliverable.required_path}`);
  const wrapper = read(deliverable.required_path);
  assert.equal(wrapper.includes(deliverable.implementation_authority), true, `DELIVERABLE_AUTHORITY_NOT_BOUND:${deliverable.required_path}`);
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
  assert.equal(output.status, 'PASS');
  assert.equal(output.required_path, deliverable.required_path);
  assert.equal(output.implementation_authority, deliverable.implementation_authority);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S11D_REPAIR_BASE_REF || DEFAULT_BASE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const exactHead = git(['rev-parse', 'HEAD']);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S11D_REPAIR_PRODUCT_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S11D_REPAIR_FORBIDDEN_SURFACE_CHANGED');

  const entry = read(`${DIR}/GEOX-MCFT-CAP-06-TASK.md`);
  assert.equal(entry.includes(`resolved_manifest_ref: ${RESOLVED}`), true, 'TASK_ENTRY_RESOLVED_MANIFEST_REF_MISSING');
  assert.equal(entry.includes('# 43. Hard Acceptance evidence ledger'), false, 'TASK_ENTRY_STILL_CONTAINS_HISTORICAL_BODY');
  assert.equal(exists(`${DIR}/GEOX-MCFT-CAP-06-TASK-v0.3.1.md`), true, 'HISTORICAL_TASKBOOK_MISSING');

  const resolved = json(RESOLVED);
  assert.equal(resolved.schema_version, 'geox_mcft_cap_06_resolved_task_manifest_v2');
  assert.equal(resolved.record_status, 'EFFECTIVE_RESOLVED_AUTHORITY');
  assert.equal(resolved.resolution_policy.direct_historical_task_parsing_forbidden, true);
  assert.equal(resolved.resolution_policy.closure_gates_must_consume_resolved_manifest, true);
  assert.equal(resolved.resolved_slice_graph.length, 17);
  assert.equal(resolved.resolved_slice_graph.map((item) => item.sequence).join(','), '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17');
  for (const item of resolved.resolved_slice_graph) {
    for (const key of ['slice_id','inputs','outputs','canonical_writes','consumer','successor_probe','authority_graph_refs','entry_conditions','exit_conditions','nonclaims']) {
      assert.equal(Object.hasOwn(item, key), true, `RESOLVED_SLICE_FIELD_MISSING:${item.short_id}:${key}`);
    }
  }
  assert.equal(resolved.completion_claims.count, 48);
  assert.equal(resolved.completion_claims.claim_ids.length, 48);
  assert.equal(resolved.capability_result_boundary.repository_history_calibration_capability, 'NOT_ESTABLISHED');
  assert.equal(resolved.capability_result_boundary.production_runtime_capability, 'NOT_ESTABLISHED');
  assert.equal(resolved.s10_composition_boundary.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES');
  assert.equal(resolved.s10_composition_boundary.controlled_stage_database_count, 2);
  assert.equal(resolved.closure_delivery_policy.proof_only_pr_required, false);
  assert.deepEqual(resolved.closure_delivery_policy.attestation_triggers, ['merge_group', 'push:main']);

  const taskbookManifest = json(`${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`);
  assert.equal(taskbookManifest.schema_version, 'geox_mcft_cap_06_taskbook_manifest_v2');
  assert.equal(taskbookManifest.resolved_manifest_ref, RESOLVED);
  assert.equal(taskbookManifest.direct_legacy_task_parsing_forbidden, true);
  assert.equal(taskbookManifest.closure_gates_must_consume_resolved_manifest, true);

  for (const legacyPath of LEGACY_FRONTIERS) {
    const legacy = json(legacyPath);
    assert.equal(legacy.record_status, 'HISTORICAL_SUPERSEDED_FOR_CURRENT_FRONTIER', `LEGACY_RECORD_STATUS_INVALID:${legacyPath}`);
    assert.equal(legacy.historical_snapshot, true, `LEGACY_HISTORICAL_FLAG_INVALID:${legacyPath}`);
    assert.equal(legacy.current_frontier_authority, false, `LEGACY_AUTHORITY_FLAG_INVALID:${legacyPath}`);
    assert.equal(legacy.superseded_by, `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`, `LEGACY_SUPERSEDED_BY_INVALID:${legacyPath}`);
  }

  const deliverables = json(`${DIR}/GEOX-MCFT-CAP-06-REQUIRED-DELIVERABLES-MANIFEST.json`);
  assert.equal(deliverables.required_deliverable_count, 13);
  assert.equal(deliverables.runtime_acceptance_count, 12);
  assert.equal(deliverables.governance_acceptance_count, 1);
  assert.equal(deliverables.deliverables.length, 13);
  for (const deliverable of deliverables.deliverables) verifyWrapper(deliverable);

  const ledger = json(`${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`);
  assert.equal(ledger.schema_version, 'geox_mcft_cap_06_hard_acceptance_item_ledger_v3');
  assert.equal(ledger.resolved_task_manifest_ref, RESOLVED);
  assert.equal(ledger.item_shape_inheritance, 'FORBIDDEN');
  assert.equal(ledger.each_item_self_contained, true);
  assert.equal(ledger.total_check_count, 255);
  assert.deepEqual(ledger.status_domain, ['PASS', 'FAIL', 'PENDING', 'NOT_APPLICABLE']);
  assert.deepEqual(ledger.status_counts, { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  assert.equal(ledger.category_count, 10);
  assert.equal(ledger.category_records.length, 10);
  assert.equal(ledger.completion_claims_effective, false);
  assert.equal(ledger.verified, false);

  const ids = new Set();
  const statusCounts = { PASS: 0, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 };
  const pendingIds = [];
  let itemCount = 0;
  for (const recordPath of ledger.category_records) {
    assert.equal(exists(recordPath), true, `LEDGER_CATEGORY_RECORD_MISSING:${recordPath}`);
    const raw = read(recordPath);
    assert.equal(ledger.category_record_digests[recordPath], sha256(raw), `LEDGER_CATEGORY_DIGEST_INVALID:${recordPath}`);
    const record = JSON.parse(raw);
    assert.equal(record.item_shape_inheritance, 'FORBIDDEN');
    assert.equal(record.each_item_self_contained, true);
    assert.equal(record.item_count, record.items.length);
    itemCount += record.items.length;
    for (const item of record.items) {
      assert.equal(ids.has(item.acceptance_id), false, `LEDGER_ITEM_ID_DUPLICATE:${item.acceptance_id}`);
      ids.add(item.acceptance_id);
      for (const field of REQUIRED_ITEM_FIELDS) assert.equal(Object.hasOwn(item, field), true, `LEDGER_ITEM_FIELD_MISSING:${item.acceptance_id}:${field}`);
      assert.equal(item.category, record.category);
      assert.equal(['PASS', 'FAIL', 'PENDING', 'NOT_APPLICABLE'].includes(item.status), true, `LEDGER_ITEM_STATUS_INVALID:${item.acceptance_id}`);
      assert.equal(item.predicate.statement, item.assertion, `LEDGER_ITEM_PREDICATE_ASSERTION_MISMATCH:${item.acceptance_id}`);
      assert.equal(item.predicate.expected_result, 'PASS', `LEDGER_ITEM_PREDICATE_RESULT_INVALID:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.evidence_refs) && item.evidence_refs.length > 0, true, `LEDGER_ITEM_EVIDENCE_REQUIRED:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.workflow_refs) && item.workflow_refs.length > 0, true, `LEDGER_ITEM_WORKFLOW_REQUIRED:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.canonical_refs), true);
      assert.equal(Array.isArray(item.notes) && item.notes.length > 0, true);
      for (const ref of [...item.evidence_refs, ...item.workflow_refs]) assert.equal(exists(ref), true, `LEDGER_ITEM_REF_MISSING:${item.acceptance_id}:${ref}`);
      if (item.status === 'PENDING') {
        assert.equal(item.subject_commit, null, `PENDING_ITEM_SUBJECT_COMMIT_MUST_BE_NULL:${item.acceptance_id}`);
        assert.equal(item.predicate.type, 'MERGE_SHA_ATTESTATION');
        pendingIds.push(item.acceptance_id);
      } else {
        assert.equal(item.predicate.type, 'EVIDENCE_BOUND_ASSERTION');
      }
      statusCounts[item.status] += 1;
    }
  }
  assert.equal(itemCount, 255);
  assert.equal(ids.size, 255);
  assert.deepEqual(statusCounts, ledger.status_counts);
  assert.deepEqual(sorted(pendingIds), sorted(EXPECTED_PENDING));

  const claims = resolved.completion_claims.claim_ids;
  const closure = json(`${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`);
  const frontier = json(`${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`);
  const verification = json(`${DIR}/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json`);
  const finalization = json(`${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`);
  const reconciliation = json(`${DIR}/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json`);
  const s11a = json(`${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`);
  const s11c = json(`${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`);
  const s11d = json(`${DIR}/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json`);
  const repair = json(`${DIR}/GEOX-MCFT-CAP-06-S11D-CLOSURE-REPAIR-STATUS.json`);

  assert.equal(repair.status, 'REPAIR_CANDIDATE');
  assert.equal(repair.repair_classification, 'IMPLEMENTATION_DEFECT');
  assert.equal(repair.new_capability_slice, false);
  assert.equal(repair.task_order_changed, false);
  assert.equal(repair.active_delivery_slice_id, SLICE);
  assert.equal(repair.next_repository_action, NEXT);
  assert.equal(repair.hard_acceptance.pass_count, 253);
  assert.equal(repair.hard_acceptance.fail_count, 0);
  assert.equal(repair.hard_acceptance.pending_count, 2);
  assert.deepEqual(sorted(repair.hard_acceptance.pending_acceptance_ids), sorted(EXPECTED_PENDING));

  assert.deepEqual(closure.pending_completion_claims, claims);
  assert.deepEqual(closure.effective_completion_claims, []);
  assert.equal(closure.status, 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED');
  assert.equal(frontier.status, 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED');
  assert.equal(frontier.active_delivery_slice_id, SLICE);
  assert.equal(frontier.next_repository_action, NEXT);
  assert.equal(taskbookManifest.execution_control.active_delivery_slice_id, SLICE);

  for (const [label, value] of Object.entries({ closure, verification, finalization, reconciliation, s11a, s11c, s11d })) {
    assert.equal(value.resolved_task_manifest_ref, RESOLVED, `${label.toUpperCase()}_RESOLVED_MANIFEST_REF_INVALID`);
    assert.equal(value.closure_effective, false, `${label.toUpperCase()}_CLOSURE_EFFECTIVE_INVALID`);
    assert.equal(value.capability_complete, false, `${label.toUpperCase()}_CAPABILITY_COMPLETE_INVALID`);
    assert.equal(value.active_delivery_slice_id, SLICE, `${label.toUpperCase()}_ACTIVE_SLICE_INVALID`);
    assert.equal(value.runtime_source_authorized, false, `${label.toUpperCase()}_RUNTIME_AUTHORITY_INVALID`);
    assert.equal(value.proof_only_pr_required, false, `${label.toUpperCase()}_PROOF_ONLY_PR_POLICY_INVALID`);
    assert.equal(value.repair_merge_sha_attestation_required, true, `${label.toUpperCase()}_ATTESTATION_POLICY_INVALID`);
    assert.equal(value.s10_composition_boundary.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES', `${label.toUpperCase()}_S10_BOUNDARY_INVALID`);
    assertZero(value.runtime_delta, label.toUpperCase());
  }
  assert.equal(verification.completion_claims.pending_count, 48);
  assert.equal(verification.completion_claims.effective_count, 0);
  assert.equal(s11d.hard_acceptance_pass_count, 253);
  assert.equal(s11d.hard_acceptance_fail_count, 0);
  assert.equal(s11d.hard_acceptance_pending_count, 2);
  assert.equal(reconciliation.postmerge_ssot_writeback_allowed, false);

  const quality = json(`${DIR}/GEOX-MCFT-CAP-06-QUALITY-BOUNDARY.json`);
  assert.equal(quality.technical_capability, 'COMPLETE');
  assert.equal(quality.repository_history_calibration_capability, 'NOT_ESTABLISHED');
  assert.equal(quality.production_runtime_capability, 'NOT_ESTABLISHED');
  assert.equal(quality.s10_interpretation, 'TWO_STAGE_CONTROLLED_END_TO_END_COMPOSITION_PROOF');
  assert.equal(quality.successor_capability_line_authorized, false);

  const result = {
    schema_version: 'geox_mcft_cap_06_s11d_closure_repair_result_v2',
    status: 'PASS',
    baseline,
    exact_head: exactHead,
    changed_file_count: changed.length,
    changed_files: changed,
    resolved_task_manifest_ref: RESOLVED,
    resolved_slice_count: 17,
    required_deliverable_count: 13,
    hard_acceptance_total_check_count: 255,
    hard_acceptance_pass_count: 253,
    hard_acceptance_fail_count: 0,
    hard_acceptance_pending_count: 2,
    pending_acceptance_ids: EXPECTED_PENDING,
    pending_completion_claim_count: 48,
    effective_completion_claim_count: 0,
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    proof_only_pr_required: false,
    merge_sha_attestation_required: true,
    runtime_source_authorized: false,
    successor_capability_line_authorized: false,
    s10_composition_boundary: resolved.s10_composition_boundary,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try { main(); } catch (error) {
  const result = { schema_version: 'geox_mcft_cap_06_s11d_closure_repair_result_v2', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
