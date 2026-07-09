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

A capability-line closure does not automatically mark its contributing work packages COMPLETE.

## 3. MCFT-CAP-01 slice map

`MCFT-CAP-01` (`MCFT-1`) is authorized to deliver only:

| delivery slice | primary owner | contributors | bounded result |
|---|---|---|---|
| `MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1` | MCFT-01 | none | 30-day controlled Canonical Replay Dataset |
| `MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1` | MCFT-02 | none | A0 object/config subset only |
| `MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1` | MCFT-03 | none | A0 persistence, lease, fencing, idempotency and projection subset only |
| `MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1` | MCFT-08 | MCFT-07 | static bootstrap observation/assimilation and posterior math only |
| `MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1` | MCFT-04 | MCFT-05, MCFT-08, MCFT-09 | one A0 bootstrap transaction with BLOCKED Forecast only |
| `MCFT-CAP-01.CLOSURE-V1` | MCFT-08 | MCFT-01/02/03/04/05/07/09 | bounded capability-line closure |

MCFT-06 remains `NOT_STARTED` for MCFT-CAP-01. No propagation, water balance, rainfall application, ET application, irrigation application, continuous tick, restart/backfill, late revision, successful 72-point Forecast, or Scenario may be claimed.

MCFT-CAP-01 is `READY_FOR_IMPLEMENTATION` as the successor state of the COMPLETE Amendment 02 candidate. This readiness becomes effective only after the final candidate passes Gate and CI, merges into `main`, and is verified on `main`.

## 4. Initial and revision lineage ownership

```text
A0_BOOTSTRAP_STATE_COMMIT MCFT-02/03/04/05/07/08/09
E1_DECLARE_REVISION      MCFT-03/04/16
E2_APPEND_REVISION_STATUS MCFT-03/04/16
E3_PROMOTE_LINEAGE       MCFT-03/04/08/09/10/16
```

A0 plus an `INITIAL` `twin_runtime_lineage_v1` is the sole `NULL_TO_INITIAL` activation authority. It appends no promotion record.

E1/E2 switch no active pointers. E3 appends `twin_lineage_promotion_v1` and is the sole authority for replacing an existing active lineage.

A0 implementation must preserve:

```text
nine-object atomic append set
embedded bootstrap prior
INITIAL revision_id without revision-run object
aggregate idempotency before null-CAS
canonical INITIAL uniqueness
zero A0 partial write on failure
optional separately transacted F audit
```

## 5. Closure ownership

| closure | architecture proof required |
|---|---|
| MCFT-CAP-01 closure | one controlled bootstrap posterior, A0 atomicity, idempotency, projection rebuild and next-tick handoff; no dynamics or successful Forecast claim |
| MCFT-GATE-A Replay-backed Closure | shared semantics, explicit replay clock, no future leakage, deterministic replay, fenced restart/backfill, E1/E2/E3 revision, COMPLETED/BLOCKED/FAILED Forecast behavior, fixed Scenario sources |
| MCFT-GATE-B Shadow-online Closure | same core with online adapters, persistent scheduling, late/out-of-order handling, restart recovery, readback, no automatic action |
| MCFT-GATE-C Controlled-action Feedback Closure | same core with governed decision/approval/AO-ACT/receipt/acceptance and Action Feedback that separates execution from validation |

MCFT-CAP-01 closure is not MCFT-GATE-A, MCFT-GATE-B, or MCFT-GATE-C closure.

## 6. DT-01 target=DT-02 resolution

| DT-01 component/ruling | DT-02 disposition |
|---|---|
| `append_only_fact_store` | ADR-003; canonical facts retained |
| `evidence_reference_rules` | ADR-003/004/005; typed refs and semantic layers retained |
| `stable_hash_patterns` | ADR-007; normalized semantic hash retained |
| `idempotency_patterns` | ADR-007; object and A0 aggregate conflicts |
| `p50_trace_replay_pattern` | ADR-002/005/007; shared core plus Replay adapter |
| `p31_contract_and_negative_boundaries` | ADR-004/016; reference only; synthetic belief not physical State |
| `p31_fact_write_pattern` | ADR-003/005; adapter pattern only |
| `p49_freeze_packet` | ADR-016 and closure nonclaims; governance reference |
| `explicit_replay_clock` | ADR-002 and Runtime Mode Matrix |
| `evidence_partition` | ADR-002/005; frozen Evidence Window |
| `no_future_leakage` | ADR-002/005; retained invariant |
| `trace_packet_structure` | ADR-002/007/013; canonical trace/read APIs |
| `demo_namespace` | ADR-014; reference only |
| `p57_freeze_runner` | ADR-016; reference-only claim boundary |
| `scenario_latest_index` | ADR-003/010; rebuildable projection only |
| `canonical_field_routes` | ADR-013; `/operator/fields/:fieldId/*` retained |
| `legacy_operator_twin_routes` | ADR-014; compatibility and deletion prerequisites |

## 7. Owner work-package dependency sequence

```text
MCFT-00 -> MCFT-01 -> MCFT-02 -> MCFT-03 -> MCFT-04
-> MCFT-05 -> MCFT-06 -> MCFT-07 -> MCFT-08 -> MCFT-09
-> MCFT-10 -> MCFT-11 -> MCFT-12 -> MCFT-13 -> MCFT-14
-> MCFT-15 -> MCFT-16 -> MCFT-17 -> MCFT-18
```

This is the semantic dependency order. It is not a requirement to close every owner work package in full before an accepted bounded capability slice may use a later owner.

Parallel work is allowed only when dependency order, explicit delivery-slice dependencies, changed-file boundaries, partial-establishment claims, and one-semantic-core rules remain intact.
