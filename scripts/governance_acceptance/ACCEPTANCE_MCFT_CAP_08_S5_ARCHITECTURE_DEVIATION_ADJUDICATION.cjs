#!/usr/bin/env node
// Purpose: validate the non-candidate MCFT-CAP-08.S5 Architecture Deviation adjudication package.
// Boundary: repository governance only; no Runtime, database, canonical write, Candidate, Shadow, activation, or effectiveness mutation.

const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const BASE = '6838bf07a96022640bea6ddb20e461f748a5114c';
const EXPECTED = [
  '.github/workflows/mcft-cap-08-current-frontier-reconciliation.yml',
  '.github/workflows/mcft-cap-08-s5-architecture-deviation-adjudication.yml',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json',
  'docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-ADJUDICATION-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-PREQUALIFICATION-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-WORKFLOW-DECLARATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_ARCHITECTURE_DEVIATION_ADJUDICATION.cjs',
].sort();

const fail = (code) => { throw new Error(code); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const digest = (value) => {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(copy))).digest('hex')}`;
};
const exact = (actual, expected, code) => { if (actual !== expected) fail(`${code}:${String(actual)}`); };
const yes = (value, code) => { if (value !== true) fail(code); };
const no = (value, code) => { if (value !== false) fail(code); };

const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`], { encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean).sort();
if (JSON.stringify(changed) !== JSON.stringify(EXPECTED)) {
  fail(`CAP08_S5_ADJUDICATION_BOUNDARY_MISMATCH:${JSON.stringify(changed)}`);
}
if (changed.some((file) => file.startsWith('apps/') || file.startsWith('db/') || file.includes('migration'))) {
  fail('CAP08_S5_ADJUDICATION_RUNTIME_OR_DATABASE_SOURCE_FORBIDDEN');
}
if (changed.some((file) => file.includes('CANDIDATE-DECLARATION'))) {
  fail('CAP08_S5_ADJUDICATION_CANDIDATE_DECLARATION_FORBIDDEN');
}
for (const file of [
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  'docs/governance/DELIVERY-CANDIDATE-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
]) {
  const delta = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`, '--', file], { encoding: 'utf8' }).trim();
  if (delta) fail(`CAP08_S5_ADJUDICATION_FROZEN_AUTHORITY_CHANGED:${file}`);
}

const adjudication = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-ADJUDICATION-V1.json');
exact(adjudication.semantic_digest, digest(adjudication), 'CAP08_S5_ADJUDICATION_DIGEST_MISMATCH');
exact(adjudication.confirmed_findings.v1_selected_parameter_value, '0.040000', 'CAP08_S5_ADJUDICATION_V1_RESULT');
exact(adjudication.outcome_preserving_v2_diagnostic.eligibility_aware_attempt.selected_parameter_value, '0.034000', 'CAP08_S5_ADJUDICATION_V2_ORACLE');
yes(adjudication.outcome_preserving_v2_diagnostic.eligibility_aware_attempt.canonical_append_allowed, 'CAP08_S5_ADJUDICATION_APPEND_PROOF_REQUIRED');
no(adjudication.adjudication.s5_direct_implementation_authorized, 'CAP08_S5_ADJUDICATION_DIRECT_IMPLEMENTATION_FORBIDDEN');
no(adjudication.adjudication.s5_formal_candidate_authorized, 'CAP08_S5_ADJUDICATION_FORMAL_CANDIDATE_FORBIDDEN');
yes(adjudication.adjudication.replay_dataset_v2_prequalification_authorized, 'CAP08_S5_ADJUDICATION_PREQUALIFICATION_REQUIRED');
no(adjudication.adjudication.s6_implementation_authorized, 'CAP08_S5_ADJUDICATION_S6_FORBIDDEN');

const contract = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-PREQUALIFICATION-CONTRACT-V1.json');
exact(contract.semantic_digest, digest(contract), 'CAP08_S5_PREQUALIFICATION_CONTRACT_DIGEST_MISMATCH');
exact(contract.dataset.calibration_window_count, 16, 'CAP08_S5_PREQUALIFICATION_CALIBRATION_COUNT');
exact(contract.dataset.holdout_window_count, 8, 'CAP08_S5_PREQUALIFICATION_HOLDOUT_COUNT');
exact(contract.objective_eligibility.objective_case_count, 15, 'CAP08_S5_PREQUALIFICATION_OBJECTIVE_COUNT');
exact(contract.objective_eligibility.diagnostic_only_case_count, 1, 'CAP08_S5_PREQUALIFICATION_DIAGNOSTIC_COUNT');
exact(JSON.stringify(contract.objective_eligibility.objective_ineligible_observation_refs), JSON.stringify(['FVO-10']), 'CAP08_S5_PREQUALIFICATION_FVO10_POLICY');
yes(contract.required_requalification.candidate_append_forbidden, 'CAP08_S5_PREQUALIFICATION_CANDIDATE_WRITE_FORBIDDEN');
yes(contract.required_requalification.shadow_append_forbidden, 'CAP08_S5_PREQUALIFICATION_SHADOW_WRITE_FORBIDDEN');

const status = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-STATUS-V1.json');
exact(status.semantic_digest, digest(status), 'CAP08_S5_ADJUDICATION_STATUS_DIGEST_MISMATCH');
yes(status.replay_dataset_v2_prequalification_authorized, 'CAP08_S5_ADJUDICATION_STATUS_PREQUALIFICATION');
no(status.s5_formal_candidate_authorized, 'CAP08_S5_ADJUDICATION_STATUS_CANDIDATE_FORBIDDEN');
no(status.s6_implementation_authorized, 'CAP08_S5_ADJUDICATION_STATUS_S6_FORBIDDEN');

const declaration = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-WORKFLOW-DECLARATION-V1.json');
exact(declaration.semantic_digest, digest(declaration), 'CAP08_S5_PREQUALIFICATION_WORKFLOW_DIGEST_MISMATCH');
no(declaration.candidate_transition, 'CAP08_S5_PREQUALIFICATION_CANDIDATE_TRANSITION_FORBIDDEN');
yes(declaration.candidate_declaration_forbidden, 'CAP08_S5_PREQUALIFICATION_DECLARATION_MUST_BE_FORBIDDEN');
no(declaration.candidate_or_shadow_persistence_authorized, 'CAP08_S5_PREQUALIFICATION_PERSISTENCE_FORBIDDEN');

const frontier = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json');
exact(frontier.current_effective_slice_id, 'MCFT-CAP-08.S4', 'CAP08_S5_FRONTIER_EFFECTIVE_SLICE');
exact(frontier.next_authorized_slice_id, null, 'CAP08_S5_FRONTIER_NEXT_SLICE_MUST_BE_NULL');
no(frontier.s5_implementation_authorized, 'CAP08_S5_FRONTIER_DIRECT_IMPLEMENTATION_FORBIDDEN');
yes(frontier.replay_dataset_v2_prequalification_authorized, 'CAP08_S5_FRONTIER_PREQUALIFICATION_REQUIRED');
no(frontier.s6_implementation_authorized, 'CAP08_S5_FRONTIER_S6_FORBIDDEN');

const ssot = readJson('docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json');
exact(ssot.current_frontier.first_legal_next_action, 'MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION', 'CAP08_S5_SSOT_NEXT_ACTION');
no(ssot.current_frontier.s5_formal_candidate_authorized, 'CAP08_S5_SSOT_CANDIDATE_FORBIDDEN');
no(ssot.current_frontier.s6_implementation_authorized, 'CAP08_S5_SSOT_S6_FORBIDDEN');

const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json');
yes(matrix.cap_08_status.replay_dataset_v2_prequalification_authorized, 'CAP08_S5_MATRIX_PREQUALIFICATION_REQUIRED');
no(matrix.cap_08_status.s5_formal_candidate_authorized, 'CAP08_S5_MATRIX_CANDIDATE_FORBIDDEN');

const map = fs.readFileSync('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md', 'utf8');
for (const token of ['MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION','selected parameter           = 0.034000','FVO-10 objective_eligible = false','S5 formal Candidate implemented and exact-SHA effective']) {
  if (!map.includes(token)) fail(`CAP08_S5_IMPLEMENTATION_MAP_TOKEN_MISSING:${token}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  base: BASE,
  changed_files: changed,
  current_effective_slice: frontier.current_effective_slice_id,
  blocked_slice: frontier.blocked_slice_id,
  first_legal_next_action: frontier.first_legal_next_action,
  s5_formal_candidate_authorized: frontier.s5_formal_candidate_authorized,
  prequalification_authorized: frontier.replay_dataset_v2_prequalification_authorized,
  s6_authorized: frontier.s6_implementation_authorized,
}, null, 2));
