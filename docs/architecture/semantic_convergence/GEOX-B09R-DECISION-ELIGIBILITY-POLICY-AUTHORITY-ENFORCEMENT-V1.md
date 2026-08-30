# GEOX B-09r Decision Eligibility Policy Authority Enforcement V1

B-09r is stacked exactly on B-09q product head `8526be4611290484ccaa8550969a013b408ff557`.

Product governance authorizes `DEC-BLINE-ELIGIBILITY-POLICY-PRINCIPAL-001`.

The dedicated capability is:

```text
decision.eligibility.policy.declare
```

The initial human policy-author role is:

```text
agronomist
```

This is declaration authorship only. It is not policy-content authority,
DecisionEligibility verdict authority, Approval, Execution, or service-principal
authorship.

The centralized gate is
`requireDecisionEligibilityPolicyDeclarationAuthorityV1`:

```text
valid bearer token
  -> requireAoActAuthV0
  -> explicit token capability
  -> product-author principal allowlist
  -> role == agronomist
```

Missing capability fails with `AUTH_SCOPE_DENIED`. An unauthorized principal,
including `admin`, fails with `AUTH_POLICY_PRINCIPAL_DENIED` even if its token
explicitly carries the capability.

## MCFT boundary correction

The first B-09r candidate also changed
`apps/server/src/domain/auth/roles.ts`. Its own B-09r authz tests, B-02,
typecheck and build passed, but MCFT CAP-07 boundary run `33289032771` failed
its lifecycle-aware S5 step with
`SUCCESSOR_WRAPPER_MODE_NOT_APPLICABLE`.

That workflow treats `roles.ts` as an S5/S6 lifecycle-sensitive diff surface.
B-Line does not own that lifecycle, so the final B-09r candidate removes the
`roles.ts` mutation and does not modify the MCFT workflow.

The new authority is therefore enforced by explicit token capability plus the
centralized product-author principal allowlist. `ROLE_SCOPE_MATRIX_V1` remains
byte-identical to B-09q.

Service-principal policy authorship remains forbidden. A future governed service
principal may execute an already-authorized immutable declaration but may not
author its policy contents.

Still absent: policy route, append-only writer, real policy instance, policy_ref,
required_criteria, applicable_action_types, B-07e connection, consumer migration,
authority removal. G-B02-32 remains zero-path.
