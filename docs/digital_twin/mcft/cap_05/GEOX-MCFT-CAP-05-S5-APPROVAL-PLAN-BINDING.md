<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-APPROVAL-PLAN-BINDING.md -->
# MCFT-CAP-05 S5 — Approval Assertion and Approved Plan Evidence Binding V1

## Authority

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1
baseline merged main: 7f2f2bec144cee4d90608c3a25c3dc7cac9f9189
runtime mode: REPLAY
target: Level A — Deterministic Replay Twin
canonical Decision object: twin_decision_record_v1
Approval Assertion source: Replay Evidence
Approved Plan source: Replay Evidence
binding storage: rebuildable projection only
```

This slice validates and materializes the trace:

```text
canonical Human Decision
→ external/human Approval Assertion Evidence
→ Approved Plan Snapshot Evidence
```

It does not exercise approval authority, create either Evidence record, append a new canonical Twin object, infer dispatch, or mutate State/checkpoint.

## Separation of records

Approval Assertion and Approved Plan are distinct records with distinct source identities and hashes.

Approval Assertion answers:

```text
who asserted approval
what Decision request and selected Scenario option were approved
when the assertion became available
whether GEOX exercised approval authority
```

Approved Plan answers:

```text
what amount is approved
what Reality scope is targeted
when the Plan is effective
which Approval Assertion supports it
whether it is active for the Decision
whether it explicitly supersedes an earlier Plan
```

The two records may not share the same Evidence identity. The Plan must reference the Assertion by exact ref/hash.

## GEOX approval boundary

The Assertion must state:

```text
approval_semantics = EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION
approval_status = APPROVED
approver_class = HUMAN
geox_approval_authority_exercised = false
geox_approval_request_created = false
```

The binding projection is neither canonical approval history nor approval authority.

## Exact linkage

The validator requires exact equality across Decision, Assertion and Plan for:

```text
Reality scope
decision_request_ref
decision_request_hash
selected_option_ref
selected_option_hash
approval_assertion_ref
approval_assertion_hash
```

The canonical Decision is read from `public.facts`. Assertion and Plan are read from `public.facts` as Replay Evidence. The caller supplies only exact refs/hashes and `as_of`; it cannot supply a validated binding payload.

## Amount semantics

The selected Scenario option defines the Scenario amount:

```text
NO_ACTION = 0.000000 mm
IRRIGATE_NOW_15MM = 15.000000 mm
IRRIGATE_NOW_25MM = 25.000000 mm
```

The Plan separately carries:

```text
scenario_amount_mm
approved_amount_mm
amount_difference_mm
amount_difference_reason_codes
```

The invariant is:

```text
amount_difference_mm = approved_amount_mm - scenario_amount_mm
0 <= approved_amount_mm <= scenario_amount_mm
```

A non-zero difference requires at least one reason code. The standard controlled replay proves `15.000000 mm` Scenario amount and `14.000000 mm` approved amount with difference `-1.000000 mm`.

## Time and validity

The following order is required:

```text
Assertion approved_at <= asserted_at <= available_to_runtime_at
Plan created_at <= approved_at <= available_to_runtime_at
plan_effective_from < plan_effective_to
Assertion available_to_runtime_at <= Plan approved_at
Assertion and Plan available_to_runtime_at <= binding as_of
```

The Plan must be `APPROVED` and `active_for_decision = true` at binding time.

## Dispatch disposition

S5 creates no dispatch fact. The validated binding records:

```text
dispatch_disposition = NOT_OBSERVED
```

This is an explicit absence disposition, not evidence that dispatch occurred or did not occur.

## Supersession

The first valid Plan has:

```text
status = NO_PREDECESSOR
supersedes_plan_ref = null
supersedes_plan_hash = null
```

A later Plan for the same Decision must explicitly carry both predecessor ref and predecessor hash. Both values must match the currently active projection. A successful supersession uses a projection CAS to deactivate exactly one previous Plan and activate the new Plan.

Implicit replacement is forbidden. A new Plan without explicit predecessor identity while an active Plan exists fails closed. A forged predecessor hash fails closed.

## Persistence and recovery

No new migration is introduced. S5 reuses:

```text
twin_approved_plan_binding_projection_v1
```

The projection stores the original Plan Evidence, the supporting Assertion Evidence and the validated binding trace in `canonical_evidence` JSON. This is mutable support state and may be deleted.

`PostgresApprovedPlanBindingRepositoryV1.rebuildAllBindingsWithClientV1` rebuilds bindings in effective-time order from canonical Decision facts and Replay Evidence facts. Generic CAP-05 recovery delegates Plan reconstruction to this same validator, so recovery cannot bypass S5 linkage, amount, validity or supersession rules.

## PostgreSQL proof

Workflow `29312506965` proved:

```text
repository typecheck: PASS
standard Decision/Assertion/Plan binding: PASS
same Plan idempotent projection result: PASS
missing Assertion rejection: PASS
Assertion hash mismatch rejection: PASS
non-approved Assertion rejection: PASS
wrong Reality scope rejection: PASS
amount difference mismatch rejection: PASS
invalid validity window rejection: PASS
inactive Plan rejection: PASS
explicit supersession: PASS
forged supersession predecessor rejection: PASS
projection deletion and validated rebuild: PASS
canonical Twin fact delta: 0
S3 persistence/recovery regression: PASS
```

## Preserved nonclaims

```text
NO_GEOX_APPROVAL_AUTHORITY
NO_APPROVAL_ASSERTION_EVIDENCE_CREATION
NO_APPROVED_PLAN_EVIDENCE_CREATION
NO_CANONICAL_TWIN_APPEND
NO_DISPATCH_FACT
NO_ACTION_FEEDBACK_WRITE
NO_STATE_OR_CHECKPOINT_MUTATION
NO_PUBLIC_ROUTE
NO_RECOMMENDATION
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CAP_06_AUTHORIZATION
```
