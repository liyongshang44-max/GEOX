# GEOX B-09o Decision Eligibility Policy Writer Authority Inventory V1

## Status

B-09o is stacked exactly on completed B-09n product head:

`5f8012f90882e94203a2407e718dcb963ced1375`.

B-09o is analysis/governance only.

It does not add an auth scope, role mapping, route, writer, policy instance,
B-07e connection, consumer migration or authority removal.

## Question

B-09n recommended a separate append-only policy declaration fact, but left its
writer authority ungranted.

The next question is:

> Which existing product authz authority, if any, may legitimately write a
> DecisionEligibility policy declaration?

The answer is:

```text
none of the current scopes establishes that authority
```

## Existing scopes are semantically wrong

The current auth contract contains several adjacent write authorities, but
none is the same semantic question.

### ao_act.task.write

This is task/action execution-side authority.

It is already used by some legacy surfaces for broader mutations, including
Skill Binding, but that historical reuse is not a reason to extend the
semantic collapse.

Decision policy declaration is not AO-ACT task writing.

### recommendation.write / prescription.write

These authorize recommendation or prescription artifacts.

A policy declaration governs what criteria make a Candidate eligible.

The policy must not inherit its authority from an artifact producer that it
later governs.

### approval.decide

Approval is downstream.

Approval authority cannot be used to define the pre-approval eligibility
policy without violating:

```text
Eligibility != Approval
```

### security.admin

Admin currently has wildcard access.

That is an authentication/authorization implementation fact, not proof that
the broad security-admin capability is the intended product authority for
declaring decision policy.

B-09o does not convert a wildcard into policy provenance.

### skill.binding.write

Skill Binding is a separate governance domain.

Its writer authority is not reusable for DecisionEligibility policy.

## Dedicated writer authority is required

Before a production path may instantiate:

`DecisionEligibilityPolicyDeclarationV1`

under G-B02-32, the repository needs an explicitly authorized, bounded
policy-declaration write authority.

B-09o does not name that final scope token.

The exact token remains:

`UNDECIDED`.

Likewise, B-09o does not decide whether future declaration authority belongs
to:

- admin;
- agronomist;
- another existing role;
- a new product-governance role;
- a service principal plus human-governance process.

That role decision is product governance, not migration implementation.

## Auditability precedent

The append-only Skill Binding fact provides a useful auditability pattern:

```text
changed_by_actor_id
changed_by_token_id
change_reason
```

That is a reusable pattern, not reusable authority.

A future policy writer should preserve equivalent auditability:

```text
actor identity
token identity
change reason
append-only fact identity
```

B-09o does not reuse the Skill Binding writer or its current
`ao_act.task.write` scope.

## Required writer invariants

Before implementation, product governance must freeze:

```text
dedicated policy declaration write authority
allowed role set
tenant/project/group scope
field/program scope matching
actor_id
token_id
change_reason
append-only semantics
policy_ref immutability
duplicate conflict fail-closed
multi-policy ambiguity fail-closed
decision-time as-of selection
```

The writer must not:

- invoke B-07e;
- create an Approval;
- create a Plan;
- create a Task;
- authorize execution.

## Intentionally undecided

B-09o leaves all of these unset:

```text
scope token
allowed roles
route path
writer service path
policy_id
policy_version
policy_ref
applicable_action_types
required_criteria
```

No real IRRIGATE policy exists.

## Preserved boundary

```text
G-B02-32 registered paths        0
policy writer                    NONE
policy instance                  NONE
B-07e runtime                    DISCONNECTED
consumer migration               NOT PERFORMED
authority removal                NOT PERMITTED
MCFT/Twin implementation         UNTOUCHED
```

## Next permitted step

An explicit product-governance decision must authorize a dedicated
policy-declaration write scope and allowed role set.

Only after that authority exists may B-Line add an append-only production
writer.

B-09o does not authorize that implementation.
