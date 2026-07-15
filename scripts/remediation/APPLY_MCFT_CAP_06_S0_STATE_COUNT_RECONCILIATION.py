# scripts/remediation/APPLY_MCFT_CAP_06_S0_STATE_COUNT_RECONCILIATION.py
# Purpose: reconcile the reproducible canonical State fact count with the historical CAP-05 S10 field that mislabeled the 81-object orchestrator fact delta as global_state_count.
# Boundary: acceptance and governance wording only; no CAP-05 historical record rewrite, production Runtime, canonical fact mutation, database schema, migration, route, scheduler, Candidate/Evaluation, Model Activation, or CAP-07 authority.

from pathlib import Path

PREFLIGHT = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts")
GATE = Path("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs")
RECONCILIATION = "HISTORICAL_S10_GLOBAL_STATE_COUNT_LABEL_CONFLATED_WITH_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA"


def replace_once(text: str, old: str, new: str, code: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{code}:MARKER_COUNT:{count}")
    return text.replace(old, new, 1)


preflight = PREFLIGHT.read_text()
preflight = replace_once(
    preflight,
    "const EXPECTED_GLOBAL_STATE_COUNT = 81;",
    f'''const EXPECTED_REPRODUCED_STATE_FACT_COUNT = 33;
const HISTORICAL_S10_DECLARED_GLOBAL_STATE_COUNT = 81;
const HISTORICAL_S10_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA = 81;
const STATE_COUNT_RECONCILIATION = "{RECONCILIATION}";''',
    "S0_STATE_COUNT_CONSTANTS",
)
preflight = replace_once(
    preflight,
    '  assert.equal(stateCount.rows[0].count, EXPECTED_GLOBAL_STATE_COUNT, "GLOBAL_STATE_COUNT_MISMATCH");',
    '''  assert.equal(
    stateCount.rows[0].count,
    EXPECTED_REPRODUCED_STATE_FACT_COUNT,
    "REPRODUCED_STATE_FACT_COUNT_MISMATCH",
  );''',
    "S0_STATE_COUNT_ASSERTION",
)
preflight = replace_once(
    preflight,
    "    global_state_count: stateCount.rows[0].count,",
    '''    reproduced_state_fact_count: stateCount.rows[0].count,
    historical_s10_declared_global_state_count: HISTORICAL_S10_DECLARED_GLOBAL_STATE_COUNT,
    historical_s10_orchestrator_canonical_object_fact_delta: HISTORICAL_S10_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA,
    state_count_reconciliation: STATE_COUNT_RECONCILIATION,''',
    "S0_STATE_COUNT_IDENTITY",
)
preflight = replace_once(
    preflight,
    '''    expected_checkpoint: {
      checkpoint_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      global_state_count: EXPECTED_GLOBAL_STATE_COUNT,
      last_logical_time: EXPECTED_LAST_LOGICAL_TIME,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
    },''',
    '''    expected_checkpoint: {
      checkpoint_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      reproduced_state_fact_count: EXPECTED_REPRODUCED_STATE_FACT_COUNT,
      historical_s10_declared_global_state_count: HISTORICAL_S10_DECLARED_GLOBAL_STATE_COUNT,
      historical_s10_orchestrator_canonical_object_fact_delta: HISTORICAL_S10_ORCHESTRATOR_CANONICAL_OBJECT_FACT_DELTA,
      state_count_reconciliation: STATE_COUNT_RECONCILIATION,
      last_logical_time: EXPECTED_LAST_LOGICAL_TIME,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
    },''',
    "S0_LOCK_EXPECTED_COUNT",
)
preflight = replace_once(
    preflight,
    '      "global_state_count_equals_81",',
    '''      "reproduced_state_fact_count_equals_33",
      "historical_s10_declared_global_state_count_81_preserved_without_reuse_as_state_count",
      "historical_s10_orchestrator_canonical_object_fact_delta_equals_81",
      "state_count_semantic_reconciliation_is_explicit",''',
    "S0_LOCK_VALIDATED_RELATIONS",
)
preflight = replace_once(
    preflight,
    "      global_state_count: identity.global_state_count,",
    '''      reproduced_state_fact_count: identity.reproduced_state_fact_count,
      historical_s10_declared_global_state_count: identity.historical_s10_declared_global_state_count,
      historical_s10_orchestrator_canonical_object_fact_delta: identity.historical_s10_orchestrator_canonical_object_fact_delta,
      state_count_reconciliation: identity.state_count_reconciliation,''',
    "S0_AUTH_STATUS_PREDECESSOR_COUNT",
)
preflight = replace_once(
    preflight,
    '''checkpoint_sequence: ${identity.checkpoint_sequence}
global_state_count: ${identity.global_state_count}
latest_logical_time: ${identity.latest_logical_time}''',
    '''checkpoint_sequence: ${identity.checkpoint_sequence}
reproduced_state_fact_count: ${identity.reproduced_state_fact_count}
historical_s10_declared_global_state_count: ${identity.historical_s10_declared_global_state_count}
historical_s10_orchestrator_canonical_object_fact_delta: ${identity.historical_s10_orchestrator_canonical_object_fact_delta}
state_count_reconciliation: ${identity.state_count_reconciliation}
latest_logical_time: ${identity.latest_logical_time}''',
    "S0_AUTH_DOC_COUNT",
)
preflight = replace_once(
    preflight,
    '''predecessor global State count:
${identity.global_state_count}''',
    '''predecessor reproduced State fact count:
${identity.reproduced_state_fact_count}

historical S10 declared global State count:
${identity.historical_s10_declared_global_state_count}

historical S10 orchestrator canonical object fact delta:
${identity.historical_s10_orchestrator_canonical_object_fact_delta}

State-count reconciliation:
${identity.state_count_reconciliation}''',
    "S0_TASK_COUNT",
)
preflight = replace_once(
    preflight,
    '''global State count: ${identity.global_state_count}
latest logical time: ${identity.latest_logical_time}''',
    '''reproduced State fact count: ${identity.reproduced_state_fact_count}
historical S10 declared global State count: ${identity.historical_s10_declared_global_state_count}
historical S10 orchestrator canonical object fact delta: ${identity.historical_s10_orchestrator_canonical_object_fact_delta}
State-count reconciliation: ${identity.state_count_reconciliation}
latest logical time: ${identity.latest_logical_time}''',
    "S0_MAP_COUNT",
)
for required in [
    "EXPECTED_REPRODUCED_STATE_FACT_COUNT = 33",
    "historical_s10_orchestrator_canonical_object_fact_delta",
    RECONCILIATION,
    "reproduced_state_fact_count_equals_33",
]:
    if required not in preflight:
        raise SystemExit(f"S0_PREFLIGHT_COUNT_RECONCILIATION_MISSING:{required}")
if "identity.global_state_count" in preflight or "EXPECTED_GLOBAL_STATE_COUNT" in preflight:
    raise SystemExit("S0_MISLABELED_GLOBAL_STATE_COUNT_REFERENCE_REMAINS")
PREFLIGHT.write_text(preflight)

gate = GATE.read_text()
gate = replace_once(
    gate,
    '''check("S0_POSTGRESQL_IDENTITY", lock.status === "COMPLETE"
  && lock.identity_extraction_source === "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH"
  && lock.expected_checkpoint.checkpoint_sequence === 80
  && lock.expected_checkpoint.global_state_count === 81
  && lock.expected_checkpoint.last_logical_time === "2026-06-04T09:00:00.000Z"
  && lock.expected_checkpoint.next_tick_logical_time === "2026-06-04T10:00:00.000Z"
  && lock.canonical_identity.checkpoint_sequence === 80
  && lock.canonical_identity.global_state_count === 81
  && lock.canonical_identity.latest_logical_time === "2026-06-04T09:00:00.000Z"
  && lock.canonical_identity.next_tick_logical_time === "2026-06-04T10:00:00.000Z", lockPath);''',
    f'''check("S0_POSTGRESQL_IDENTITY", lock.status === "COMPLETE"
  && lock.identity_extraction_source === "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH"
  && lock.expected_checkpoint.checkpoint_sequence === 80
  && lock.expected_checkpoint.reproduced_state_fact_count === 33
  && lock.expected_checkpoint.historical_s10_declared_global_state_count === 81
  && lock.expected_checkpoint.historical_s10_orchestrator_canonical_object_fact_delta === 81
  && lock.expected_checkpoint.state_count_reconciliation === "{RECONCILIATION}"
  && lock.expected_checkpoint.last_logical_time === "2026-06-04T09:00:00.000Z"
  && lock.expected_checkpoint.next_tick_logical_time === "2026-06-04T10:00:00.000Z"
  && lock.canonical_identity.checkpoint_sequence === 80
  && lock.canonical_identity.reproduced_state_fact_count === 33
  && lock.canonical_identity.historical_s10_declared_global_state_count === 81
  && lock.canonical_identity.historical_s10_orchestrator_canonical_object_fact_delta === 81
  && lock.canonical_identity.state_count_reconciliation === "{RECONCILIATION}"
  && lock.canonical_identity.latest_logical_time === "2026-06-04T09:00:00.000Z"
  && lock.canonical_identity.next_tick_logical_time === "2026-06-04T10:00:00.000Z", lockPath);''',
    "S0_GATE_IDENTITY_COUNT",
)
gate = replace_once(
    gate,
    '''check("S0_AUTHORIZATION_DOCUMENT", authorization.includes("S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS")
  && authorization.includes("checkpoint_sequence: 80")
  && authorization.includes("global_state_count: 81")
  && authorization.includes("status: INSUFFICIENT_MATCHED_PAIRS")
  && authorization.includes("runtime_source_authorized:\nfalse"), authorizationPath);''',
    f'''check("S0_AUTHORIZATION_DOCUMENT", authorization.includes("S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS")
  && authorization.includes("checkpoint_sequence: 80")
  && authorization.includes("reproduced_state_fact_count: 33")
  && authorization.includes("historical_s10_declared_global_state_count: 81")
  && authorization.includes("historical_s10_orchestrator_canonical_object_fact_delta: 81")
  && authorization.includes("state_count_reconciliation: {RECONCILIATION}")
  && authorization.includes("status: INSUFFICIENT_MATCHED_PAIRS")
  && authorization.includes("runtime_source_authorized:\nfalse"), authorizationPath);''',
    "S0_GATE_AUTH_DOC_COUNT",
)
gate = replace_once(
    gate,
    '''check("S0_IMPLEMENTATION_MAP", implementationMap.includes("MCFT-CAP-06-S0-CURRENT-STATE-BEGIN")
  && implementationMap.includes("S0 status: READY_FOR_MERGE")
  && implementationMap.includes("checkpoint sequence: 80")
  && implementationMap.includes("global State count: 81")
  && implementationMap.includes("dataset qualification: INSUFFICIENT_MATCHED_PAIRS")
  && implementationMap.includes("runtime source authorized: false"), mapPath);''',
    f'''check("S0_IMPLEMENTATION_MAP", implementationMap.includes("MCFT-CAP-06-S0-CURRENT-STATE-BEGIN")
  && implementationMap.includes("S0 status: READY_FOR_MERGE")
  && implementationMap.includes("checkpoint sequence: 80")
  && implementationMap.includes("reproduced State fact count: 33")
  && implementationMap.includes("historical S10 declared global State count: 81")
  && implementationMap.includes("historical S10 orchestrator canonical object fact delta: 81")
  && implementationMap.includes("State-count reconciliation: {RECONCILIATION}")
  && implementationMap.includes("dataset qualification: INSUFFICIENT_MATCHED_PAIRS")
  && implementationMap.includes("runtime source authorized: false"), mapPath);''',
    "S0_GATE_MAP_COUNT",
)
if "global_state_count === 81" in gate or 'authorization.includes("global_state_count: 81")' in gate:
    raise SystemExit("S0_GATE_MISLABELED_GLOBAL_STATE_COUNT_REFERENCE_REMAINS")
for required in [
    "reproduced_state_fact_count === 33",
    "historical_s10_orchestrator_canonical_object_fact_delta === 81",
    RECONCILIATION,
]:
    if required not in gate:
        raise SystemExit(f"S0_GATE_COUNT_RECONCILIATION_MISSING:{required}")
GATE.write_text(gate)
