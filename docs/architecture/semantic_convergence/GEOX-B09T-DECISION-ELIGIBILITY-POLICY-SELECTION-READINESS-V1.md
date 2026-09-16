# GEOX B-09t Decision Eligibility Policy Selection Readiness V1

## Status

`SELECTION_SEMANTICS_NOT_AUTHORIZED`

B-09s established a governed declaration writer. B-09t asks the next distinct
question:

> Given one CandidateDecision at one causal decision boundary, which declared
> DecisionEligibility policy, if any, is authoritative?

B-09t does not implement that selector.

## The primary blocker: Candidate has no policy anchor

`CandidateDecisionV1` carries canonical `EvidenceScopeV1`:

- tenant;
- project;
- group;
- field;
- season;
- zone.

It does **not** carry:

- program_id;
- policy_scope_anchor_ref;
- any equivalent canonical program anchor.

The legacy `decision_recommendation_v1` fact can contain `program_id`, and
the recommendation route resolves that program before persisting the
recommendation fact.

But B-06c/B-09j deliberately do not promote that legacy value into canonical
CandidateDecision authority.

Therefore this is forbidden:

```text
Candidate field + season
  -> guess latest/matching FieldProgram
  -> use that Program's policy
```

It is also forbidden to rehydrate `recommendation.program_id` and silently
treat it as canonical policy-selection authority.

## Canonical bridge exists, but is not bound

B-05b already projects `FieldProgramV1` into canonical Context.

Its `DECLARED_FIELD_PROGRAM` assertion includes `program_id`, and the
ContextSnapshot has canonical field/season scope.

That is a plausible future canonical bridge:

```text
Candidate
  -> ContextSnapshot
  -> DECLARED_FIELD_PROGRAM
  -> explicit Program/equivalent anchor
  -> policy declaration
```

But current B-09j Candidate projection has:

```text
context_snapshot_ref = null
```

So the bridge is capability-only, not currently bound.

## Scope matching is not yet defined

`EvidenceScopeV1` permits nullable:

- field_id;
- season_id;
- zone_id.

No existing contract says that a null policy field means:

- wildcard;
- parent scope;
- “all zones”;
- missing information.

Therefore B-09t forbids treating null as wildcard and forbids implicit
“most-specific scope wins” ranking.

That semantics must be explicit before selection becomes authority.

## Time boundary is not yet defined

Policy declarations have:

- declared_at;
- effective_from;
- effective_until.

CandidateDecision has nullable `decision_time`.

A selector must not silently substitute:

- evaluated_at;
- created_at;
- wall clock;
- latest fact time.

Those substitutions change the causal knowledge boundary.

A future selector needs an explicitly authorized policy-selection time.

It should also distinguish:

```text
policy is effective at T
```

from:

```text
policy declaration was actually known by T
```

so a fact inserted after T must not become retrospectively selectable merely
because its payload contains compatible dates.

## Multiple policy declarations

B-07e consumes one policy object.

The declaration model permits multiple policy IDs and versions that may overlap
in scope, action and time.

No current authority says:

- latest version wins;
- newest declaration wins;
- lexicographically highest policy wins;
- most-specific scope wins;
- policies should be composed.

All such precedence is forbidden by B-09t.

The safe default remains fail closed on multiple applicable policies unless
product governance explicitly authorizes composition or precedence.

## Supersession is not yet operational semantics

`supersedes_policy_ref` currently proves only that a declaration contains a
pointer.

It does not define:

- whether the predecessor automatically terminates;
- whether both declarations may overlap;
- whether they must share policy_id;
- whether scopes/actions must match;
- whether cycles are forbidden;
- whether the predecessor must already exist;
- whether a future declaration can supersede a past declaration at a new
  effective boundary.

Therefore the selector must not infer deactivation from the pointer yet.

## Effective-window boundary

B-09m validates:

```text
declared_at <= effective_from
effective_until > effective_from
```

It does not define whether `effective_until` is inclusive or exclusive.

A half-open interval:

```text
[effective_from, effective_until)
```

is the cleanest recommended model, but B-09t does not authorize it.

## Stable facts that do not require a new product decision

Action applicability can remain exact string membership because B-07e already
requires exact membership of `candidate.proposed_action.action_type`.

Program status, execution policy and Approval authority must not become selector
precedence.

Legacy recommendation `program_id` remains shadow provenance, not canonical
selector authority.

## Recommended future shape — not authorized

A future fail-closed selector should receive:

```text
CandidateDecisionV1
+ canonical ContextSnapshot or other explicit canonical scope anchor
+ explicit policy-selection time
```

and return exactly one of:

```text
POLICY_SELECTED
POLICY_NOT_FOUND
POLICY_SCOPE_ANCHOR_MISSING
POLICY_SCOPE_AMBIGUOUS
POLICY_TIME_BOUNDARY_MISSING
POLICY_SUPERSESSION_AMBIGUOUS
POLICY_DECLARATION_INVALID
POLICY_READ_ERROR
```

No implementation is authorized by B-09t.

## Next governance decisions

Before selector runtime:

1. authorize the canonical policy scope-anchor source;
2. authorize null/parent scope applicability semantics;
3. authorize policy-selection time semantics;
4. authorize multiple-policy fail-closed/precedence semantics;
5. authorize supersession and effective-window boundaries.

Actual policy content remains a separate authorization:

- policy_id/version/ref;
- applicable_action_types;
- required_criteria;
- scope anchor;
- effective window.

B-07e remains disconnected.
