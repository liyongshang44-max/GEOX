# GEOX B-02 Semantic Ownership Register + Parallel Authority Graph + Semantic Contract Linter V1

## 0. Status and authority

Status: **proposal / implementation-governance output**

Repository-level SSOT: `docs/SSOT.md`

Sprint / Tag / Freeze authority: `README_MIGRATION.md`

B-line charter:

- `docs/architecture/semantic_convergence/GEOX-BLINE-CHARTER-V1.md`
- `docs/architecture/semantic_convergence/GEOX-BLINE-CHARTER-V1-AMENDMENT-01-EVIDENCE-FIRST-SEQUENCE.md`

B-01 audit:

- `docs/architecture/semantic_convergence/GEOX-B01-SEMANTIC-OWNERSHIP-AUDIT-V1.md`

Exact protected-main audit basis:

```text
26c1383f7f45abb76c99e28ec3d06714e85d1b2c
```

Stacked implementation basis:

```text
docs/bline-b01-semantic-convergence-v1
head at B-02 branch creation:
6e82367d89f284643368ebdce12f9b02d0e20d3d
```

B-02 does not create repository-level architecture authority. It does not activate the target owners described in PR #3300, does not mutate runtime semantics, and does not claim that B-03/B-04/B-05/B-06/B-07/B-08/B-09 have been implemented.

---

## 1. B-02 purpose

B-01 identified the parallel semantic-authority problem. B-02 turns that human audit into explicit machine-readable governance.

B-02 has three outputs:

```text
Semantic Ownership Register
+
Parallel Authority Graph
+
Semantic Contract Linter
```

The goal is deliberately limited:

> **Do not repair current semantic debt in B-02. Prevent that debt from silently growing while later B-line phases replace it in a controlled order.**

B-02 therefore introduces the distinction:

```text
existing duplicate authority
= grandfathered and visible

new unregistered duplicate authority
= forbidden
```

---

## 2. Files

### 2.1 Semantic Ownership Register

```text
docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json
```

The register records, per semantic:

```text
semantic_id
question
target_owner
canonical_output_type
current_state
target_phase
new_owner_creation
registered_producers
registered_consumers
grandfathered_duplicate
removal_target
```

It currently covers the critical B-01 families and the preserved downstream boundaries:

```text
raw observation
evidence qualification
context identity
crop stage
physical State
Forecast / Scenario
Agronomy Interpretation
deterministic decision calculation
Candidate Decision
Decision Eligibility
Approval
Operation Plan
AO-ACT / Receipt / Acceptance
presentation/read model
```

The register is not claiming that target contracts such as `CanonicalObservationV1`, `EvidenceQualificationV1`, `CandidateDecisionV1`, or `DecisionEligibilityDecisionV1` exist in runtime today. Their target phase is explicitly recorded.

### 2.2 Parallel Authority Graph

```text
docs/architecture/semantic_convergence/GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json
```

The graph separates three edge classes:

```text
semantic_edges
current_parallel_edges
forbidden_edges
```

`current_parallel_edges` names existing grandfathered debt and gives it a removal/convergence target.

`forbidden_edges` encode architecture prohibitions without pretending all of them are statically enforceable today.

Each forbidden edge therefore carries an explicit enforcement class such as:

```text
DECLARATIVE
DECLARATIVE_EXISTING_CONSTITUTION
STATIC_FINGERPRINT_FOR_KNOWN_DEFAULT_PLUS_TARGET_DECLARATIVE
TARGET_DECLARATIVE_UNTIL_B-04/B-06
```

This prevents the B-02 linter from claiming semantic understanding it does not have.

### 2.3 Semantic Contract Linter

```text
scripts/governance_acceptance/ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs
```

Run from repository root:

```bash
node scripts/governance_acceptance/ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs
```

Pass marker:

```text
B02_SEMANTIC_CONTRACT_LINTER_PASS
```

Failure marker:

```text
B02_SEMANTIC_CONTRACT_LINTER_FAIL
```

---

## 3. What the linter actually proves

The linter is intentionally narrow.

It proves machine-checkable facts only.

### 3.1 Register integrity

It checks:

- semantic IDs are unique;
- target owner/output/new-owner rule are declared;
- producer IDs are unique;
- current registered producer/consumer paths exist;
- declared producer fingerprints still exist;
- every `grandfathered_duplicate` has a bounded B-04 through B-09 removal target;
- weak/no-control grandfather registration is rejected.

### 3.2 Graph integrity

It checks:

- all graph semantic IDs exist in the register;
- all current-parallel producer IDs exist in the matching semantic;
- edge IDs are unique;
- current parallel debt has a removal target and `new_owner_creation = FORBIDDEN`;
- forbidden edges have a reason and an explicit enforcement class.

### 3.3 Explicit static touchpoint guards

The first B-02 guard set covers six high-value, mechanically detectable cases.

#### Guard 1 — crop-stage resolver proliferation

Current registered production touchpoints:

```text
stage_resolver.ts
context_builder.ts
rule_engine.ts
decision_engine_v1.ts
field_program_state_v1.ts
operation_state_v1.ts
```

A new production file that starts using the known crop-stage resolver signatures without registration fails.

#### Guard 2 — irrigation calculation proliferation

Current registered touchpoints for:

```text
runIrrigationRequirementSkillV1
runIrrigationDeficitSkillV1
```

are frozen into the register. New unregistered production touchpoints fail.

#### Guard 3 — current evidence-qualification entrypoint proliferation

The known Stage-1 and Evidence-Judge qualification entrypoints are registered.

A new file using those explicit entrypoint signatures without registration fails.

#### Guard 4 — Agronomy Agent direct operation-plan fingerprint

The existing path:

```text
apps/server/src/jobs/agronomy_agent.ts
```

is the only registered file allowed to contain both:

```text
agronomy_agent_auto_create
operation_plan_v1
```

This does not bless that path as canonical. It freezes it as visible grandfathered debt so a copy cannot silently appear elsewhere.

#### Guard 5 — fabricated soil-moisture fallback fingerprint

The known combination:

```text
DEFAULT_SOIL_MOISTURE
effectiveSoilMoisture
```

is grandfathered at the existing Agronomy Agent path only.

B-02 does not modify that behavior. It prevents a second copy of the same explicit fallback pattern from appearing unregistered.

The canonical prohibition remains the architecture/B-line rule:

```text
missing Evidence
must not become fabricated authoritative observation
```

The runtime repair belongs to later phases.

#### Guard 6 — Decision Engine integration hotspot

`apps/server/src/routes/decision_engine_v1.ts` is statically guarded against direct future implementation imports containing:

```text
/adr/
/llm/
/mcft/
```

This is not a complete import-boundary system. It is an explicit B-02 tripwire against using the already identified composition hotspot as the direct landing zone for the three future integration families.

---

## 4. What the linter does NOT prove

B-02 must not overclaim.

The linter does **not** prove that it can understand arbitrary TypeScript business semantics.

It does not detect every logically equivalent implementation of:

```text
Evidence Qualification
crop-stage derivation
physical State construction
recommendation generation
operation-plan formation
```

A developer could write logically equivalent code with different names and evade a string/fingerprint guard.

Therefore the B-02 linter is one layer of governance, not a substitute for review, contracts, architecture tests, or later runtime convergence.

Its contract is narrower:

> **Registered explicit owners/touchpoints remain visible, and known high-risk patterns cannot proliferate silently.**

---

## 5. Grandfathered debt policy

B-02 follows the amended Charter exactly.

Current debt is represented explicitly, for example:

```json
{
  "grandfathered_duplicate": true,
  "new_owner_creation": "FORBIDDEN",
  "removal_target": "B-06"
}
```

This is not approval of the current authority arrangement.

It means:

```text
current behavior remains unchanged in B-02
current duplicate remains visible
new duplicate is forbidden
later convergence phase owns authority removal
```

Current examples include:

- Stage-1 evidence qualification semantics -> B-04;
- Evidence Judge raw qualification semantics -> B-04;
- field-program/stage-resolver/rule-engine stage derivation -> B-05;
- Agronomy Rule/Judge/Decision Engine candidate/calculation overlap -> B-06;
- Agronomy Agent recommendation/direct-plan authority -> B-06;
- legacy/projection physical-state ownership -> B-09.

---

## 6. B-02 non-effects

B-02 does not:

- change `AGRONOMY_AGENT_ENABLED`;
- remove `DEFAULT_SOIL_MOISTURE = 30`;
- change Stage-1 trigger semantics;
- change Evidence Judge behavior;
- change Agronomy Judge behavior;
- change crop-stage resolver behavior;
- create `CanonicalObservationV1` runtime;
- create Evidence Qualification runtime;
- change MQTT/API/raw-sample ingestion;
- change MCFT Evidence/State/Forecast/Scenario semantics;
- create Context Authority runtime;
- create CandidateDecision runtime;
- create Decision Eligibility runtime;
- create Decision Episode runtime;
- connect MCFT;
- activate ADR;
- connect an LLM;
- change Approval/AO-ACT/Receipt/Acceptance behavior;
- modify database schema;
- modify workflows/CI;
- delete legacy code.

---

## 7. B-02 exit criteria

B-02 is complete only when all of the following are true:

```text
[ ] machine-readable Ownership Register exists
[ ] machine-readable Parallel Authority Graph exists
[ ] all grandfathered duplicates have removal targets
[ ] new-owner creation policy is explicit
[ ] forbidden semantic edges are enumerated
[ ] static linter validates register/graph integrity
[ ] known crop-stage touchpoints are guarded
[ ] known irrigation-calculator touchpoints are guarded
[ ] known evidence-qualification touchpoints are guarded
[ ] Agronomy Agent direct-plan fingerprint is grandfathered at one path only
[ ] DEFAULT_SOIL_MOISTURE fallback fingerprint is grandfathered at one path only
[ ] decision_engine_v1 future ADR/LLM/MCFT direct-import tripwire exists
[ ] no runtime/schema/workflow behavior changed
```

Once these gates pass, the next B-line frontier is exactly:

```text
B-03 — Canonical Observation + Evidence Qualification Contracts
```

B-03 may define typed contracts and negative fixtures, but still must not rewrite MCFT semantics.
