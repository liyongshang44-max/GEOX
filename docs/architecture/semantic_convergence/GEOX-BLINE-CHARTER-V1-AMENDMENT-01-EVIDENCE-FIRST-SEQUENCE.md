# GEOX B-Line Semantic Convergence Charter V1 — Amendment 01

Status: **proposal amendment**  
Date: 2026-08-27  
Applies to: `docs/architecture/semantic_convergence/GEOX-BLINE-CHARTER-V1.md`  
B-01 audit: `docs/architecture/semantic_convergence/GEOX-B01-SEMANTIC-OWNERSHIP-AUDIT-V1.md`  
Repository-level SSOT: `docs/SSOT.md`  
Sprint / Tag / Freeze authority: `README_MIGRATION.md`  
Exact baseline: protected `main` = `26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

This amendment changes only the B-line implementation sequence from B-03 onward. It does not reopen or rewrite B-01 findings. B-02 remains unchanged and remains non-runtime semantic-governance work.

The reason for the sequence change is the B-01 finding that Evidence qualification is itself one of the highest-risk duplicate-authority families. Candidate/Decision contracts must not be unified before the repository has one canonical answer to whether an Observation is physically, temporally, spatially, and source-authoritatively eligible for a role.

---

## 1. B-01 and B-02 remain unchanged

### B-01 — COMPLETE

Deliverables already established:

```text
B-Line Charter
+
exact-main Semantic Ownership Audit
```

B-01 identifies duplicate authority and current producers. It does not migrate runtime semantics.

### B-02 — UNCHANGED

Formal task:

```text
Semantic Ownership Register
+
Parallel Authority Graph
+
Semantic Contract Linter
```

B-02 remains governance/static-analysis only.

The linter must operate on explicit, provable repository declarations and edges rather than claiming arbitrary TypeScript business-semantic understanding.

Minimum machine-checkable fields include:

```text
semantic_id
registered_producer
allowed_consumer
forbidden_edge
canonical_output_type
authority_level
grandfathered_duplicate
removal_target
new_owner_creation
```

Existing duplicate owners may be registered as:

```text
grandfathered_duplicate = true
new_owner_creation = forbidden
removal_target = B-04 | B-05 | B-06 | B-09
```

This prevents B-02 from making protected main red merely because historical debt already exists, while preventing additional unregistered authority owners from being introduced.

---

## 2. Revised B-line implementation sequence

The implementation sequence after B-02 is frozen for the B-line proposal as follows:

| Phase | Formal task | Required result | Runtime risk |
|---|---|---|---|
| B-01 | Charter + exact-main Semantic Ownership Audit | Duplicate-authority families and active producers identified | 0 |
| B-02 | Ownership Register + Parallel Authority Graph + Semantic Contract Linter | Machine-readable producer/consumer/authority/forbidden-edge governance; no runtime repair | Very low |
| B-03 | Canonical Observation + Evidence Qualification Contracts | One typed Observation/evidence vocabulary for physical, temporal, source, spatial, conflict and role eligibility semantics | Low |
| B-04 | Evidence Runtime convergence | Shared QC/qualification across ingress; ineligible observations cannot silently become sensing/state truth; Stage-1/Judge consume canonical qualification | Medium-high |
| B-05 | Context Authority / Crop Stage convergence | UNKNOWN remains UNKNOWN; declared context, observations and derived stage are separated; legacy resolvers become adapters | Medium |
| B-06 | CandidateDecision + decision-producer convergence | recommendation/decision_plan/prescription mapped into one candidate lattice; legacy brains lose final decision/plan authority | Medium-high |
| B-07 | Decision Eligibility Runtime | PASS / DEGRADED / NEED_EVIDENCE / HUMAN_REVIEW / BLOCK action-level eligibility | Medium-high |
| B-08 | Decision Episode + typed MCFT/ADR/LLM ports | Complete decision-time trace; typed integration seams exist but real adapters/providers remain disconnected | Medium |
| B-09 | Shadow compare + authority removal + controlled deprecation | Replacement-backed old owners lose authority; unreplaced paths become compatibility-only/no-new-feature; no mass deletion | Medium |

The B-line ends after B-09 and before real MCFT + ADR + LLM integration into the central decision spine.

---

## 3. B-03 — Canonical Observation + Evidence Qualification Contracts

B-03 establishes contract vocabulary only; it does not rewrite MCFT.

Required canonical Observation semantics include at least:

```text
CanonicalObservationV1

observation_id
source_fact_id
source_ref
scope
metric
unit
raw_value
canonical_value

observed_at
ingested_at
available_to_runtime_at

device_transport_health
measurement_health

physical_validity
temporal_eligibility
source_authority
spatial_authority
conflict_state

role_eligibility
limitations
reason_codes
epistemic_class
```

Frozen distinction:

```text
Device Health != Measurement Health
```

Example:

```text
RSSI = GOOD
battery = GOOD
packet_loss = 0
RH = 102.7 %
```

may validly produce:

```text
device_transport_health = GOOD
measurement_health = INVALID
physical_validity = FAIL
role_eligibility = INELIGIBLE_FOR_PHYSICAL_STATE
```

The raw fact remains retained.

Missing evidence must not be converted into fabricated authoritative numeric observation. Model priors, estimates, imputation and fallback values must retain explicit epistemic classes such as `ESTIMATED`, `MODEL_DERIVED`, `IMPUTED`, `ASSUMED`, `SIMULATED`, or `LIMITED`.

B-03 exit requires typed contracts and negative contract fixtures; it does not yet require all ingress to use them.

---

## 4. B-04 — Evidence Runtime convergence

B-04 is the first high-risk runtime milestone and should be implemented as small bounded PRs.

Recommended subphases:

```text
B-04a
metric catalog -> shared physical QC

B-04b
MQTT / server telemetry / raw-sample / external ingress
-> shared observation qualification

B-04c
sensing consumption guard
OUTLIER / INELIGIBLE / MISSING cannot silently pass through latest-finite selection

B-04d
Stage-1 evidence gate
-> projection/consumer of canonical qualification

B-04e
Evidence Judge
-> problem-specific sufficiency facade over canonical qualification,
not a second raw physical-truth engine
```

Mandatory acceptance fixtures include at least:

```text
RH = 102.7 %
physically impossible soil-moisture value
missing observation
stale observation
source-unqualified observation
spatially limited observation
```

B-04 must prove:

```text
raw fact retained
invalid measurement marked invalid
invalid role authority removed/narrowed
no silent state/sensing consumption
no fabricated observation substitution
no automatic action BLOCK solely because one observation is invalid
```

The last condition is essential: Evidence Qualification removes/narrows evidence authority; Decision Eligibility later decides action-level consequence.

---

## 5. B-05 — Context Authority / Crop Stage convergence

B-05 separates declared context, observed phenology, and derived stage.

Target semantic flow:

```text
Declared customer/field context
        -> ContextAssertion

Phenology/scouting/management observation
        -> CanonicalObservation
        -> Evidence Qualification

Derived crop stage / phenology state
        -> Twin/qualified derived-state boundary

Decision Runtime
        -> consume; never fabricate
```

Canonical future paths must preserve `UNKNOWN`.

Forbidden authority conversion:

```text
missing stage
-> convenience DAP guess
-> unknown
-> seedling
-> authoritative recommendation input
```

Legacy field-program and stage-resolver paths may remain through adapters, but they must not become future canonical stage authority.

---

## 6. B-06 — CandidateDecision and decision-producer convergence

B-06 establishes one candidate semantic lattice while preserving historical compatibility objects.

Target:

```text
Interpretation
        ↓
CandidateDecision
        ↓
Decision Eligibility
        ↓
Approval
        ↓
ApprovedOperationPlan
        ↓
ExecutableTask
```

Historical mappings may include:

```text
recommendation_v1 -> CandidateDecision adapter
decision_plan_v0 -> CandidateDecision compatibility adapter
prescription -> candidate action-spec adapter
operation_plan_v1 -> classified as draft/proposed/approved according to real authority state
```

The active Agronomy Agent is explicitly in scope for B-06 convergence.

It must transition conceptually from:

```text
telemetry + field_program
-> recommendation
-> operation_plan authority
```

into:

```text
legacy candidate producer
-> CandidateDecision adapter
-> Decision Eligibility
-> Approval/Policy authority
-> ApprovedOperationPlan
```

B-06 does not require immediate deletion. Authority removal follows the migration discipline:

```text
inventory
-> classify
-> canonical contract
-> adapter
-> shadow compare
-> remove authority
-> compatibility-only
-> disable default
-> delete later
```

---

## 7. B-07 — Decision Eligibility Runtime

B-07 creates the action-level eligibility semantic and must remain distinct from Evidence Qualification.

Normative verdicts:

```text
PASS
DEGRADED
NEED_EVIDENCE
HUMAN_REVIEW
BLOCK
```

`EXPIRED` belongs to lifecycle/time validity, not to this verdict enum.

Decision Eligibility considers the candidate action as a whole, including:

```text
qualified Evidence
State / Forecast / Scenario
Context
Knowledge / policy requirements
permissions
action window
consequence
reversibility
remaining uncertainty
independent evidence support
```

It must support the central degraded-evidence behavior:

```text
one observation invalid
!=
automatic action block
```

Example:

```text
RH = invalid
flow = missing
pressure = qualified
cumulative meter = qualified/limited
other independent water-state evidence = qualified
```

may result in:

```text
IRRIGATION candidate -> DEGRADED
```

when the required decision claims remain sufficiently supported.

---

## 8. B-08 — Decision Episode + typed integration ports

B-08 keeps the original Decision Episode direction and clarifies that reasoning is not authority.

Authority input ports:

```text
GovernedEvidencePort
ContextAuthorityPort
TwinDecisionInputPort
KnowledgeClaimInputPort
```

Decision-producer ports:

```text
DeterministicCalculatorPort
HumanReasoningPort
LLMReasoningPort
```

Decision producers may output only typed candidate semantics:

```text
CandidateDecision
```

They may not create:

```text
APPROVED
PASS/DEGRADED/NEED_EVIDENCE/HUMAN_REVIEW/BLOCK authority by themselves
TASK
DEVICE_COMMAND
```

At B-08 exit:

```text
real MCFT adapter = NOT CONNECTED
real ADR runtime = NOT CONNECTED
real LLM provider = NOT CONNECTED
```

The ports and negative contract tests exist; real integration remains a later program.

---

## 9. B-09 — Shadow compare, authority removal, controlled deprecation

B-09 is the only phase that may intentionally remove historical semantic authority after a replacement has been demonstrated.

Required order:

```text
canonical replacement exists
        ↓
legacy/canonical shadow comparison
        ↓
semantic divergence inventory
        ↓
acceptance/consumer migration
        ↓
remove legacy authority
        ↓
compatibility-only / no-new-feature
        ↓
disable default where safe
        ↓
delete only after explicit prerequisites
```

If no canonical replacement exists, the old path must not be deleted merely for architectural neatness. It is instead frozen as compatibility-only/no-new-feature and remains visible in the ownership register.

---

## 10. Relationship to the architecture freeze candidate

The B-line Charter and this amendment govern implementation sequencing only. They do not become repository-level SSOT and do not supersede the architecture ownership candidate in PR #3300.

The architecture candidate governs semantic invariants and target ownership.

The B-line governs the bounded migration order required to reach that target.

Mandatory precedence after this amendment:

```text
Evidence convergence
before
Context convergence
before
Candidate convergence
before
Decision Eligibility
before
MCFT/ADR/LLM integration ports
```

This sequencing rule prevents a unified CandidateDecision interface from being built on top of several unresolved Evidence truths.

---

## 11. Non-effects

This amendment does not:

- alter B-01 audit findings;
- implement B-02;
- mutate current runtime;
- mutate schemas/migrations;
- disable the Agronomy Agent;
- change Stage-1/Judge semantics today;
- modify MCFT-CAP-09;
- activate ADR;
- connect an LLM;
- create Decision Eligibility runtime;
- authorize deletion of legacy code;
- authorize merge of either Draft PR.
