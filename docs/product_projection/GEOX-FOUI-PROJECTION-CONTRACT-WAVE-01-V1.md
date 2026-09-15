# GEOX FOUI — Product Projection Contract Wave-01 V1

Status: **PRE-CONSTRUCTION FREEZE CANDIDATE**

This artifact freezes the first non-authoritative product projection contracts required before FOUI high-fidelity design or broad frontend implementation.

## 1. Scope

Wave-01 contains:

1. `ProductProjectionEnvelopeV1`
2. `GovernedActionCaseProjectionV1`
3. `CapabilityAvailabilityProjectionV1`
4. `AttentionQueueProjectionV1`

The contracts live in:

- `apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts`
- `apps/server/src/product_projection/contracts/product_projection_contracts_v1.schema.json`

Qualification lives in:

- `scripts/governance_acceptance/ACCEPTANCE_FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_V1.cjs`
- `scripts/governance_acceptance/FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_NEGATIVE_V1.ts`

## 2. Authority ceiling

Permanent invariant:

```text
FOUI-PROJ
= customer/product composition read model

FOUI-PROJ
!= MCFT authority
!= ADR authority
!= B-Line authority
!= Outcome authority
!= command authorization
```

Every product projection carries:

```text
authority_ceiling
= NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY

non_authoritative
= true
```

A product projection ID is not an authority reference and must never be accepted as sufficient predecessor authority for a domain command.

## 3. Query / command physical separation

Projection APIs are read-only.

Allowed product-projection transport methods:

```text
GET
HEAD
```

Forbidden:

```text
POST
PUT
PATCH
DELETE
```

`interaction_hints.allowed_intents` are caller-relative UI hints only.

```text
button visible
!= authority granted
```

Every intent requires:

```text
requires_command_reauthorization = true
```

The actual authority owner must authenticate, authorize and adjudicate the command again at its own command boundary.

Example:

```text
GET GovernedActionCaseProjection
  -> interaction hint: APPROVE
  -> user selects Approve
  -> explicit B-Line approval command
  -> B-Line re-authorizes
  -> B-Line creates ApprovalDecision
  -> projection is recomputed
```

FOUI-PROJ never creates the ApprovalDecision.

## 4. Common ProductProjectionEnvelopeV1

All product projections carry common provenance and time semantics:

```text
projection_id
projection_type
projection_schema_version

generated_at
derivation_version

subject_scope

source_authority_refs[]
source_content_digests[]

source_effective_interval
source_evidence_cutoff?

authority_ceiling
limitations[]

freshness
projection_semantics
non_authoritative
```

`source_content_digests` may only preserve source-owned digests. FOUI-PROJ must not mint a replacement authority digest when an authority source does not provide one.

Freshness is projection freshness / source-declared validity composition. It is not a claim that physical reality is perfectly known.

## 5. Current world vs decision-time world

Permanent invariant:

```text
CURRENT BEST-KNOWN WORLD
!=
DECISION-TIME WORLD
```

`GovernedActionCaseProjectionV1` therefore has separate surfaces:

```text
current_context

decision_time_basis

later_changes
```

`current_context` answers what the latest qualified product projection currently references.

`decision_time_basis` answers what exact authority basis was available for the historical decision.

The following invariant is literal contract state:

```text
current_state_substitution_forbidden = true
```

If historical decision-time basis cannot be recovered, FOUI must return an unavailable/partial historical basis. It must never substitute current MCFT state into the historical explanation.

## 6. GovernedActionCaseProjectionV1

`GovernedActionCaseProjectionV1` is a customer/product composition envelope, not a new domain object.

It contains:

```text
case_anchor
action_type
composition_status
linkage_proofs[]

current_context
decision_time_basis
later_changes

authority_chain

derived_display_phase
```

### 6.1 Composition status

Allowed values:

```text
EXACT_REF_LINKED
PARTIAL_REF_LINKED
UNRESOLVED
```

Only exact predecessor/source-fact/digest-bound relations are accepted as linkage proof types.

Forbidden composition heuristic:

```text
same field
+ nearby timestamp
+ same action type
+ similar parameter value
=> same governed action
```

That inference is not permitted.

If exact linkage is not established, the projection must remain partial or unresolved.

### 6.2 Authority-chain slots

The Action Case may reference, without collapsing:

```text
Agronomic Decision
Recommendation Candidate
Approval Request
Approval Decision
Operation Plan
Execution Authorization
Task
Dispatch
Executor
Device
Execution Receipt
As Executed
Evidence Artifacts
Execution Evidence Acceptance
Outcome
Attribution
```

A missing standalone authority object stays `null`. FOUI-PROJ must not synthesize it.

### 6.3 Display phase

`derived_display_phase` is presentation-only.

Examples:

```text
AWAITING_APPROVAL
PLAN_READY
DISPATCHED
EXECUTION_REPORTED
EVIDENCE_REVIEW
EXECUTION_EVIDENCE_ACCEPTED
```

It is not a domain state machine and must never be written back into authority storage.

Forbidden display states include semantic promotions such as:

```text
OPERATION_SUCCESSFUL
OUTCOME_SUCCESSFUL
PHYSICAL_EXECUTION_VERIFIED
```

unless a future authority contract explicitly supports those claims.

## 7. CapabilityAvailabilityProjectionV1

Capability availability uses three independent dimensions:

```text
PRODUCT IMPLEMENTATION
BUILT / PARTIAL / NOT_BUILT

AUTHORITY MATURITY
AUTHORIZED / PREVIEW / NOT_AUTHORIZED

OPERATIONAL ELIGIBILITY
CURRENT / DEGRADED / EXPIRED / UNAVAILABLE
```

Only after evaluating all three does the product derive:

```text
customer_state
AVAILABLE / LIMITED / PREVIEW / NOT_YET_AVAILABLE

default_release_surface_state
ACTIVE / LIMITED / PREVIEW / DISABLED
```

Route existence, API existence, code existence or screen existence is never sufficient to derive `AVAILABLE`.

Non-available states require reason codes.

Example:

```text
capability_id = ADR_DECISION
product_implementation = BUILT
authority_maturity = PREVIEW
operational_eligibility = CURRENT
customer_state = PREVIEW
reason_codes = [ADR_AUTHORITATIVE_CUTOVER_NOT_COMPLETE]
```

Caller-specific hiding is not stored in canonical capability projection state. Navigation hiding remains caller-capability/UI-surface policy.

## 8. AttentionQueueProjectionV1

FOUI attention ordering is product triage, not agronomic risk authority.

Forbidden product-owned fields:

```text
priority
severity
risk_score
```

Canonical product fields are:

```text
triage_bucket
attention_reason_code
source_authority_ref_keys[]
blocking_state
presentation_rank
sort_reason_code
```

If a domain authority provides severity, FOUI may expose it only as:

```text
source_declared_severity
```

with an exact source ref.

`presentation_rank` is internal display ordering only. It is not customer-visible domain priority.

## 9. Source binding for Wave-01

Wave-01 contracts may consume these existing authority/read-model families without changing their authority:

| Product projection need | Current source family | Boundary |
|---|---|---|
| Current field context | `apps/server/src/domain/field_twin_read_model/contracts_v1.ts` | MCFT read model; exact scope/hash/time/limitations are preserved |
| Current-crop operational validity | `apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.ts` | Consume source validity; do not re-run MCFT qualification |
| ADR preview/cutover state | `apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts` | Read-only shadow; no field actionability/dispatch authority |
| ADR decision semantics | ADR `DecisionResult` authority in agronomy-deployment-runtime | ACT/WAIT/ASK/ABSTAIN stays distinct from human approval/execution |
| Human approval | `apps/server/src/domain/approval/recommendation_approval_decision_builder_v1.ts` and exact source facts/indexes | B-Line command remains separate |
| Operation/dispatch/task | existing B-Line operation-plan/AO-ACT/dispatch sources | Projection references only |
| Execution proof | receipt -> as-executed -> evidence artifact -> acceptance sources | PASS means execution-evidence acceptance only; not effect/outcome |

Source paths are implementation anchors, not permission for FOUI-PROJ to import command builders into projection code.

## 10. Allowed derivations

FOUI-PROJ may:

- preserve exact authority refs and source-owned digests;
- assemble explicitly linked authority objects into a product view;
- derive presentation-only phase from already-existing source states;
- compare current and historical refs when comparability is explicit;
- derive customer capability state from frozen implementation/authority/operational axes;
- compute presentation ordering from workflow-blocking facts and declared due information;
- produce caller-relative interaction hints from caller-capability projection.

## 11. Forbidden derivations

FOUI-PROJ must not:

- mint authority;
- re-adjudicate MCFT state;
- run ADR applicability/runtime/decision calculation;
- create or infer Human Approval;
- create or infer Execution Authorization;
- mutate dispatch/execution state;
- create receipts/evidence/acceptance;
- infer evidence sufficiency beyond source acceptance authority;
- infer agronomic risk severity from raw sensor values;
- infer causal effect from temporal succession;
- replace historical decision basis with current world state;
- join independent authority objects by similarity when exact linkage is absent.

## 12. Wave-01 qualification gates

The governance acceptance gate proves at minimum:

```text
PP-01 all projections remain non-authoritative
PP-02 no FOUI-PROJ command methods
PP-03 no product-projection database/domain writes
PP-04 projection IDs do not substitute authority predecessors
PP-05 interaction hints require command reauthorization

AC-01 unresolved ADR/product linkage cannot display downstream approval authority
AC-02 exact composition requires exact linkage proof
AC-03 current-state change does not replace decision-time basis
AC-04 unavailable historical basis cannot fall back to current state
AC-05 late/revised information is isolated from historical basis

CAP-01 API/code existence cannot imply AVAILABLE
CAP-02 PREVIEW authority cannot map to ACTIVE
CAP-03 expired/unavailable operational eligibility cannot remain ACTIVE

ATTN-01 no product-owned priority/severity/risk_score
ATTN-02 presentation ordering cannot write authority
ATTN-03 source severity requires exact source authority reference
```

Run:

```bash
node scripts/governance_acceptance/ACCEPTANCE_FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_V1.cjs
```

## 13. Construction authorization after freeze

After CTO acceptance of Wave-01 contracts, the next authorized construction may add narrow read-only projection builders/readers/routes.

Allowed:

```text
product projection builders
read-only authority readers
GET projection routes
projection fixtures/tests
interaction hint adapters
```

Still forbidden:

```text
domain writes
authority minting
authority re-adjudication
MCFT state calculation
ADR decision calculation
B-Line approval/authorization logic
execution mutation
outcome/attribution promotion
```

High-fidelity FOUI design remains held until the first projection contracts are accepted and machine-qualified.
