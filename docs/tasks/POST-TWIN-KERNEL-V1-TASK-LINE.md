# docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md

## Stage

```text
Post-Twin-Kernel-v1 Productionization
```

## Stage goal

Move Twin Kernel v1 from a bounded human-gated execution-to-learning kernel into a quasi-production agricultural digital twin system that can accept real data, support multi-operator workflow, govern ROI and Field Memory, and connect to execution systems without breaking the human gate.

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

The strong fixture requirement remains open inside P1:

```text
At least 3 project/group/field scopes.
At least 2 seasons.
At least 2 crops.
Pointer refs must not cross fields.
Decision cycles must not cross seasons.
Field Memory records must not cross crops.
```

## Formal phase line

The formal post-v1 phase line is:

```text
P1 Production Hardening
P2 Real Adapter Integration
P3 Operator UX Refinement
P4 Policy-Controlled ROI
P5 Policy-Controlled Field Memory Governance
P6 Execution System Integration
```

## Dependency structure

The phase line has two dependency layers.

The foundation layer is:

```text
P1 → P2 → P3
```

The governance and execution layer is:

```text
P4 → P5 → P6
```

The preferred merge order remains:

```text
P1 → P2 → P3 → P4 → P5 → P6
```

P3 may be developed partly in parallel with P4 and P5.

However, the merge order should keep P3 before P4 and P5 because ROI policy and Field Memory governance change the practical meaning of operator workflow.

## Phase constraint

Post-v1 work must not rewrite Twin Kernel v1 completion facts.

Post-v1 work must not make the kernel autonomous unless a later policy-controlled task explicitly changes the boundary.

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

## P1 — Production Hardening

### Purpose

Move the system from acceptance fixture happy path to production-interface stability.

P1 is the prerequisite for every later phase.

Without P1, real adapters, ROI policy, Field Memory governance, and execution integration would expand an unstable surface.

### Scope

```text
multi tenant / project / group / field fixtures
strict multi-scope fixture pack
idempotency hardening
route-level negative tests
structured error taxonomy
DB index and query-cost checks
Docker startup hardening
migration runner hardening
repeatable local acceptance commands
```

### Meaning of completion

After P1, the system should tolerate:

```text
wrong input
missing input
repeated requests
startup order variance
migration state variance
multi-scope data isolation
case-local production pointer refs
```

### P1 internal tasks

```text
POSTV1-01 Production Hardening Baseline
POSTV1-02 Strong Multi-Scope Fixture Pack
POSTV1-03 Ingestion Idempotency & Error Taxonomy
POSTV1-04 Route Negative Runtime Matrix
POSTV1-05 DB Index / Query Cost Audit
POSTV1-06 Docker Startup / Migration Runner Baseline
```

## P2 — Real Adapter Integration

### Purpose

Make `production_source_refs_v0` usable by external systems while preserving the raw payload and semantic boundary.

P2 must not allow adapters to smuggle business meaning into Twin Kernel internals.

### Scope

```text
source_system registry
source_contract_version registry
source_event_id duplicate semantics
adapter checkpoint policy
raw payload pointer policy
opaque payload boundary
ingest replay tool
ingest repair tool
adapter failure ledger
```

### Boundary

```text
External payloads remain raw or pointer-based.
Adapters cannot create recommendations.
Adapters cannot create approvals.
Adapters cannot create AO-ACT tasks.
Adapters cannot create formal ROI.
Adapters cannot create formal Field Memory.
```

## P3 — Operator UX Refinement

### Purpose

Move the TK17 production workflow shell from existence proof to usable operator workbench.

### Scope

```text
decision queue search
queue filters
session status display
review status display
trace link display
formalization before / after comparison
business closure status cards
missing closure reason display
error state display
disabled state display
```

### Boundary

```text
No automatic formalization.
No dispatch UI unless P6 explicitly introduces an approved bridge.
No priority scoring.
No risk coloring.
No autonomous next action.
```

## P4 — Policy-Controlled ROI

### Purpose

Introduce traceable ROI preview under explicit policy and evidence inputs.

P4 is not automatic ROI decisioning.

### Hard boundary

```text
ROI preview is not formal ROI.
ROI dry-run is not a decision.
ROI policy cannot advance decision_cycle_v1.
ROI policy cannot update decision_cycle_v1 external refs.
Operator approval remains required before formal ROI.
Operator formalization action remains the only formal ROI path.
```

### Scope

```text
ROI policy config
ROI input schema
cost / yield / water / labor input normalization
preview-only ROI endpoint or read model
ROI policy evidence refs
ROI preview determinism hash
operator approve then formalize flow
```

## P5 — Policy-Controlled Field Memory Governance

### Purpose

Govern Field Memory before long-term memory writes affect system behavior.

P5 must precede P6 because execution integration can amplify bad memory.

### Scope

```text
memory candidate review queue
duplicate memory detection
conflict memory detection
evidence sufficiency gate
memory versioning
supersede lifecycle
retract lifecycle
formal memory audit readback
```

### Hard boundary

```text
Field Memory governance is not model update governance.
Writing memory and updating a model are two separate gates.
No automatic model update.
No automatic policy promotion.
No silent overwrite of existing memory.
No low-evidence formal memory write.
```

## P6 — Execution System Integration

### Purpose

Connect the approved operation context to AO-ACT and real execution systems without introducing autonomous execution.

P6 is the most sensitive phase.

### Scope

```text
operation plan to AO-ACT task human approval bridge
executor registry
receipt adapter
as-executed observation adapter
acceptance gate
partial completion read model
execution failure read model
repair / replay for execution receipts
```

### Hard boundary

```text
operation plan → AO-ACT task requires human review.
AO-ACT task is not created automatically by Twin Kernel.
Receipt adapter only ingests receipts.
As-executed adapter only ingests facts.
Acceptance gate cannot auto-pass.
Partial completion and failure must be readable.
Trace readback cannot cause execution side effects.
```

## Current execution order inside P1

```text
POSTV1-01 Production Hardening Baseline
POSTV1-02 Strong Multi-Scope Fixture Pack
POSTV1-03 Ingestion Idempotency & Error Taxonomy
POSTV1-04 Route Negative Runtime Matrix
POSTV1-05 DB Index / Query Cost Audit
POSTV1-06 Docker Startup / Migration Runner Baseline
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

## POSTV1-05 — DB Index / Query Cost Audit

### Goal

Audit the production hardening query surfaces before real adapters increase write and read volume.

### Scope

```text
production_ingestion_event_v0 lookup path
operator decision queue lookup path
trace readback lookup path
business closure lookup path
field_learning_candidate_v1 lookup path
index inventory
basic EXPLAIN readout acceptance
```

### Boundary

```text
No premature performance tuning.
No table redesign unless an observed query path is missing an index.
No semantic change.
```

## POSTV1-06 — Docker Startup / Migration Runner Baseline

### Goal

Make local and deployment startup less dependent on manual command memory.

### Scope

```text
server startup check
Postgres health dependency
migration application check
missing migration diagnostic
port mapping diagnostic
acceptance preflight output
```

### Boundary

```text
No infrastructure migration to another platform.
No cloud deployment work.
No new runtime semantics.
```

## Next-phase placeholders

After P1 completes, the next phase entries are:

```text
P2 Real Adapter Integration
P3 Operator UX Refinement
P4 Policy-Controlled ROI
P5 Policy-Controlled Field Memory Governance
P6 Execution System Integration
```

These should not begin until P1 has a completion review, unless the work is explicitly marked as parallel exploratory work and not merged into main before P1 completion.
