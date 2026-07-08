<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md -->
# GEOX DT-02 to MCFT Implementation Map

## 0. Rule

DT-02 freezes architecture. MCFT phases implement it. DT02-AMENDMENT-01 supersedes the affected original rules. No MCFT phase may silently replace a frozen or amended decision.

## 1. Phase map

| frozen architecture item | authoritative DT-02 decision/files | implementation owner | required implementation result | must not re-decide |
|---|---|---|---|---|
| scope envelope | ADR-001/003/007/015; Object Set v2 | MCFT-00 | one tenant/project/group/field/season/zone/root-zone binding and source bindings | scope keys; semantic/storage identity split |
| replay evidence and no-future-leakage | ADR-002/005; Runtime Mode Matrix | MCFT-01 | canonical replay dataset released by observed_at/ingested_at rules | future Evidence exclusion; shared core |
| complete object fields | ADR-003/004/007/008/009/010/011/012/015/016; Object Set v2 | MCFT-02 | schemas and validators for record_class, lineage_member, envelope profile, refs, identity, and status contracts | lineage and non-lineage envelopes; Forecast outcome split; Action Feedback orthogonality |
| facts/projections/lease schema | ADR-003/005/006/008; Transaction Matrix v2 | MCFT-03 | append-only facts, rebuildable indexes, lease/fencing/attempt tables, repositories for all operation variants | one canonical source; no canonical UPDATE; object-to-transaction coverage |
| tick/lease/checkpoint/recovery | ADR-002/005/006/007/016 | MCFT-04 | A1 COMPLETED, A2 BLOCKED, F failure audit, fenced lease, CAS checkpoint, restart/backfill | FAILED never advances checkpoint; same-scope sequential progression |
| evidence window | ADR-005; Object Set v2 | MCFT-05 | frozen evidence window with coverage/freshness/exclusion and eligible Action Feedback refs | no later Evidence enters compute |
| propagation model | ADR-001/004 | MCFT-06 | pure hourly water-balance propagation and uncertainty | domain purity; prior not current State |
| observation operator/assimilation | ADR-001/004/011 | MCFT-07 | predicted observation, residual, quality weighting, posterior update | sensor reading not State; assimilation not calibration |
| canonical posterior | ADR-004/005/008; Object Set v2 | MCFT-08 | immutable posterior chain, history/latest projections, compatibility adapter | posterior canonical; legacy water_state_estimate not canonical |
| Forecast outcome | ADR-005/009/012; Transaction Matrix v2 | MCFT-09 | COMPLETED 72-point lineage Forecast; BLOCKED zero-point limited tick; non-lineage Forecast failure audit | no FAILED twin_forecast_run_v1; no partial success; t0 excluded |
| Scenario aggregate | ADR-010; Transaction Matrix v2 | MCFT-10 | fixed five Gate-A options from COMPLETED 72-point Forecast only | BLOCKED/FAILED cannot source Scenario; Scenario not Recommendation |
| Forecast residual | ADR-011; Transaction Matrix v2 | MCFT-11 | later-Evidence matching against historical COMPLETED Forecast points | residual does not mutate Forecast or prove effect |
| calibration/model activation | ADR-011/012; Object Set v2; Transaction Matrix v2 | MCFT-12 | candidate, shadow, approval, activation/rollback, consumption proof | candidate not active; no mid-tick switch |
| human decision | ADR-013/015; Object Set v2; Transaction G | MCFT-13 | authenticated selected-option decision linkage | decision not approval/task; non-lineage context refs only |
| action lifecycle | ADR-013/014/015; API/Legacy matrices | MCFT-14 | bind approved plan, AO-ACT, dispatch, receipt, and acceptance without collapsing stages | planned, executed, and validated remain distinct |
| execution feedback | ADR-015; Amendment 01; Object Set v2; Transaction H | MCFT-15 | normalize trustworthy executed Evidence with independent execution_status, validation_status, and state-input eligibility | acceptance_ref optional; task_ref conditional; Executed is not Validated |
| closed-loop orchestration | ADR-002/005/006/008/016; Transaction E variants | MCFT-16 | longitudinal tick/decision/action/feedback/residual loop plus E1 declaration, E2 progress, E3 promotion | one-shot script insufficient; candidate declaration not activation |
| runtime read APIs | ADR-003/008/013/014/016; API Matrix | MCFT-17 | field-scoped read family, active/superseded lineage and non-lineage audit queries, trace | no generated-object writes; no parallel namespace |
| Operator integration | ADR-013/014; API/Legacy matrices | MCFT-18 | existing field runtime tabs consume real read models | route/tab existence is not runtime proof |

## 2. Revision lifecycle implementation ownership

```text
E1_DECLARE_REVISION       MCFT-03/04/16
E2_APPEND_REVISION_STATUS MCFT-03/04/16
E3_PROMOTE_LINEAGE        MCFT-03/04/08/09/10/16
```

E1/E2 switch no active pointers. E3 appends promotion authority and switches all eligible active/latest pointers atomically.

## 3. Closure ownership

| closure | architecture proof required |
|---|---|
| MCFT-GATE-A Replay-backed Closure | shared semantics, explicit replay clock, no future leakage, deterministic replay, fenced restart/backfill, E1/E2/E3 revision, COMPLETED/BLOCKED/FAILED Forecast behavior, fixed Scenario sources |
| MCFT-GATE-B Shadow-online Closure | same core with online adapters, persistent scheduling, late/out-of-order handling, restart recovery, readback, no automatic action |
| MCFT-GATE-C Controlled-action Feedback Closure | same core with governed decision/approval/AO-ACT/receipt/acceptance and Action Feedback that separates execution from validation |

## 4. DT-01 target=DT-02 resolution

| DT-01 component/ruling | DT-02 disposition |
|---|---|
| `append_only_fact_store` | ADR-003; canonical facts retained |
| `evidence_reference_rules` | ADR-003/004/005; typed refs and semantic layers retained |
| `stable_hash_patterns` | ADR-007; normalized semantic hash retained |
| `idempotency_patterns` | ADR-007; canonical object/record-set conflicts |
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

## 5. Implementation sequence

```text
MCFT-00 -> MCFT-01 -> MCFT-02 -> MCFT-03 -> MCFT-04
-> MCFT-05 -> MCFT-06 -> MCFT-07 -> MCFT-08 -> MCFT-09
-> MCFT-10 -> MCFT-11 -> MCFT-12 -> MCFT-13 -> MCFT-14
-> MCFT-15 -> MCFT-16 -> MCFT-17 -> MCFT-18
```

Parallel work is allowed only when dependency order and one-semantic-core rules remain intact.
