# GEOX FOUI-0 — Pre-Wave-02 Construction Handoff

Status: PLANNING ARTIFACT / NOT IMPLEMENTATION AUTHORIZATION
Audit base: d054b334b3e74f3356b5d02498da9ba845eccdfb

## 0. Purpose

This handoff defines the narrow construction order that may be used if CTO later authorizes FOUI Product Projection Runtime Wave-02.

It does not itself authorize Wave-02.

## 1. Preconditions before any Wave-02 code

All must be true:

~~~
FOUI-0 reconciliation accepted
Wave-01 contracts remain accepted
source binding registry remains current
MCFT production-chain freeze permits independent FOUI branch work
no main-merge authorization is inferred
no authority semantic change is required
~~~

If any builder would require changing MCFT, ADR or B-Line semantics, STOP and return to authority adjudication.

## 2. Construction order

Construction order is fixed:

~~~
W2-0 shared read boundary / utilities
W2-1 GovernedActionCaseProjection builder
W2-2 CapabilityAvailabilityProjection builder
W2-3 AttentionQueueProjection builder
W2-4 GET-only projection routes
W2-5 projection fixtures / negative tests
W2-6 typed frontend API clients / adapters
~~~

No React page implementation is required to qualify W2-0 through W2-5.

## 3. W2-0 shared read boundary

Allowed:

- exact-ref readers;
- read-only source adapters;
- source-ref normalization that preserves exact identity;
- source binding proof construction;
- common projection envelope construction;
- deterministic derivation helpers.

Forbidden:

- domain writes;
- database authority ownership;
- MCFT calculation;
- ADR applicability/decision calculation;
- B-Line approval or authorization logic;
- execution mutation;
- Outcome calculation.

## 4. W2-1 GovernedActionCaseProjection builder

Input families may include only registered source roles.

Expected output:

~~~
ProductProjectionEnvelopeV1
case_anchor
composition_status
linkage_proofs
current_context
decision_time_basis
later_changes
authority_chain
derived_display_phase
~~~

Required invariants:

~~~
exact composition -> exact linkage proof
missing linkage -> PARTIAL_REF_LINKED or UNRESOLVED
current_state_substitution_forbidden = true
missing authority object -> null / unavailable
no heuristic join by field + time + action type
~~~

Exit proof must include at least one real repository object set with reverse trace:

~~~
projection field
→ source ref
→ source object
→ source owner
~~~

## 5. W2-2 CapabilityAvailabilityProjection builder

Must derive from exactly three independent axes:

~~~
product_implementation
authority_maturity
operational_eligibility
~~~

Required rules:

- code/route/component existence never implies AVAILABLE;
- ADR shadow stays PREVIEW until explicit authoritative cutover basis;
- MCFT operational state is consumed, never requalified by FOUI;
- degraded/expired/unavailable eligibility cannot map to ACTIVE;
- non-AVAILABLE states require reason codes;
- caller hiding remains UI policy, not canonical capability truth.

## 6. W2-3 AttentionQueueProjection builder

Allowed product triage fields:

~~~
triage_bucket
attention_reason_code
presentation_rank
sort_reason_code
blocking_state
source_declared_severity with exact authority ref only
~~~

Forbidden:

~~~
priority
severity
risk_score
~~~

Legacy OperatorWorkbench priorityText must not be copied into this projection.

## 7. W2-4 GET-only routes

Projection namespace permits:

~~~
GET
HEAD
~~~

Projection namespace forbids:

~~~
POST
PUT
PATCH
DELETE
~~~

Projection route responses may carry interaction hints, but every authority-changing intent must state requires_command_reauthorization = true.

## 8. W2-5 qualification

Minimum machine qualification should prove:

- zero writes under product projection namespace;
- no domain builder imports;
- exact source binding proofs required;
- missing refs fail closed;
- current world cannot substitute historical decision basis;
- PREVIEW cannot silently become ACTIVE;
- old priority/severity/risk_score semantics cannot enter AttentionQueue;
- output is deterministic for the same exact source set;
- all returned authority refs preserve source authority domain;
- projection IDs cannot be used as authority predecessor refs.

Negative tests must cover deliberate malformed/ref-mismatch cases.

## 9. W2-6 frontend adapters

Only after server projection qualification.

Allowed:

- typed GET clients;
- projection-to-view adapters;
- release-surface state adapter;
- interaction-hint presentation;
- explicit unavailable/partial rendering.

Forbidden:

- client-side authority reconstruction;
- client-side source joining by similarity;
- client-side MCFT/ADR/B-Line re-adjudication;
- write calls to projection namespace.

## 10. First product pages after Wave-02 qualification

Still requires separate frontend implementation authorization.

Recommended first slice:

~~~
Home
Operations
Action Case
~~~

Responsibilities:

~~~
Home = attention / triage
Operations = governed work visibility
Action Case = WHY / BASIS / DECISION / AUTHORITY / EXECUTION / PROOF
~~~

Fields remains based on canonical MCFT Field Runtime rather than being rebuilt around Action Case.

## 11. Stop gates

Immediate STOP if:

- protected main production freeze rules are violated;
- Wave-02 requires authority semantic changes;
- a source object cannot be exact-ref linked;
- a UI requirement requests silent semantic promotion;
- Outcome/attribution is required to make the page look complete;
- a write method appears under product projection namespace;
- current state is proposed as a historical decision substitute;
- legacy workbench priority is proposed as AttentionQueue authority.

## 12. Main-merge discipline

FOUI working branches may progress independently while MCFT is in frozen waiting.

However:

~~~
branch progress != main merge authorization
qualified PR != main merge authorization
frontend usefulness != production-chain priority inversion
~~~

Any later merge to protected main must follow the then-current CTO exact-boundary decision and MCFT freeze state.

## 13. Handoff conclusion

Wave-02, if later authorized, should operationalize the already-frozen Product Projection contracts without changing authority semantics. The narrow goal is to make existing MCFT / ADR / B-Line source objects consumable as deterministic, non-authoritative product read models before any broad frontend implementation.