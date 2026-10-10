# GEOX B-Line Residual Authority Audit V1

## Status

Status: **active governance implementation / no business behavior change**

Audit branch:

```text
governance/bline-residual-authority-audit-v1
```

Audit basis:

```text
B-Line accepted base:
3450f932e345e1d0b880a45b9f2613eba9833fcb

protected main observed during fresh audit:
fa6e260d8cdec4a82403a86f1c7b3d5420e44ef8
```

MCFT boundary:

```text
DO NOT MODIFY MCFT IMPLEMENTATION
```

This package changes governance only. It does not change runtime behavior, database semantics, business rules, product API behavior, MCFT implementation, Deere behavior, Approval behavior, AO-ACT behavior, Acceptance behavior, or authority ownership.

---

## 1. Mission

The B-Line mission is now narrowed to:

> During MCFT-9 parallel closure, complete GEOX whole-repository semantic/authority debt closure so that after MCFT completion only final typed integration and governed cutover remain; do not redesign the product skeleton after MCFT.

The immediate frontier is therefore not authority removal.

The immediate frontier is:

```text
FULL RESIDUAL AUTHORITY AUDIT
        ↓
complete machine inventory
        ↓
prove no unregistered authority-capable surface
        ↓
close non-MCFT semantic debt
        ↓
wait for MCFT canonical State/Forecast/crop-stage authority
        ↓
typed integration
        ↓
shadow/cutover
        ↓
authority removal
```

---

## 2. Why B-02 is insufficient for this frontier

The current B-02 contract intentionally states:

```text
linter_scope = STATIC_EXPLICIT_ONLY
```

and its original purpose was:

```text
freeze known debt
prevent known patterns from proliferating
```

It explicitly did **not** claim arbitrary whole-repository semantic inference.

Fresh audit confirms that this limitation now matters.

The B-09y Semantic Ownership Register and Parallel Authority Graph do not register several authority-capable product/runtime surfaces, including:

```text
apps/server/src/domain/planner/compiler_v1.ts
apps/server/src/routes/programs_core_v1.ts
apps/server/src/domain/prescription/prescription_contract_v1.ts
apps/server/src/routes/prescriptions_v1.ts
apps/server/src/routes/v1/operator_dispatch_actions.ts
apps/server/src/routes/human_executors_v1.ts
apps/server/src/domain/twin_kernel/decision_cycle_v1.ts
apps/server/src/domain/soil_water/root_zone_scenario_recommendation_submission_builder_v1.ts
apps/executor/src/run_dispatch_once.ts
```

The existing B-02 linter is also not called directly by the current package scripts or general CI workflow.

Therefore:

```text
B02_PASS
!=
whole repository has no residual authority-capable path
```

This package exists to close that proof gap.

---

## 3. Fresh audit findings

### 3.1 Planner is runtime reachable and under-registered

`apps/server/src/domain/planner/compiler_v1.ts` builds `CandidateActionV1`.

It derives:

```text
AUTO
APPROVAL_REQUIRED
BLOCKED
```

from `FieldProgram.execution_policy`.

The result is exposed through:

```text
GET /api/v1/programs/:program_id/actions
```

in `apps/server/src/routes/programs_core_v1.ts`.

The route is runtime reachable through:

```text
programs_core_v1
→ programs_read_v1
→ programs_v1
→ field module
```

Required convergence rule:

```text
FieldProgram.execution_policy
may describe downstream execution policy

but must not become
DecisionEligibility PASS

and must not mean
external dispatch succeeded
```

Target semantic flow:

```text
Planner
→ PlanningOption / CalculationResult
→ CandidateDecision
→ DecisionEligibility
→ Approval / explicit execution policy
→ OperationPlan
→ AO-ACT
```

---

### 3.2 Dispatch currently has at least three meanings of DISPATCHED

Fresh audit found three different events sharing the same word.

#### Operator route

`apps/server/src/routes/v1/operator_dispatch_actions.ts` writes:

```text
ao_act_dispatch_v1
status = DISPATCHED
```

directly from the operator action route.

This proves operator intent, not external delivery.

#### AO-ACT queue claim

`apps/server/src/domain/controlplane/task_service.ts` changes:

```text
READY
→ DISPATCHED
```

when an executor claims/leases a queue item.

This proves queue ownership/lease, not external delivery.

#### Executor runtime

`apps/executor/src/run_dispatch_once.ts` writes `DISPATCHED` before:

```text
adapter.execute(...)
```

and only later writes `ACKED` after adapter success.

This proves another different runtime stage.

Therefore current code effectively has:

```text
operator requested
= DISPATCHED

queue claimed
= DISPATCHED

adapter about to execute
= DISPATCHED
```

These are not the same fact.

Required execution-family split:

```text
execution.task
execution.dispatch_intent
execution.dispatch_delivery
execution.external_work_plan
execution.result_evidence
execution.reconciliation
execution.receipt
execution.as_executed
acceptance.verdict
outcome.evidence
```

At minimum the future state model must distinguish:

```text
DISPATCH_REQUESTED
CLAIMED / LEASED
SEND_ATTEMPTED
PROVIDER_ACCEPTED / PUBLISHED
ACKED
RECEIPT_RECEIVED
AS_EXECUTED
ACCEPTED
```

Exact names remain a later contract decision. This audit does not rename runtime state yet.

---

### 3.3 Human execution is correctly converging but not registered

`apps/server/src/routes/human_executors_v1.ts` has an explicit human assignment lifecycle:

```text
ASSIGNED
→ ACCEPTED
→ ARRIVED
→ SUBMITTED
```

On submit it validates `HumanWorkReceiptV1` and delegates into:

```text
POST /api/v1/actions/receipt
```

This is directionally correct.

It should be classified as:

```text
Execution Adapter = HUMAN
```

not as a parallel execution truth.

Required canonical downstream shape:

```text
AO-ACT Task
→ Human Assignment
→ Human Work Evidence
→ canonical Receipt
→ AsExecuted
→ Acceptance
```

The audit defect is that this active adapter family was not present in the B-Line machine ownership inventory.

---

### 3.4 Twin decision-cycle is trace-only but contains a semantic conflation

`apps/server/src/domain/twin_kernel/decision_cycle_v1.ts` correctly states that it does not write recommendations, approvals, tasks, receipts, acceptance, ROI, Field Memory, model parameters, or downstream operations.

That boundary is good.

However its state-machine projection currently marks:

```text
DISPATCHED = hasRef(act_task_id)
```

Task existence is not dispatch proof.

Therefore this file should remain a trace/projection surface but its dispatch-stage derivation must eventually consume dispatch evidence, not task existence.

This is exactly why residual audit includes projection/status derivation, not only database writers.

---

### 3.5 Root-zone scenario candidate builder is authority-capable even though it is pure

`root_zone_scenario_recommendation_submission_builder_v1.ts` is a pure builder with no DB I/O.

It nevertheless constructs a `decision_recommendation_v1` candidate payload.

Therefore:

```text
no DB write
!=
not authority-capable
```

The future scan must include semantic builders, not only SQL/fact writers.

---

### 3.6 Old operator_twin.ts is code-capable but not currently active

The old:

```text
apps/server/src/routes/v1/operator_twin.ts
```

contains recommendation write code even though its header describes the surface as read-only.

However current `registerOperatorModule` registers:

```text
operator_twin_read_legacy_v1.ts
operator_twin_write_legacy_v1.ts
```

rather than the old `operator_twin.ts`.

Therefore the correct classification is:

```text
STALE_ORPHAN_AUTHORITY_CAPABLE_SURFACE
runtime reachable = NOT_PROVEN
```

not active writer.

This is an important audit rule:

```text
code capability
and
runtime activation
must be separate fields
```

---

### 3.7 Prescription is more than a passive action-spec today

`prescription_contract_v1.ts` currently derives:

```text
approval_requirement
READY_FOR_APPROVAL
risk
acceptance_conditions
```

from recommendation semantics.

Therefore the current implementation cannot simply be labelled “action spec only” without qualification.

Target responsibility remains:

```text
Prescription
= Action Specification
```

but the residual audit must first record the current mixed semantics so that later convergence does not silently erase real behavior.

---

### 3.8 Deere #3346 boundary is currently correct

Draft PR #3346 at:

```text
605d256d5e4a02a18fee89e5a6db755af3f97e18
```

maps Deere FieldOperation into:

```text
ExternalOperationSourceEvidenceV1
```

with explicit hard boundaries:

```text
no CanonicalObservation
no EvidenceQualification
no GEOX Task
no Receipt
no Acceptance
no Twin State
no Business Closure
no silent canonical field/product/machine identity promotion
```

Therefore Deere is currently an inventory/integration gap, not a demonstrated authority-escalation bug.

It remains a separate stacked branch and is not replayed into this audit branch.

---

## 4. Audit method

The residual audit must scan the following classes independently.

### A. Persistence writers

Detect:

```text
facts
semantic tables
projection tables
queue tables
SQL function/trigger writes
migration-created runtime behavior
```

### B. Semantic builders

Detect constructors/builders that can create:

```text
CanonicalObservation
EvidenceQualification
ContextSnapshot
CropStage
State
Forecast
Scenario
CalculationResult
CandidateDecision
decision_recommendation_v1
CandidateAction
DecisionEligibility
approval_request
approval_decision
prescription
operation_plan
AO-ACT task
dispatch records
receipt
as-executed
acceptance
outcome
Field Memory
ROI
```

even when the builder itself performs zero I/O.

### C. Projection/status derivation

Detect code that can state or imply:

```text
eligible
approved
ready
dispatched
acked
executed
accepted
successful
formalized
```

from weaker evidence.

### D. Runtime entrypoints

Trace:

```text
routes
jobs
services
module registration
worker bootstrap
executor entrypoints
feature flags
GitHub/runtime scripts
external adapters
```

A surface is not classified ACTIVE until an activation path is proven.

---

## 5. Reverse scan model

The machine audit is organized around:

```text
semantic object / table / fact type
        ↓
all builders and writers
        ↓
all route/job/worker entrypoints
        ↓
activation path
        ↓
all consumers/projections
```

Every detected authority-capable path must either:

1. exist in `GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json`; or
2. fail with:

```text
UNREGISTERED_AUTHORITY_CAPABLE_PATH
```

No unknown finding may be silenced by adding an allowlist before classification.

---

## 6. Non-effects

This package does not:

- change planner output;
- change `execution_policy`;
- change `DEFAULT_SOIL_MOISTURE`;
- disable Agronomy Agent;
- refactor Decision Engine;
- change Prescription behavior;
- rename DISPATCHED yet;
- change queue state transitions;
- change executor runtime;
- change Human Executor behavior;
- change Twin Kernel runtime;
- change root-zone scenario behavior;
- modify MCFT;
- merge Deere #3346;
- create canonical State/Forecast/crop-stage authority;
- connect B-07e runtime;
- remove any historical authority.

---

## 7. Exit criteria

Residual Audit V1 is not complete merely because the seed inventory exists.

Completion requires one exact head where:

```text
inventory schema validation                          PASS
all registered current paths exist                  PASS
whole-repo authority-capable reverse scan           PASS
semantic builder scan                               PASS
writer scan                                         PASS
projection/status derivation scan                   PASS
route/job/worker activation scan                    PASS
UNREGISTERED_AUTHORITY_CAPABLE_PATH count           0
B02 semantic contract linter                        PASS
general CI                                          PASS
full acceptance                                     PASS
MCFT boundary checks                                PASS
Deere boundary checks where branch material exists PASS
business behavior delta                             0
MCFT implementation delta                           0
```

Only after this gate is closed should B-Line proceed into non-MCFT semantic repairs and later authority removal.
