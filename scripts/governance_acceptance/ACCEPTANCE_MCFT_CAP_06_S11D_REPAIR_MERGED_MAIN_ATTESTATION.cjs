#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = 'docs/digital_twin/mcft/cap_06';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S11D_REPAIR_MERGED_MAIN_ATTESTATION.json');
const RESOLVED = `${DIR}/GEOX-MCFT-CAP-06-RESOLVED-TASK-MANIFEST-V2.json`;
const LEDGER = `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`;
const WORKFLOW = '.github/workflows/mcft-cap-06-s11d-repair-merged-main-attestation.yml';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11D_REPAIR_MERGED_MAIN_ATTESTATION.cjs';
const PENDING_IDS = ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'];
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

function git(args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function text(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }
function json(relativePath) { return JSON.parse(text(relativePath)); }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function sorted(values) { return [...values].sort(); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function assertZero(delta, label) {
  assert.ok(delta && typeof delta === 'object', `${label}_RUNTIME_DELTA_MISSING`);
  for (const key of ZERO_KEYS) assert.equal(delta[key], 0, `${label}_${key.toUpperCase()}_NONZERO`);
}
function parentChangedFiles() {
  const parentCount = Number(git(['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/).length - 1);
  if (parentCount < 1) return [];
  const parent = git(['rev-parse', 'HEAD^1']);
  const raw = git(['diff', '--name-only', `${parent}..HEAD`]);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function eventMode() {
  const explicit = String(process.env.MCFT_CAP_06_ATTESTATION_MODE || '').trim();
  if (explicit) return explicit;
  const event = String(process.env.GITHUB_EVENT_NAME || '').trim();
  if (event === 'merge_group') return 'MERGE_GROUP_EXACT_SHA';
  if (event === 'push') return 'PUSH_MAIN_EXACT_SHA';
  return 'LOCAL_OR_WORKFLOW_DISPATCH_SELFTEST';
}
function assertWorkflowReadOnly() {
  const workflow = text(WORKFLOW);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.equal(/contents:\s*write/.test(workflow), false, 'ATTESTATION_WORKFLOW_CONTENTS_WRITE_FORBIDDEN');
  assert.equal(/git\s+push|update-ref|create_file|update_file/i.test(workflow), false, 'ATTESTATION_WORKFLOW_REPOSITORY_WRITE_COMMAND_FORBIDDEN');
  assert.equal(workflow.includes('persist-credentials: false'), true, 'ATTESTATION_WORKFLOW_CREDENTIAL_PERSISTENCE_FORBIDDEN');
  assert.equal(workflow.includes('push:'), true, 'ATTESTATION_PUSH_TRIGGER_MISSING');
  assert.equal(workflow.includes('merge_group:'), true, 'ATTESTATION_MERGE_GROUP_TRIGGER_MISSING');
}

function main() {
  const exactHead = git(['rev-parse', 'HEAD']);
  const expectedSha = String(process.env.GITHUB_SHA || exactHead).trim();
  assert.equal(exactHead, expectedSha, 'ATTESTATION_SUBJECT_NOT_EXACT_GITHUB_SHA');
  const mode = eventMode();
  const ref = String(process.env.GITHUB_REF || '').trim();
  if (mode === 'PUSH_MAIN_EXACT_SHA') assert.equal(ref, 'refs/heads/main', 'ATTESTATION_PUSH_REF_NOT_MAIN');
  if (mode === 'MERGE_GROUP_EXACT_SHA') assert.equal(ref.includes('gh-readonly-queue/main/'), true, 'ATTESTATION_MERGE_GROUP_REF_INVALID');

  assertWorkflowReadOnly();
  const changed = parentChangedFiles();
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'ATTESTATION_PRODUCT_RUNTIME_OR_MIGRATION_DELTA_FORBIDDEN');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'ATTESTATION_FORBIDDEN_SURFACE_DELTA');

  const resolved = json(RESOLVED);
  const ledger = json(LEDGER);
  const closure = json(`${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`);
  const frontier = json(`${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`);
  const verification = json(`${DIR}/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json`);
  const finalization = json(`${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`);
  const reconciliation = json(`${DIR}/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json`);
  const s11a = json(`${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`);
  const s11c = json(`${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`);
  const s11d = json(`${DIR}/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json`);
  const repair = json(`${DIR}/GEOX-MCFT-CAP-06-S11D-CLOSURE-REPAIR-STATUS.json`);
  const manifest = json(`${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`);

  assert.equal(resolved.schema_version, 'geox_mcft_cap_06_resolved_task_manifest_v2');
  assert.equal(resolved.resolution_policy.closure_gates_must_consume_resolved_manifest, true);
  assert.equal(resolved.closure_delivery_policy.proof_only_pr_required, false);
  assert.equal(resolved.closure_delivery_policy.exact_merge_sha_attestation_required, true);
  assert.equal(resolved.closure_delivery_policy.attestation_workflow_ref, WORKFLOW);
  assert.equal(resolved.closure_delivery_policy.attestation_gate_ref, GATE);
  assert.equal(resolved.closure_delivery_policy.postmerge_ssot_writeback_allowed, false);
  assert.equal(resolved.s10_composition_boundary.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES');

  assert.deepEqual(ledger.status_counts, { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  const pendingItems = [];
  let itemCount = 0;
  const categoryDigests = {};
  for (const recordPath of ledger.category_records) {
    const raw = text(recordPath);
    categoryDigests[recordPath] = sha256(raw);
    assert.equal(ledger.category_record_digests[recordPath], categoryDigests[recordPath], `ATTESTATION_LEDGER_DIGEST_INVALID:${recordPath}`);
    const record = JSON.parse(raw);
    for (const item of record.items) {
      itemCount += 1;
      if (item.status === 'PENDING') pendingItems.push(item);
      else assert.equal(item.status, 'PASS', `ATTESTATION_NONPASS_ITEM:${item.acceptance_id}`);
    }
  }
  assert.equal(itemCount, 255);
  assert.deepEqual(sorted(pendingItems.map((item) => item.acceptance_id)), sorted(PENDING_IDS));
  for (const item of pendingItems) {
    assert.equal(item.predicate.type, 'MERGE_SHA_ATTESTATION');
    assert.equal(item.predicate.resolution_authority, GATE);
    assert.equal(item.subject_commit, null);
  }

  const projections = { closure, verification, finalization, reconciliation, s11a, s11c, s11d };
  for (const [label, value] of Object.entries(projections)) {
    assert.equal(value.resolved_task_manifest_ref, RESOLVED, `${label.toUpperCase()}_RESOLVED_MANIFEST_REF_INVALID`);
    assert.equal(value.closure_effective, true, `${label.toUpperCase()}_CLOSURE_EFFECTIVE_INVALID`);
    assert.equal(value.capability_complete, true, `${label.toUpperCase()}_CAPABILITY_COMPLETE_INVALID`);
    assert.equal(value.active_delivery_slice_id, null, `${label.toUpperCase()}_ACTIVE_SLICE_NOT_NULL`);
    assert.equal(value.next_repository_action, null, `${label.toUpperCase()}_NEXT_ACTION_NOT_NULL`);
    assert.equal(value.runtime_source_authorized, false, `${label.toUpperCase()}_RUNTIME_AUTHORITY_INVALID`);
    assert.equal(value.proof_only_pr_required, false, `${label.toUpperCase()}_PROOF_ONLY_PR_POLICY_INVALID`);
    assert.equal(value.repair_merge_sha_attestation_required, true, `${label.toUpperCase()}_ATTESTATION_REQUIRED_INVALID`);
    assert.equal(value.postmerge_ssot_writeback_allowed, false, `${label.toUpperCase()}_POSTMERGE_WRITEBACK_POLICY_INVALID`);
    assertZero(value.runtime_delta, label.toUpperCase());
  }
  assert.equal(frontier.status, 'MCFT_CAP_06_COMPLETE');
  assert.equal(frontier.active_delivery_slice_id, null);
  assert.equal(frontier.next_repository_action, null);
  assert.equal(frontier.runtime_source_authorized, false);
  assert.equal(frontier.successor_capability_line_authorized, false);
  assert.equal(frontier.terminal_state.closure_effective, true);
  assert.equal(frontier.terminal_state.capability_complete, true);
  assertZero(frontier.runtime_delta, 'FRONTIER');
  assert.equal(manifest.execution_control.active_delivery_slice_id, null);
  assert.equal(manifest.execution_control.next_action, null);
  assert.equal(manifest.terminal_state.closure_effective, true);
  assert.equal(manifest.terminal_state.capability_complete, true);
  assert.equal(manifest.successor_capability_line_authorized, false);
  assert.equal(repair.status, 'FINAL_CANDIDATE_AWAITING_EXACT_MERGE_SHA_ATTESTATION');

  const claims = resolved.completion_claims.claim_ids;
  assert.equal(claims.length, 48);
  assert.deepEqual(closure.pending_completion_claims, []);
  assert.deepEqual(closure.effective_completion_claims, claims);
  assert.equal(verification.completion_claims.pending_count, 0);
  assert.equal(verification.completion_claims.effective_count, 48);
  assert.deepEqual(verification.completion_claims.effective, claims);

  const resolutions = [
    {
      acceptance_id: 'MCFT_CAP_06_HARD_J_016',
      status: 'PASS',
      subject_commit: exactHead,
      predicate_result: 'ATTESTATION_WORKFLOW_IS_READ_ONLY_AND_PRODUCES_ARTIFACT_ONLY',
    },
    {
      acceptance_id: 'MCFT_CAP_06_HARD_J_017',
      status: 'PASS',
      subject_commit: exactHead,
      predicate_result: 'ALL_CURRENT_FRONTIER_PROJECTIONS_HAVE_ACTIVE_DELIVERY_SLICE_NULL',
    },
  ];

  const result = {
    schema_version: 'geox_mcft_cap_06_s11d_repair_merged_main_attestation_v1',
    status: 'PASS',
    mode,
    subject_commit: exactHead,
    subject_ref: ref || null,
    parent_changed_file_count: changed.length,
    parent_changed_files: changed,
    committed_ledger_status_counts: ledger.status_counts,
    attested_item_resolutions: resolutions,
    effective_hard_acceptance_status_counts: { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 },
    effective_completion_claim_count: 48,
    pending_completion_claim_count: 0,
    closure_effective: true,
    capability_complete: true,
    active_delivery_slice_id: null,
    next_repository_action: null,
    runtime_source_authorized: false,
    successor_capability_line_authorized: false,
    proof_only_pr_created: false,
    repository_write_performed: false,
    postmerge_ssot_writeback_performed: false,
    attestation_workflow_ref: WORKFLOW,
    attestation_workflow_sha256: sha256(text(WORKFLOW)),
    attestation_gate_ref: GATE,
    attestation_gate_sha256: sha256(text(GATE)),
    resolved_task_manifest_ref: RESOLVED,
    resolved_task_manifest_sha256: sha256(text(RESOLVED)),
    ledger_ref: LEDGER,
    ledger_sha256: sha256(text(LEDGER)),
    category_record_digests: categoryDigests,
    s10_composition_boundary: resolved.s10_composition_boundary,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s11d_repair_merged_main_attestation_v1',
    status: 'FAIL',
    subject_commit: (() => { try { return git(['rev-parse', 'HEAD']); } catch { return null; } })(),
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
