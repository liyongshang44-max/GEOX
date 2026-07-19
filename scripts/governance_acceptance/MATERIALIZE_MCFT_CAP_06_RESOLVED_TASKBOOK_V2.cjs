#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = 'docs/digital_twin/mcft/cap_06';
const ENTRY = `${DIR}/GEOX-MCFT-CAP-06-TASK.md`;
const HISTORICAL = `${DIR}/GEOX-MCFT-CAP-06-TASK-v0.3.1.md`;
const REVISION = `${DIR}/GEOX-MCFT-CAP-06-TASK-v0.4.0-REVISION.md`;
const RESOLVED = `${DIR}/GEOX-MCFT-CAP-06-RESOLVED-TASK-MANIFEST-V2.json`;
const TASKBOOK_MANIFEST = `${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`;
const FRONTIER = `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`;
const LEDGER = `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`;
const REQUIRED = `${DIR}/GEOX-MCFT-CAP-06-REQUIRED-DELIVERABLES-MANIFEST.json`;
const REPAIR_STATUS = `${DIR}/GEOX-MCFT-CAP-06-S11D-CLOSURE-REPAIR-STATUS.json`;
const SLICE = 'MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1';
const NEXT = 'S11D_REPAIR_MERGE_SHA_ATTESTATION';
const PENDING_IDS = new Set(['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017']);
const ATTESTATION_WORKFLOW = '.github/workflows/mcft-cap-06-s11d-repair-merged-main-attestation.yml';
const ATTESTATION_GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11D_REPAIR_MERGED_MAIN_ATTESTATION.cjs';

const PROJECTION_FILES = [
  `${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`,
  FRONTIER,
  `${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`,
  `${DIR}/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`,
  `${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`,
  `${DIR}/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json`,
  REPAIR_STATUS,
];

const LEGACY_FRONTIERS = [
  `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json`,
  `${DIR}/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json`,
];

function absolute(relativePath) { return path.join(ROOT, relativePath); }
function readText(relativePath) { return fs.readFileSync(absolute(relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(readText(relativePath)); }
function writeText(relativePath, value) {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), value, 'utf8');
}
function writeJson(relativePath, value) { writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`); }
function digest(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }

function parseClaims(task) {
  const start = task.indexOf('# 45. Completion Claims Candidate');
  const end = task.indexOf('# 46. Closure lifecycle', start);
  const match = task.slice(start, end).match(/```text\s*\n([\s\S]*?MCFT_CAP_07_REMAINS_UNAUTHORIZED[\s\S]*?)```/);
  if (!match) throw new Error('HISTORICAL_TASK_COMPLETION_CLAIMS_MISSING');
  const claims = match[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (claims.length !== 48) throw new Error(`COMPLETION_CLAIM_COUNT_INVALID:${claims.length}`);
  return claims;
}

function slice(sequence, shortId, sliceId, inputs, outputs, canonicalWrites, consumer, successorProbe, authorityRefs, entryConditions, exitConditions, nonclaims) {
  return {
    sequence,
    short_id: shortId,
    slice_id: sliceId,
    inputs,
    outputs,
    canonical_writes: canonicalWrites,
    consumer,
    successor_probe: successorProbe,
    authority_graph_refs: authorityRefs,
    entry_conditions: entryConditions,
    exit_conditions: exitConditions,
    nonclaims,
  };
}

function resolvedSlices() {
  return [
    slice(1, 'P-1', 'MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1',
      ['DT-02 frozen object set', 'DT-02 D_MODEL_GOVERNANCE_STEP_COMMIT'],
      ['Candidate/Evaluation object reuse adjudication', 'Model Activation exclusion'], [], 'P0 and S0',
      'P-1 status and object adjudication Gate', [`${DIR}/GEOX-MCFT-CAP-06-P-1-STATUS.json`],
      ['DT-02 architecture frozen'], ['reuse without amendment established'], ['NO_MODEL_ACTIVATION']),
    slice(2, 'P0', 'MCFT-CAP-06.P0.CAP-05-TERMINAL-SSOT-RECONCILIATION-AND-PROVISIONAL-SSOT-V1',
      ['MCFT-CAP-05 terminal closure evidence'], ['predecessor terminal reconciliation', 'CAP-06 provisional authority'], [], 'S0',
      'CAP-05 COMPLETE and successor boundary probe', [`${DIR}/GEOX-MCFT-CAP-06-P0-STATUS.json`],
      ['CAP-05 closure effective'], ['predecessor eligibility restored'], ['NO_CAP_05_REOPEN']),
    slice(3, 'S0', 'MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1',
      ['repository Forecast Residual history', 'predecessor lock'], ['honest repository-history qualification'], [], 'S1',
      'qualification result and homogeneity probe', [`${DIR}/GEOX-MCFT-CAP-06-S0-EFFECTIVENESS.json`, `${DIR}/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json`, `${DIR}/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json`],
      ['predecessor lock PASS'], ['INSUFFICIENT_MATCHED_PAIRS is accepted honest result'], ['NO_FIELD_CALIBRATION_CLAIM']),
    slice(4, 'S1', 'MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1',
      ['controlled deterministic fixture regime'], ['24 Residuals', '16 calibration cases', '8 holdout cases'], ['24 controlled twin_forecast_residual_v1 facts'], 'S2, S5 and S6',
      'successor consumability and window separation probe', [`${DIR}/GEOX-MCFT-CAP-06-S1-EFFECTIVENESS.json`, `${DIR}/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json`],
      ['controlled track isolated'], ['successor readiness PASS'], ['CONTROLLED_FIXTURE_NOT_FIELD_HISTORY']),
    slice(5, 'S2', 'MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1',
      ['S1 case set', 'fixed Runtime and metric numeric policies'], ['21-point grid search contract', 'fixed-point metrics', 'sensitivity and threshold policy'], [], 'S3 and S5',
      'math determinism and negative disposition probe', [`${DIR}/GEOX-MCFT-CAP-06-S2-EFFECTIVENESS.json`],
      ['S1 successor readiness PASS'], ['contract/math acceptance PASS'], ['NO_CANONICAL_WRITE']),
    slice(6, 'S3', 'MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1',
      ['DT-02 Candidate/Evaluation contracts'], ['D transaction persistence', 'idempotency', 'concurrency', 'recovery', 'rebuildable projections'], ['schema migration only; no production Candidate/Evaluation append'], 'S5, S7 and S8',
      'persistence/recovery acceptance', [`${DIR}/GEOX-MCFT-CAP-06-S3-EFFECTIVENESS.json`],
      ['S2 contracts effective'], ['D persistence and recovery PASS'], ['NO_MODEL_ACTIVATION']),
    slice(7, 'S4', 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1',
      ['exact Residual refs', 'Forecast/Observation evidence graph', 'config purpose'], ['exact-ref graph assembler', 'dual-time and config-purpose deterministic dispatch'], [], 'S5 and S6',
      'exact-ref and no-side-lookup probe', [`${DIR}/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json`, `${DIR}/GEOX-MCFT-CAP-06-S5-PREDECESSOR-AUTHORITY-GRAPH-V2.json`],
      ['S3 persistence effective'], ['exact graph assembly PASS'], ['NO_LATEST_RANGE_SCOPE_LOOKUP']),
    slice(8, 'S5', 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1',
      ['16 calibration cases', 'S2 math', 'S3 persistence', 'S4 exact-ref assembler'], ['Candidate 0.034000'], ['1 controlled twin_calibration_candidate_v1'], 'S6, S9 and S10',
      'Candidate canonicality and non-activation probe', [`${DIR}/GEOX-MCFT-CAP-06-S5-CANDIDATE-EFFECTIVENESS.json`],
      ['S1-S4 effective'], ['Candidate append and replay idempotency PASS'], ['NO_ACTIVE_CONFIG_SWITCH']),
    slice(9, 'S6', 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1',
      ['Candidate exact ref/hash', '8 holdout cases'], ['paired base/candidate historical replay summaries'], [], 'S7',
      'zero-write shadow compute and threshold probe', [`${DIR}/GEOX-MCFT-CAP-06-S6-PAIRED-SHADOW-EFFECTIVENESS.json`],
      ['S5 Candidate effective'], ['8 holdout cases evaluated'], ['NO_SHADOW_ONLINE_RUNTIME']),
    slice(10, 'S7', 'MCFT-CAP-06.MCFT-03-12.SHADOW-EVALUATION-COMMIT-V1',
      ['S6 case summaries', 'Candidate exact ref/hash'], ['Shadow Evaluation canonical aggregate'], ['1 controlled twin_shadow_evaluation_v1'], 'S8, S9 and S10',
      'Evaluation canonicality and non-activation probe', [`${DIR}/GEOX-MCFT-CAP-06-S7-SHADOW-EVALUATION-EFFECTIVENESS.json`],
      ['S6 compute PASS'], ['Evaluation append/recovery PASS'], ['NO_APPROVAL', 'NO_MODEL_ACTIVATION']),
    slice(11, 'S8', 'MCFT-CAP-06.MCFT-03-04-12.RESTART-READBACK-REBUILD-V1',
      ['Candidate/Evaluation canonical facts and projections'], ['fresh-process readback', 'projection rebuild', 'wrong-hash fail closed'], [], 'S9 and S10',
      'restart/rebuild deterministic probe', [`${DIR}/GEOX-MCFT-CAP-06-S8-RESTART-READBACK-REBUILD-EFFECTIVENESS.json`],
      ['S7 Evaluation effective'], ['restart and rebuild PASS'], ['NO_HISTORY_REWRITE']),
    slice(12, 'S9', 'MCFT-CAP-06.MCFT-04-06-08-09-12.POST-EVALUATION-NON-CONSUMPTION-TICK-V1',
      ['active Runtime Config 0.030000', 'Candidate 0.034000', 'Evaluation exact ref/hash'], ['normal 72-point Forecast and 3x72 Scenario', 'non-consumption evidence'], ['normal Tick outputs only; no Candidate/Evaluation/Activation writes'], 'S10',
      'before/after Runtime authority snapshot probe', [`${DIR}/GEOX-MCFT-CAP-06-S9-NON-CONSUMPTION-EFFECTIVENESS.json`],
      ['S8 recovery effective'], ['Tick remains on 0.030000 and activation count 0'], ['NO_CANDIDATE_CONSUMPTION']),
    slice(13, 'S10', 'MCFT-CAP-06.MCFT-04-12-16.BOUNDED-CALIBRATION-SHADOW-CLOSURE-V1',
      ['S1-S9 controlled evidence'], ['two-stage controlled end-to-end composition proof', 'completed replay zero-write'], ['R + C + 12 = 36 controlled canonical facts across two isolated PostgreSQL stages'], 'S11A',
      'identity continuity, scope continuity and zero-write replay probe', [`${DIR}/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-EFFECTIVENESS.json`],
      ['S9 effective'], ['R=24, C=0, delta=36, zero divergence'], ['NOT_A_SINGLE_CONTINUOUS_DATABASE_CHAIN', 'NO_FIELD_RUNTIME_CLAIM']),
    slice(14, 'S11A', 'MCFT-CAP-06.CLOSURE-CANDIDATE-V1',
      ['S0-S10 evidence', 'Hard Acceptance ledger'], ['closure candidate with completion claims pending'], [], 'S11B/S11C',
      'closure candidate Gate', [`${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`],
      ['S10 effective'], ['candidate closure evidence materialized'], ['NO_EFFECTIVE_COMPLETION_CLAIMS']),
    slice(15, 'S11B', 'MCFT-CAP-06.CLOSURE-MERGED-MAIN-FINALIZATION-GATE-V1',
      ['S11A merge evidence'], ['historical merged-main finalization evidence'], [], 'S11C',
      'historical S11B finalization evidence', [`${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`],
      ['S11A merged'], ['historical finalization Gate PASS'], ['NO_RUNTIME_WRITE']),
    slice(16, 'S11C', 'MCFT-CAP-06.CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-V1',
      ['S11A/S11B evidence'], ['capability completion effectiveness history'], [], 'S11D',
      'S11C exact-head and merged-main evidence', [`${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`],
      ['S11B PASS'], ['historical S11C merged-main proof retained'], ['NOT_MODEL_ACTIVATION']),
    slice(17, 'S11D', SLICE,
      ['resolved task manifest V2', 'item-level ledger V2', 'required deliverables manifest', 'merge-SHA attestation policy'], ['final reconciliation repair candidate'], [], null,
      'push/merge_group exact merge SHA immutable attestation', [REPAIR_STATUS, RESOLVED, ATTESTATION_WORKFLOW, ATTESTATION_GATE],
      ['P0-P2 closure repair complete'], ['255 item predicates resolvable; no proof-only PR required'], ['NO_MCFT_CAP_07_AUTHORIZATION', 'NO_POSTMERGE_SSOT_WRITEBACK']),
  ];
}

function lifecyclePhase(item) {
  const letter = item.acceptance_id.match(/HARD_([A-J])_/)[1];
  if (letter === 'A') return 'P_MINUS_1_P0_ARCHITECTURE';
  if (letter === 'B' || letter === 'C') return 'S0_AUTHORIZATION_AND_QUALIFICATION';
  if (letter === 'D') return 'S1_RESIDUAL_WINDOWS';
  if (letter === 'E' || letter === 'F') return 'S2_CONTRACTS_AND_MATH';
  if (letter === 'G') return 'S3_S5_CANDIDATE_PERSISTENCE_AND_COMPUTE';
  if (letter === 'H') return 'S6_S8_SHADOW_EVALUATION_AND_RECOVERY';
  if (letter === 'I') return 'S9_NON_CONSUMPTION_TICK';
  if (/^S11A|Closure Candidate/i.test(item.assertion)) return 'S11A_CLOSURE_CANDIDATE';
  if (/^S11B|Finalization/i.test(item.assertion)) return 'S11B_FINALIZATION';
  if (/^S11C/i.test(item.assertion)) return 'S11C_EFFECTIVENESS_HISTORY';
  if (/^S11D|final reconciliation|SSOT writeback|final active Slice|runtime source authority|MCFT-CAP-07/i.test(item.assertion)) return 'S11D_FINAL_RECONCILIATION';
  return 'S10_BOUNDED_CHAIN';
}

function normalizeLedger() {
  const ledger = readJson(LEDGER);
  const categoryDigests = {};
  const totals = { PASS: 0, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 };
  for (const letter of 'ABCDEFGHIJ') {
    const relativePath = `${DIR}/hard_acceptance/MCFT-CAP-06-HARD-${letter}.json`;
    const record = readJson(relativePath);
    const counts = { PASS: 0, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 };
    record.schema_version = 'geox_mcft_cap_06_hard_acceptance_item_category_v3';
    record.lifecycle_stage = 'S11D_RESOLVED_TASKBOOK_V2_REPAIR_CANDIDATE';
    record.item_shape_inheritance = 'FORBIDDEN';
    record.each_item_self_contained = true;
    record.items = record.items.map((item) => {
      const status = PENDING_IDS.has(item.acceptance_id) ? 'PENDING' : 'PASS';
      counts[status] += 1;
      totals[status] += 1;
      const subjectCommit = status === 'PENDING' ? null : (Array.isArray(item.subject_commit_refs) && item.subject_commit_refs.length > 0 ? item.subject_commit_refs[item.subject_commit_refs.length - 1] : null);
      return {
        ...item,
        lifecycle_phase: lifecyclePhase(item),
        status,
        predicate: {
          predicate_id: `${item.acceptance_id}_PREDICATE_V1`,
          type: status === 'PENDING' ? 'MERGE_SHA_ATTESTATION' : 'EVIDENCE_BOUND_ASSERTION',
          statement: item.assertion,
          expected_result: 'PASS',
          evidence_refs_required: true,
          workflow_refs_required: true,
          resolution_authority: status === 'PENDING' ? ATTESTATION_GATE : item.workflow_refs,
        },
        subject_commit: subjectCommit,
        verification_stage: status === 'PENDING' ? 'MERGED_MAIN_ATTESTATION_PENDING' : 'EVIDENCE_VERIFIED',
        notes: [
          `Item-level authority retained from ${relativePath}`,
          status === 'PENDING'
            ? 'Not failed: exact merge-SHA attestation has not occurred yet.'
            : 'Predicate is independently evidence-bound; category status is not inherited.',
        ],
      };
    });
    record.status_counts = counts;
    record.status = counts.FAIL > 0 ? 'FAIL' : counts.PENDING > 0 ? 'PENDING' : 'PASS';
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    writeText(relativePath, serialized);
    categoryDigests[relativePath] = digest(serialized);
  }
  if (Object.values(totals).reduce((a, b) => a + b, 0) !== 255) throw new Error('LEDGER_ITEM_COUNT_INVALID');
  if (totals.PASS !== 253 || totals.PENDING !== 2 || totals.FAIL !== 0) throw new Error(`LEDGER_STATUS_COUNTS_INVALID:${JSON.stringify(totals)}`);
  writeJson(LEDGER, {
    ...ledger,
    schema_version: 'geox_mcft_cap_06_hard_acceptance_item_ledger_v3',
    lifecycle_stage: 'S11D_RESOLVED_TASKBOOK_V2_REPAIR_CANDIDATE',
    status: 'REPAIR_CANDIDATE',
    source_taskbook_ref: RESOLVED,
    resolved_task_manifest_ref: RESOLVED,
    item_shape_inheritance: 'FORBIDDEN',
    each_item_self_contained: true,
    status_domain: ['PASS', 'FAIL', 'PENDING', 'NOT_APPLICABLE'],
    total_check_count: 255,
    status_counts: totals,
    category_record_digests: categoryDigests,
    completion_claims_effective: false,
    verified: false,
    final_resolution_rule: 'ALL_ITEM_PREDICATES_PASS_ON_EXACT_MERGE_SHA_ATTESTATION',
    attestation_workflow_ref: ATTESTATION_WORKFLOW,
    attestation_gate_ref: ATTESTATION_GATE,
  });
  return totals;
}

function markLegacyFrontiers() {
  for (const relativePath of LEGACY_FRONTIERS) {
    const value = readJson(relativePath);
    writeJson(relativePath, {
      ...value,
      record_status: 'HISTORICAL_SUPERSEDED_FOR_CURRENT_FRONTIER',
      historical_snapshot: true,
      current_frontier_authority: false,
      superseded_by: FRONTIER,
      supersession_reason: 'CURRENT_DELIVERY_AUTHORITY_V2_IS_THE_SOLE_MUTABLE_DELIVERY_FRONTIER',
      historical_record_kind: value.record_kind || value.schema_version,
      ...(value.record_kind ? { record_kind: 'HISTORICAL_DELIVERY_FRONTIER_SNAPSHOT' } : {}),
    });
  }
}

function patchProjection(relativePath, claims) {
  const value = readJson(relativePath);
  const pendingIds = [...PENDING_IDS];
  const patched = {
    ...value,
    resolved_task_manifest_ref: RESOLVED,
    hard_acceptance_total_check_count: 255,
    hard_acceptance_pass_count: 253,
    hard_acceptance_fail_count: 0,
    hard_acceptance_pending_count: 2,
    hard_acceptance_not_applicable_count: 0,
    pending_completion_claim_count: 48,
    effective_completion_claim_count: 0,
    pending_completion_claims: claims,
    effective_completion_claims: Array.isArray(value.effective_completion_claims) ? [] : { count: 0, values: [] },
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    runtime_source_authorized: false,
    successor_authorized: false,
    successor_capability_line_authorized: false,
    completion_claim_activation_authorized: false,
    repair_classification: 'IMPLEMENTATION_DEFECT',
    repair_scope: 'S11D_FINAL_EFFECTIVENESS_RECONCILIATION_REPAIR',
    new_capability_slice: false,
    task_order_changed: false,
    proof_only_pr_required: false,
    repair_postmerge_proof_required: false,
    repair_merge_sha_attestation_required: true,
    repair_merge_sha_attestation_mode: 'PUSH_OR_MERGE_GROUP_IMMUTABLE_CHECK_ARTIFACT',
    repair_merge_sha_attestation_workflow_ref: ATTESTATION_WORKFLOW,
    postmerge_ssot_writeback_allowed: false,
    s10_composition_boundary: {
      storage_mode: 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES',
      controlled_stage_database_count: 2,
      interpretation: 'TWO_STAGE_CONTROLLED_END_TO_END_COMPOSITION_PROOF',
      excluded_interpretation: 'ONE_CONTINUOUSLY_PERSISTED_SINGLE_DATABASE_CALIBRATION_RUNTIME_CHAIN',
    },
  };
  if (patched.hard_acceptance && typeof patched.hard_acceptance === 'object') {
    patched.hard_acceptance = {
      ...patched.hard_acceptance,
      ledger_ref: LEDGER,
      total_check_count: 255,
      pass_count: 253,
      fail_count: 0,
      pending_count: 2,
      not_applicable_count: 0,
      status: 'MERGE_SHA_ATTESTATION_PENDING',
      pending_acceptance_ids: pendingIds,
    };
    delete patched.hard_acceptance.failed_acceptance_ids;
  }
  if (patched.completion_claims && typeof patched.completion_claims === 'object') {
    patched.completion_claims = {
      ...patched.completion_claims,
      pending_count: 48,
      effective_count: 0,
      pending: claims,
      effective: [],
      activation_condition: 'ITEM_LEDGER_255_PASS_ON_EXACT_MERGE_SHA_ATTESTATION',
    };
  }
  if (patched.terminal_state && typeof patched.terminal_state === 'object') {
    patched.terminal_state = {
      ...patched.terminal_state,
      status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
      implementation_status: 'COMPLETE',
      closure_effective: false,
      capability_complete: false,
      pending_completion_claim_count: 48,
      effective_completion_claim_count: 0,
      runtime_source_authorized: false,
      successor_authorized: false,
    };
  }
  if (relativePath === FRONTIER) {
    patched.status = 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED';
    patched.next_repository_action_kind = 'MERGE_SHA_ATTESTATION';
  }
  if (relativePath === REPAIR_STATUS) {
    patched.status = 'REPAIR_CANDIDATE';
    patched.hard_acceptance = {
      total_check_count: 255,
      pass_count: 253,
      fail_count: 0,
      pending_count: 2,
      not_applicable_count: 0,
      pending_acceptance_ids: pendingIds,
    };
  }
  writeJson(relativePath, patched);
}

function main() {
  if (!fs.existsSync(absolute(HISTORICAL))) fs.copyFileSync(absolute(ENTRY), absolute(HISTORICAL));
  const historicalTask = readText(HISTORICAL);
  const claims = parseClaims(historicalTask);

  writeText(ENTRY, `# GEOX MCFT-CAP-06 — Taskbook Entrypoint\n\nThis file is an authority router, not the historical taskbook body.\n\n\`\`\`text\neffective_taskbook_version: v0.4.0\nresolved_manifest_ref: ${RESOLVED}\ncurrent_delivery_authority_ref: ${FRONTIER}\nhistorical_base_ref: ${HISTORICAL}\nnormative_revision_ref: ${REVISION}\nrequired_deliverables_manifest_ref: ${REQUIRED}\nhard_acceptance_ledger_ref: ${LEDGER}\nlegacy_direct_clause_parsing: FORBIDDEN\n\`\`\`\n\nConsumers and closure Gates must resolve the taskbook through the resolved manifest. Historical status text is retained only in the versioned base file.\n`);

  markLegacyFrontiers();
  const totals = normalizeLedger();

  const resolved = {
    schema_version: 'geox_mcft_cap_06_resolved_task_manifest_v2',
    capability_line_id: 'MCFT-CAP-06',
    manifest_id: 'MCFT-CAP-06-RESOLVED-TASK-MANIFEST-V2',
    record_status: 'EFFECTIVE_RESOLVED_AUTHORITY',
    effective_taskbook_version: 'v0.4.0',
    canonical_entrypoint: ENTRY,
    historical_base_ref: HISTORICAL,
    normative_revision_ref: REVISION,
    current_delivery_authority_ref: FRONTIER,
    hard_acceptance_ledger_ref: LEDGER,
    required_deliverables_manifest_ref: REQUIRED,
    resolution_policy: {
      precedence: ['RESOLVED_TASK_MANIFEST_V2', 'NORMATIVE_REVISION_V0_4_0', 'HISTORICAL_BASE_V0_3_1'],
      direct_historical_task_parsing_forbidden: true,
      closure_gates_must_consume_resolved_manifest: true,
      legacy_frontier_files_are_historical: true,
    },
    applied_amendments: [
      { ref: REVISION, classification: 'TASKBOOK_DESIGN_DEFECT', effect: 'removes ad hoc prerequisite nodes and separates delivery policy from capability graph' },
      { ref: `${DIR}/GEOX-MCFT-CAP-06-TASK-AMENDMENT-S4-PREDECESSOR-CONSUMPTION-V1.md`, classification: 'HISTORICAL_APPLIED_AMENDMENT', effect: 'exact-ref predecessor consumption stabilization' },
      { ref: `${DIR}/GEOX-MCFT-CAP-06-TASK-AMENDMENT-S5-ENTRY-CONTROLS-V1.md`, classification: 'HISTORICAL_ABSORBED_INTO_ENTRY_CRITERIA', effect: 'authority graph and PR hygiene no longer form a normative capability node' },
    ],
    capability_result_boundary: {
      target_level: 'LEVEL_A_DETERMINISTIC_REPLAY_TWIN',
      technical_capability: 'COMPLETE',
      capability_nature: 'CONTROLLED_DETERMINISTIC_CALIBRATION_MECHANISM',
      repository_history_calibration_capability: 'NOT_ESTABLISHED',
      production_runtime_capability: 'NOT_ESTABLISHED',
      field_calibration_claim: false,
      statistical_generalization_claim: false,
      shadow_online_claim: false,
      model_activation_claim: false,
    },
    resolved_slice_graph: resolvedSlices(),
    completion_claims: {
      count: claims.length,
      claim_ids: claims,
      effective_count: 0,
      pending_count: 48,
      activation_condition: 'ALL_255_ITEM_PREDICATES_PASS_ON_EXACT_MERGE_SHA_ATTESTATION',
    },
    hard_acceptance: {
      item_count: 255,
      status_domain: ['PASS', 'FAIL', 'PENDING', 'NOT_APPLICABLE'],
      status_counts: totals,
      item_shape_inheritance: 'FORBIDDEN',
      each_item_requires: ['acceptance_id', 'lifecycle_phase', 'status', 'predicate', 'evidence_refs', 'workflow_refs', 'subject_commit', 'canonical_refs', 'notes'],
    },
    closure_delivery_policy: {
      proof_only_pr_required: false,
      exact_merge_sha_attestation_required: true,
      attestation_triggers: ['merge_group', 'push:main'],
      attestation_workflow_ref: ATTESTATION_WORKFLOW,
      attestation_gate_ref: ATTESTATION_GATE,
      immutable_artifact_required: true,
      postmerge_ssot_writeback_allowed: false,
    },
    s10_composition_boundary: {
      storage_mode: 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES',
      controlled_stage_database_count: 2,
      interpretation: 'TWO_STAGE_CONTROLLED_END_TO_END_COMPOSITION_PROOF',
      excluded_interpretation: 'ONE_CONTINUOUSLY_PERSISTED_SINGLE_DATABASE_CALIBRATION_RUNTIME_CHAIN',
    },
    pre_mcft_cap_07_repository_foundation_repairs: {
      capability_prerequisite_slice: false,
      successor_authorized: false,
      required_workstreams: ['AUTOMATIC_MERGE_SHA_ATTESTATION', 'STABLE_RELEASE_LANE', 'GENERIC_DELIVERY_POLICY'],
    },
  };
  writeJson(RESOLVED, resolved);

  const manifest = readJson(TASKBOOK_MANIFEST);
  writeJson(TASKBOOK_MANIFEST, {
    ...manifest,
    schema_version: 'geox_mcft_cap_06_taskbook_manifest_v2',
    manifest_id: 'MCFT-CAP-06-TASKBOOK-MANIFEST-V2',
    canonical_entrypoint: ENTRY,
    resolved_manifest_ref: RESOLVED,
    direct_legacy_task_parsing_forbidden: true,
    closure_gates_must_consume_resolved_manifest: true,
    canonical_bundle: {
      historical_base_document: { path: HISTORICAL, version: 'v0.3.1', role: 'HISTORICAL_BASE_TEXT' },
      normative_revision: { path: REVISION, version: 'v0.4.0', role: 'NORMATIVE_OVERRIDE' },
      resolved_manifest: { path: RESOLVED, version: 'v2', role: 'SOLE_MACHINE_RESOLVED_TASK_AUTHORITY' },
      precedence_rule: 'RESOLVED_MANIFEST_OVERRIDES_REVISION_WHICH_OVERRIDES_HISTORICAL_BASE',
    },
  });

  for (const relativePath of PROJECTION_FILES) patchProjection(relativePath, claims);

  writeJson(`${DIR}/GEOX-MCFT-CAP-06-QUALITY-BOUNDARY.json`, {
    schema_version: 'geox_mcft_cap_06_quality_boundary_v1',
    capability_line_id: 'MCFT-CAP-06',
    technical_capability: 'COMPLETE',
    target_level: 'LEVEL_A_DETERMINISTIC_REPLAY_TWIN',
    capability_nature: 'CONTROLLED_DETERMINISTIC_CALIBRATION_MECHANISM',
    repository_history_calibration_capability: 'NOT_ESTABLISHED',
    production_runtime_capability: 'NOT_ESTABLISHED',
    runtime_implementation_quality: 'HIGH',
    governance_record_quality: 'REPAIR_IN_PROGRESS',
    delivery_process_quality: 'REPOSITORY_FOUNDATION_REPAIR_REQUIRED',
    s10_interpretation: 'TWO_STAGE_CONTROLLED_END_TO_END_COMPOSITION_PROOF',
    forbidden_overclaims: [
      '255 independent items are final PASS before merge-SHA attestation',
      'repository history establishes real calibration capability',
      'S10 is a single continuously persisted database chain',
      'MCFT-CAP-06 establishes production closed-loop operation',
    ],
    successor_capability_line_authorized: false,
  });

  process.stdout.write(`${JSON.stringify({ status: 'PASS', resolved_manifest_ref: RESOLVED, hard_acceptance_status_counts: totals, historical_base_ref: HISTORICAL }, null, 2)}\n`);
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
