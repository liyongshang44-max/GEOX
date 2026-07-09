<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md -->
# GEOX DT-02 to MCFT Implementation Map

## 0. Rule

DT-02 freezes architecture. MCFT owner work packages implement it. DT02-AMENDMENT-01 and DT02-AMENDMENT-02 supersede only their named rules. MCFT-VERTICAL-AMENDMENT-01 introduces vertical capability lines and bounded delivery slices without changing DT-02 architecture ownership. No MCFT phase or capability line may silently replace a frozen or amended decision.

The identifiers are orthogonal:

```text
capability_line_id
  vertical executable capability closure unit

owner_work_package_id
  horizontal architecture ownership catalogue entry

delivery_slice_id
  bounded implementation slice delivered by a capability line
```

`MCFT-01` through `MCFT-18` remain owner work-package identifiers. The first vertical capability line is `MCFT-CAP-01`, with display alias `MCFT-1`.

## 1. Phase map

| frozen architecture item | authoritative DT-02 decision/files | implementation owner | required implementation result | must not re-decide |
|---|---|---|---|---|
| scope envelope | ADR-001/003/007/015; Object Set v3 | MCFT-00 | one tenant/project/group/field/season/zone/root-zone binding and source bindings | scope keys; semantic/storage identity split |
| replay evidence and no-future-leakage | ADR-002/005; Runtime Mode Matrix | MCFT-01 | canonical replay dataset released by observed_at/ingested_at rules | future Evidence exclusion; shared core |
| complete object fields | ADR-003/004/007/008/009/010/011/012/015/016; Object Set v3 | MCFT-02 | schemas and validators for record class, lineage, conditional refs, identity, status, A0 and revision contracts | lineage/non-lineage envelopes; INITIAL revision identity; Forecast outcome split |
| facts/projections/lease schema | ADR-003/005/006/007/008; Transaction Matrix v3 | MCFT-03 | append-only facts, rebuildable indexes, lease/fencing/attempt/idempotency tables, repositories for operation variants | one canonical source; no canonical UPDATE; A0 aggregate idempotency ordering |
| tick/lease/checkpoint/recovery | ADR-002/005/006/007/016 | MCFT-04 | A0 bootstrap, A1 COMPLETED, A2 BLOCKED, F failure audit, fenced lease and checkpoint CAS | A0 is not continuous runtime; FAILED never advances checkpoint |
| evidence window | ADR-005; Object Set v3 | MCFT-05 | frozen evidence window with coverage/freshness/exclusion and eligible Action Feedback refs | no later Evidence enters compute |
| propagation model | ADR-001/004 | MCFT-06 | pure hourly water-balance propagation and uncertainty | domain purity; prior not current State |
| observation operator/assimilation | ADR-001/004/011 | MCFT-07 | predicted observation, residual, quality weighting, posterior update | sensor reading not State; assimilation not calibration |
| canonical posterior | ADR-004/005/008; Object Set v3 | MCFT-08 | immutable posterior chain, history/latest projections, initial and revision lineage continuity | posterior canonical; legacy water_state_estimate not canonical |
| Forecast outcome | ADR-005/009/012; Transaction Matrix v3 | MCFT-09 | COMPLETED 72-point lineage Forecast; BLOCKED zero-point limited tick; non-lineage Forecast failure audit | no FAILED twin_forecast_run_v1; no partial success; t0 excluded |
| Scenario aggregate | ADR-010; Transaction Matrix v3 | MCFT-10 | fixed five Gate-A options from COMPLETED 72-point Forecast only | BLOCKED/FAILED cannot source Scenario; Scenario not Recommendation |
| Forecast residual | ADR-011; Transaction Matrix v3 | MCFT-11 | later-Evidence matching against historical COMPLETED Forecast points | residual does not mutate Forecast or prove effect |
| calibration/model activation | ADR-011/012; Object Set v3; Transaction Matrix v3 | MCFT-12 | candidate, shadow, approval, activation/rollback, consumption proof | candidate not active; no mid-tick switch |
| human decision | ADR-013/015; Object Set v3; Transaction G | MCFT-13 | authenticated selected-option decision linkage | decision not approval/task; non-lineage context refs only |
| action lifecycle | ADR-013/014/015; API/Legacy matrices | MCFT-14 | bind approved plan, AO-ACT, dispatch, receipt, and acceptance without collapsing stages | planned, executed, and validated remain distinct |
| execution feedback | ADR-015; Amendment 01; Object Set v3; Transaction H | MCFT-15 | normalize trustworthy executed Evidence with independent execution_status, validation_status, and state-input eligibility | acceptance_ref optional; task_ref conditional; Executed is not Validated |
| closed-loop orchestration | ADR-002/005/006/008/016; Transaction E variants | MCFT-16 | longitudinal tick/decision/action/feedback/residual loop plus E1 declaration, E2 progress, E3 promotion | one-shot script insufficient; INITIAL activation is not E3 promotion |
| runtime read APIs | ADR-003/008/013/014/016; API Matrix | MCFT-17 | field-scoped read family, active/superseded lineage and non-lineage audit queries, trace | no generated-object writes; no parallel namespace |
| Operator integration | ADR-013/014; API/Legacy matrices | MCFT-18 | existing field runtime tabs consume real read models | route/tab existence is not runtime proof |

## 2. Vertical capability delivery rule

The phase map above remains the architecture ownership catalogue. Its sequence remains the semantic dependency order, but bounded slices may be delivered across several owner work packages when an accepted capability-line amendment defines:

```text
capability_line_id
delivery_slice_id
primary_owner_work_package_id
contributing_work_package_ids
depends_on_delivery_slice_ids
partial-establishment status
explicit nonclaims
```

A work package may be:

```text
NOT_STARTED
SLICE_PLANNED
PARTIALLY_ESTABLISHED
COMPLETE
```

A capability-line closure does not automatically mark its contributing work packages COMPLETE. A later code-level audit may reopen a closure if a completion claim exceeds the implementation evidence. Hash correctness does not substitute for semantic graph correctness.

## 3. MCFT-CAP-01 current slice map

`MCFT-CAP-01` is currently reopened for closure remediation.

| delivery slice | bounded result | current status |
|---|---|---|
| `MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1` | 30-day controlled Replay Evidence dataset | REMEDIATION_REQUIRED — crop-stage configuration context |
| `MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1` | A0 object/config subset | REMEDIATION_REQUIRED — complete cross-reference graph validation |
| `MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1` | A0 persistence subset | REMEDIATION_REQUIRED — persisted Reality Binding and next-tick reads |
| `MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1` | static bootstrap posterior math | COMPLETE |
| `MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1` | one A0 transaction and checkpoint pointer | REMEDIATION_REQUIRED — conflict rejection, consumption trace, persisted handoff, runner |
| `MCFT-CAP-01.CLOSURE-V1` | historical bounded closure | SUPERSEDED_PENDING_REMEDIATION |
| `MCFT-CAP-01.CLOSURE-REMEDIATION-V1` | repair and reclose capability line | IN_IMPLEMENTATION |

```text
historical closure main commit:
250053aba801075c17098f8d505d527eb54390e9

active branch:
mcft-cap-01-closure-remediation-v1

active PR:
#2316

successor:
NOT_YET_AUTHORIZED
```

## 4. Retained implementation facts

The following remain established:

```text
controlled Canonical Replay Evidence
explicit Replay logical time
no-future-leakage fixture behavior
immutable Runtime Config
bootstrap prior and scalar assimilation
first bootstrap posterior
A0 aggregate idempotency
nine-fact atomic append
six rebuildable projections
INITIAL lineage
INITIAL checkpoint
BLOCKED zero-point Forecast result
checkpoint next_tick_logical_time pointer
```

The accurate checkpoint claim is:

```text
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
```

The following historical claims are suspended pending remediation:

```text
NEXT_TICK_HANDOFF_ESTABLISHED
MCFT_CAP_01_COMPLETE
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
```

## 5. Remediation architecture proof

The active remediation must prove:

```text
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
  PostgreSQL reads active lineage, latest checkpoint, previous posterior,
  Runtime Config and Reality Binding Runtime snapshot in one consistent view

CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
  same origin and observed_at with different canonical value fails closed

EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
  window inclusion is distinct from estimator consumption

A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
  rehashed invalid refs remain invalid

OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
  explicit one-shot runner exists

CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED
  time-resolved context is configuration-derived and is not Evidence
```

The persisted next-tick DTO must contain:

```text
previous_posterior_ref
previous_checkpoint_ref
lineage_id
prior_mean
prior_variance
next_logical_tick_time
runtime_config_ref/hash
reality_binding_ref/hash
```

## 6. Initial and revision lineage ownership

```text
A0_BOOTSTRAP_STATE_COMMIT  MCFT-02/03/04/05/07/08/09
E1_DECLARE_REVISION       MCFT-03/04/16
E2_APPEND_REVISION_STATUS MCFT-03/04/16
E3_PROMOTE_LINEAGE        MCFT-03/04/08/09/10/16
```

A0 plus an `INITIAL` `twin_runtime_lineage_v1` is the sole `NULL_TO_INITIAL` activation authority. It appends no promotion record. E1/E2 switch no active pointers. E3 is the sole authority for replacing an existing active lineage.

## 7. Closure hierarchy

| closure | architecture proof required |
|---|---|
| MCFT-CAP-01 reclosure | one controlled bootstrap posterior, atomicity, idempotency, complete Evidence trace, graph validation, persisted handoff and manual entry; no dynamics or successful Forecast |
| MCFT-GATE-A Replay-backed Closure | continuous progression, propagation, restart/backfill, E1/E2/E3, COMPLETED/BLOCKED/FAILED Forecast behavior, 72-point Forecast and fixed Scenario sources |
| MCFT-GATE-B Shadow-online Closure | online adapters, persistent scheduling, late/out-of-order handling and restart recovery |
| MCFT-GATE-C Controlled-action Feedback Closure | decision/approval/AO-ACT/receipt/acceptance and governed Action Feedback |

MCFT-CAP-01 reclosure is not Gate A, Gate B, Gate C or Minimum Complete Field Twin closure.

## 8. Owner work-package status during remediation

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

## 9. Preserved nonclaims

```text
NO_MCFT_CAP_01_CLOSURE
NO_PERSISTED_NEXT_TICK_HANDOFF
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

## 10. Dependency sequence

```text
MCFT-00 -> MCFT-01 -> MCFT-02 -> MCFT-03 -> MCFT-04
-> MCFT-05 -> MCFT-06 -> MCFT-07 -> MCFT-08 -> MCFT-09
-> MCFT-10 -> MCFT-11 -> MCFT-12 -> MCFT-13 -> MCFT-14
-> MCFT-15 -> MCFT-16 -> MCFT-17 -> MCFT-18
```

No MCFT-2 / hourly dynamics work is authorized until `MCFT-CAP-01.CLOSURE-REMEDIATION-V1` merges and the reclosure is verified on main.
