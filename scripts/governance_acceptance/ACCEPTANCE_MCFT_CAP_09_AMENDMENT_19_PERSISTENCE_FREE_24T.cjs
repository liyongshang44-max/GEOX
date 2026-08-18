const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const OUTPUT = path.join(OUTPUT_DIR, 'MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T_GOVERNANCE_RESULT.json');
const EXACT_PREDECESSOR_MAIN = 'b0ecccc336409762afb157ce794786880976b55b';
const CORE_PATH = 'apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts';
const CORE_SYMBOL = 'executeExternalFormalAmendment19CanonicalTickV1';
const ACCEPTANCE_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T.ts';
const GATE_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function requireTrue(value, code) {
  if (!value) throw new Error(code);
}
function requireIncludes(text, token, code) {
  if (!text.includes(token)) throw new Error(code);
}
function requireExcludes(text, token, code) {
  if (text.includes(token)) throw new Error(code);
}

function main() {
  const gate = JSON.parse(read(GATE_PATH));
  const core = read(CORE_PATH);
  const acceptance = read(ACCEPTANCE_PATH);

  requireTrue(gate.canonical_core_binding?.core_path === CORE_PATH, 'AMENDMENT19_PF24T_GATE_CORE_PATH_MISMATCH');
  requireTrue(gate.canonical_core_binding?.core_symbol === CORE_SYMBOL, 'AMENDMENT19_PF24T_GATE_CORE_SYMBOL_MISMATCH');
  requireTrue(gate.canonical_core_binding?.persistence_free_engineering_must_call_core_directly === true, 'AMENDMENT19_PF24T_DIRECT_CORE_RULE_REQUIRED');
  requireTrue(gate.canonical_core_binding?.persistence_free_engineering_direct_state_math_imports_forbidden === true, 'AMENDMENT19_PF24T_DIRECT_MATH_FORBIDDEN_RULE_REQUIRED');
  requireTrue(gate.canonical_core_binding?.persistence_free_engineering_simplified_runner_forbidden === true, 'AMENDMENT19_PF24T_SIMPLIFIED_RUNNER_FORBIDDEN_RULE_REQUIRED');
  requireTrue(gate.canonical_core_binding?.future_production_persistent_path_must_call_same_core_symbol === true, 'AMENDMENT19_PF24T_FUTURE_PRODUCTION_SAME_CORE_REQUIRED');

  for (const token of [
    'selectExternalFormalCurrentIntervalForcingV1',
    'executeHourlyWaterBalanceV1',
    'composeAssimilatedContinuationPosteriorV1',
    'selectCap04FutureForcingOutcomeV1',
    'executeCap04Pure72hForecastMathV1',
    'buildExternalFormalCap04CompletedA1RecordSetV1',
    'buildExternalFormalCap04BlockedA2RecordSetV1',
  ]) requireIncludes(core, token, `AMENDMENT19_PF24T_CORE_CHAIN_MISSING:${token}`);
  requireIncludes(core, `export function ${CORE_SYMBOL}`, 'AMENDMENT19_PF24T_CORE_EXPORT_MISSING');
  requireIncludes(core, 'evidence_snapshot_time', 'AMENDMENT19_PF24T_BOUNDARY_SNAPSHOT_REQUIRED');
  requireIncludes(core, 'AMENDMENT19_CANONICAL_CORE_BOUNDARY_SNAPSHOT_MUST_EQUAL_LOGICAL_TIME', 'AMENDMENT19_PF24T_BOUNDARY_FREEZE_REQUIRED');
  requireIncludes(core, 'current_interval_forcing:', 'AMENDMENT19_PF24T_EXPLICIT_CURRENT_FORCING_REQUIRED');
  requireIncludes(core, 'provider_wait_required: false', 'AMENDMENT19_PF24T_ZERO_WAIT_CORE_REQUIRED');
  requireExcludes(core, 'validateExternalFormalCap04InputAuthorityV1', 'AMENDMENT19_PF24T_OLD_EXACT_FIVE_AUTHORITY_FORBIDDEN');
  requireExcludes(core, 'buildAssimilatedContinuationEvidenceWindowV2', 'AMENDMENT19_PF24T_LEGACY_EXACT_INTERVAL_WINDOW_FORBIDDEN');
  requireExcludes(core, 'rainfall_record:', 'AMENDMENT19_PF24T_FAKE_RAINFALL_RECORD_FORBIDDEN');
  requireExcludes(core, 'historical_et0_record:', 'AMENDMENT19_PF24T_FAKE_HISTORICAL_ET0_RECORD_FORBIDDEN');

  requireIncludes(acceptance, CORE_SYMBOL, 'AMENDMENT19_PF24T_ACCEPTANCE_MUST_IMPORT_CORE');
  requireIncludes(acceptance, 'for (let index = 0; index < 24; index += 1)', 'AMENDMENT19_PF24T_EXACT_24T_LOOP_REQUIRED');
  requireIncludes(acceptance, 'nextHandoff(', 'AMENDMENT19_PF24T_CANONICAL_CHAIN_CONTINUITY_REQUIRED');
  requireIncludes(acceptance, 'PERSISTENCE_FREE_24T: "PASS"', 'AMENDMENT19_PF24T_PASS_STATUS_REQUIRED');
  requireIncludes(acceptance, 'PERSISTENT_24T: "NOT_YET_AUTHORIZED_OR_CLAIMED"', 'AMENDMENT19_PF24T_PERSISTENT_NONCLAIM_REQUIRED');
  requireIncludes(acceptance, 'o00_real_causal_gfs_h1_claimed: false', 'AMENDMENT19_PF24T_REAL_GFS_NONCLAIM_REQUIRED');
  requireIncludes(acceptance, 'late_exact_after_boundary_no_canonical_rewrite', 'AMENDMENT19_PF24T_LATE_EXACT_HASH_PROOF_REQUIRED');
  requireIncludes(acceptance, 'partial_rainfall_only_whole_mode_b', 'AMENDMENT19_PF24T_PARTIAL_RAIN_REQUIRED');
  requireIncludes(acceptance, 'partial_et0_only_whole_mode_b', 'AMENDMENT19_PF24T_PARTIAL_ET0_REQUIRED');

  for (const forbidden of [
    'selectExternalFormalCurrentIntervalForcingV1',
    'executeHourlyWaterBalanceV1',
    'composeAssimilatedContinuationPosteriorV1',
    'executeCap04Pure72hForecastMathV1',
    'buildExternalFormalCap04CompletedA1RecordSetV1',
    'buildExternalFormalCap04BlockedA2RecordSetV1',
    'buildExternalFormalCap04StateSourceMembersV1',
  ]) requireExcludes(acceptance, forbidden, `AMENDMENT19_PF24T_ACCEPTANCE_DIRECT_SEMANTIC_IMPORT_FORBIDDEN:${forbidden}`);

  requireExcludes(acceptance, 'formal_effect: true', 'AMENDMENT19_PF24T_FORMAL_EFFECT_FORBIDDEN');
  requireExcludes(acceptance, 'future_formal_epoch_selected: true', 'AMENDMENT19_PF24T_EPOCH_SELECTION_FORBIDDEN');
  requireExcludes(acceptance, 'production_persistent_path_cutover: true', 'AMENDMENT19_PF24T_PRODUCTION_CUTOVER_FORBIDDEN');

  const result = {
    schema_version: 'geox_mcft_cap09_amendment19_persistence_free_24t_governance_result_v1',
    status: 'PASS',
    exact_predecessor_protected_main: EXACT_PREDECESSOR_MAIN,
    canonical_core_path: CORE_PATH,
    canonical_core_symbol: CORE_SYMBOL,
    same_core_gate_bound: true,
    semantic_chain_bound_in_core: true,
    acceptance_direct_state_forecast_math_imports: 0,
    acceptance_simplified_runner: false,
    legacy_exact_five_authority_in_core: false,
    fake_observation_fields_in_core: false,
    boundary_snapshot_equals_logical_time_required: true,
    persistent_24t_claimed: false,
    real_o00_gfs_claimed: false,
    production_persistent_path_cutover: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    formal_effect: false,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

main();
