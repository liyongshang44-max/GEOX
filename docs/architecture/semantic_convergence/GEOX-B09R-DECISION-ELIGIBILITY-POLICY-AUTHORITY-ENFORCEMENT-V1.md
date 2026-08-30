# GEOX B-09r Decision Eligibility Policy Authority Enforcement V1

## Status

B-09r is stacked exactly on completed B-09q product head:

`8526be4611290484ccaa8550969a013b408ff557`.

Product governance has now authorized the authority model that B-09p/B-09q
left intentionally undecided.

Decision:

`DEC-BLINE-ELIGIBILITY-POLICY-PRINCIPAL-001`

Status:

`AUTHORIZED_BY_PRODUCT_GOVERNANCE`.

## Frozen dedicated capability

The dedicated token scope is:

```text
decision.eligibility.policy.declare
```

This scope means only:

> the principal may author a DecisionEligibility policy declaration.

It does not grant:

- policy content defaults;
- DecisionEligibility verdict authority;
- Approval authority;
- Execution authority;
- service-principal policy authorship.

## Initial human policy-author principal

The initial authorized human role is:

```text
agronomist
```

No other current role is a product policy author in B-09r.

In particular:

```text
admin != DecisionEligibility policy author
```

even though the generic role matrix keeps:

```text
admin: ["*"]
```

## Why a specialized central gate is required

The existing generic gate remains:

```text
token explicitly contains requested scope
AND
role matrix allows requested scope
```

B-09q established that admin wildcard does not mint a missing token scope.

But an admin token that is explicitly configured with
`decision.eligibility.policy.declare` can pass that generic gate because the
admin role row is wildcard.

B-09r therefore adds a stricter centralized product-author gate:

```text
requireDecisionEligibilityPolicyDeclarationAuthorityV1
```

which requires:

```text
valid bearer token
AND
explicit decision.eligibility.policy.declare token scope
AND
generic role-matrix permission
AND
human author role == agronomist
```

If the generic gate succeeds but the product-author principal is not allowed,
the request fails closed with:

```text
AUTH_POLICY_PRINCIPAL_DENIED
```

This is intentionally not hidden inside generic role authorization.

## Service-principal boundary

B-09r does not authorize service-principal policy authorship.

A future governed service principal may execute an already-authorized,
immutable declaration, but it may not decide the policy contents.

No service-principal policy writer or route is added here.

## What B-09r changes

B-09r changes only the authority substrate:

- adds `decision.eligibility.policy.declare` to the scope vocabulary;
- adds that scope to the agronomist role row;
- adds a centralized policy-author predicate and enforcement helper;
- adds contract tests for agronomist allow / admin deny / missing-scope deny;
- records the product-governance decision.

## What B-09r still does not do

```text
policy route                    NONE
append-only writer              NONE
real policy instance            NONE
policy_ref                      NONE
required_criteria               UNDECIDED
applicable_action_types         UNDECIDED
B-07e runtime connection        NONE
consumer migration              NOT STARTED
authority removal               NONE
G-B02-32 registered paths       0
service-principal authorship    FORBIDDEN
MCFT implementation             UNTOUCHED
```

## Next permitted engineering step

B-09r makes the authority substrate explicit enough to implement a bounded
append-only declaration writer and route.

That next step must use
`requireDecisionEligibilityPolicyDeclarationAuthorityV1` and must preserve:

- actor_id;
- token_id;
- tenant_id;
- project_id;
- group_id;
- change_reason;
- immutable policy_ref semantics;
- conflict fail-closed behavior.

It still may not invent actual policy contents or connect B-07e until product
governance separately authorizes a real policy declaration.
