# GEOX B-01 Semantic Ownership Audit V1

## 0. Status and authority

Status: **derived view**

Repository-level SSOT: `docs/SSOT.md`

Sprint / Tag / Freeze authority: `README_MIGRATION.md`

B-line working charter: `docs/architecture/semantic_convergence/GEOX-BLINE-CHARTER-V1.md`

Exact audit baseline:

```text
repository: liyongshang44-max/GEOX
protected branch: main
commit: 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
audit phase: B-01
```

This file is a derived code/document audit. It does not create repository-level authority, does not change any frozen contract, and does not claim that proposed target owners are implemented. When this audit conflicts with code, migrations, `docs/SSOT.md`, `README_MIGRATION.md`, or a recognized frozen domain contract, the higher authority wins.

No runtime, schema, workflow, provider, Formal, ADR, LLM, MCFT, approval, or execution mutation is part of B-01.

---

## 1. Executive conclusion

The repository already contains most of the components needed for the eventual GEOX decision spine, but those components were created in several historical product lines and do not yet form one semantic ownership hierarchy.

The strongest current architectural boundaries are already correct:

```text
Reality != Evidence
Evidence != State
Sensor Reading != Root-zone State
Forecast != Scenario
Scenario != Recommendation
Decision != Approval
Approval != Dispatch
Dispatch != Execution
Executed != Validated
Outcome Evidence != Effect Attribution
```

Those distinctions are frozen in the Digital Twin master line and must be retained.

The principal B-01 finding is different:

> several semantic concepts still have multiple active or callable producers that independently derive the same kind of conclusion from different input layers.

The highest-risk overlaps are:

```text
Evidence qualification
Crop-stage authority
Field/water-state authority
Irrigation-need / recommendation logic
Recommendation / candidate / plan object semantics
```

The most concrete active overlap is `apps/server/src/jobs/agronomy_agent.ts`: the commercial jobs runtime can enable it, it reads the latest `telemetry_index_v1` soil-moisture value plus `field_program_v1`, can substitute a default soil-moisture value when telemetry is missing, generates recommendation facts, and directly creates an `operation_plan_v1`. This path is separate from the frozen Stage-1 formal recommendation trigger path and separate from the MCFT State/Forecast/Scenario chain.

This is **not** evidence of a direct execution bypass: the repository still separately protects approved-task execution. It is, however, evidence of a parallel decision/plan-producing path that must be classified before MCFT/ADR/LLM integration.

B-01 therefore concludes:

```text
The repository does not need a new central brain now.
It needs an explicit semantic ownership register before any new brain is connected.
```

---

## 2. Audit method

B-01 uses four evidence classes.

### 2.1 Repository governance

Primary anchors:

```text
docs/SSOT.md
README_MIGRATION.md
```

These establish repository-level authority layering and freeze-index rules.

### 2.2 Current implemented/frozen product boundaries

Primary anchors include:

```text
docs/STAGE1_RECOMMENDATION_TRIGGER_BOUNDARY.md
docs/STAGE1_SENSING_TO_APPROVAL_EXECUTION_CHAIN.md
docs/audit/CONTRACT_ALIGNMENT_MATRIX_V1.md
docs/controlplane/GEOX-CP-Agronomy-Interpretation-Contract-v1.md
docs/controlplane/GEOX-CP-Decision-Plan-Contract-v0.md
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md
docs/digital_twin/GEOX-DT-01-EXISTING-CAPABILITY-RECONCILIATION.md
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json
```

### 2.3 Current code paths

Primary anchors include:

```text
apps/server/src/jobs/runtime.ts
apps/server/src/jobs/agronomy_agent.ts
apps/server/src/domain/agronomy/context_builder.ts
apps/server/src/domain/agronomy/stage_resolver.ts
apps/server/src/domain/agronomy/rule_engine.ts
apps/server/src/domain/agronomy/engine.ts
apps/server/src/domain/judge/evidence_judge_v2.ts
apps/server/src/domain/judge/agronomy_judge_v2.ts
apps/server/src/domain/decision/stage1_action_boundary_v1.ts
apps/server/src/routes/decision_engine_v1.ts
apps/server/src/domain/skill_registry/agronomy_rule_registry.ts
docker-compose.commercial_v1.yml
```

### 2.4 Current MCFT integration frontier

Open MCFT-CAP-09 production-hosting work is treated only as an integration frontier/reference because it is not merged into this exact protected-main baseline. B-01 does not make branch-local CAP-09 work authoritative for protected main.

The audit nevertheless preserves the direction already being developed there: production Evidence supply and Twin runtime progression are separate operational roles and should not be collapsed by B-line.

---

## 3. Current repository semantic topology

The exact-main repository contains at least these distinct semantic lines:

```text
A. Apple / Control lineage
   Evidence -> Judge / ProblemState -> Control / AO-SENSE / AO-ACT boundaries

B. Stage-1 product lineage
   sensing summary -> formal trigger -> recommendation -> approval -> plan/task -> receipt -> acceptance

C. Agronomy runtime lineage
   field program + telemetry -> agronomy context -> crop/rule skills -> recommendation

D. Judge-v2 agronomy lineage
   Evidence Judge -> Agronomy Judge -> irrigation deficit/requirement calculations

E. Digital Twin / MCFT lineage
   governed Evidence -> State -> Forecast -> Scenario -> feedback/residual/calibration

F. Execution and acceptance lineage
   approval -> operation plan -> approved task -> execution -> receipt -> acceptance -> outcome/ROI
```

Lines A-F are not all incorrect duplicates. Some are intentionally separate layers. The convergence problem appears where two lines claim or derive the same semantic conclusion without an explicit authority relationship.

---

## 4. First-pass semantic ownership matrix

Legend:

```text
KEEP_AUTHORITY      = boundary appears structurally correct and should remain authoritative
CONVERGE_AUTHORITY  = more than one path currently owns/recomputes the semantic
ADAPT               = useful object/algorithm should map into future canonical vocabulary
PROJECTION_ONLY     = may display/materialize canonical truth but should not own it
CALCULATOR_ONLY     = deterministic computation is reusable but should not own final decision truth
COMPATIBILITY_ONLY  = historical path may remain but should lose future authority
DEPRECATE_CANDIDATE = path appears redundant/legacy; deletion requires later evidence
OUT_OF_SCOPE        = B-line does not own the semantic
```

| Semantic family | Current producers / owners observed | Current assessment | Provisional future owner | B-01 classification |
| --- | --- | --- | --- | --- |
| Raw telemetry / raw observation | telemetry ingest, raw-sample/fact paths, provider-specific paths | multiple ingestion mechanisms are expected; raw data itself is not decision truth | Evidence ingestion plane | KEEP/ADAPT |
| Provenance / source identity | facts/evidence refs, provider/MCFT contracts, sensing | partially distributed but structurally compatible | Evidence Authority | CONVERGE_AUTHORITY |
| Freshness / quality / device health | Stage-1 gate, Evidence Judge v2, Apple-II evidence semantics, MCFT availability semantics | same broad question is evaluated in several systems | Evidence Authority | CONVERGE_AUTHORITY |
| Time coverage / sample continuity | Stage-1 gate, Apple-II contracts, MCFT windows | duplicate eligibility semantics with different levels of rigor | Evidence Authority | CONVERGE_AUTHORITY |
| Conflict detection | Stage-1 summary/gate and other evidence governance | not yet one canonical decision input | Evidence Authority | CONVERGE_AUTHORITY |
| Tenant/project/group/field/season identity | field/program/control/twin scope contracts | broadly consistent identity dimensions, but consumers resolve context independently | Context Authority + existing scope/authz | ADAPT |
| Zone / spatial applicability | sensing/twin/MCFT and product field objects | must not be recomputed independently by recommendation path | Context/Evidence spatial authority | CONVERGE_AUTHORITY |
| Crop identity / variety / planting context | `field_program_v1`, request payloads, MCFT reality binding | multiple sources can be consumed directly | Context Authority | CONVERGE_AUTHORITY |
| Crop stage / phenology | field-program crop_stage, `stage_resolver`, crop skills/rule engine, MCFT stage authority | clear duplicate semantic ownership | Context/Twin-qualified stage | CONVERGE_AUTHORITY |
| Derived sensing state | `derived_sensing_state_v1`, sensing overview, legacy state objects | useful support/read models but not future canonical physical State | projection/support only | PROJECTION_ONLY |
| Root-zone physical State | legacy water/root-zone builders and MCFT canonical posterior State | DT-01 already says older aggregate paths are not canonical MCFT posterior | Twin Runtime | CONVERGE_AUTHORITY |
| External weather forecast | weather provider/read model | exogenous forcing/evidence, not the same semantic as field Twin Forecast | Evidence/forcing plane | KEEP_AUTHORITY |
| Field/Twin Forecast | root-zone forecast builders, MCFT forecast | must converge on MCFT canonical field forecast | Twin Runtime | CONVERGE_AUTHORITY |
| Scenario | root-zone scenario builder, MCFT scenario | semantic boundary is already clear: scenario is not recommendation | Twin Runtime scenario engine | ADAPT/KEEP |
| Agronomy Interpretation | `agronomy_interpretation_v1` | frozen explain-only semantics are sound | Interpretation layer | KEEP_AUTHORITY |
| Agronomy rule/skill computation | rule engine, irrigation deficit/requirement skills, crop skills | useful deterministic calculations but some currently emit recommendation semantics | Decision calculators | CALCULATOR_ONLY/ADAPT |
| Evidence Judge result | `evidence_judge_v2` | useful local QC/freshness facade, overlaps broader evidence eligibility | Evidence Authority facade | ADAPT/COMPATIBILITY_ONLY |
| Agronomy Judge result | `agronomy_judge_v2` | currently calculates irrigation requirement and emits WATER_DEFICIT/PASS/BLOCKED | future decision calculator + qualification consumer | CONVERGE_AUTHORITY |
| Recommendation | Stage-1 recommendation route, agronomy engine/agent, decision engine | multiple recommendation producers with different provenance rules | CandidateDecision | CONVERGE_AUTHORITY |
| `decision_plan_v0` | Control-plane decision/plan contract | semantically well-separated candidate for execution | CandidateDecision compatibility view | ADAPT |
| Prescription | commercial irrigation chain | action specification exists between recommendation and approval/task | action-spec compatibility layer | ADAPT |
| Qualification | Stage-1 eligibility, evidence/agronomy judge gates, control/policy checks, MCFT availability | no single general production qualification owner | Qualification Runtime | CONVERGE_AUTHORITY |
| Approval request / decision | approval services/routes | explicit human/policy boundary is structurally correct | Approval Authority | KEEP_AUTHORITY |
| Operation plan | formal recommendation/approval chain plus agronomy-agent direct producer | plan meaning is not produced by one path | ApprovedOperationPlan semantics | CONVERGE_AUTHORITY |
| AO-ACT task | approved-task execution path | explicit execution object | AO-ACT | KEEP_AUTHORITY |
| Dispatch / executor | executor runtime | separate from task creation | execution runtime | KEEP_AUTHORITY |
| Receipt | AO-ACT receipt, as-executed/as-applied | execution evidence is distinct from validation | Receipt authority | KEEP_AUTHORITY |
| Acceptance | acceptance runtime/verdict | backend-owned validation boundary is structurally correct | Acceptance | KEEP_AUTHORITY |
| Outcome evidence / effect attribution | outcome/effect modules | must remain later than acceptance and distinct from ROI | Outcome / effect layers | KEEP/ADAPT |
| ROI / Field Memory | existing server/database modules | should consume accepted/qualified downstream evidence, not become upstream decision truth | ROI / Memory | KEEP_AUTHORITY |
| Customer/operator presentation | report APIs/read models/UI | should project authoritative objects, never reconstruct truth | presentation/read model | PROJECTION_ONLY |

This matrix is human-readable B-01 output only. B-02 must convert the scoped semantics into a machine-readable register with exact source paths and allowed/forbidden edges.

---

## 5. Critical finding B01-F01 — active Agronomy Agent is a parallel recommendation/plan producer

Severity: **CRITICAL for convergence; not a proven execution bypass**

### Evidence

`docker-compose.commercial_v1.yml` enables the jobs service with:

```text
AGRONOMY_AGENT_ENABLED: "1"
```

`apps/server/src/jobs/runtime.ts` executes `runAgronomyAgentOnce(pool)` whenever that flag is enabled.

`apps/server/src/jobs/agronomy_agent.ts` then:

1. reads the latest `soil_moisture` from `telemetry_index_v1` joined through `device_binding_index_v1`;
2. reads `field_program_v1` for crop code, crop stage, and days after planting;
3. builds an AgronomyContext;
4. generates an agronomy recommendation;
5. writes `recommendation_v1`;
6. writes `decision_recommendation_v1`;
7. directly writes `operation_plan_v1` and `operation_plan_transition_v1` with trigger `agronomy_agent_auto_create`.

This is materially different from the frozen Stage-1 formal recommendation path, where the formal recommendation trigger must originate from `stage1_sensing_summary` and only the frozen formal trigger fields may establish formal trigger eligibility.

### Additional risk: missing telemetry fallback

The agent contains:

```text
DEFAULT_SOIL_MOISTURE = 30
```

When telemetry is missing, it increments/logs the no-telemetry counter but then computes:

```text
effectiveSoilMoisture = actual soil moisture if finite, else DEFAULT_SOIL_MOISTURE
```

and continues the candidate loop unless another condition blocks it.

This means the path is capable of converting a missing observation into a numeric agronomy input. B-01 does not claim that every such run produces a recommendation; rule matching still applies. The architectural issue is that missing evidence can become a fabricated numeric input before candidate generation.

### Adjudication

Do not delete the agent in B-01.

Classify it as:

```text
current: ACTIVE COMPATIBILITY / PARALLEL DECISION PRODUCER
future: COMPATIBILITY_ONLY or adapter to CandidateDecision
future direct operation-plan authority: remove
```

B-02 must register this path explicitly so new code cannot treat it as the future canonical decision spine.

---

## 6. Critical finding B01-F02 — crop-stage semantics have multiple independent derivation rules

Severity: **CRITICAL**

### Evidence path A: context builder

`apps/server/src/domain/agronomy/context_builder.ts` calls `resolveCropStage` with:

```text
explicitStage
daysAfterPlanting
startDate
```

### Evidence path B: stage resolver

`apps/server/src/domain/agronomy/stage_resolver.ts` resolves stage by priority:

```text
valid explicit stage
else daysAfterPlanting
else startDate -> Date.now()-based days
else "unknown"
```

### Evidence path C: rule engine

`apps/server/src/domain/agronomy/rule_engine.ts` performs another stage normalization/resolution path using crop skills.

Its `normalizeSkillStage` maps any value outside its recognized skill-stage set to `seedling`. Its rule-input normalization can therefore turn an unrecognized/unknown stage into a concrete `seedling` value, and other paths also default to `seedling` when no resolved stage is available.

### Evidence path D: MCFT

MCFT has separately frozen crop/stage authority and state progression semantics, including explicit provenance, scope, no-future-leakage and uncertainty constraints. MCFT work has already shown that management activity, planting date, and biological stage are not interchangeable authorities.

### Adjudication

No future canonical recommendation/qualification path may independently derive crop stage from raw `field_program` fields or a wall-clock default once the context/twin authority seam exists.

B-01 target:

```text
field_program crop stage      -> ContextAssertion / compatibility
stage_resolver                -> candidate/calculator helper
crop skill resolver           -> candidate/calculator helper
MCFT-qualified stage/state    -> future authoritative decision input
```

Until that integration exists, no B-01 runtime change is authorized.

---

## 7. Critical finding B01-F03 — evidence eligibility has several overlapping owners

Severity: **CRITICAL**

### Stage-1 formal gate

`apps/server/src/domain/decision/stage1_action_boundary_v1.ts` evaluates a broad evidence gate including:

```text
evidence sufficiency
time coverage
formal sample count
coverage ratio
max gap
formal source eligibility
metric evidence
freshness
device health
conflict status
simulation/dev markers
```

and returns:

```text
ELIGIBLE
NOT_ELIGIBLE
NEEDS_EVIDENCE
```

### Evidence Judge v2

`apps/server/src/domain/judge/evidence_judge_v2.ts` separately evaluates:

```text
soil moisture quality
device/observation freshness
heartbeat age
```

and emits verdicts such as:

```text
PASS
DEVICE_OFFLINE
SENSOR_DRIFT
STALE_DATA
INSUFFICIENT_EVIDENCE
```

### Apple-II / report alignment layer

`docs/audit/CONTRACT_ALIGNMENT_MATRIX_V1.md` explicitly recognizes evidence quality as a separate concept from observable facts and business-node validity, and notes that time coverage, QC, device health, conflict detection, and evidence sufficiency must not be reconstructed ad hoc in report/business layers.

### MCFT

MCFT introduces a more explicit causal/as-of evidence model for State progression: evidence windows, no-future-leakage, availability, observation selection, scope, lineage and revision semantics.

### Adjudication

These do not all need to disappear. They need one authority relationship.

Provisional B-line direction:

```text
canonical governed evidence + qualification
        |
        +-> Stage-1 projection / compatibility gate
        +-> Evidence Judge facade / local diagnostic
        +-> report/read models
        +-> Decision Qualification inputs
```

Stage-1 and Evidence Judge may remain useful interfaces, but they should not independently establish conflicting production truth after convergence.

---

## 8. Critical finding B01-F04 — physical/water state has historical and MCFT implementations

Severity: **HIGH**

`docs/digital_twin/GEOX-DT-01-EXISTING-CAPABILITY-RECONCILIATION.md` already adjudicates this problem.

It records that the repository had substantial state/read-model infrastructure but did not yet have a persistent continuously advancing Minimum Complete Field Twin at the DT-01 baseline.

It specifically classifies the historical `water_state_estimate_v1` path as not being a canonical MCFT posterior State, and it classifies root-zone state builders as useful for selected deterministic calculations while requiring replacement/adaptation for canonical State because the older aggregate lacks prior/propagation/observation-update/posterior-uncertainty/revision semantics.

This is a strong prior architecture decision and B-line must not reopen it.

### Adjudication

Provisional future ownership:

```text
canonical physical field State -> Twin Runtime
legacy derived sensing states   -> support/projection
legacy water state estimate     -> compatibility/deprecation candidate
root-zone pure calculations     -> reusable calculator components where already adjudicated
```

B-line should prepare consumers to stop recomputing physical state outside the Twin authority; B-line must not rewrite the Twin semantics.

---

## 9. Critical finding B01-F05 — irrigation need is computed in multiple layers

Severity: **CRITICAL**

At least three materially different paths can currently contribute an irrigation-like conclusion.

### Path 1: Agronomy Rule Engine

`apps/server/src/domain/agronomy/engine.ts` calls `evaluateRules()` and `pickBestRule()`.

`apps/server/src/domain/agronomy/rule_engine.ts` normalizes crop/stage/telemetry, selects enabled crop-specific rule skills, matches the first applicable rule, and maps it into an `AgronomyRecommendationV2` including action type, reasons, confidence, expected effect and skill trace.

### Path 2: Agronomy Judge v2

`apps/server/src/domain/judge/agronomy_judge_v2.ts` directly reads:

```text
soil moisture
target soil moisture
root-zone depth
72h rain forecast
72h ET0
crop stage
application efficiency
```

and runs:

```text
irrigation_deficit_skill_v1
irrigation_requirement_skill_v1
```

It can return `WATER_DEFICIT`, `PASS`, or `BLOCKED`, and includes net/gross irrigation requirement in outputs.

### Path 3: MCFT State / Forecast / Scenario

The MCFT semantic line separately produces canonical State, a 72-hour field forecast, and fixed irrigation scenarios. The master line explicitly freezes `Scenario != Recommendation`.

### Adjudication

The useful deterministic irrigation calculations should be retained, but future final authority must be separated:

```text
Twin State / Forecast / Scenario     -> physical future state authority
ADR claim/policy applicability       -> knowledge/policy authority
irrigation requirement skill         -> deterministic calculator
LLM/rule system                       -> candidate producer
Qualification Runtime                -> production eligibility
Human/policy                          -> approval
```

No single calculator should own all of these roles.

---

## 10. Critical finding B01-F06 — recommendation semantics have more than one producer

Severity: **HIGH**

The Stage-1 route freezes one formal trigger path:

```text
stage1_sensing_summary
-> formal trigger eligibility
-> recommendation generate
```

with only `irrigation_effectiveness` and `leak_risk` as formal trigger fields and several explicit support-only/forbidden fields.

The Agronomy Agent, however, can independently write recommendation facts after reading latest telemetry and a field program.

The main decision route also contains significant agronomy/sensing/forecast/memory composition and produces recommendation objects.

### Adjudication

A future `CandidateDecision` contract should become the common semantic object at this layer.

Historical recommendation objects may remain, but each producer must declare:

```text
source semantic layer
input refs
reason/calculator refs
whether its inputs are formally qualified
whether it is formal or compatibility-only
execution authority = none
```

B-01 does not define the final schema; B-03/B-05 do.

---

## 11. Critical finding B01-F07 — plan-like objects have layered but partially overlapping meanings

Severity: **HIGH**

Current objects include:

```text
decision_plan_v0
recommendation_v1
prescription
approval_request
operation_plan_v1
AO-ACT task
```

This does not mean all are duplicates.

The existing `decision_plan_v0` contract is architecturally strong: it is explicitly a candidate for execution and cannot directly create an AO-ACT task.

The Stage-1 execution-chain document is also strong: recommendation, approval request and operation plan cannot be executed directly; execution receives an approved task.

The overlap is at the candidate/plan layer, especially because the Agronomy Agent can directly create `operation_plan_v1` alongside recommendation facts.

### Adjudication

B-line must define a semantic lattice without prematurely renaming/deleting persisted objects:

```text
Interpretation
-> CandidateDecision
-> QualificationDecision
-> ApprovalRequest
-> ApprovedOperationPlan
-> ExecutableTask
-> Receipt
-> Acceptance
```

`prescription` can remain an action-specification compatibility object if its exact authority is explicitly registered.

`operation_plan_v1` must eventually have one authoritative formation rule; compatibility plans must be distinguishable from approved plans.

---

## 12. Critical finding B01-F08 — `decision_engine_v1.ts` is a composition hotspot

Severity: **HIGH future-risk**

`apps/server/src/routes/decision_engine_v1.ts` imports or coordinates responsibilities across:

```text
fertility precheck
crop-stage resolution
recommendation main-chain validation
rule performance
hard-rule hints
irrigation diagnosis
irrigation recommendation
AO-ACT receipt/task checks
irrigation skills
weather forecast
Stage-1 action boundary
field read models
derived sensing states
Field Memory
recommendation memory adjustment
skill trace
control-plane action mapping
```

This breadth is understandable historically, but it makes the file a dangerous future landing zone for ADR and LLM integration.

### Adjudication

B-line must explicitly prohibit:

```text
ADR implementation -> directly embedded into decision_engine_v1.ts
LLM provider/agent -> directly embedded into decision_engine_v1.ts
MCFT runtime calls -> directly embedded as another ad-hoc branch in decision_engine_v1.ts
```

Future integration should happen through typed semantic ports after B-03/B-07, not by adding more authority to this route.

---

## 13. Boundaries that are already good and should be preserved

B-01 does not treat every separation as debt.

### 13.1 Interpretation vs decision

`GEOX-CP-Agronomy-Interpretation-Contract-v1.md` explicitly freezes Agronomy Interpretation as explain-only, not decision/control/prescription, and prohibits Judge from reading it into deterministic ProblemState semantics.

Disposition: **KEEP**.

### 13.2 Decision Plan vs execution

`GEOX-CP-Decision-Plan-Contract-v0.md` explicitly freezes `decision_plan_v0` as a candidate for execution whose conversion to task belongs to explicit external decision authority.

Disposition: **KEEP boundary; ADAPT vocabulary later**.

### 13.3 Recommendation/approval/plan vs approved task

`STAGE1_SENSING_TO_APPROVAL_EXECUTION_CHAIN.md` explicitly states that recommendation, approval request and operation plan cannot directly execute; execution enters through approved task/executor paths.

Disposition: **KEEP**.

### 13.4 Receipt vs acceptance

The contract-alignment matrix and existing execution chain preserve receipt as execution evidence rather than acceptance truth.

Disposition: **KEEP**.

### 13.5 Twin Scenario vs Recommendation

The Digital Twin master line freezes this distinction.

Disposition: **KEEP**.

### 13.6 Replay vs online semantic core

The Digital Twin architecture freezes one semantic core across replay/shadow/controlled/production modes with adapter differences only.

Disposition: **KEEP**.

### 13.7 Evidence Runtime vs Twin Runtime

The current CAP-09 production-hosting direction separates live provider acquisition/governed ingress from Twin State progression. B-line must not collapse these concerns into one process or one authority role.

Disposition: **KEEP integration constraint**.

---

## 14. Component-level first classification

This table is a B-01 planning classification, not a deletion authorization.

| Component / family | B-01 classification | Rationale |
| --- | --- | --- |
| `stage1_sensing_summary` | ADAPT / PROJECTION | useful formal product surface; should eventually project canonical evidence qualification rather than own an independent truth universe |
| `stage1_action_boundary_v1` | ADAPT / COMPATIBILITY gate | strong explicit formal-trigger boundary; evidence qualification sublogic should converge behind a shared evidence authority |
| `evidence_judge_v2` | ADAPT / COMPATIBILITY facade | useful local QC/freshness result; overlaps broader evidence eligibility |
| Apple-II evidence sufficiency/time coverage semantics | KEEP concepts / converge implementation ownership | correct conceptual layer; exact implementation relationship with Stage-1/MCFT requires B-02/B-03 registration |
| `derived_sensing_state_v1` | PROJECTION_ONLY | support/read state; must not become canonical Twin State |
| historical `water_state_estimate_v1` | DEPRECATE_CANDIDATE for canonical-state use | DT-01 already says it is not canonical MCFT posterior State |
| root-zone pure builders | ADAPT / CALCULATOR | DT-01 already identifies reusable deterministic pieces |
| MCFT canonical State/Forecast/Scenario | future KEEP_AUTHORITY | B-line does not modify; real adapter connected later |
| `context_builder.ts` | ADAPT | useful aggregation but currently resolves stage internally |
| `stage_resolver.ts` | CALCULATOR_ONLY | may derive candidate stage; must not own future qualified stage truth |
| crop skills stage resolver | CALCULATOR_ONLY | same reason |
| Agronomy Rule Engine | CALCULATOR/CANDIDATE producer | deterministic logic reusable; final production eligibility must live elsewhere |
| `agronomy_judge_v2` | CONVERGE | currently mixes evidence gate consumption and irrigation requirement conclusion |
| `agronomy_agent.ts` | COMPATIBILITY_ONLY target | currently active parallel candidate/plan producer; must lose future canonical authority before MCFT/ADR/LLM integration |
| legacy agronomy skill registry guarded by `LEGACY_AGRONOMY_SKILLS_DISABLED` | DEPRECATE_CANDIDATE / compatibility | already explicitly legacy-gated; B-02 should inventory callers before any deletion |
| Agronomy Interpretation | KEEP_AUTHORITY in explain-only layer | frozen boundary is useful |
| `recommendation_v1` | ADAPT | map to future CandidateDecision semantics |
| `decision_plan_v0` | ADAPT | preserve non-executable candidate semantics |
| prescription | ADAPT | preserve action specification where needed; register exact authority |
| approval request/decision | KEEP_AUTHORITY | explicit decision authority boundary |
| `operation_plan_v1` | CONVERGE formation semantics | multiple formation paths require classification |
| AO-ACT task | KEEP_AUTHORITY | explicit executable task object |
| executor | KEEP_AUTHORITY | execution runtime |
| receipt/as-executed/as-applied | KEEP_AUTHORITY | execution evidence |
| acceptance | KEEP_AUTHORITY | validation boundary |
| outcome/effect | KEEP/ADAPT | preserve post-acceptance semantics |
| ROI/Field Memory | KEEP/ADAPT | downstream only; no automatic-learning authority currently assumed |
| reports/UI | PROJECTION_ONLY | must not reconstruct semantic truth |
| `decision_engine_v1.ts` | composition refactor candidate | avoid adding ADR/LLM/MCFT authority directly here |

---

## 15. Provisional target semantic spine

This is a B-line proposal, not implemented authority.

```text
External reality / customer assertions / source systems
                    |
                    v
              Evidence Authority
       provenance / time / scope / quality
                    |
                    +-----------------------------+
                    |                             |
                    v                             v
             Context Authority              Twin Runtime
      field/season/crop/goal/policy     State/Forecast/Scenario
                    |                             |
                    +-------------+---------------+
                                  |
                                  v
                        Decision Calculators
                  deterministic agronomy operations
                                  |
                       ADR claims | LLM reasoning
                         (later)  |  (later)
                                  v
                         CandidateDecision
                                  |
                                  v
                       QualificationDecision
                                  |
                                  v
                         Approval Authority
                                  |
                                  v
                      ApprovedOperationPlan
                                  |
                                  v
                           AO-ACT Task
                                  |
                                  v
                              Receipt
                                  |
                                  v
                            Acceptance
                                  |
                                  v
                         DecisionEpisode
```

The principal ownership rule is:

> a downstream layer may consume an authoritative object; it may not silently recreate a stronger upstream truth from raw inputs.

Examples:

```text
Recommendation may consume qualified State; it may not recreate canonical State from latest telemetry.
LLM may consume published claims; it may not publish its own scientific authority.
Qualification may consume evidence status; it may not call a provider to manufacture missing evidence.
UI may display acceptance; it may not infer acceptance from receipt status.
```

---

## 16. B-01 answers to the charter questions

### Q1. Which modules currently decide whether evidence is sufficient?

At minimum:

```text
Stage-1 evidence/trigger gate
Evidence Judge v2
Apple-II evidence sufficiency/time-coverage concepts
MCFT evidence-window/availability/causal qualification semantics
```

Result: **duplicate/overlapping authority requires convergence**.

### Q2. Which modules currently derive/default crop stage?

At minimum:

```text
field_program crop_stage input
context_builder -> stage_resolver
rule_engine / crop skill resolution
MCFT crop/stage authority
```

Result: **duplicate authority; rule-engine fallback behavior is incompatible with a strict unknown-preserving future authority path**.

### Q3. Which modules currently create a physical/derived field state?

At minimum:

```text
derived sensing states
historical water/root-zone state builders
MCFT canonical State
```

Result: **MCFT should own future canonical physical State; older states become projections/calculators/compatibility**.

### Q4. Which modules currently calculate irrigation need or recommended amount?

At minimum:

```text
Agronomy Rule Engine / irrigation skill path
Agronomy Judge v2 irrigation requirement path
MCFT Scenario/Forecast physical projections
other irrigation diagnosis/recommendation composition in decision_engine_v1.ts
```

Result: **calculation and decision authority are mixed; deterministic calculation should be separated from candidate and qualification authority**.

### Q5. Which modules currently create recommendation-like facts?

At minimum:

```text
Stage-1 recommendation generation
Agronomy engine / Agronomy Agent
decision_engine_v1 route family
```

Result: **multiple candidate producers; future common CandidateDecision semantics required**.

### Q6. Which modules currently create plan-like facts?

At minimum:

```text
decision_plan_v0 path
prescription path
formal approval/operation-plan path
Agronomy Agent direct operation_plan_v1 path
```

Result: **object lattice requires explicit authority classification**.

### Q7. Which paths can reach approval and execution?

The protected formal boundary is strongest at:

```text
recommendation -> submit approval -> approval request / operation plan -> approved task -> execution -> receipt -> acceptance
```

Execution does not accept recommendation/approval-request/operation-plan as direct execution authority.

Result: **execution boundary is generally good and should be preserved**.

### Q8. Which current paths are formal, compatibility, legacy, read-only, or acceptance-only?

B-01 identifies the categories but does not yet provide a machine-complete registry. B-02 must bind exact paths and authority classes.

Known examples:

```text
Stage-1 formal trigger path          formal
Agronomy Agent                       active parallel/compatibility candidate
legacy agronomy rule registry        explicitly legacy-gated
Operator/report projections          read/presentation
MCFT acceptance/replay scripts        qualification/replay where so documented
```

### Q9. Which duplicates are safe projections vs dangerous semantic owners?

Generally safe:

```text
read models
UI projections
audit views
explain-only Agronomy Interpretation
scenario as scenario
receipt as execution evidence
```

High-risk duplicates:

```text
crop stage derivation
evidence eligibility
canonical physical state
irrigation need/recommendation
operation-plan formation
```

### Q10. Which boundaries should not be changed?

Preserve:

```text
Interpretation != Decision
Scenario != Recommendation
Candidate != Approval
Approval != Execution
Task != Receipt
Receipt != Acceptance
Outcome Evidence != ROI
Evidence Runtime != Twin Runtime
Replay/Shadow/Controlled/Production share one Twin semantic core
```

---

## 17. B-01 non-effects

B-01 explicitly does not:

```text
disable AGRONOMY_AGENT_ENABLED
change agronomy_agent runtime behavior
change DEFAULT_SOIL_MOISTURE
change Stage-1 formal trigger fields
change Evidence Judge verdict semantics
change crop-stage resolver behavior
change recommendation schemas
change prescription schemas
change operation-plan schemas
change approval/task/receipt/acceptance behavior
change MCFT State/Forecast/Scenario contracts
change provider/evidence-runtime implementation
create ADR claims
connect an LLM
create Qualification Runtime
create Decision Episode runtime
```

Those are later governed tasks after B-01 establishes ownership inventory and boundaries.

---

## 18. B-02 mandatory inputs produced by B-01

B-02 must create a machine-readable register with at least these fields per semantic owner entry:

```text
semantic_id
semantic_name
authority_class
status
current_owner_path
producer_entrypoint
input_semantics
output_object_types
allowed_consumers
forbidden_consumers
forbidden_input_classes
compatibility_role
proposed_target_owner
migration_classification
authority_source_refs
acceptance_refs
notes
```

B-02 scanner must fail closed for at least:

```text
unregistered new canonical semantic owner
new raw-telemetry -> recommendation bypass
new raw-telemetry -> canonical-state bypass
new interpretation -> task bypass
new scenario -> task bypass
new candidate -> task bypass
new LLM/ADR/MCFT integration path before registered port ownership
```

The scanner must not treat a filename regex alone as proof of semantic ownership. Registration must be explicit.

---

## 19. B-01 exit assessment

B-01 exit status: **READY FOR B-02, subject to review of this derived audit**.

The exact-main audit has established enough evidence to proceed without changing runtime:

```text
[PASS] repository-level authority source identified
[PASS] exact protected-main baseline fixed
[PASS] principal current semantic lines mapped
[PASS] critical duplicate-authority families identified
[PASS] Agronomy Agent active parallel path identified
[PASS] crop-stage duplicate derivation identified
[PASS] evidence-qualification overlap identified
[PASS] State ownership conflict already reconciled by DT-01 direction
[PASS] irrigation decision duplication identified
[PASS] candidate/plan object overlap identified
[PASS] existing safe execution boundaries identified
[PASS] MCFT/ADR/LLM no-touch boundary defined
[PASS] B-02 registry/scanner input requirements defined
```

B-01 intentionally stops here.

The next B-line task is not a runtime refactor. It is:

> **B-02 — create the machine-readable Semantic Ownership Register and CI/static scanner so the repository can no longer add an unregistered parallel semantic owner silently.**
