<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md -->
# GEOX DT-02 to MCFT Implementation Map

## 0. Rule

DT-02 freezes architecture. MCFT phases implement it. No MCFT phase may silently replace a frozen decision. Any change requires a separately reviewed architecture amendment ADR naming the superseded DT02 ADR.

## 1. Phase map

| frozen architecture item | authoritative DT-02 decision/files | implementation owner | required implementation result | must not re-decide |
|---|---|---|---|---|
| scope envelope | ADR-001/003/007/015; Canonical Object Set | MCFT-00 | one tenant/project/group/field/season/zone/root-zone binding and source bindings | scope keys and canonical identity separation |
| replay evidence and no-future-leakage | ADR-002/005; Runtime Mode Matrix | MCFT-01 | canonical replay dataset released by observed_at/ingested_at rules | future Evidence exclusion and shared-core rule |
| complete canonical fields | ADR-004/007/008/009/010/011/012/016; Object Set | MCFT-02 | versioned schemas, validators, identity/hash normalization | prior/posterior split, fact_id separation, object responsibilities |
| facts/projections/lease schema | ADR-003/005/006/008; Object Set; Transaction Matrix | MCFT-03 | append-only facts, rebuildable indexes, lease/fencing/attempt tables, transaction repositories | one canonical source, no canonical UPDATE, promotion authority |
| tick/lease/checkpoint/recovery | ADR-002/005/006/007/016 | MCFT-04 | manual/replay/shadow tick services, fenced lease, CAS checkpoint, restart/backfill | claim/compute/commit split, sequential same-scope backfill |
| evidence window | ADR-005; Object Set | MCFT-05 | frozen evidence window with coverage/freshness/exclusion refs | no later Evidence enters compute |
| propagation model | ADR-001/004 | MCFT-06 | pure hourly water-balance propagation and uncertainty | domain purity and prior not current State |
| observation operator/assimilation | ADR-001/004/011 | MCFT-07 | predicted observation, residual, quality weighting, posterior update | sensor reading not State; assimilation not calibration |
| canonical posterior | ADR-004/005/008; Object Set | MCFT-08 | immutable posterior chain, history/latest projections, compatibility adapter | posterior is canonical; legacy water_state_estimate is not |
| forecast aggregate | ADR-005/009/012; Transaction Matrix | MCFT-09 | COMPLETED 72-point aggregate or explicit 0-point terminal failure | t0 excluded, no partial success |
| scenario aggregate | ADR-010; Transaction Matrix | MCFT-10 | fixed five Gate-A options and atomic set/point projections | scenario separate from recommendation and State transaction |
| forecast residual | ADR-011; Transaction Matrix | MCFT-11 | later-evidence matching and immutable residual history | residual does not mutate forecast or prove effect |
| calibration/model activation | ADR-011/012; Object Set; Transaction Matrix | MCFT-12 | candidate, shadow, approval, activation/rollback, consumption proof | candidate not active; no mid-tick config switch |
| human decision | ADR-013/015; Object Set; Transaction G | MCFT-13 | authenticated selected-option decision linkage | decision not approval/task |
| action lifecycle | ADR-013/014/015; API/Legacy matrices | MCFT-14 | bind approved plan, AO-ACT, dispatch, receipt, acceptance | no action bypass; keep planned/executed separate |
| execution feedback | ADR-015; Object Set; Transaction H | MCFT-15 | normalize only trustworthy executed evidence for later window | planned/approved/dispatched not executed |
| closed-loop orchestration | ADR-002/005/006/008/016 | MCFT-16 | longitudinal tick/decision/action/feedback/residual loop | one-shot script insufficient; shared runtime core |
| runtime read APIs | ADR-003/008/013/014/016; API Matrix | MCFT-17 | field-scoped read family, active/superseded lineage queries, trace | no generated-object writes; no parallel namespace |
| Operator integration | ADR-013/014; API/Legacy matrices | MCFT-18 | existing field runtime tabs consume real read models | route/tab existence is not runtime proof |

## 2. Closure ownership

| closure | architecture proof required |
|---|---|
| MCFT-GATE-A Replay-backed Closure | same domain/runtime/persistence semantics, explicit replay clock, no future leakage, deterministic 30-day replay, fenced restart/backfill, immutable revision, 72-point forecast and fixed scenarios |
| MCFT-GATE-B Shadow-online Closure | same core with online clock/ingress adapters, persistent scheduling, late/out-of-order handling, restart recovery, readback, no automatic action |
| MCFT-GATE-C Controlled-action Feedback Closure | same core with governed human decision/approval/AO-ACT/receipt/acceptance/action-feedback adapters |

## 3. DT-01 target=DT-02 resolution

| DT-01 component/ruling | DT-02 disposition |
|---|---|
| `append_only_fact_store` | ADR-003; canonical facts envelope retained |
| `evidence_reference_rules` | ADR-003/004/005; references remain typed and semantic layers stay separate |
| `stable_hash_patterns` | ADR-007; normalized semantic hash retained |
| `idempotency_patterns` | ADR-007; adapted to canonical object and record-set conflicts |
| `p50_trace_replay_pattern` | ADR-002/005/007; adapted into shared core and Replay adapter |
| `p31_contract_and_negative_boundaries` | ADR-004/016; reference only; synthetic belief not physical State |
| `p31_fact_write_pattern` | ADR-003/005; adapter pattern only, no P31 semantics promotion |
| `p49_freeze_packet` | ADR-016 and closure nonclaims; governance reference only |
| `explicit_replay_clock` | ADR-002 and Runtime Mode Matrix; adapter boundary |
| `evidence_partition` | ADR-002/005; frozen evidence window |
| `no_future_leakage` | ADR-002/005; retained invariant |
| `trace_packet_structure` | ADR-002/007/013; adapted to canonical trace/read APIs |
| `demo_namespace` | ADR-014; reference only, no new runtime mainline |
| `p57_freeze_runner` | ADR-016; reference-only claim boundary |
| `scenario_latest_index` | ADR-003/010; rebuildable projection only |
| `canonical_field_routes` | ADR-013; existing `/operator/fields/:fieldId/*` retained |
| `legacy_operator_twin_routes` | ADR-014; read compatibility and deletion prerequisites |

## 4. Implementation sequencing

```text
MCFT-00 scope
-> MCFT-01 replay evidence
-> MCFT-02 schemas
-> MCFT-03 persistence
-> MCFT-04 tick/recovery
-> MCFT-05 evidence window
-> MCFT-06 propagation
-> MCFT-07 assimilation
-> MCFT-08 posterior
-> MCFT-09 forecast
-> MCFT-10 scenario
-> MCFT-11 residual
-> MCFT-12 model governance
-> MCFT-13 decision
-> MCFT-14 action lifecycle
-> MCFT-15 feedback
-> MCFT-16 closed loop
-> MCFT-17 read APIs
-> MCFT-18 Operator integration
```

Parallel work is allowed only where it does not violate dependency order or create a second semantic implementation.
