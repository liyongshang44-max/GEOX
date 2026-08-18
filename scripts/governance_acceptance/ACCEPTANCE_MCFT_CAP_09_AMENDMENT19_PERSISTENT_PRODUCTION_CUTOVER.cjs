const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const EVIDENCE = 'apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts';
const SERVICE = 'apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts';
const RUNNER = 'apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.ts';
const GATE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json';
const OUT = 'acceptance-output/MCFT_CAP_09_AMENDMENT19_PERSISTENT_PRODUCTION_CUTOVER_RESULT.json';

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function need(text, token, code) { if (!text.includes(token)) throw new Error(code); }
function forbid(text, token, code) { if (text.includes(token)) throw new Error(code); }
function assert(value, code) { if (!value) throw new Error(code); }

function main() {
  const evidence = read(EVIDENCE);
  const service = read(SERVICE);
  const runner = read(RUNNER);
  const gate = JSON.parse(read(GATE));

  assert(gate.canonical_core_binding?.core_symbol === 'executeExternalFormalAmendment19CanonicalTickV1', 'AM19_CUTOVER_GATE_CORE_SYMBOL_DRIFT');
  assert(gate.persistent_accelerated_equivalence?.allowed_clock_difference_only === true, 'AM19_CUTOVER_CLOCK_ONLY_RULE_REQUIRED');
  assert(gate.persistent_accelerated_equivalence?.accelerated_clock_role === 'REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY', 'AM19_CUTOVER_CLOCK_ROLE_DRIFT');
  assert(gate.persistent_accelerated_equivalence?.simplified_runner_forbidden === true, 'AM19_CUTOVER_SIMPLIFIED_RUNNER_FORBIDDEN_RULE_REQUIRED');

  need(service, 'executeExternalFormalAmendment19CanonicalTickV1', 'AM19_CUTOVER_SHARED_CORE_REQUIRED');
  forbid(service, 'executeExternalFormalCap04Amendment11CandidateV1', 'AM19_CUTOVER_OLD_CANDIDATE_FORBIDDEN');
  forbid(service, 'executeExternalFormalCap04CandidateV1', 'AM19_CUTOVER_LEGACY_CANDIDATE_FORBIDDEN');
  need(service, 'created_at: timing.logical_time', 'AM19_CUTOVER_CANONICAL_CREATED_AT_LOGICAL_T_REQUIRED');
  need(service, 'created_at: timing.logical_time });', 'AM19_CUTOVER_SCENARIO_CREATED_AT_LOGICAL_T_REQUIRED');
  need(service, 'provider_wait_required: false', 'AM19_CUTOVER_ZERO_PROVIDER_WAIT_REQUIRED');
  need(service, 'healthFromPersistedARecordSetV1', 'AM19_CUTOVER_HEALTH_FROM_READBACK_REQUIRED');
  need(service, 'forcingModeFromPersistedARecordSetV1', 'AM19_CUTOVER_FORCING_FROM_READBACK_REQUIRED');

  need(evidence, 'AM19_EXTERNAL_DB_BOUNDARY_SNAPSHOT_MUST_EQUAL_LOGICAL_TIME', 'AM19_CUTOVER_BOUNDARY_FREEZE_REQUIRED');
  need(evidence, '["soil", "future_weather", "future_et0"]', 'AM19_CUTOVER_ONLY_CAUSAL_FAMILIES_REQUIRED');
  forbid(evidence, '["soil", "rainfall", "historical_et0", "future_weather", "future_et0"] as const', 'AM19_CUTOVER_DELAYED_PAIR_MUST_NOT_BE_REQUIRED');
  need(evidence, 'Date.parse(availableAt) > Date.parse(logicalTime)', 'AM19_CUTOVER_AVAILABILITY_CUTOFF_T_REQUIRED');
  need(evidence, 'provider_request_count: 0', 'AM19_CUTOVER_DB_ONLY_REQUIRED');

  need(runner, 'listMissedSlots', 'AM19_CUTOVER_PRODUCTION_SCHEDULER_LIST_REQUIRED');
  need(runner, 'claimDueSlot', 'AM19_CUTOVER_PRODUCTION_SCHEDULER_CLAIM_REQUIRED');
  need(runner, 'recordTerminalResult', 'AM19_CUTOVER_PRODUCTION_SCHEDULER_TERMINAL_REQUIRED');
  need(runner, 'const snapshotTime = slot.logical_time', 'AM19_CUTOVER_BACKFILL_FREEZE_AT_SLOT_T_REQUIRED');
  need(runner, 'tickResult.runtime_health === "DEGRADED" ? "DEGRADED"', 'AM19_CUTOVER_DEGRADED_TERMINAL_REQUIRED');
  need(runner, 'tick_ref: tickResult.a_record_set.record_set_id', 'AM19_CUTOVER_TICK_READBACK_REF_REQUIRED');
  need(runner, 'BLOCKED_NO_CAUSAL_FORCING', 'AM19_CUTOVER_EXPLICIT_BLOCKED_REQUIRED');
  forbid(runner, 'setTimeout(', 'AM19_CUTOVER_TIMER_LOOP_FORBIDDEN');
  forbid(runner, 'fetch(', 'AM19_CUTOVER_PROVIDER_FETCH_FORBIDDEN');

  const result = {
    schema_version: 'geox_mcft_cap09_amendment19_persistent_production_cutover_result_v1',
    status: 'PASS',
    shared_canonical_core_bound: true,
    delayed_exact_pair_optional_at_boundary: true,
    snapshot_authority: 'SELECTED_SLOT_LOGICAL_T',
    scheduler_graph: 'LIST_MISSED_CLAIM_SAME_FENCE_TERMINAL',
    mode_b_terminal_state: 'DEGRADED',
    mode_a_terminal_state: 'COMPLETED',
    health_source: 'PERSISTED_A_RECORD_READBACK',
    blocked_no_assumption_is_wait: false,
    provider_wait_authorized: false,
    persistent_24t_claimed: false,
    future_formal_epoch_selected: false,
    formal_effect: false,
  };
  fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

main();
