'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const baselineMainCommit = 'eca0d053045db59982ad20a6e0421f72ae16f804';
const matrixPath = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const mapPath = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const taskPath = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md';
const statusPath = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json';
const cap03DeliveryPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const cap03MainPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const cap03FinalPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';

const absolute = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(absolute(relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));
const write = (relativePath, content) =>
  fs.writeFileSync(absolute(relativePath), content.endsWith('\n') ? content : `${content}\n`, 'utf8');

const matrix = readJson(matrixPath);
const delivery = readJson(cap03DeliveryPath);
const mainVerification = readJson(cap03MainPath);
const finalVerification = readJson(cap03FinalPath);

if (mainVerification.status !== 'VERIFIED_ON_MAIN' ||
    mainVerification.verified_on_main !== true ||
    mainVerification.closure_effective !== true ||
    mainVerification.capability_complete !== true) {
  throw new Error('CAP_03_MAIN_VERIFICATION_NOT_EFFECTIVE');
}
if (finalVerification.status !== 'VERIFIED_ON_MAIN' ||
    finalVerification.effectiveness_condition_satisfied !== true ||
    finalVerification.task_conformance?.remaining_nonconformant_count !== 0 ||
    finalVerification.task_conformance?.remaining_unadjudicated_contract_deviation_count !== 0) {
  throw new Error('CAP_03_R4_FINAL_VERIFICATION_NOT_EFFECTIVE');
}
if (delivery.status !== 'CAPABILITY_COMPLETE' ||
    delivery.active_delivery_slice_id !== null ||
    delivery.implementation_status !== 'R4_REMEDIATION_MERGED_EFFECTIVE') {
  throw new Error('CAP_03_DELIVERY_SSOT_NOT_TERMINAL');
}

matrix.schema_version = 'geox_mcft_vertical_capability_line_matrix_v6';
matrix.amendment_id = 'MCFT-VERTICAL-AMENDMENT-03';
matrix.status = 'COMPLETE_WITH_CAP_04_P0_CANDIDATE';
matrix.baseline = { branch: 'main', commit: baselineMainCommit };

const cap03 = matrix.capability_lines.find((entry) => entry.capability_line_id === 'MCFT-CAP-03');
if (!cap03) throw new Error('CAP_03_MATRIX_ENTRY_MISSING');
Object.assign(cap03, {
  status: 'COMPLETE',
  authorization_status: 'EFFECTIVE',
  authorization_effective: true,
  runtime_source_authorized: true,
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'VERIFIED_ON_MAIN',
  active_delivery_slice_id: null,
  closure_effective: true,
  capability_complete: true,
  pending_completion_claims: [],
  completion_claims: [...mainVerification.effective_completion_claims],
  preserved_nonclaims: [...mainVerification.preserved_nonclaims],
  latest_verified_main_commit: finalVerification.verified_main_commit,
  repository_reconciliation_main_commit: baselineMainCommit,
  main_verification_ref: cap03MainPath,
  r4_final_verification_ref: cap03FinalPath,
  post_completion_remediation_verification: {
    ...mainVerification.post_completion_remediation_verification,
  },
  successor_capability_line_id: 'MCFT-CAP-04',
  successor_authorized: false,
  next_authorized_slice_ids: [],
  effectiveness_condition: 'CAP_03_R4_FINAL_VERIFICATION_EFFECTIVE_ON_MAIN',
  finalization: {
    status: 'VERIFIED_ON_MAIN',
    closure_effective: true,
    capability_complete: true,
    completion_claims_status: 'EFFECTIVE',
    verified_main_commit: finalVerification.verified_main_commit,
    effectiveness_condition_satisfied: true,
    finalization_effectiveness: {
      ...mainVerification.finalization_effectiveness,
    },
  },
});
delete cap03.next_authorized_slice_id_after_merge_and_postmerge_gate;

const authoritativeSlices = new Map(delivery.slices.map((slice) => [slice.delivery_slice_id, slice]));
for (const slice of cap03.delivery_slices) {
  const authoritative = authoritativeSlices.get(slice.delivery_slice_id);
  if (!authoritative) throw new Error(`CAP_03_MATRIX_SLICE_HAS_NO_DELIVERY_SSOT:${slice.delivery_slice_id}`);
  for (const key of [
    'status', 'baseline_main_commit', 'branch', 'merge_commit', 'merged_main_gate',
    'effectiveness_condition_satisfied', 'activation_fields_status', 'allowed_claims',
    'preserved_nonclaims', 'exact_changed_file_boundary', 'effectiveness_condition',
  ]) {
    if (Object.prototype.hasOwnProperty.call(authoritative, key)) slice[key] = authoritative[key];
    else delete slice[key];
  }
}

const p0 = 'MCFT-CAP-04.P0.PREDECESSOR-SSOT-AND-TASK-FREEZE-V1';
const lifecycle = [
  [p0, 'READY_FOR_MERGE', 'MCFT-00', []],
  ['MCFT-CAP-04.S0.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1', 'BLOCKED', 'MCFT-09', [p0]],
  ['MCFT-CAP-04.S1.CONTRACTS-CONFIG-AND-PROVENANCE-V1', 'BLOCKED', 'MCFT-02', ['MCFT-CAP-04.S0.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1']],
  ['MCFT-CAP-04.S2.FUTURE-FORCING-EVIDENCE-WINDOW-V1', 'BLOCKED', 'MCFT-05', ['MCFT-CAP-04.S1.CONTRACTS-CONFIG-AND-PROVENANCE-V1']],
  ['MCFT-CAP-04.S3.SUCCESSFUL-FORECAST-MATH-AND-RECORD-SET-V1', 'BLOCKED', 'MCFT-09', ['MCFT-CAP-04.S2.FUTURE-FORCING-EVIDENCE-WINDOW-V1']],
  ['MCFT-CAP-04.S4.FORECAST-PERSISTENCE-AND-PROJECTIONS-V1', 'BLOCKED', 'MCFT-03', ['MCFT-CAP-04.S3.SUCCESSFUL-FORECAST-MATH-AND-RECORD-SET-V1']],
  ['MCFT-CAP-04.S5.TICK-INTEGRATION-AND-HEALTH-RECOVERY-V1', 'BLOCKED', 'MCFT-04', ['MCFT-CAP-04.S4.FORECAST-PERSISTENCE-AND-PROJECTIONS-V1']],
  ['MCFT-CAP-04.S6.SCENARIO-CONTRACTS-AND-TRAJECTORY-V1', 'BLOCKED', 'MCFT-10', ['MCFT-CAP-04.S5.TICK-INTEGRATION-AND-HEALTH-RECOVERY-V1']],
  ['MCFT-CAP-04.S7.SCENARIO-PERSISTENCE-AND-PROJECTIONS-V1', 'BLOCKED', 'MCFT-03', ['MCFT-CAP-04.S6.SCENARIO-CONTRACTS-AND-TRAJECTORY-V1']],
  ['MCFT-CAP-04.S8.RESTART-BACKFILL-AND-FAILURE-RECOVERY-V1', 'BLOCKED', 'MCFT-04', ['MCFT-CAP-04.S7.SCENARIO-PERSISTENCE-AND-PROJECTIONS-V1']],
  ['MCFT-CAP-04.S9.CLOSURE-V1', 'BLOCKED', 'MCFT-09', ['MCFT-CAP-04.S8.RESTART-BACKFILL-AND-FAILURE-RECOVERY-V1']],
  ['MCFT-CAP-04.S10A.FINALIZATION-CANDIDATE-V1', 'BLOCKED', 'MCFT-09', ['MCFT-CAP-04.S9.CLOSURE-V1']],
  ['MCFT-CAP-04.S10B.EXACT-HEAD-FINAL-VERIFICATION-V1', 'BLOCKED', 'MCFT-09', ['MCFT-CAP-04.S10A.FINALIZATION-CANDIDATE-V1']],
  ['MCFT-CAP-04.S10C.POSTMERGE-EFFECTIVENESS-V1', 'BLOCKED', 'MCFT-09', ['MCFT-CAP-04.S10B.EXACT-HEAD-FINAL-VERIFICATION-V1']],
];

const cap04 = {
  capability_line_id: 'MCFT-CAP-04',
  display_alias: 'MCFT-4',
  name: 'Successful Forecast and Scenario Runtime',
  runtime_mode: 'REPLAY',
  target_completion_level: 'Level A',
  status: 'NOT_AUTHORIZED',
  design_status: 'FINAL_FROZEN_CANDIDATE_V0_5',
  implementation_status: 'NOT_AUTHORIZED',
  authorization_id: null,
  authorization_status: 'NOT_AUTHORIZED',
  authorization_effective: false,
  runtime_source_authorized: false,
  predecessor_capability_line_id: 'MCFT-CAP-03',
  predecessor_main_verification_ref: cap03MainPath,
  predecessor_r4_final_verification_ref: cap03FinalPath,
  predecessor_verified_main_commit: finalVerification.verified_main_commit,
  predecessor_repository_main_commit: baselineMainCommit,
  active_delivery_slice_id: p0,
  planned_owner_work_package_ids: ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-06', 'MCFT-08', 'MCFT-09', 'MCFT-10'],
  excluded_owner_work_package_ids: ['MCFT-01', 'MCFT-07', 'MCFT-11', 'MCFT-12', 'MCFT-13', 'MCFT-14', 'MCFT-15', 'MCFT-16', 'MCFT-17', 'MCFT-18'],
  delivery_slices: lifecycle.map(([delivery_slice_id, status, primary_owner_work_package_id, depends_on_delivery_slice_ids]) => ({
    delivery_slice_id,
    status,
    primary_owner_work_package_id,
    depends_on_delivery_slice_ids,
    runtime_source_authorized: false,
    effectiveness_condition: delivery_slice_id === p0
      ? 'P0_PR_MERGED_TO_MAIN_AND_EXACT_HEAD_CI_PASS_AND_MERGE_TREE_EQUIVALENCE_PASS_AND_POSTMERGE_P0_ACCEPTANCE_PASS_AND_EFFECTIVENESS_RECONCILED'
      : 'PREDECESSOR_SLICE_MERGED_AND_MERGED_MAIN_GATE_PASS_AND_EXPLICIT_SLICE_ACTIVATION',
  })),
  pending_completion_claims: [],
  effective_completion_claims: [],
  preserved_nonclaims: [
    'NO_MCFT_CAP_04_AUTHORIZATION', 'NO_MCFT_CAP_04_RUNTIME_SOURCE',
    'NO_SUCCESSFUL_FORECAST', 'NO_72_HOUR_FORECAST', 'NO_FUTURE_FORCING_WINDOW',
    'NO_SCENARIO', 'NO_FORECAST_RESIDUAL', 'NO_CALIBRATION_CANDIDATE',
    'NO_SHADOW_EVALUATION', 'NO_MODEL_ACTIVATION', 'NO_RECOMMENDATION',
    'NO_POLICY_EVALUATION', 'NO_DECISION', 'NO_AO_ACT', 'NO_CONTINUOUS_RUNTIME',
    'NO_CONTINUOUS_SCHEDULER', 'NO_LIVE_FIELD_CLAIM', 'NO_MCFT_GATE_A_CLOSURE',
    'NO_MCFT_GATE_B_CLOSURE', 'NO_MCFT_GATE_C_CLOSURE', 'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
  ],
  next_authorized_slice_ids: [],
  next_eligible_slice_id_after_p0_effectiveness: 'MCFT-CAP-04.S0.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1',
  task_ref: taskPath,
  p0_status_ref: statusPath,
  effectiveness_condition: 'P0_POSTMERGE_EFFECTIVENESS_REQUIRED_BEFORE_S0_ACTIVATION',
  effectiveness_condition_satisfied: false,
  successor_capability_line_id: null,
  successor_authorized: false,
};

const cap04Index = matrix.capability_lines.findIndex((entry) => entry.capability_line_id === 'MCFT-CAP-04');
if (cap04Index === -1) matrix.capability_lines.push(cap04);
else matrix.capability_lines[cap04Index] = cap04;
write(matrixPath, JSON.stringify(matrix, null, 2));

const markerStart = '<!-- MCFT-CAP-04-P0-AUTHORITY-START -->';
const markerEnd = '<!-- MCFT-CAP-04-P0-AUTHORITY-END -->';
let implementationMap = read(mapPath);
const startIndex = implementationMap.indexOf(markerStart);
const endIndex = implementationMap.indexOf(markerEnd);
if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
  implementationMap =
    implementationMap.slice(0, startIndex) +
    implementationMap.slice(endIndex + markerEnd.length);
}
implementationMap = implementationMap.trimEnd();
const mapSection = Buffer.from('PCEtLSBNQ0ZULUNBUC0wNC1QMC1BVVRIT1JJVFktU1RBUlQgLS0+CiMjIDE1LiBNQ0ZULUNBUC0wMyBhdXRob3JpdGF0aXZlIHJlY29uY2lsaWF0aW9uIGFuZCBNQ0ZULUNBUC0wNCBQMAoKYGBgdGV4dApyZXBvc2l0b3J5IGJhc2VsaW5lOgplY2EwZDA1MzA0NWRiNTk5ODJhZDIwYTZlMDQyMWY3MmFlMTZmODA0CgpNQ0ZULUNBUC0wMzoKc3RhdHVzOiBDT01QTEVURQppbXBsZW1lbnRhdGlvbl9zdGF0dXM6IFZFUklGSUVEX09OX01BSU4KY2xvc3VyZV9lZmZlY3RpdmU6IHRydWUKY2FwYWJpbGl0eV9jb21wbGV0ZTogdHJ1ZQphY3RpdmVfZGVsaXZlcnlfc2xpY2VfaWQ6IG51bGwKUjQtQTogTUVSR0VEX0VGRkVDVElWRQpSNC1COiBNRVJHRURfRUZGRUNUSVZFClI0LUM6IE1FUkdFRF9FRkZFQ1RJVkUKcmVtYWluaW5nIGF1ZGl0ZWQgaGFyZC1hY2NlcHRhbmNlIGZhaWx1cmVzOiAwCnJlbWFpbmluZyB1bmFkanVkaWNhdGVkIGNvbnRyYWN0IGRldmlhdGlvbnM6IDAKc3VjY2Vzc29yOiBNQ0ZULUNBUC0wNApzdWNjZXNzb3JfYXV0aG9yaXplZDogZmFsc2UKYGBgCgpUaGUgZ2xvYmFsIGNhcGFiaWxpdHkgbWF0cml4IGlzIHJlY29uY2lsZWQgdG8gdGhlIGVmZmVjdGl2ZSBDQVAtMDMgZGVsaXZlcnkgYW5kIHZlcmlmaWNhdGlvbiByZWNvcmRzLiBIaXN0b3JpY2FsIGNhbmRpZGF0ZSBzZWN0aW9ucyBhYm92ZSByZW1haW4gaGlzdG9yaWNhbCBldmlkZW5jZSBhbmQgYXJlIG5vdCBjdXJyZW50IGF1dGhvcml0eS4KCk1DRlQtQ0FQLTA0IFAwIGZyZWV6ZXMgdGhlIHRhc2sgYW5kIGRlbGl2ZXJ5IGdyYXBoIG9ubHk6CgpgYGB0ZXh0CmRlc2lnbl9zdGF0dXM6IEZJTkFMX0ZST1pFTl9DQU5ESURBVEVfVjBfNQppbXBsZW1lbnRhdGlvbl9zdGF0dXM6IE5PVF9BVVRIT1JJWkVECnJ1bnRpbWVfc291cmNlX2F1dGhvcml6ZWQ6IGZhbHNlCmFjdGl2ZV9kZWxpdmVyeV9zbGljZV9pZDogTUNGVC1DQVAtMDQuUDAuUFJFREVDRVNTT1ItU1NPVC1BTkQtVEFTSy1GUkVFWkUtVjEKYGBgCgp8IHBoYXNlIHwgYm91bmRlZCByZXN1bHQgfCBQMCBzdGF0ZSB8CnwtLS18LS0tfC0tLXwKfCBQMCB8IHByZWRlY2Vzc29yIFNTT1QgcmVjb25jaWxpYXRpb24gYW5kIHRhc2sgZnJlZXplIHwgUkVBRFlfRk9SX01FUkdFIHwKfCBTMCB8IGF1dGhvcml6YXRpb24gYW5kIHByZWRlY2Vzc29yIGlkZW50aXR5IGxvY2sgfCBCTE9DS0VEIHwKfCBTMSB8IGNvbnRyYWN0cywgUnVudGltZSBDb25maWcgcGlucywgcHJvdmVuYW5jZSB8IEJMT0NLRUQgfAp8IFMyIHwgRnV0dXJlIEZvcmNpbmcgRXZpZGVuY2UgV2luZG93IHwgQkxPQ0tFRCB8CnwgUzMgfCBzdWNjZXNzZnVsIDcyLWhvdXIgRm9yZWNhc3QgbWF0aCBhbmQgcmVjb3JkIHNldCB8IEJMT0NLRUQgfAp8IFM0IHwgRm9yZWNhc3QgcGVyc2lzdGVuY2UgYW5kIGNhbm9uaWNhbCBwcm9qZWN0aW9ucyB8IEJMT0NLRUQgfAp8IFM1IHwgVGljayBpbnRlZ3JhdGlvbiBhbmQgcmV2ZXJzZSBIZWFsdGggcmVjb3ZlcnkgfCBCTE9DS0VEIHwKfCBTNiB8IFNjZW5hcmlvIGNvbnRyYWN0cyBhbmQgZGV0ZXJtaW5pc3RpYyB0cmFqZWN0b3JpZXMgfCBCTE9DS0VEIHwKfCBTNyB8IFNjZW5hcmlvIHBlcnNpc3RlbmNlIGFuZCBjYW5vbmljYWwgcHJvamVjdGlvbnMgfCBCTE9DS0VEIHwKfCBTOCB8IHJlc3RhcnQsIGJvdW5kZWQgYmFja2ZpbGwsIGFuZCBmYWlsdXJlIHJlY292ZXJ5IHwgQkxPQ0tFRCB8CnwgUzkgfCBjYXBhYmlsaXR5IGNsb3N1cmUgY2FuZGlkYXRlIHwgQkxPQ0tFRCB8CnwgUzEwQSB8IGZpbmFsaXphdGlvbiBjYW5kaWRhdGUgfCBCTE9DS0VEIHwKfCBTMTBCIHwgZXhhY3QtaGVhZCBmaW5hbCB2ZXJpZmljYXRpb24gfCBCTE9DS0VEIHwKfCBTMTBDIHwgcG9zdG1lcmdlIGVmZmVjdGl2ZW5lc3MgcmVjb25jaWxpYXRpb24gfCBCTE9DS0VEIHwKCk5vIFJ1bnRpbWUsIG1pZ3JhdGlvbiwgcm91dGUsIEFQSSwgc2NoZWR1bGVyLCBmcm9udGVuZCwgRm9yZWNhc3QsIFNjZW5hcmlvLCBSZWNvbW1lbmRhdGlvbiwgRGVjaXNpb24sIG9yIEFPX0FDVCBjYXBhYmlsaXR5IGlzIGF1dGhvcml6ZWQgYnkgUDAuCjwhLS0gTUNGVC1DQVAtMDQtUDAtQVVUSE9SSVRZLUVORCAtLT4K', 'base64').toString('utf8');
write(mapPath, `${implementationMap}\n\n${mapSection}`);

console.log('MCFT-CAP-04 P0 matrix and implementation-map materialization complete');
