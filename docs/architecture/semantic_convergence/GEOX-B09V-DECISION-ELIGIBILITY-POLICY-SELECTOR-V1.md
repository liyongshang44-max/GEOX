# GEOX B-09v Decision Eligibility Policy Selector V1

## Status

B-09v is a stacked implementation candidate based exactly on B-09u product head:

`1deeea2bd72c70d7eaa9305112f9352b14b8ac91`.

The product-governance decision:

`DEC-BLINE-ELIGIBILITY-POLICY-SELECTOR-001`

is now explicitly authorized.

This phase implements only the authorized policy selector/read-model semantics.
It does not authorize or create real product policy contents and does not connect
B-07e.

## Canonical selector boundary

The selector consumes:

```text
CandidateDecisionV1
+
ContextSnapshotV1
+
append-only DecisionEligibilityPolicyDeclarationV1 facts
```

The Candidate is not repaired or enriched by the selector.

`CandidateDecision.basis.context_snapshot_ref` must be non-null and must exactly
identify the supplied canonical ContextSnapshot. Candidate and ContextSnapshot
scopes must match exactly.

The ContextSnapshot must contain exactly one matching:

`DECLARED_FIELD_PROGRAM`

assertion. Its exact `value.program_id` becomes:

```text
scope_anchor_type = PROGRAM
scope_anchor_ref  = program_id
```

Legacy `decision_recommendation.program_id` remains non-authoritative and is not
read by the selector.

## Exact nullable scope

Policy applicability uses exact structural equality over:

```text
tenant_id
project_id
group_id
field_id
season_id
zone_id
```

Null equals null only.

There is no wildcard, parent inheritance, specificity ranking, or fallback.

## Causal as-of boundary

The sole selection boundary is:

`CandidateDecisionV1.decision_time`.

It must be non-null.

No fallback to evaluation time, Candidate creation time, wall clock, or latest
fact time exists.

A declaration can participate only when both are true:

```text
declaration.declared_at <= decision_time
fact.occurred_at        <= decision_time
```

The persisted reader also bounds the SQL read by `occurred_at <= decision_time`.

## Effective window and action applicability

Effective windows are half-open:

`[effective_from, effective_until)`.

Null `effective_until` means no explicit end.

Action applicability remains exact string membership against:

`candidate.proposed_action.action_type`.

No alias/category mapping is introduced.

## Supersession

A successor may deactivate its predecessor at
`successor.effective_from` only when:

1. the predecessor exists in the exact scope/anchor set;
2. the predecessor was knowable before the successor declaration;
3. both declarations share the same policy_id;
4. both declarations have exact same decision scope;
5. both declarations have exact same Program anchor;
6. the chain is acyclic.

Multiple successors for one predecessor fail closed as
`POLICY_SUPERSESSION_AMBIGUOUS`.

Cross-policy, cross-scope, cross-anchor, unknown-predecessor, and retroactively
unknown predecessor topology fails closed as invalid declaration topology.

## Cardinality

After exact anchor, scope, causal-time, effective-window, action, and
supersession filtering:

```text
0 -> POLICY_NOT_FOUND
1 -> POLICY_SELECTED
>1 -> POLICY_SCOPE_AMBIGUOUS
```

There is no latest-version, newest-declaration, lexical, specificity, or
composition rule.

## Runtime topology

B-09v creates a canonical domain capability island:

```text
persisted policy declaration facts
-> decision_eligibility_policy_selector_v1
-> POLICY_SELECTED | fail-closed selector state
```

There is no HTTP selector route and no B-07e caller.

The selector returns the selected immutable declaration fact only. It does not
invoke `runDecisionEligibilityRuntimeV1`, does not produce a
`DecisionEligibilityDecisionV1`, and does not create Approval or execution
authority.

## Preserved blockers

B-09j currently still projects:

```text
context_snapshot_ref = null
decision_time = null
```

B-09v does not modify that producer. Therefore the current B-09j Candidate path
correctly remains unable to select policy and fails closed until canonical
Candidate/Context/time binding is separately established.

There is still no real product policy instance. `policy_id`, `policy_version`,
`policy_ref`, `applicable_action_types`, and `required_criteria` remain a later
product-governance decision.

B-07e remains disconnected.

## Non-effects

B-09v does not:

- change CandidateDecision producers;
- create or mutate ContextSnapshot producers;
- invent real policy content;
- create a selector HTTP route;
- connect B-07e;
- change Approval, OperationPlan, Task, AO-ACT, execution, receipt, acceptance,
  or outcome authority;
- modify MCFT provider/scheduler/Formal/Twin persistence/production hosting/
  candidate promotion/schema/binding/lifecycle work;
- connect ADR or LLM;
- migrate consumers;
- remove historical authority.
