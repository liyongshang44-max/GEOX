# GEOX FOUI — Product Projection Contract Wave-01 V1

Status: **PRE-CONSTRUCTION FREEZE CANDIDATE**

This artifact freezes the first non-authoritative product projection contracts required before FOUI high-fidelity design or broad frontend implementation.

## 1. Scope

Wave-01 contains:

1. `ProductProjectionEnvelopeV1`
2. `GovernedActionCaseProjectionV1`
3. `CapabilityAvailabilityProjectionV1`
4. `AttentionQueueProjectionV1`

Machine contracts:

- `apps/server/src/product_projection/contracts/product_projection_contracts_v1.ts`
- `apps/server/src/product_projection/contracts/product_projection_contracts_v1.schema.json`

Qualification:

- `scripts/governance_acceptance/ACCEPTANCE_FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_V1.cjs`
- `scripts/governance_acceptance/FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_NEGATIVE_V1.ts`

## 2. Permanent authority ceiling

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

Every projection carries:

```text
authority_ceiling
= NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY

non_authoritative
= true
```

A `projection_id` is not an authority ref and must never be accepted as sufficient predecessor authority for a domain command.

## 3. Source-ref taxonomy

Wave-01 permanently separates authority refs from non-authority basis refs.

### 3.1 Authority refs

```text
source_authority_refs[]
```

These may reference exact outputs owned by authority domains such as:

```text
MCFT
ADR
B_LINE
OUTCOME
EXTERNAL
```

They retain the source object's authority; FOUI does not confer or widen it.

### 3.2 Non-authority refs

```text
source_non_authority_refs[]
```

Allowed classes:

```text
COMPOSITION_MANIFEST
PRODUCT_GOVERNANCE
OPERATIONAL_QUALIFICATION
PROVIDER
MEASUREMENT
VERIFICATION_STATE
EVIDENCE
OTHER_NON_AUTHORITY
```

This distinction is mandatory because a referenced object does not become authority merely because it participates in product composition.

In particular:

```text
DecisionTimeAuthorityManifest
= COMPOSITION_MANIFEST
!= authority object
```

Likewise product-release manifests, provider metadata, measurement refs and verification-state refs must not be silently inserted into `source_authority_refs`.

The two ref families share one `ref_key` namespace so a projection cannot alias the same key as both authority and non-authority.

`source_content_digests[]`, effective intervals, evidence cutoffs and limitations may bind either ref family. Interaction hints targeting a command may target only `source_authority_refs`.

## 4. Query / command physical separation

Projection APIs are read-only.

Allowed methods:

```text
GET
HEAD
```

Forbidden methods under FOUI-PROJ:

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

Every intent must carry:

```text
requires_command_reauthorization = true
```

Correct flow:

```text
GET Product Projection
  -> show allowed intent
  -> user chooses intent
  -> explicit authority-owner command
  -> authority owner re-authenticates/re-authorizes
  -> authority owner creates/changes authority object
  -> projection is recomputed
```

FOUI-PROJ never mutates the authority object itself.

## 5. ProductProjectionEnvelopeV1

All product projections carry one common provenance/time envelope:

```text
projection_id
projection_type
projection_schema_version

generated_at
derivation_version

subject_scope

source_authority_refs[]
source_non_authority_refs[]
source_content_digests[]

source_effective_interval
source_evidence_cutoff?

authority_ceiling
limitations[]

freshness
projection_semantics
non_authoritative
```

`source_content_digests` preserve source-owned digests only. FOUI-PROJ must not mint an authority-equivalent digest when a source does not provide one.

`freshness=CURRENT` means the projection is current under its declared product/source validity semantics. It does not mean physical reality is perfectly known.

## 6. Current world vs decision-time world

Permanent invariant:

```text
CURRENT BEST-KNOWN WORLD
!=
DECISION-TIME WORLD
```

`GovernedActionCaseProjectionV1` therefore separates:

```text
current_context

decision_time_basis

later_changes
```

`current_context` answers what the latest qualified product projection currently references.

`decision_time_basis` answers what was actually available/recoverable as the historical decision basis.

Literal invariant:

```text
current_state_substitution_forbidden = true
```

If historical basis cannot be recovered, FOUI returns an unavailable/partial basis. It must not substitute current MCFT state into the historical explanation.

## 7. GovernedActionCaseProjectionV1

The Action Case is a product composition envelope, not a domain state machine.

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

### 7.1 Composition status

```text
EXACT_REF_LINKED
PARTIAL_REF_LINKED
UNRESOLVED
```

Exact composition requires explicit exact linkage proof. Allowed linkage proof kinds are:

```text
EXACT_PREDECESSOR_REF
EXACT_SOURCE_FACT_REF
EXACT_DIGEST_BOUND_REF
```

Forbidden heuristic:

```text
same field
+ nearby timestamp
+ same action type
+ similar parameters
=> same governed action
```

No exact linkage means no silent exact composition.

### 7.2 Decision-time basis

Decision-time authority objects remain authority refs:

```text
decision_ref
field_state_ref_at_decision
applicability_ref
runtime_eligibility_ref
runtime_binding_refs[]
```

Historical composition/basis metadata remains non-authority:

```text
decision_time_manifest_ref
provider_refs[]
measurement_refs[]
verification_state_refs[]
```

`EXACT_MANIFEST` requires an exact `COMPOSITION_MANIFEST` ref.

### 7.3 Authority chain remains decomposed

The projection may reference, but never collapse:

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

A missing standalone authority object stays `null`. FOUI-PROJ must not synthesize one.

### 7.4 Presentation phase

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

The validator requires minimum source refs for downstream display phases. For example, `AWAITING_APPROVAL` requires a real ApprovalRequest ref, while `EXECUTION_EVIDENCE_ACCEPTED` requires a real acceptance ref.

Forbidden semantic promotions include:

```text
OPERATION_SUCCESSFUL
OUTCOME_SUCCESSFUL
PHYSICAL_EXECUTION_VERIFIED
```

unless a future authority contract explicitly supports those claims.

## 8. CapabilityAvailabilityProjectionV1

Availability derives from three independent axes:

```text
PRODUCT IMPLEMENTATION
BUILT / PARTIAL / NOT_BUILT

AUTHORITY MATURITY
AUTHORIZED / PREVIEW / NOT_AUTHORIZED

OPERATIONAL ELIGIBILITY
CURRENT / DEGRADED / EXPIRED / UNAVAILABLE
```

Only then does FOUI derive:

```text
customer_state
AVAILABLE / LIMITED / PREVIEW / NOT_YET_AVAILABLE

default_release_surface_state
ACTIVE / LIMITED / PREVIEW / DISABLED
```

Route/API/code/screen existence is never sufficient to derive `AVAILABLE`.

Basis rules:

```text
product_release_basis_ref_keys
-> PRODUCT_GOVERNANCE non-authority refs

authority_maturity_basis_ref_keys
-> authority refs

operational_eligibility_basis_ref_keys
-> exact source refs supporting current/degraded/expired state
```

Non-available customer states require reason codes.

Example:

```text
capability_id = ADR_DECISION
product_implementation = BUILT
authority_maturity = PREVIEW
operational_eligibility = CURRENT
customer_state = PREVIEW
reason_codes = [ADR_AUTHORITATIVE_CUTOVER_NOT_COMPLETE]
```

Caller-specific hiding is not canonical capability truth. Navigation hiding remains caller-capability/UI-surface policy.

## 9. AttentionQueueProjectionV1

Attention ordering is product triage, not agronomic risk authority.

Forbidden product-owned fields:

```text
priority
severity
risk_score
```

Canonical triage fields:

```text
triage_bucket
attention_reason_code
source_authority_ref_keys[]
blocking_state
presentation_rank
sort_reason_code
```

If a domain authority declares severity, FOUI may expose it only as:

```text
source_declared_severity
```

with an exact authority ref.

`presentation_rank` is internal display ordering only, not domain priority.

Due semantics are also separated:

```text
DOMAIN_SOURCE
-> authority ref

PRODUCT_SLA
-> PRODUCT_GOVERNANCE non-authority ref

NONE
-> no due timestamp/ref
```

## 10. Existing source families

Wave-01 may consume these existing families without changing their authority:

| Product need | Existing source family | Boundary |
|---|---|---|
| Current field context | `apps/server/src/domain/field_twin_read_model/contracts_v1.ts` | MCFT read model; preserve exact scope/hash/time/limitations |
| Current-crop validity | `apps/server/src/runtime/twin_runtime/mcft_cap09_current_crop_authority_resolver_v1.ts` | consume validity; do not rerun MCFT qualification |
| ADR preview/cutover state | `apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts` | read-only shadow; no field actionability/dispatch authority |
| ADR decision semantics | ADR `DecisionResult` authority | ACT/WAIT/ASK/ABSTAIN remains distinct from approval/execution |
| Human approval | B-Line approval objects and exact source facts/indexes | command remains at B-Line boundary |
| Operation/dispatch/task | B-Line operation-plan/AO-ACT/dispatch sources | projection references only |
| Execution proof | Receipt -> AsExecuted -> EvidenceArtifact -> AcceptanceResult | acceptance is execution-evidence acceptance, not outcome/effect |

Implementation paths are source anchors, not permission for FOUI-PROJ to import command builders.

## 11. Allowed derivations

FOUI-PROJ may:

- preserve exact authority refs;
- preserve exact non-authority basis refs without promoting them;
- preserve source-owned digests;
- assemble explicitly linked objects into a product view;
- derive presentation-only phase from existing source states/refs;
- compare current and historical refs when comparability is explicit;
- derive customer capability state from the frozen three axes;
- compute presentation ordering from workflow-blocking facts and declared due information;
- produce caller-relative interaction hints.

## 12. Forbidden derivations

FOUI-PROJ must not:

- mint authority;
- classify a replay/composition manifest as authority;
- classify product governance as domain authority;
- re-adjudicate MCFT state;
- run ADR applicability/runtime/decision calculation;
- create/infer Human Approval;
- create/infer Execution Authorization;
- mutate dispatch/execution state;
- create receipts/evidence/acceptance;
- infer evidence sufficiency beyond source acceptance authority;
- infer agronomic risk severity from raw sensor values;
- infer causal effect from temporal succession;
- replace historical decision basis with current world state;
- join independent authority objects by similarity when exact linkage is absent.

## 13. Machine qualification

The dedicated gate proves at minimum:

```text
PP-01 projection non-authority invariant
PP-02 no FOUI-PROJ command methods
PP-03 no projection domain/database writes
PP-04 projection IDs cannot substitute authority refs
PP-05 interaction hints require command reauthorization
PP-06 authority and non-authority ref keys cannot alias

AC-01 unresolved linkage cannot display downstream approval authority
AC-02 exact composition requires exact linkage proof
AC-03 current state cannot replace decision-time basis
AC-04 unavailable history cannot fall back to current state
AC-05 DecisionTimeAuthorityManifest must be non-authority COMPOSITION_MANIFEST
AC-06 downstream display phases require corresponding source refs

CAP-01 API/code existence cannot imply AVAILABLE
CAP-02 PREVIEW authority cannot map to ACTIVE
CAP-03 expired/unavailable operational eligibility cannot remain ACTIVE
CAP-04 product release basis must be PRODUCT_GOVERNANCE non-authority ref

ATTN-01 no product-owned priority/severity/risk_score
ATTN-02 presentation ordering cannot write authority
ATTN-03 source severity requires exact authority ref
ATTN-04 product SLA due basis uses PRODUCT_GOVERNANCE non-authority ref
```

Run:

```bash
node scripts/governance_acceptance/ACCEPTANCE_FOUI_PRODUCT_PROJECTION_CONTRACT_WAVE_01_V1.cjs
```

Dedicated PR workflow:

```text
foui-projection-contract-wave01
```

## 14. Construction authorization after freeze

After CTO acceptance, the next narrow construction may add:

```text
read-only product projection builders
read-only authority/basis readers
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
ADR decision/applicability calculation
B-Line approval/authorization logic
execution mutation
Outcome/Attribution promotion
```

High-fidelity FOUI remains held until Wave-01 contracts are accepted and machine-qualified.
