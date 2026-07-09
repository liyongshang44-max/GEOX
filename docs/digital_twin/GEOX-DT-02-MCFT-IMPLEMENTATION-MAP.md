<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md -->
# GEOX DT-02 to MCFT Implementation Map

## 0. Rule

DT-02 freezes architecture. MCFT owner work packages implement it. Capability-line closure does not automatically mark horizontal owner work packages COMPLETE.

```text
capability_line_id
  vertical executable capability closure unit

owner_work_package_id
  horizontal architecture ownership catalogue entry

delivery_slice_id
  bounded implementation slice delivered by a capability line
```

## 1. Horizontal architecture ownership

```text
MCFT-00 scope and binding authority
MCFT-01 Replay Evidence
MCFT-02 canonical contracts
MCFT-03 facts, projections, lease and idempotency
MCFT-04 tick, checkpoint and recovery
MCFT-05 Evidence Window
MCFT-06 propagation
MCFT-07 observation and assimilation
MCFT-08 canonical posterior State
MCFT-09 Forecast outcome
MCFT-10 Scenario
MCFT-11 Forecast residual
MCFT-12 calibration and model activation
MCFT-13 human decision
MCFT-14 action lifecycle
MCFT-15 execution feedback
MCFT-16 closed-loop orchestration
MCFT-17 runtime read APIs
MCFT-18 Operator integration
```

## 2. MCFT-CAP-01 final slice map

| delivery slice | bounded result | status |
|---|---|---|
| `MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1` | 30-day Replay Evidence plus configuration-derived crop-stage context | COMPLETE |
| `MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1` | A0 contracts and complete graph validation | COMPLETE |
| `MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1` | A0 persistence plus Reality Binding snapshot and next-tick reads | COMPLETE |
| `MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1` | deterministic bootstrap posterior | COMPLETE |
| `MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1` | one A0 transaction, complete Evidence trace, persisted handoff and manual entry | COMPLETE |
| `MCFT-CAP-01.CLOSURE-V1` | historical closure | SUPERSEDED_BY_REMEDIATION |
| `MCFT-CAP-01.CLOSURE-REMEDIATION-V1` | repaired bounded capability closure | COMPLETE |

```text
runtime delivery main commit:
4a0fd03beb05298028101a4999c67a5e053dadb8

historical closure main commit:
250053aba801075c17098f8d505d527eb54390e9

remediation implementation candidate head:
193f9785e42eb146e300e2a64abeed455f10e54e

PR:
#2316

capability status:
COMPLETE

active delivery slice:
null

successor:
NOT_YET_AUTHORIZED
```

## 3. Established MCFT-CAP-01 proof

```text
controlled Canonical Replay Evidence
configuration-derived crop-stage context
explicit Replay logical time
no-future-leakage behavior
immutable Runtime Config
bootstrap prior and scalar assimilation
first bootstrap posterior
A0 aggregate idempotency
nine-fact atomic append
six rebuildable projections
INITIAL lineage and checkpoint
BLOCKED zero-point Forecast result
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
MCFT_CAP_01_COMPLETE
```

The persisted handoff resolves:

```text
active_lineage_ref = lineage canonical object_id
lineage_id = semantic lineage identity
```

and reads active lineage, latest checkpoint, previous posterior, Runtime Config and Reality Binding in one PostgreSQL consistent view.

## 4. Acceptance

```text
S1 Replay Dataset: 12 PASS, 0 FAIL
S4 static: 21 PASS, 0 FAIL
S4 PostgreSQL: 12 PASS, 0 FAIL
Remediation static: 18 PASS, 0 FAIL
Remediation PostgreSQL: 7 PASS, 0 FAIL
Governance readiness: 106 PASS, 0 FAIL
Typecheck: PASS
Build: PASS
CI #4491: SUCCESS
Manual runner: INSERTED then EXISTING_IDEMPOTENT_SUCCESS
```

## 5. Owner work-package status

```text
MCFT-01 PARTIALLY_ESTABLISHED
MCFT-02 PARTIALLY_ESTABLISHED
MCFT-03 PARTIALLY_ESTABLISHED
MCFT-04 PARTIALLY_ESTABLISHED
MCFT-05 PARTIALLY_ESTABLISHED
MCFT-06 NOT_STARTED
MCFT-07 PARTIALLY_ESTABLISHED
MCFT-08 PARTIALLY_ESTABLISHED
MCFT-09 PARTIALLY_ESTABLISHED
```

MCFT-CAP-01 closure does not imply complete horizontal work-package closure.

## 6. Preserved nonclaims

```text
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

## 7. Closure hierarchy

MCFT-CAP-01 establishes a deterministic Replay bootstrap State capability only. It is not Gate A, Gate B, Gate C or Minimum Complete Field Twin closure.

MCFT-2 / hourly dynamics remains unauthorized until PR #2316 is merged, main is verified, and a separate task line explicitly authorizes it.
