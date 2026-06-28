# docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md

## Stage

```text
Post Twin Kernel v1 / Production Hardening & Integration Prep
```

## Baseline

Twin Kernel v1 is frozen by:

```text
tag: twin_kernel_v1_completion_review
acceptance: TWIN_KERNEL_V1_COMPLETION_REVIEW
capability_level: Twin Kernel v1 bounded human-gated execution-to-learning loop
```

The frozen v1 loop is:

```text
production source refs
→ decision_cycle_v1
→ operator queue
→ operator session
→ operator review
→ explicit ROI formalization
→ explicit Field Memory formalization
→ trace readback
→ business closure readback
```

## Correction carried into post-v1

TK16 is accepted as a configurable multi-scope regression harness framework.

TK16 must not be described as full strong fixture coverage.

The strong fixture requirement remains open for post-v1:

```text
At least 3 project/group/field scopes.
At least 2 seasons.
At least 2 crops.
Pointer refs must not cross fields.
Decision cycles must not cross seasons.
Field Memory records must not cross crops.
```

## Phase constraint

Post-v1 hardening must not rewrite Twin Kernel v1 completion facts.

Post-v1 hardening must not make the kernel autonomous unless a later policy-controlled task explicitly changes the boundary.

The following remain absent by design until explicitly introduced:

```text
automatic recommendation
automatic approval
automatic AO-ACT task creation
automatic receipt creation
automatic acceptance creation
automatic production ROI formalization
automatic Field Memory policy write
automatic model update
```

## Execution order

```text
POSTV1-01 Production Hardening Baseline
POSTV1-02 Strong Multi-Scope Fixture Pack
POSTV1-03 Ingestion Idempotency & Error Taxonomy
POSTV1-04 Route Negative Runtime Matrix
POSTV1-05 Adapter Contract Registry
POSTV1-06 Operator UX Closure Cards
POSTV1-07 Policy-Controlled ROI Preview
POSTV1-08 Field Memory Governance Policy
POSTV1-09 Execution Adapter Bridge
```

## POSTV1-01 — Production Hardening Baseline

### Goal

Create the post-v1 task line and freeze the hardening baseline without changing runtime behavior.

### Required changes

```text
docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md
docs/tasks/POSTV1-01-Production-Hardening-Baseline.md
scripts/governance_acceptance/POSTV1_01_PRODUCTION_HARDENING_BASELINE.cjs
```

### Acceptance

```powershell
node scripts/governance_acceptance/POSTV1_01_PRODUCTION_HARDENING_BASELINE.cjs
```

### Boundary

```text
No runtime route.
No migration.
No UI.
No business object.
No change to Twin Kernel v1 semantics.
```

## POSTV1-02 — Strong Multi-Scope Fixture Pack

### Goal

Implement the missing strong fixture pack that was originally described under TK16 but not fulfilled by the default TK16 acceptance run.

### Fixture requirements

```text
At least 3 project/group/field scopes.
At least 2 seasons.
At least 2 crops.
At least 6 total fixture cases.
```

### Acceptance

```text
candidate_count >= 6
project/group/field scope isolation is verified
season isolation is verified
crop isolation is verified
pointer refs remain case-local
business closure remains case-local
```

### Boundary

```text
No new kernel semantics.
No performance optimization.
No adapter integration.
Only fixture coverage and isolation regression.
```

## POSTV1-03 — Ingestion Idempotency & Error Taxonomy

### Goal

Make production ingestion safer to operate repeatedly and easier to diagnose.

### Scope

```text
source_system + source_event_id idempotency readback
stable duplicate response semantics
structured error code ledger
negative tests for required fields
negative tests for invalid timestamps
negative tests for malformed source refs
```

### Boundary

```text
No new production adapter.
No automatic business decision.
No change to formalization semantics.
```

## POSTV1-04 — Route Negative Runtime Matrix

### Goal

Add systematic negative runtime acceptance for TK13 through TK18 public surfaces.

### Scope

```text
missing ids
unknown ids
malformed bodies
wrong stage attempts
wrong session/review pairing
forbidden automatic-write assertions
```

### Boundary

```text
No new routes.
No schema expansion unless required by an observed bug.
```

## POSTV1-05 — Adapter Contract Registry

### Goal

Define known source systems and their source ref contract versions.

### Scope

```text
source_system registry
source_contract_version registry
adapter checkpoint rules
raw payload pointer policy
repair/replay policy
```

### Boundary

```text
No actual external adapter yet.
No ingestion of private vendor payloads into semantic fields.
```

## POSTV1-06 — Operator UX Closure Cards

### Goal

Expose the TK18 business closure readback in the operator production workflow UX.

### Scope

```text
closure status card
trace link
ROI / Field Memory pointer display
missing closure reason display
error state display
```

### Boundary

```text
No automatic formalization.
No dispatch UI.
No priority/risk scoring.
```

## POSTV1-07 — Policy-Controlled ROI Preview

### Goal

Add preview-only ROI calculation under explicit policy and evidence inputs.

### Boundary

```text
Preview is not formal ROI.
Preview cannot update decision_cycle_v1 external refs.
Operator action remains required to formalize ROI.
```

## POSTV1-08 — Field Memory Governance Policy

### Goal

Add governance around Field Memory candidates before formal memory writes are accepted.

### Boundary

```text
No automatic model update.
No automatic policy promotion.
No silent overwrite of existing memory.
```

## POSTV1-09 — Execution Adapter Bridge

### Goal

Design the explicit bridge from approved operation context to AO-ACT and receipt/as-executed adapters.

### Boundary

```text
No bypass of human approval.
No automatic dispatch from forecast or scenario.
No execution side effects from trace readback.
```
