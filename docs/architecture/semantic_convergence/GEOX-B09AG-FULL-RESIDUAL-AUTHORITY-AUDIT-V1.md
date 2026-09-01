# GEOX B-09ag Full Residual Authority Audit V1

## Mission

During MCFT-9 parallel closure, B-Line owns whole-repository semantic/authority debt discovery and closure.

MCFT completion must leave only final typed integration work. B-09ag therefore audits residual authority before any broad authority removal.

## Frozen audit snapshots

- protected main: `fa6e260d8cdec4a82403a86f1c7b3d5420e44ef8`
- latest accepted B-Line head: `3450f932e345e1d0b880a45b9f2613eba9833fcb`
- active Deere PR #3346 head: `605d256d5e4a02a18fee89e5a6db755af3f97e18`

The dual main/B-Line view is mandatory. Current main contains product surfaces not replayed into the stacked B-Line ancestry; B-Line contains canonical convergence code not present on current main.

A later main drift requires another residual audit before convergence cutover.

## Why existing B-02 is insufficient

The existing B-02 linter strongly validates registered producers, consumers, static guards and graph edges.

It does not prove that every pre-existing authority-capable production path has been registered.

Therefore a graph can be internally consistent while still omitting a planner, route, job, worker or adapter.

B-09ag adds reverse discovery:

```
semantic object / fact / table
        ↓
all repository files mentioning it
        ↓
writer / mutating route / job / worker / producer transform detection
        ↓
residual inventory
        ↓
missing inventory entry = FAIL
```

Failure code:

`UNREGISTERED_AUTHORITY_CAPABLE_PATH`

B-09ag does not yet mutate the original B-02 register or graph. That reconciliation is the next package after discovery is exhaustive.

## Independently confirmed defects

### RA-001 — agronomy_agent

`apps/server/src/jobs/agronomy_agent.ts`

Confirmed chain:

```
missing soil telemetry
→ no_telemetry counter/log only
→ no continue
→ DEFAULT_SOIL_MOISTURE = 30
→ agronomy recommendation
→ decision_recommendation_v1
→ direct operation_plan_v1
```

The fallback value is also written as the recommendation rule-hit actual value and action parameter.

Classification:

`CONFIRMED_SEMANTIC_DEFECT / P0`

No behavior is changed by B-09ag.

### RA-009 — operator dispatch

`apps/server/src/routes/v1/operator_dispatch_actions.ts`

The route directly persists:

```
ao_act_dispatch_v1
status = DISPATCHED | RETRY_DISPATCHED
```

after an operator action.

Current-main code search finds the `ao_act_dispatch_v1` writer only in this route.

The canonical AO-ACT runtime in `control_ao_act.ts` instead maintains task/execution-attempt/skill/receipt semantics and requires downstream execution evidence.

Therefore operator request and external delivery are currently represented by incompatible dispatch semantics.

Classification:

`CONFIRMED_SEMANTIC_DEFECT / P0`

B-09ag does not change dispatch behavior.

### RA-002 — planner/compiler

`apps/server/src/domain/planner/compiler_v1.ts`

Runtime reachable through:

`GET /api/v1/programs/:program_id/actions`

It reads latest FieldProgram and interprets `execution_policy` into:

- AUTO
- APPROVAL_REQUIRED
- BLOCKED

This is an execution-policy/planning surface. It is not DecisionEligibility.

Classification:

`CONFIRMED_AUTHORITY_AMBIGUITY / P1`.

## Under-registered but boundary-healthy examples

### Root-zone recommendation submission builder

The builder is candidate-only and explicitly sets human approval required / no direct execution / no downstream writes.

Its defect is missing machine registration, not an observed direct-execution semantic bug.

### Twin decision cycle

The decision-cycle object is trace/state-machine oriented and explicitly forbids recommendation/forecast/scenario auto-jumps to task.

It still must be inventoried because it influences decision-chain traceability.

### Human executor

Human work assignment has its own assignment lifecycle, but submit delegates the actual execution receipt through `/api/v1/actions/receipt`.

This is compatible with treating HUMAN as an execution adapter, not a parallel receipt authority.

It remains under-registered.

## Prescription boundary

Prescription creation is retained as action specification/materialization.

The prescription route can submit a READY_FOR_APPROVAL prescription into the approval-request service, but does not itself decide approval or eligibility.

It must be registered as an action-specification producer plus approval-submission adapter.

## Deere

PR #3346 is not in current B-Line ancestry, so it cannot be silently treated as current product runtime.

It is nevertheless an active product frontier and is included as a third audit snapshot.

Its current contract is source-evidence only and explicitly does not create Receipt, Acceptance, Twin State or canonical decision authority.

Outbound Deere execution integration is not implemented by B-09ag.

## Additional reverse-scan surfaces

The initial reverse scan also identified authority-capable paths not present in the user's original missed list, including:

- `apps/executor/src/run_once.ts`
- approval request/decision builders
- approved-decision → operation-plan builder
- operation-plan → AO-ACT task builder
- AO-ACT receipt builder
- receipt → AsExecuted builder
- Acceptance result builder
- Field Memory writer
- ROI ledger writer

Not every one is semantically defective. They require explicit inventory classification because they can influence the governed decision/execution/outcome spine.

## Current execution-family problem

The current ownership registry uses the combined semantic:

`execution.task_receipt_acceptance`

That family is too coarse to distinguish:

- task
- dispatch intent
- dispatch delivery/proof
- external work plan
- result evidence
- reconciliation
- receipt
- as-executed
- acceptance verdict
- outcome evidence

B-09ag records this as a taxonomy debt. It does not perform the split yet.

## Closure rule

B-09ag is exhaustive only when the reverse scanner passes on all frozen snapshots with no:

`UNREGISTERED_AUTHORITY_CAPABLE_PATH`

The next package may then reconcile B-02 ownership register/graph and wire the residual scanner into mandatory governance.

No authority removal is permitted before that reconciliation.
