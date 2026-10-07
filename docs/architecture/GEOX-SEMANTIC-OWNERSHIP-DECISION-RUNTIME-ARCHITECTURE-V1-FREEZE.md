# GEOX Semantic Ownership & Decision Runtime Architecture V1 — Freeze

Status: ARCHITECTURE FREEZE CANDIDATE  
Date: 2026-08-27  
Repository basis: protected `main` = `26c1383f7f45abb76c99e28ec3d06714e85d1b2c`  
Change class: docs-only architecture governance  
Runtime mutation: NONE  
Schema mutation: NONE  
Database mutation: NONE  
Workflow mutation: NONE  
Provider mutation: NONE  
Scheduler mutation: NONE  
MCFT Formal mutation: NONE  

This document freezes the target semantic ownership model for GEOX. It does not activate or rewire runtime paths by itself. Repository-level authority begins only after this document is merged into protected `main` through the normal review path.

---

## 0. Purpose

GEOX has accumulated several historically valid but partially overlapping semantic chains:

- Apple I / II / III Evidence → Judge → Control → AO-ACT;
- Stage-1 Sensing → Summary → Recommendation → Prescription → Approval → Task → Receipt → Acceptance;
- Agronomy telemetry/context → rules/skills/Judge → recommendation;
- MCFT governed Evidence → State → Forecast → Scenario → feedback/residual;
- CAP-09 production hosting Provider → Evidence Runtime → governed Evidence → Twin Runtime.

The architecture problem is not that parallel planes exist. Some separation is intentional and mandatory. The architecture problem is that multiple modules can currently claim ownership over the same semantic question.

This freeze therefore establishes one governing rule:

> **Preserve necessary plane separation; eliminate duplicate semantic authority.**

Once a semantic has a canonical owner, downstream modules may consume, interpret, project, or package it, but must not silently recompute a competing authoritative version.

---

## 1. Frozen invariants

The following invariants are normative for future convergence work:

```text
Reality ≠ Evidence
Evidence ≠ State
State ≠ Forecast
Forecast ≠ Scenario
Scenario ≠ Recommendation
Recommendation ≠ Decision Eligibility
Decision Eligibility ≠ Approval
Approval ≠ Execution
Execution ≠ Receipt
Receipt ≠ Acceptance
```

Additional frozen invariants:

1. Raw evidence is append-only. Bad, stale, contradictory, or physically impossible observations are not deleted merely because they lose decision authority.
2. Evidence invalidity removes or narrows authority; it does not rewrite history.
3. Device/transport health is not the same semantic as measurement validity.
4. Evidence Qualification is not the same semantic as Decision Eligibility.
5. Knowledge claims are not field facts.
6. Twin State is not customer policy.
7. A calculator may compute a quantity but may not elevate itself into an authority owner without an explicit contract.
8. AI reasoning may interpret qualified inputs but may not manufacture source truth, Evidence authority, approval authority, or execution authority.
9. Replay, Shadow-online, Controlled, and Production must converge on the same semantic core while differing only through explicit adapters such as clock, ingress, scheduler, persistence, provider, and execution-feedback boundaries.
10. No compatibility projection may become a second truth source.

---

## 2. Frozen target architecture

```text
Reality / External Sources / Devices / Human Records
                         │
                         ▼
                 Raw Evidence Ledger
                         │
                         ▼
                  Evidence Runtime
          collect / normalize / provenance
                         │
                         ▼
               Evidence Qualification
     physical / temporal / spatial / source /
        epistemic / conflict / authority
                         │
                         ▼
                  Governed Evidence
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             │
                   Twin Runtime         │
              State / Forecast /        │
             Scenario / Uncertainty     │
                  │                     │
                  └──────────┬──────────┘
                             │
Knowledge Authority ─────────┤
Context Authority ───────────┤
Customer goals / cost ───────┤
                             ▼
                      Decision Runtime
       reasoning / deterministic calculators
                             │
                     Candidate Decision
                             │
                             ▼
                     Decision Eligibility
        PASS / DEGRADED / NEED_EVIDENCE / BLOCK
                             │
                             ▼
                    Human / Policy Approval
                             │
                       Operation Plan
                             │
                           AO-ACT
                             │
                         Execution
                             │
                          Receipt
                             │
                        Acceptance
                             │
                     Decision Episode
```

This is a semantic ownership architecture. It does not require all boxes to be separate processes or services. Process topology may remain implementation-specific as long as authority ownership remains unambiguous.

---

## 3. Canonical semantic ownership

| Semantic question | Canonical owner | Non-owner behavior |
|---|---|---|
| What raw event/source was received? | Raw Evidence Ledger | Other layers reference; never rewrite |
| Is this observation syntactically/physically plausible? | Evidence Qualification | Consumers may display result but not recompute competing authority |
| Was this evidence available at the relevant decision boundary? | Evidence Qualification | Twin/Judge consume the qualification |
| Is the source authorized for this evidence role? | Evidence Qualification / source authority profile | Downstream consumers cannot self-authorize |
| What is the current estimated field state? | Twin Runtime | Agronomy/Decision consume state; do not create competing state authority |
| What may happen under future forcing? | Forecast | Decision Runtime consumes forecast |
| What happens under alternative candidate actions? | Scenario Engine / Twin Runtime | Scenario is not recommendation |
| What crop/cultivar/planting/management context is declared? | Context Authority | Twin may derive state from context but cannot rewrite identity/history |
| What observed/estimated phenology state currently holds? | Twin Runtime, using qualified evidence | Field program/default resolver cannot create a competing authoritative stage |
| Which agronomic claim applies here? | Knowledge Authority | Decision Runtime selects from qualified claims; may not fabricate claim authority |
| What action should be considered? | Decision Runtime | Calculators provide traces/results only |
| Is the candidate action currently eligible for production/approval? | Decision Eligibility | Evidence Qualification does not answer action policy by itself |
| Who authorizes the action? | Human or explicit policy authority | Recommendation cannot self-approve |
| How does an approved action become an executable plan/task? | Operation / AO-ACT | Judge/Decision Runtime do not execute directly |
| What actually happened? | Receipt / as-executed evidence | Plans do not substitute for execution truth |
| Was the outcome acceptable? | Acceptance | Receipt alone is not acceptance |
| Why was this decision made at that time? | Decision Episode / audit graph | No later model may rewrite original decision context |

---

## 4. Evidence Qualification versus Decision Eligibility

These are permanently distinct semantics.

### 4.1 Evidence Qualification

Evidence Qualification answers:

> **Can this evidence item, at this time, in this scope, for this role, carry authority?**

It may consider:

- metric/unit contract;
- physical plausibility;
- source-provided QC;
- GEOX-derived measurement QC;
- device/transport status;
- temporal freshness;
- observed/ingested/available-to-runtime chronology;
- spatial support;
- source binding;
- epistemic class;
- duplicate/conflict state;
- calibration status;
- simulation/debug/formal lane;
- future-evidence leakage;
- representativeness limitations.

Representative outputs:

```text
PASS
LIMITED
SUSPECT
OUTLIER
STALE
CONFLICTED
SOURCE_UNAUTHORIZED
QUALITY_INELIGIBLE
TEMPORALLY_INELIGIBLE
SPATIALLY_LIMITED
```

The raw fact remains append-only regardless of qualification result.

### 4.2 Decision Eligibility

Decision Eligibility answers:

> **Given the qualified Evidence, current State/Forecast/Scenario, policy, consequence, and reversibility, may this candidate action proceed toward approval or execution?**

Representative outputs:

```text
PASS
DEGRADED
NEED_EVIDENCE
HUMAN_REVIEW
BLOCK
```

A single invalid observation must not automatically imply `BLOCK`. It may instead lose veto/state authority while sufficient independent evidence still supports the action.

---

## 5. Measurement health versus device/transport health

The following distinction is frozen:

```text
Device / transport health
≠
Measurement health
```

Signal strength, battery, packet loss, heartbeat, and connectivity describe transport/device health.

Range plausibility, calibration, drift, stuck values, cross-sensor inconsistency, action-response inconsistency, and impossible physical values describe measurement health.

Therefore a device may be:

```text
ONLINE
RSSI_GOOD
BATTERY_GOOD
PACKET_LOSS_LOW
```

while one measurement is simultaneously:

```text
MEASUREMENT_INVALID
```

Compatibility fields such as `sensor_quality_level` may remain temporarily, but their internal authority must be narrowed or renamed so they do not impersonate measurement truth.

---

## 6. Canonical Observation boundary

For operational sensing, the target business boundary is a canonical Observation object that preserves raw provenance and qualification metadata.

At minimum, Observation semantics must carry or reference:

```text
observation_id
source_fact_id
source identity
metric
raw value
canonical value
unit
observed_at
ingested_at
available_to_runtime_at
scope
quality / qualification
confidence or uncertainty where applicable
formal/simulated/debug lane
limitations
```

Raw device telemetry, imported files, public providers, manual records, and external APIs may use different adapters, but downstream business/state models must not create separate evidence truths solely because ingress differed.

---

## 7. MCFT ownership ruling

MCFT is not demoted into a generic Evidence layer.

The frozen ruling is:

- MCFT / Twin Runtime remains the canonical future State / Forecast / Scenario runtime.
- CAP-09 production hosting is a productization path into the same future MCFT semantic mainline.
- Evidence Runtime and Twin Runtime remain intentionally separate planes.
- MCFT source-specific authority rules remain source-specific.
- Generic evidence-qualification semantics developed through MCFT should be extracted into reusable contracts/engines rather than imported through CAP-specific constants.

Correct separation:

```text
External Providers
      ↓
Evidence Runtime
      ↓
raw retention / canonicalization / governed Evidence
      ↓
Persistence
      ↓
Twin Runtime
      ↓
State / Forecast / Scenario
```

Evidence Runtime must not mutate Twin state or create recommendation/approval/action authority.

Twin Runtime must not fetch public providers directly or create approval/task/device-command authority.

---

## 8. Context and crop-stage ownership

Crop semantics are split deliberately.

### 8.1 Context Authority owns declared identity/history

Examples:

```text
crop identity
cultivar
planting event/date
declared field program
management history
customer goal
```

### 8.2 Evidence owns observations

Examples:

```text
phenology observation
manual scouting observation
imagery-derived observation candidate
management-event record
```

### 8.3 Twin Runtime owns derived state

Examples:

```text
estimated crop stage
phenology posterior
state confidence
uncertainty
```

A default such as `seedling` must never become authoritative merely because a crop-stage input was absent. Any compatibility fallback must be explicitly non-authoritative and must not bypass qualification.

---

## 9. Judge ownership ruling

Judge capabilities are retained but narrowed.

### 9.1 Evidence Judge

Evidence Judge remains a problem-specific sufficiency/arbitration layer.

It should consume Evidence Qualification rather than independently reinvent raw physical-range, freshness, source-authority, or transport-health truth.

Target question:

> Given already-qualified evidence, is there enough evidence to adjudicate this problem?

It may return domain-specific states such as degraded evidence, unresolved conflict, or insufficient evidence.

### 9.2 Agronomy Judge

Agronomy Judge is the canonical agronomic interpretation/judgement owner where such judgement is required.

It consumes:

```text
Twin State
Forecast
Scenario where relevant
Context
qualified agronomic claims
Evidence/Judge sufficiency
```

It must not silently create a competing sensor truth or Twin state.

### 9.3 Execution Judge

Execution Judge remains separate because it adjudicates execution/result evidence after an action. It must not be collapsed into pre-action Evidence Judge or Agronomy Judge.

---

## 10. Deterministic agronomy skills and Rule Engine

Existing deterministic skills are retained as calculators unless separately promoted by an explicit authority contract.

Examples include irrigation deficit/requirement calculations.

Target identity:

```text
Deterministic Decision Calculator
```

Inputs:

```text
qualified Twin State
Forecast
Context
qualified Agronomic Claim / policy
```

Outputs:

```text
calculation result
calculation trace
assumptions
uncertainty / limitations
```

A calculator must not self-declare:

```text
"IRRIGATE NOW"
```

unless a higher Decision Runtime/policy contract explicitly turns that calculation into a Candidate Decision.

---

## 11. Decision Engine ownership ruling

`decision_engine_v1` or any successor must converge toward orchestration/packaging, not a monolithic second agronomy/state runtime.

Target responsibilities:

- consume canonical State / Forecast / Scenario;
- consume qualified Context and Knowledge;
- call deterministic calculators/reasoners;
- create Candidate Decision objects;
- attach traces, reasons, Evidence refs, and policy context;
- hand Candidate Decision to Decision Eligibility.

It must not own independent canonical implementations of:

- Evidence qualification;
- sensor physical validity;
- Twin state estimation;
- crop-stage authority;
- approval;
- execution.

Knowledge/ADR and LLM reasoning must not be added as arbitrary branches inside a growing `decision_engine_v1` composition hotspot. They must enter through explicit Knowledge/Reasoning boundaries.

---

## 12. Stage-1 ownership ruling

Stage-1 is retained during migration for product and compatibility continuity.

Long-term target:

```text
Governed Evidence / canonical State
        ↓
Stage-1 projection / compatibility adapter
```

Forbidden long-term target:

```text
Raw telemetry
        ↓
Stage-1 creates a second authoritative Evidence world
```

Stage-1 freshness, coverage, conflict, device-health, and evidence-sufficiency logic must be inventoried and either:

- migrated into canonical Evidence Qualification;
- retained as a projection of canonical qualification;
- or explicitly deprecated.

Stage-1 output contracts may remain while their internal semantic authority is rewired.

---

## 13. Compatibility and deprecation rule

No historical component is deleted merely because its semantics overlap.

Every candidate must first be classified:

```text
KEEP
ADAPT
REPLACE
DEPRECATE
DELETE_AFTER
```

Deletion prerequisites are mandatory:

1. canonical replacement exists;
2. all production consumers are identified;
3. all acceptance/governance consumers are identified;
4. compatibility surface is either migrated or explicitly retired;
5. exact negative-boundary tests exist;
6. no frozen MCFT/SSOT dependency is silently violated;
7. protected-main behavior is requalified where required.

No component may receive new functionality after it is formally marked `DEPRECATE`, except compatibility/safety fixes required for migration.

---

## 14. Frozen no-recompute rules

The following are architecture-level prohibitions:

- Once Evidence Qualification has classified an observation, Stage-1, Judge, Agronomy, and Decision Runtime may not silently re-authorize the raw observation using an independent rule.
- Once Twin Runtime has emitted canonical State, Decision Runtime may not independently construct a competing field-state truth from raw telemetry.
- Once Context Authority has established crop identity/planting history, a resolver may not replace missing stage evidence with an authoritative default.
- Once Forecast is canonical, recommendation logic may not fetch a separate uncontrolled forecast and treat it as equally authoritative.
- Once a Candidate Decision exists, AO-ACT may not reinterpret agronomy to decide whether the action is good; it enforces authorization/execution contracts.
- Receipt may report what happened but may not declare the outcome acceptable without Acceptance.

---

## 15. Degraded-evidence behavior

The target system must support more than binary `valid/invalid` and `go/stop` semantics.

Normative decision states are at least:

```text
NORMAL
DEGRADED
HUMAN_REVIEW
BLOCKED
```

The system should prefer claim/action requirements over hard-coded sensor requirements.

Example:

```text
Required claim:
"water delivery is occurring within a bounded operational envelope"
```

may be supportable by different evidence combinations, such as flow, cumulative meter, pressure, machine state, or independent field verification, depending on timing and action risk.

Pseudo-redundancy must not be counted as independent evidence. A paper form and its copied AgLog entry remain the same provenance chain unless independent provenance exists.

---

## 16. Reference acceptance fixture: impossible RH with continued irrigation

This fixture is illustrative and does not itself authorize production behavior.

Given:

```text
RH observation = 102.7 %RH
metric physical range = 0..100 %RH
```

Target Evidence Qualification:

```text
PHYSICAL_RANGE_FAIL
measurement_health = INVALID
weather_state_authority = INELIGIBLE_FOR_THIS_OBSERVATION
irrigation_veto_authority = NONE_FROM_THIS_OBSERVATION
raw_fact_retained = true
```

The system must then continue evaluating independent evidence rather than automatically asserting either:

```text
STOP_IRRIGATION
```

or:

```text
CONTINUE_IRRIGATION
```

Decision Eligibility depends on the remaining qualified Evidence, State, action risk, reversibility, monitoring, and policy.

A degraded but sufficient case may legally result in:

```text
IRRIGATION_ELIGIBLE
status = DEGRADED
reason = INVALID_WEATHER_OBSERVATION_EXCLUDED_FROM_VETO;
         SUFFICIENT_INDEPENDENT_WATER_STATE_EVIDENCE_REMAINS
```

An insufficient case must result in `NEED_EVIDENCE`, `HUMAN_REVIEW`, or `BLOCK` according to policy.

---

## 17. Migration sequence

The frozen migration order is intentionally incremental.

### Phase A — ownership inventory

Create a file-level Semantic Ownership & Migration Manifest.

For every relevant file/schema/table/route/job/acceptance:

```text
semantic owner
authority role
current consumers
future owner
KEEP / ADAPT / REPLACE / DEPRECATE / DELETE_AFTER
deletion prerequisites
```

No runtime deletion occurs in this phase.

### Phase B — canonical Evidence Qualification contract

Freeze a reusable contract covering at minimum:

- physical validity;
- measurement health;
- temporal eligibility;
- spatial/source authority;
- conflict state;
- limitations;
- role-specific eligibility;
- reason codes.

### Phase C — observation QC convergence

Route MQTT, server telemetry, raw-sample ingress, import paths, and applicable external evidence through shared qualification semantics while preserving raw facts.

### Phase D — sensing consumption guard

Ensure ineligible observations cannot silently enter canonical sensing/state inference solely because the numeric value is finite.

### Phase E — Stage-1 compatibility convergence

Replace independent Stage-1 Evidence truth with projections/adapters over canonical qualification while retaining necessary external contracts.

### Phase F — Judge and Decision convergence

- thin Evidence Judge to problem-specific sufficiency/arbitration;
- bind Agronomy Judge to canonical State/Forecast/Context/Knowledge;
- remove duplicate agronomic state calculation from Decision Engine where replacement paths exist;
- preserve recommendation packaging and policy orchestration.

### Phase G — controlled deprecation/deletion

Delete only after dependency/acceptance migration and exact requalification.

---

## 18. Explicit nonclaims

This freeze does **not** claim that:

- existing parallel chains are currently removed;
- MCFT-9 Formal is modified;
- current production decisions are already generated from MCFT State/Forecast/Scenario;
- ADR/Knowledge Runtime is already a canonical production plane;
- LLM reasoning has production authority;
- a particular percentage of existing code can be reused without a dependency audit;
- degraded evidence always permits action;
- impossible data proves a specific sensor hardware fault;
- the 102.7% reference fixture alone proves an irrigation decision was agronomically correct.

---

## 19. Architecture success criteria

The convergence is complete only when all of the following are true:

1. Each core semantic has exactly one canonical authority owner.
2. Compatibility/read-model projections cannot become competing truth sources.
3. Raw evidence remains replayable and append-only.
4. Evidence Qualification is reusable across device, import, external-provider, and MCFT paths where semantics are shared.
5. MCFT remains canonical State/Forecast/Scenario runtime rather than another recommendation brain.
6. Stage-1 no longer independently owns Evidence truth.
7. Agronomy Judge and Decision Runtime do not independently recompute canonical field state.
8. Decision Eligibility can distinguish `DEGRADED` from `BLOCK`.
9. Approval and AO-ACT remain downstream explicit authorities.
10. Receipt and Acceptance remain distinct.
11. Decision Episodes preserve the exact Evidence/State/Knowledge/policy context used at decision time.
12. Negative tests prove that unauthorized evidence, state recomputation, or authority escalation fail closed.

---

## 20. Freeze statement

The target GEOX architecture is frozen as:

```text
Knowledge
   +
Governed Evidence
   ↓
Canonical Context / Twin State / Forecast / Scenario
   ↓
Decision Runtime
   ↓
Candidate Decision
   ↓
Decision Eligibility
   ↓
Approval
   ↓
Operation / AO-ACT
   ↓
Execution
   ↓
Receipt
   ↓
Acceptance
   ↓
Decision Episode
```

with the non-negotiable governance principle:

> **One semantic, one canonical authority owner.**

And the corresponding runtime rule:

> **Downstream layers may consume, interpret, project, or package an authoritative semantic; they must not silently recompute a competing authoritative version.**

This document freezes the target architecture only. Migration remains additive and must proceed through dependency-aware adapters and controlled deprecation rather than a destructive big-bang rewrite.
