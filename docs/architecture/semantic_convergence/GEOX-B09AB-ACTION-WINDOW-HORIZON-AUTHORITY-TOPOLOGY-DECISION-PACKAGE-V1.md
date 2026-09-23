# GEOX B-09ab ActionWindow Horizon Authority Topology Decision Package V1

## Status

Base:

`93b00ec51eca95b6388f236ce73b4fa6d4e10c49`

Decision:

`DEC-BLINE-ACTION-WINDOW-HORIZON-AUTHORITY-TOPOLOGY-001`

Status:

`RECOMMENDED_NOT_AUTHORIZED`

B-09ab chooses only the recommended ownership/topology for a future ActionWindow horizon.
It does not choose a duration and does not implement a contract or producer.

## Problem

B-09aa established that the repository currently has no authorized ActionWindow horizon
source.

The remaining question is where future horizon authority should live.

## Recommended topology

The recommended v1 topology is:

`SUCCESSOR_ELIGIBILITY_POLICY_CONTRACT_EMBEDDED_HORIZON`

The ActionWindow horizon belongs to the same Decision Eligibility policy-content
authority that already declares:

- policy identity;
- exact scope anchor;
- applicable action types;
- required criteria;
- policy lifecycle.

This keeps ActionWindow risk tolerance inside Decision Eligibility policy rather than
creating another parallel policy-selection family.

## Why not a separate horizon-policy family

A second independently selected horizon policy would create another authority-selection
problem:

Candidate
→ Eligibility policy selector
→ horizon policy selector
→ composition/precedence.

That would reintroduce the parallel-authority complexity B-Line is trying to remove.

For v1, B-09ab therefore recommends one selected Eligibility policy as the sole product
policy identity from which ActionWindow horizon authority is obtained.

## Existing v1 contract remains immutable

Current contract:

`DecisionEligibilityPolicyDeclarationV1`

Current fact type:

`decision_eligibility_policy_declaration_v1`

B-09ab does not modify that contract.

A future implementation must use a successor contract, for example:

`DecisionEligibilityPolicyDeclarationV2`

or a semantically equivalent successor.

Existing v1 declarations must remain valid under their original semantics.

They must not receive an inferred or default ActionWindow duration.

If a future successor policy declares ACTION_WINDOW as required but does not provide
explicit horizon authority, materialization must fail closed.

## Provenance

A future canonical ActionWindow must remain tied to:

- the exact selected policy_ref;
- the exact immutable selected policy declaration fact;
- the same Candidate decision boundary.

There is no independent "latest horizon" lookup.

There is no fallback to:

- FieldProgram;
- AO-ACT/execution policy;
- ProblemState/Twin windows;
- MCFT forecast/evidence/runtime windows.

## Numerical value is deliberately undecided

B-09ab does not select:

- 6h / 12h / 24h / 72h;
- fixed-duration mode;
- start offset;
- unit representation;
- minimum or maximum duration;
- dynamic agronomic shortening.

Those are separate product-governance choices.

Topology authority must be decided before numerical policy content is invented.

## Future dynamic extension

A later version may allow a dynamic agronomic calculation to shorten an explicit policy
maximum.

That would require, in order:

1. explicit policy bound;
2. canonical agronomic calculation authority;
3. canonical input-validity semantics if used;
4. deterministic composition/precedence.

Forecast-dependent dynamic shortening remains blocked until MCFT-9 is COMPLETE and a
separate B-Line ↔ MCFT integration authorization exists.

## Authorization effect

Accepting this topology decision would permit design of a successor Eligibility policy
contract carrying ActionWindow horizon authority.

It would not authorize any concrete horizon value, real declaration, writer/route
mutation, selector connection, ActionWindow producer, B-07e connection, Approval,
AO-ACT, Execution, MCFT integration, consumer migration or authority removal.

## Non-effects

B-09ab changes no runtime, schema, DB, route, graph edge, existing policy contract,
policy fact, horizon value, ActionWindow producer, B-07e connection, MCFT implementation
or historical authority.
