# GEOX B-Line Semantic Convergence Charter V1

## 0. Status and authority

Status: **proposal**

Repository-level SSOT: `docs/SSOT.md`

Sprint / Tag / Freeze authority: `README_MIGRATION.md`

Audit baseline:

```text
repository: liyongshang44-max/GEOX
protected branch: main
exact baseline: 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
B-line phase: B-01
runtime mutation: none
schema mutation: none
workflow mutation: none
MCFT mutation: none
ADR runtime activation: none
LLM runtime activation: none
```

This document is not a repository-level SSOT, does not supersede any frozen control-plane or digital-twin contract, and does not claim implementation completion. It defines the proposed working charter for the B-line semantic-convergence program before MCFT-9, ADR, and LLM are connected to one central decision path.

If this proposal conflicts with `docs/SSOT.md`, `README_MIGRATION.md`, a recognized domain constitution, frozen runtime semantics, or proven implementation behavior, the higher authority wins and this proposal must be corrected.

---

## 1. Mission

The B-line exists to solve one repository-level architectural problem without creating a new product brain:

> GEOX already contains multiple historically valid evidence, context, state, agronomy, recommendation, judgment, plan, and execution paths. Before MCFT-9, ADR, and LLM are connected to the product decision path, the repository must identify where more than one path currently owns or recomputes the same semantic conclusion and define one future ownership boundary for each semantic.

B-line is therefore a **semantic convergence** program, not a feature program.

Its purpose is not to make the system more autonomous. Its purpose is to make the system more explicit about:

```text
what is fact
what is qualified evidence
what is context
what is state
what is forecast
what is scenario
what is interpretation
what is a candidate decision
what is a qualification decision
what is approval
what is an operation plan
what is an executable task
what is execution evidence
what is acceptance
what is outcome
```

The end state must prevent a future ADR service, LLM reasoner, or MCFT runtime from silently creating another independent interpretation of those concepts.

---

## 2. B-line stop condition

B-line ends **before** real MCFT-9, ADR, and LLM integration.

The intended handoff condition is a repository in which the following typed integration boundaries can exist without changing their upstream authorities:

```text
EvidenceAuthorityPort
ContextAuthorityPort
TwinDecisionInputPort      <- real MCFT adapter connected later
KnowledgeClaimInputPort    <- real ADR adapter connected later
ReasoningCandidatePort     <- real LLM adapter connected later
            |
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
Approved Operation Plan
            |
            v
Executable Task
            |
            v
Receipt
            |
            v
Acceptance
            |
            v
Decision Episode
```

B-line may define the contracts, compatibility adapters, negative boundaries, and trace requirements around these seams. B-line must not pretend the future MCFT/ADR/LLM adapters already exist.

---

## 3. Core rules

### 3.1 Single Semantic Owner

For every semantic conclusion that can influence a production decision, B-line must identify one future authoritative owner.

Other components may remain as:

```text
ADAPTER
PROJECTION
CALCULATOR
COMPATIBILITY_FACADE
READ_MODEL
AUDIT_VIEW
DEPRECATED_CANDIDATE
```

but must not continue to own the same truth independently after convergence.

### 3.2 Compatibility is not authority

Historical objects and APIs may remain available to preserve frozen acceptance and customer compatibility. Their continued existence does not grant them canonical semantic authority.

### 3.3 No New Brain

Until the ownership register is machine-enforced, B-line must not introduce a new module that independently decides any of the following from raw inputs:

```text
crop stage
field physical state
irrigation need
recommendation eligibility
production qualification
approval
execution success
```

### 3.4 Preserve explicit unknowns

Canonical future paths must preserve `UNKNOWN`, missing, stale, conflicting, unsupported, or inapplicable states instead of manufacturing convenient defaults.

Compatibility behavior may be retained temporarily, but default fabrication must not become the future authority path.

### 3.5 Remove authority before deleting code

Migration order is frozen for B-line planning as:

```text
inventory
-> classify
-> define canonical contract
-> wrap with compatibility adapter
-> shadow/compare where applicable
-> remove authority
-> compatibility-only
-> disable default if safe
-> delete only in a later governed cleanup
```

No B-line phase may begin with bulk deletion of historical modules.

### 3.6 No execution-authority expansion

B-line must preserve the existing safety distinctions:

```text
Scenario != Recommendation
Candidate != Approval
Approval != Dispatch
Dispatch != Execution
Receipt != Acceptance
Outcome Evidence != ROI
```

A B-line refactor must never make a candidate, interpretation, recommendation, scenario, or qualification result directly executable.

---

## 4. Protected boundaries

### 4.1 MCFT / Digital Twin

B-line must not redefine MCFT canonical semantics.

The existing Digital Twin master line already freezes core distinctions including:

```text
Reality is not Evidence
Evidence is not State
Sensor Reading is not Root-zone State
Forecast is not Scenario
Scenario is not Recommendation
Decision is not Approval
```

B-line will treat MCFT as the future owner of canonical field physical State / Forecast / Scenario semantics once a governed integration seam is ready.

Before that integration, B-line may only classify current duplicate state-producing paths and prepare adapters/contracts around them.

### 4.2 MCFT-CAP-09 production-hosting work

The current MCFT-CAP-09 production-hosting implementation line remains independent. B-line must not modify provider acquisition, evidence-runtime semantics, twin-runtime semantics, Formal stores, forcing acquisition, scheduler ownership, runtime cursor ownership, or Formal activation.

Any branch-local MCFT-CAP-09 implementation or architecture not merged into protected `main` is an integration target/reference, not repository authority for this B-line docs branch.

### 4.3 Control plane and AO-ACT

Existing frozen boundaries around Decision / Plan, approval, AO-ACT task creation, receipt, and acceptance must be preserved.

In particular, B-line must not create:

```text
CandidateDecision -> Task
QualificationDecision -> Task
LLM output -> Task
ADR claim -> Task
Twin State -> Task
Scenario -> Task
```

without the separately governed approval/action path.

### 4.4 Agronomy Interpretation

`agronomy_interpretation_v1` remains an explain-only object under its frozen contract. B-line may map it into a future reasoning-input vocabulary, but must not convert it into an executable or directly triggerable object.

### 4.5 ADR

B-line does not extract papers, approve claims, define scientific truth, or activate an ADR runtime.

It may later define the minimum interface requirements for a future published claim to enter the decision path.

### 4.6 LLM

B-line does not choose an LLM provider, prompt framework, model, agent framework, or autonomous tool loop.

It may later define the typed object an LLM is allowed to produce and the objects it is forbidden to mutate.

---

## 5. B-line semantic scope

B-line must inventory and converge at least these semantic families:

```text
raw observation / evidence
quality / freshness / coverage / conflict
field / season / crop / zone context
crop stage / phenology context
physical State
Forecast
Scenario
Agronomy Interpretation
agronomy rule / skill calculation
recommendation / candidate decision
prescription / action specification
decision plan
qualification
approval request / approval decision
operation plan
AO-ACT task
receipt / as-executed / as-applied
acceptance
outcome evidence / effect attribution
ROI / Field Memory
customer/operator presentation
```

Each family must be classified as one of:

```text
KEEP_AUTHORITY
CONVERGE_AUTHORITY
ADAPT
PROJECTION_ONLY
CALCULATOR_ONLY
COMPATIBILITY_ONLY
DEPRECATE_CANDIDATE
OUT_OF_SCOPE
```

B-01 records a human-readable first classification. B-02 is responsible for the machine-readable register and scanner.

---

## 6. Required B-line phases

### B-01 — Charter + Semantic Ownership Audit

Deliver:

- this charter;
- exact-main code/document audit;
- current semantic-chain map;
- duplicate-authority findings;
- first classification of owners;
- explicit do-not-touch boundaries;
- B-02 machine-register requirements.

B-01 is docs-only.

### B-02 — Machine-readable ownership register + scanner

Deliver a repository-tracked ownership registry and static governance gate that can detect unregistered new owners or forbidden source-to-semantic paths.

B-02 must not attempt to infer semantic ownership from filenames alone. The register must explicitly bind semantic, owner, source paths, authority class, allowed consumers, and forbidden bypasses.

### B-03 — Canonical semantic contracts

Define shared contracts/vocabulary for context, candidate decision, qualification decision, and trace references without changing MCFT semantic contracts.

### B-04 — Context Authority

Create a canonical context seam and legacy adapters. Remove implicit/default context fabrication from the future authoritative path while retaining compatibility behavior where needed.

### B-05 — Candidate Decision convergence

Map historical recommendation / decision-plan / prescription objects into a shared candidate/action-spec vocabulary without granting new execution authority.

### B-06 — Qualification shell + negative gates

Introduce a typed qualification boundary whose output is not executable and whose inputs may come only from explicitly authorized semantic layers.

### B-07 — Decision Episode + integration ports

Create Decision Episode trace aggregation and the unconnected MCFT / ADR / LLM ports. B-line ends when those ports are structurally ready and remain unconnected to real MCFT/ADR/LLM implementations.

---

## 7. B-line completion gates

B-line may hand off to MCFT-9 / ADR / LLM integration only when all of the following are machine-testable or explicitly registered:

```text
[ ] every scoped semantic has exactly one target owner
[ ] every current duplicate owner is classified
[ ] compatibility objects are marked non-authoritative where applicable
[ ] no canonical context path fabricates missing crop stage or evidence
[ ] recommendation/decision-plan/prescription semantics map to a common candidate lattice
[ ] qualification is separate from candidate generation
[ ] candidate and qualification cannot create AO-ACT tasks
[ ] approval/action/receipt/acceptance boundaries remain intact
[ ] Decision Episode can represent the existing commercial chain
[ ] MCFT integration port exists but real adapter is not connected
[ ] ADR integration port exists but real runtime is not connected
[ ] LLM integration port exists but real provider is not connected
[ ] existing protected-main acceptance remains green for each runtime-affecting B PR
```

---

## 8. B-01 audit questions

B-01 must answer, with exact repository paths:

1. Which modules currently decide whether evidence is sufficient?
2. Which modules currently derive or default crop stage?
3. Which modules currently create a physical/derived field state?
4. Which modules currently calculate irrigation need or recommended amount?
5. Which modules currently create recommendation-like facts?
6. Which modules currently create plan-like facts?
7. Which paths can reach approval and execution?
8. Which current paths are formal, compatibility, legacy, read-only, or acceptance-only?
9. Which duplicate paths are safe because they are projections, and which are dangerous because they own the same semantic conclusion?
10. Which existing boundaries should not be changed because they are already correctly separated?

The companion audit document answers these questions for B-01.

---

## 9. Explicit nonclaims

B-01 does not claim:

```text
that current duplicate paths are all bugs
that all historical paths should be removed
that MCFT is currently wired into commercial recommendation
that ADR exists as a canonical production knowledge plane
that LLM reasoning exists as a canonical production reasoner
that Qualification Runtime V1 is implemented
that Decision Episode V1 is implemented
that the B-line target vocabulary is already repository authority
```

B-01 establishes the convergence problem and the safe work boundary only.

---

## 10. B-01 completion statement

B-01 is complete when this charter and the exact-main Semantic Ownership Audit are committed together on a docs-only branch based exactly on protected `main @ 26c1383f7f45abb76c99e28ec3d06714e85d1b2c`, with no runtime, schema, workflow, MCFT, ADR, LLM, Formal, or execution mutation.
