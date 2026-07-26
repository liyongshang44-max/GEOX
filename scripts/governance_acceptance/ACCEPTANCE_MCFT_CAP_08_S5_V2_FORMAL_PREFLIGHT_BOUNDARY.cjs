#!/usr/bin/env node
// Purpose: validate the disposable MCFT-CAP-08.S5 replay-dataset v2 formal preflight boundary.
// This preflight may prove implementation behavior but may not declare or project a formal Candidate.

'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');

const base = process.env.MCFT_BASE_SHA || '1a6ff1b3c2b9974f859fe473b09a49a5c8fdb678';
const expected = [
  '.github/workflows/mcft-cap-08-s5-v2-formal-preflight.yml',
  'apps/server/src/domain/calibration/cap08_s5_case_builder_v1.ts',
  'apps/server/src/domain/calibration/cap08_s5_envelope_profiles_v1.ts',
  'apps/server/src/domain/calibration/cap08_s5_objective_grid_search_v1.ts',
  'apps/server/src/domain/twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.ts',
  'apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts',
  'apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_replay_prediction_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_BOUNDARY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s5_v2_formal_acceptance_support_v1.ts',
].sort();

const changed = cp.execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean).sort();
if (JSON.stringify(changed) !== JSON.stringify(expected)) {
  throw new Error(`CAP08_S5_V2_FORMAL_PREFLIGHT_BOUNDARY:${JSON.stringify(changed)}`);
}
for (const file of [
  'docs/governance/DELIVERY-CANDIDATE-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
]) {
  if (cp.execFileSync('git', ['diff', '--name-only', `${base}...HEAD`, '--', file], { encoding: 'utf8' }).trim()) {
    throw new Error(`CAP08_S5_V2_FORMAL_PREFLIGHT_FROZEN_AUTHORITY_CHANGED:${file}`);
  }
}
if (changed.some((file) => file.includes('CANDIDATE-DECLARATION'))) {
  throw new Error('CAP08_S5_V2_FORMAL_PREFLIGHT_CANDIDATE_DECLARATION_FORBIDDEN');
}
const service = fs.readFileSync(
  'apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts',
  'utf8',
);
for (const token of [
  'validateCap08S5V2PrequalificationEvidenceV1',
  'runCap08S5ObjectiveGridSearchV1',
  'diagnostic_only_observation_refs: ["FVO-10"]',
  'model_activation_count: 0',
  'active_runtime_config_switch_count: 0',
]) {
  if (!service.includes(token)) throw new Error(`CAP08_S5_V2_FORMAL_PREFLIGHT_SERVICE_TOKEN:${token}`);
}
console.log(JSON.stringify({
  status: 'PASS',
  base,
  changed_files: changed,
  candidate_declaration_present: false,
  formal_candidate_state_mutation: false,
  s5_effective: false,
  s6_authorized: false,
}, null, 2));
