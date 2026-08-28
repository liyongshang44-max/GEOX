# GEOX Semantic Ownership & Decision Runtime Architecture V1 — Amendment 01

Status: **ARCHITECTURE FREEZE CANDIDATE AMENDMENT**  
Date: 2026-08-27  
Applies to: `docs/architecture/GEOX-SEMANTIC-OWNERSHIP-DECISION-RUNTIME-ARCHITECTURE-V1-FREEZE.md`  
Repository basis: protected `main` = `26c1383f7f45abb76c99e28ec3d06714e85d1b2c`  
Trigger: B-01 exact-main Semantic Ownership Audit  
Runtime mutation: NONE  
Schema mutation: NONE  
Workflow mutation: NONE  
MCFT mutation: NONE  
ADR runtime activation: NONE  
LLM runtime activation: NONE

This amendment does not replace the architecture candidate. It makes four bounded corrections after the B-01 audit. Until the architecture candidate and this amendment are merged through the normal protected-main review path, both remain non-main architecture freeze candidates.

---

## A1. Decision Eligibility verdict set

The target-architecture diagram is amended so the normative Decision Eligibility verdict set is:

```text
PASS
DEGRADED
NEED_EVIDENCE
HUMAN_REVIEW
BLOCK
```

`HUMAN_REVIEW` is therefore a first-class Decision Eligibility outcome and is not merely an explanatory note.

`EXPIRED` is not a Decision Eligibility verdict. Expiry belongs to lifecycle/time validity and may cause a new eligibility evaluation, but it must not replace the five-state eligibility semantics above.

The corrected target segment is:

```text
Candidate Decision
        │
        ▼
Decision Eligibility
PASS / DEGRADED / NEED_EVIDENCE / HUMAN_REVIEW / BLOCK
        │
        ▼
Human / Policy Approval
```

This amendment resolves the internal mismatch between the original architecture diagram and Section 4.2, which already included `HUMAN_REVIEW`.

---

## A2. Missing Evidence must not become fabricated authoritative observation

The following is added as a frozen negative invariant:

> **Missing Evidence must not be converted into a fabricated authoritative numeric observation.**

Forbidden canonical-path behavior:

```text
observation missing
        ↓
convenience/default numeric value
        ↓
represented as measured/observed truth
        ↓
state / recommendation / candidate authority
```

A system may use priors, estimates, imputation, simulation, or fallback models only when the epistemic class remains explicit, for example:

```text
ESTIMATED
MODEL_DERIVED
IMPUTED
ASSUMED
SIMULATED
LIMITED
```

Such values must not impersonate `OBSERVED` sensor evidence and must carry their provenance, decision-time availability, limitations, and role eligibility.

This invariant is motivated by B-01's exact-main finding that the active Agronomy Agent can substitute `DEFAULT_SOIL_MOISTURE = 30` when telemetry is missing and continue candidate processing. The amendment does not disable or alter that legacy path. It freezes the future canonical rule that such substitution cannot become authoritative observation truth.

---

## A3. Candidate / Recommendation must not directly own ApprovedOperationPlan authority

The following is added as a frozen plan-authority invariant:

> **A Candidate Decision or Recommendation must not directly create an authoritative ApprovedOperationPlan without an explicit Approval or Policy authority transition.**

The semantic chain is:

```text
Recommendation / CandidateDecision
        ↓
Decision Eligibility
        ↓
Human or explicit Policy Approval
        ↓
ApprovedOperationPlan
        ↓
ExecutableTask / AO-ACT
```

Compatibility objects named `operation_plan_v1` may continue to exist during migration, but naming alone must not confer approved-plan authority.

A plan created before approval must be typed or classified as non-authoritative, for example:

```text
DRAFT_PLAN
PROPOSED_PLAN
CANDIDATE_ACTION_SPEC
COMPATIBILITY_PLAN
```

and must not be treated as an approved production plan merely because an `operation_plan` record exists.

This amendment is motivated by B-01's finding that `apps/server/src/jobs/agronomy_agent.ts` currently writes `operation_plan_v1` directly after generating recommendation facts. B-01 did not identify a direct execution bypass; this amendment instead freezes the future object/authority boundary so Candidate/Recommendation semantics cannot silently inherit approval authority.

---

## A4. Migration ordering: Evidence convergence precedes Context and Decision convergence

The original architecture migration sequence remains architecture-level guidance, but its implementation order is amended by one mandatory precedence rule:

> **Canonical Observation and Evidence Qualification convergence must precede Context/Crop-Stage convergence and Candidate/Decision convergence.**

The reason is architectural, not project-management preference. Candidate unification over multiple competing Evidence truths would only normalize object shape while preserving duplicate authority underneath.

The bounded B-line implementation order is therefore:

```text
B-01  Semantic Ownership Audit
  ↓
B-02  Semantic Ownership Register + Parallel Authority Graph + Semantic Contract Linter
  ↓
B-03  Canonical Observation + Evidence Qualification Contracts
  ↓
B-04  Evidence Runtime convergence
  ↓
B-05  Context Authority / Crop Stage convergence
  ↓
B-06  CandidateDecision + decision-producer convergence
  ↓
B-07  Decision Eligibility Runtime
  ↓
B-08  Decision Episode + typed MCFT / ADR / LLM ports
  ↓
B-09  Shadow compare + authority removal + controlled deprecation
  ↓
Real MCFT + ADR + LLM integration
```

Architecture ownership remains defined by the V1 freeze candidate plus this amendment. Detailed B-line sequencing is governed by the B-line implementation documents; those implementation documents do not become repository-level SSOT and may not override the architecture invariants.

---

## A5. Evidence Qualification versus Decision Eligibility example

The architecture explicitly permits degraded operation when one evidence item loses authority but the action remains sufficiently supported.

Illustrative example:

```text
RH = 102.7 %
→ measurement_health = INVALID
→ physical_validity = FAIL
→ RH role_eligibility = INELIGIBLE

flow rate = unavailable
→ evidence state = MISSING

pressure = qualified
cumulative meter = qualified or LIMITED
other independent water-state evidence = qualified
```

The correct architecture does not derive:

```text
BAD SENSOR → BLOCK
```

by default.

Instead:

```text
Evidence Qualification
        ↓
remove/narrow authority of invalid items
        ↓
Decision Eligibility evaluates action-level sufficiency,
consequence, reversibility, policy, and remaining evidence
        ↓
PASS / DEGRADED / NEED_EVIDENCE / HUMAN_REVIEW / BLOCK
```

Therefore an irrigation candidate may validly resolve to `DEGRADED` even when one measurement is physically invalid, provided the required decision claims remain supported by other qualified, non-pseudo-redundant evidence.

---

## A6. Non-effects

This amendment does not:

- change the B-01 audit findings;
- implement B-02;
- change runtime code;
- disable the Agronomy Agent;
- change Stage-1 behavior;
- change Judge behavior;
- change MCFT Evidence/State/Forecast/Scenario semantics;
- create CanonicalObservationV1;
- create Evidence Qualification runtime;
- create Decision Eligibility runtime;
- create an ADR runtime;
- connect an LLM;
- change approval, AO-ACT, receipt, or acceptance behavior;
- authorize a protected-main merge.

The architecture remains a candidate until the normal review/merge path completes.
