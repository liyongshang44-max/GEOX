# GEOX B-09u Decision Eligibility Policy Selector Decision Package V1

## Status

`RECOMMENDED_NOT_AUTHORIZED`

Proposed decision:

`DEC-BLINE-ELIGIBILITY-POLICY-SELECTOR-001`

B-09t proved why a selector cannot be implemented safely yet. B-09u converts
those blockers into one explicit product-governance package.

No selector runtime is created by B-09u.

## 1. Canonical Program anchor

Recommended v1 source:

```text
CandidateDecision.context_snapshot_ref
  -> canonical ContextSnapshot
  -> exactly one DECLARED_FIELD_PROGRAM assertion
  -> program_id
  -> scope_anchor_type = PROGRAM
  -> scope_anchor_ref = program_id
```

If the ContextSnapshot is missing, invalid, has zero matching Program
assertions, or has more than one matching Program assertion, selection fails
closed.

Rejected:

- legacy recommendation.program_id as authority;
- infer Program from field + season;
- latest Program wins;
- planner/Program status as policy precedence.

This recommendation keeps legacy source provenance separate from canonical
selector authority.

## 2. Scope applicability

Recommended v1 rule:

```text
exact nullable structural equality
```

over:

- tenant_id;
- project_id;
- group_id;
- field_id;
- season_id;
- zone_id.

Null means only null.

It does not mean wildcard, parent scope, “all fields”, or “all zones”.

There is no specificity ranking in v1.

This is deliberately restrictive. Hierarchical policy inheritance can be added
later as a separate product-governance feature rather than smuggled into the
first selector.

## 3. Policy-selection time

Recommended sole boundary:

```text
CandidateDecision.decision_time
```

It must be non-null.

No fallback to:

- evaluated_at;
- created_at;
- request wall clock;
- latest fact timestamp.

A declaration is knowable at the candidate boundary only if both are true:

```text
declaration.declared_at <= decision_time
fact.occurred_at        <= decision_time
```

This prevents a declaration written after the candidate boundary from becoming
retrospectively selectable.

## 4. Multiple applicable policies

Recommended v1 semantics:

```text
0 applicable -> POLICY_NOT_FOUND
1 applicable -> POLICY_SELECTED
>1 applicable -> POLICY_SCOPE_AMBIGUOUS
```

No:

- latest version wins;
- newest declaration wins;
- lexical ordering;
- specificity ranking;
- policy composition.

B-07e accepts one policy object. Any composition rule would be a new authority
model and should be explicit.

## 5. Effective windows and supersession

Recommended effective interval:

```text
[effective_from, effective_until)
```

A null effective_until means no explicit end.

Recommended append-only supersession rule:

A successor may make its predecessor non-selectable at
`successor.effective_from` only if:

1. predecessor exists;
2. predecessor was already known before the successor declaration;
3. same policy_id;
4. exact same canonical decision scope;
5. exact same scope anchor type/ref;
6. supersession chain is acyclic.

If two successors create an ambiguous replacement of the same predecessor,
selection fails closed with:

`POLICY_SUPERSESSION_AMBIGUOUS`.

This allows immutable predecessor facts while avoiding overlapping version
selection.

Cross-policy and cross-scope supersession are rejected in v1.

## 6. Action applicability

No new decision is required here.

B-07e already uses exact string membership:

```text
policy.applicable_action_types
  contains
candidate.proposed_action.action_type
```

B-09u recommends retaining that exact rule.

## Proposed selector result states

Success:

`POLICY_SELECTED`

Fail-closed states:

```text
POLICY_NOT_FOUND
POLICY_CONTEXT_MISSING
POLICY_SCOPE_ANCHOR_MISSING
POLICY_SCOPE_AMBIGUOUS
POLICY_TIME_BOUNDARY_MISSING
POLICY_SUPERSESSION_AMBIGUOUS
POLICY_DECLARATION_INVALID
POLICY_READ_ERROR
```

## Exact proposed decision

If product governance accepts
`DEC-BLINE-ELIGIBILITY-POLICY-SELECTOR-001`, B-Line may implement:

1. ContextSnapshot DECLARED_FIELD_PROGRAM as the canonical Program anchor;
2. exact nullable EvidenceScope equality, with no wildcard/inheritance;
3. non-null CandidateDecision.decision_time as the sole selection boundary;
4. declared_at and occurred_at causal cutoffs;
5. fail-closed multi-policy ambiguity;
6. half-open effective windows;
7. validated same-policy/same-scope/same-anchor append-only supersession;
8. exact action-type membership.

That authorization would permit selector/read-model implementation.

It would **not** authorize actual product policy contents.

A separate product decision is still required for:

- real policy_id/version/ref;
- applicable_action_types;
- required_criteria;
- real Program/scope anchor;
- real effective window;
- persistence of a real declaration;
- B-07e connection.
