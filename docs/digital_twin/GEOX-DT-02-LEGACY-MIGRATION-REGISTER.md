<!-- docs/digital_twin/GEOX-DT-02-LEGACY-MIGRATION-REGISTER.md -->
# GEOX DT-02 Legacy Migration Register

## 0. Authority

```text
phase: DT-02
status: FROZEN
baseline: 9a31f046d717def94db30e156384b35267b503d4
rule: retain compatibility reads, add no new runtime capability, create no dual canonical write
```

DT-02 deletes no route, projection, index, object, or frontend surface.

## 1. Migration rules

Every legacy item follows:

```text
current callers identified
replacement shipped
frontend/readers switched
runtime acceptance passed
compatibility window completed
explicit deletion task approved
```

Before all conditions are true:

- read compatibility remains available;
- no new MCFT capability is added;
- no generated MCFT object is written through the legacy path;
- no legacy object becomes a second canonical store;
- deprecation is registration only.

## 2. Register

| legacy item | evidence / known callers | classification | replacement | compatibility policy | deletion prerequisites | downstream owner |
|---|---|---|---|---|---|---|
| `/api/v1/operator/fields/:fieldId/evidence-twin` | `apps/server/src/routes/v1/operator_evidence_twin.ts`; field Evidence Twin clients and acceptance | LEGACY_READ_COMPATIBILITY | `/api/v1/operator/fields/:fieldId/runtime` and subresources | retain read-only; no decision, approval, plan, AO-ACT, receipt, acceptance, ROI, Field Memory, State, Forecast, or Scenario writes | caller inventory; runtime read API shipped; frontend switched; MCFT-17 acceptance; compatibility window; deletion approval | MCFT-17 |
| `/api/v1/operator/twin/*` | `apps/server/src/routes/v1/operator_twin.ts`; `apps/web/src/api/operatorTwin.ts`; `apps/web/src/api/operatorTwinClosure.ts`; existing governance/runtime/frontend acceptance | DEPRECATE_READ_ONLY | field-scoped Runtime read family | retain; no new MCFT capability; no new write; do not extend schemas | all API callers identified; replacement parity; frontend switched; acceptance; window; deletion approval | MCFT-17/18 |
| `/operator/twin/*` | frontend navigation/API clients and retained docs | LEGACY_FRONTEND_COMPATIBILITY | `/operator/fields/:fieldId/*` | keep existing navigation until callers switch; no new page family | route caller inventory; canonical field runtime UI complete; redirects/links switched; window; deletion approval | MCFT-18 |
| `/app/operator/*/evidence-twin` | retained frontend reset/productization contracts | LEGACY_FRONTEND_COMPATIBILITY | `/operator/fields/:fieldId/evidence` and canonical runtime tabs | retain only for compatibility; no new runtime behavior | current entrypoints identified; replacement deployed; UI acceptance; window; deletion approval | MCFT-18 |
| `water_state_estimate_v1` | `apps/server/src/projections/water_state_estimate_v1.ts`; existing Evidence Twin reads | LEGACY_DERIVED_READ | compatibility projection derived from `twin_state_estimate_v1` | not canonical MCFT State; new runtime does not generate it as primary State; optional labeled adapter only | canonical posterior implemented; compatibility projection proven; all direct callers switched or intentionally retained; deletion approval | MCFT-08/17 |
| `water_state_estimate_index_v1` | legacy latest-index readers | LEGACY_READ_INDEX | canonical State latest/history projections | mutable read compatibility only; never canonical history | replacement indexes built and rebuild tested; caller migration; window; deletion approval | MCFT-03/08/17 |
| `irrigation_scenario_set_v1` and legacy scenario indexes | existing scenario routes, projections, and Operator reads | LEGACY_SCENARIO_READ | `twin_scenario_set_v1` plus scenario set/point/latest projections | retain reads; no new schema expansion; no dual canonical Scenario write | MCFT-10 object and indexes implemented; MCFT-17 API parity; frontend switched; window; deletion approval | MCFT-10/17/18 |
| legacy scenario submission/recommendation bridge | current decision/recommendation paths and rejection acceptance | GOVERNED_COMPATIBILITY | `twin_scenario_set_v1` -> authenticated `twin_decision_record_v1` -> existing approval/action services | Scenario never directly creates Recommendation, Approval, Operation Plan, Task, or Dispatch; existing human governance retained | MCFT-13/14 complete; callers and policy paths mapped; acceptance; explicit deletion/adapter decision | MCFT-13/14 |
| P42/P43 acceptance-output ledgers | controlled runners and acceptance artifacts | REPLACE_PERSISTENCE | Postgres canonical facts and rebuildable projections | retained only as historical acceptance Evidence; never runtime persistence | corresponding MCFT persistence and runtime acceptance complete | MCFT-03/09/11 |
| P50 demo namespace and file output | replay-backed demo runner and docs | REFERENCE_ONLY / REPLACE_PERSISTENCE | shared Runtime core with Replay adapter and database persistence | preserve clock, partition, no-future-leakage, and trace patterns only; demo math/files are not canonical | Replay adapter and MCFT Gate A complete; no active caller depends on demo file output | MCFT-01/04/GATE-A |
| P49/P57 freeze packages | governance/freeze docs and runners | REFERENCE_ONLY | DT-02/MCFT claim boundaries and acceptance | remain historical governance Evidence; never runtime implementation | never deleted as audit Evidence unless separate archival policy | DT-02 / governance |

## 3. Compatibility projection rule

A compatibility adapter may transform:

```text
new canonical posterior / Scenario
        ↓
explicitly labeled derived legacy read shape
```

It may not:

```text
write a second canonical State or Scenario
hide lineage/revision identity
allow legacy client data to overwrite canonical objects
present compatibility data as a new runtime capability
```

Every compatibility response must remain traceable to canonical object and fact references.

## 4. Write prohibition

Legacy paths may not accept or create:

```text
posterior State
Forecast
Scenario result
Residual
Checkpoint
Model Activation
Runtime Tick
AO-ACT bypass
```

Existing separately governed human decision/action writes retain their own contracts and are not moved into Runtime read routes.

## 5. Deletion authority

DT-02 authorizes no deletion. A later deletion PR must cite this register, name every caller, show replacement and acceptance Evidence, state the compatibility-window end, and obtain explicit approval.
