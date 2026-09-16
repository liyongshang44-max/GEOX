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
- every `grandfathered_duplicate` has `removal_target = B-09`; earlier replacement/convergence timing is expressed by the semantic `target_phase`;
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
  "target_phase": "B-06",
  "removal_target": "B-09"
}
```

This is not approval of the current authority arrangement.

It means:

```text
current behavior remains unchanged in B-02
current duplicate remains visible
new duplicate is forbidden
the semantic `target_phase` owns replacement/convergence work; B-09 owns actual historical authority removal
```

Current convergence examples include:

- Stage-1 / Evidence Judge evidence convergence -> semantic target phase B-04;
- field-program/stage-resolver/rule-engine stage convergence -> semantic target phase B-05;
- Agronomy Rule/Judge/Decision Engine candidate/calculation convergence -> semantic target phase B-06;
- Decision Eligibility convergence -> semantic target phase B-07;
- legacy/projection physical-state replacement remains governed by the Twin/MCFT target boundary.

Under Amendment-01, these earlier target phases do not authorize deletion or authority removal. For every historical grandfathered duplicate, actual `removal_target` is B-09 after replacement, shadow comparison, divergence inventory and consumer migration.

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


---

## B-02 Connectivity Amendment 01

Status: **part of B-02; B-03 remains blocked until the B-02 completion gate passes**

B-02 is expanded from semantic ownership governance into the following bounded machine-readable repository map:

```text
Semantic Ownership
        +
Runtime Connectivity
        =
B-02 machine-readable repository map
```

This amendment does not change B-03/B-04 architecture ordering and does not mutate runtime semantics.

### Capability is not wiring

The register now separates:

```text
registered_consumer
= contract/API/code capable of consuming this semantic

runtime_consumer
= repository evidence proves current runtime wiring
```

Every registered producer and consumer carries:

```text
connection_class
activation
runtime_edge
```

The allowed connection classes include MAINLINE, ACTIVE_PARALLEL, ROUTE_ISLAND, MANUAL_SEAM,
ACCEPTANCE_LIBRARY_ISLAND, COMPATIBILITY, DEVTOOLS_ONLY, ORPHANED, INTENTIONAL_ISOLATION,
REGISTERED_CAPABILITY_ISLAND, ACTIVE_LEGACY_WRITER, LOCAL_DIRECT_CALL, and REPORTING_ARTIFACT_PLANE.

### Exact-main connectivity adjudications recorded

The machine map records at least these B-02 results:

- Agronomy Agent: ACTIVE_PARALLEL.
- Evidence Judge V2: ROUTE_ISLAND.
- Agronomy Judge V2: ROUTE_ISLAND.
- Execution Judge V2: ROUTE_ISLAND with a proven execution-memory side effect.
- Generic Skill Runtime: REGISTERED_CAPABILITY_ISLAND; Judge irrigation skills remain LOCAL_DIRECT_CALL.
- evaluateIrrigationDecisionV1: ORPHANED / NOT_REFERENCED.
- legacy root-zone State / Forecast / Scenario builders: ACCEPTANCE_LIBRARY_ISLAND.
- legacy Operator scenario-to-recommendation POST module: ACTIVE_LEGACY_WRITER and CURRENT_PROVEN registration.
- Agronomy Inference: ROUTE_ISLAND.
- Agronomy Interpretation: INTENTIONAL_ISOLATION from deterministic Judge/Decision authority.
- existing EvidenceModule: REPORTING_ARTIFACT_PLANE, not the future canonical Evidence Runtime.
- Flight Table/simulator: DEVTOOLS_ONLY with intentional production-authority isolation.
- Acceptance -> Water Response Verification: MANUAL_SEAM; no automatic call is proven.

One proposed classification is corrected by exact-main code evidence:

```text
Acceptance -> Field Memory
```

is **not** a MANUAL_SEAM on the audited baseline. `apps/server/src/routes/acceptance_v1.ts` directly calls
`recordMemoryV1` when verdict is PASS, formal_acceptance is true, and field_id exists. B-02 therefore records this
edge as MAINLINE / API_ONLY / PROVEN / CURRENT_PROVEN. B-02 records code truth rather than forcing the planned label.

### Judge wiring distinction

`/api/v1/judge/evidence/evaluate` and `/api/v1/judge/agronomy/evaluate` are separate POST routes.
The Agronomy Judge request can carry `evidence_judge_id` / `evidence_judge_verdict`, but the route does not
automatically load and execute Evidence Judge before Agronomy Judge. Therefore:

```text
EvidenceJudgeV2 -> AgronomyJudgeV2
contract_compatible = true
runtime_edge = NOT_PROVEN
status = NOT_WIRED
```

### Connectivity linter rules

The B-02 linter now enforces explicit, mechanically provable rules corresponding to:

- RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE
- ROUTE_ISLAND_MUST_BE_EXPLICIT
- ACTIVE_LEGACY_WRITER_MUST_BE_REGISTERED
- ORPHANED_SEMANTIC_EXPORT_MUST_BE_REGISTERED
- MANUAL_SEAM_MUST_BE_EXPLICIT
- DECLARED_RUNTIME_EDGE_REQUIRES_EVIDENCE
- DEVTOOLS_ONLY_PATH_MUST_NOT_BE_PRODUCTION_CONSUMER
- COMPATIBILITY_PRODUCER_CANNOT_GAIN_NEW_RUNTIME_CONSUMER

It remains STATIC_EXPLICIT_ONLY. It does not claim arbitrary TypeScript semantic inference.

### Coverage output

A successful exact-head linter run prints both:

```text
B02_SEMANTIC_REGISTER_STATS ...
B02_CONNECTIVITY_STATS ...
B02_SEMANTIC_CONTRACT_LINTER_PASS
```

The connectivity stats include mainline edges, active parallel edges, route islands, manual seams,
acceptance-only islands, active legacy writers, orphans, intentional isolation, registered capability islands,
reporting artifact plane, and unproven runtime edges.

`unknown_unclassified_production_edge = 0` means zero unknown edges inside the explicit B-02 audited/scanned
scope. It does not claim whole-program semantic inference beyond that scope.

### B-02 completion gate

B-02 is COMPLETE only when all of the following are green on one exact B-02 head:

```text
Ownership Register                         PASS
Parallel Authority Graph                   PASS
Forbidden Edge Graph                       PASS
Connectivity classification                PASS
Connectivity edges                         PASS
Static linter                              PASS
Exact-head general CI                      PASS
Existing MCFT governance/release lanes     PASS
Unknown unclassified production edge       0
```

Until then:

```text
DO NOT START B-03
DO NOT MODIFY RUNTIME SEMANTICS
DO NOT DISABLE AGRONOMY AGENT
DO NOT REWIRE JUDGE
DO NOT MODIFY MCFT
DO NOT DELETE LEGACY CODE
```
