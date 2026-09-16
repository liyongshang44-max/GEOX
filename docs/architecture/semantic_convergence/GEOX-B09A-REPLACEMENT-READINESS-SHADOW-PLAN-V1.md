# GEOX B-09a Replacement Readiness + Shadow Plan V1

## Status

B-09 begins only after B-08 overall closure.

Authoritative B-08 product head:

`6702631be2f66587d4fa1230e0f97f6fd4e9b8b9`.

B-09a performs no historical authority removal.

It creates a machine-readable replacement-readiness inventory and freezes the generic shadow-comparison contract required before any removal.

## Frozen B-09 order

The mandatory sequence remains:

`replacement exists -> shadow compare -> divergence inventory -> consumer migration -> authority removal -> compatibility-only/no-new-feature -> disable default -> delete later`.

B-09a executes only the inventory/shadow-planning portion.

## Complete grandfathered coverage

The inventory must cover every producer currently registered with:

`grandfathered_duplicate = true`

exactly once.

At this product head there are 29 such producers across:

- Evidence Qualification;
- declared Context;
- crop stage;
- Twin physical state;
- Forecast/Scenario;
- calculation;
- CandidateDecision;
- Decision Eligibility;
- OperationPlan.

No hidden legacy owner may bypass the migration inventory.

## Replacement classes

The inventory distinguishes:

- `REPLACEMENT_ESTABLISHED`;
- `PARTIAL_REPLACEMENT`;
- `UNREPLACED_EXTERNAL_DEPENDENCY`;
- `REFERENCE_ONLY`;
- `ORPHANED_NO_ACTIVE_CONSUMER`.

This distinction is required because B-09 is not permission to delete every old path.

## Explicit unreplaced families

`twin.physical_state` and `twin.forecast_scenario` are classified:

`UNREPLACED_EXTERNAL_DEPENDENCY`.

B-08 created typed ports only.

Real MCFT remains disconnected.

Therefore their historical producers are:

`FREEZE_NO_NEW_FEATURE`

and:

`authority_removal_state = FORBIDDEN_UNREPLACED`.

The B-line must not pretend a typed future port is a replacement for an actual Twin/Forecast producer.

## Partial calculation replacement

B-06 created canonical irrigation CalculationResult adapters, but not every legacy calculation/composition semantic has been replaced.

Therefore:

`decision.calculation = PARTIAL_REPLACEMENT`

and authority removal is forbidden at B-09a.

The orphaned `evaluateIrrigationDecisionV1` capability is frozen, not silently deleted.

## Replacement-backed families

Evidence, Context, CandidateDecision, Decision Eligibility and formal OperationPlan families have canonical replacements/adapters sufficient to enter shadow planning.

That still does not authorize removal.

They must complete semantic comparison and consumer migration first.

Evidence already has partial B-04 shadow coverage, so it is classified separately as:

`EXISTING_PARTIAL_SHADOW / PENDING_CONSUMER_MIGRATION`.

## Producer dispositions

Every grandfathered producer receives one disposition:

- `SHADOW_COMPARE_REQUIRED`;
- `FREEZE_NO_NEW_FEATURE`;
- `REFERENCE_ONLY`;
- `ORPHANED_FREEZE`;
- `ROLE_RECLASSIFICATION_REQUIRED`.

A disposition describes the next migration treatment, not code deletion.

## Shadow comparison contract

`SemanticShadowComparisonV1` can record:

- MATCH;
- DIVERGENT;
- INCOMPARABLE;
- CANONICAL_MISSING;
- LEGACY_MISSING.

Comparable dimensions include identity, scope, value, verdict, action, evidence basis, context, time and authority class.

Every comparison is fixed:

`authority_state = SHADOW_ONLY`

and:

`authority_removal_permitted = false`.

Shadow results therefore cannot themselves remove authority.

## Real integrations remain disconnected

B-09a preserves:

- real MCFT adapter = DISCONNECTED;
- real ADR runtime = DISCONNECTED;
- real LLM provider = DISCONNECTED.

B-09 does not reopen the B-08 integration boundary.

## Machine governance

A new semantic:

`governance.semantic_authority_migration`

owns the B-09 migration inventory/shadow record vocabulary.

A new guard:

`G-B02-22-semantic-shadow-comparison-instantiation`

permits zero production shadow-comparison producers at B-09a.

Later family-specific shadow phases must explicitly register each producer.

## No authority removal

B-09a must prove:

`authority_removal_performed = false`.

No legacy implementation, route, feature flag, producer registration, runtime edge, consumer edge or default is removed in this phase.

## Completion gate

B-09a is complete only when one exact product head proves:

- every grandfathered producer covered exactly once PASS;
- every historical removal_target remains B-09 PASS;
- Twin/Forecast marked unreplaced and removal-forbidden PASS;
- calculation marked partial and removal-forbidden PASS;
- replacement-backed families queued for shadow PASS;
- B-04 evidence partial shadow recognized but not overclaimed PASS;
- real MCFT/ADR/LLM remain disconnected PASS;
- SemanticShadowComparisonV1 is SHADOW_ONLY PASS;
- shadow comparison cannot authorize removal/Approval/Task/command PASS;
- zero production shadow-comparison producers PASS;
- no historical authority/runtime mutation PASS;
- B-08/B-07 and earlier regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
