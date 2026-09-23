# PFE-14 Prototype No-Fabrication Amendment 01

Status: DESIGN AUTHORITY OVERLAY / NO RUNTIME EFFECT  
Applies to: `PFE-14-PROTOTYPE-AUTHORITY-V1` and all subsequent PFE-14 review prototypes  
Does not unlock: PFE-14 S4 or any MCFT-CAP-09 Runtime authority

## 1. Ruling

The earlier PFE-14 v0.2 prototype rule allowed a frozen design-only sample Scope and design sample data in a `TARGET_STATE_PRODUCT_PROTOTYPE`.

That allowance is revoked for reviewed prototypes.

From this amendment onward, product prototypes may reorganize current capability and may reserve layout for already-frozen future read-contract fields, but they may not populate those areas with invented identifiers, timestamps, counts, percentages, scheduler slots, freshness verdicts, health verdicts, agronomic values, State values, Forecast values, Scenario values or device/gateway states.

## 2. Why this overlay is required

The current repository contains a mixture of:

- real current GET-only read capability;
- Replay-backed demo state;
- governed static nonclaims;
- PFE-14 design contracts whose backend read models are not yet implemented;
- MCFT-CAP-09 implementation that is still waiting on external provider evidence and Formal authority.

A sample-filled target prototype can visually blur these categories even when it carries a small prototype badge. The product line therefore adopts a stronger rule: missing authority is displayed as missing authority, not as realistic sample data.

## 3. Allowed visible value sources

Every visible prototype value must be one of:

1. `CURRENT_STATIC_NONCLAIM`
   - exact current repository boundary, for example Replay-backed Demo / Read-only / Live Device Not connected.
2. `CURRENT_API_VALUE`
   - value retrieved from a named current GET endpoint for the exact shown scope.
3. `ACCEPTED_ARTIFACT_VALUE`
   - value copied from a named immutable acceptance artifact with run/artifact identity.
4. `UNAVAILABLE_AUTHORITY`
   - no synthetic value; display `未建立`, `等待权威读合同`, `不可用`, or equivalent.
5. `LABEL_ONLY`
   - navigation, title, explanation, field label or boundary copy; not data.

No sixth class exists.

## 4. Scope rule

A reviewed prototype must not use invented six-key Scope identifiers.

It may either:

- show a real governed scope from a named current API response or accepted artifact; or
- show the Scope controls in an unselected state.

If the prototype does not have a named source for the exact Scope, it must render no selected scope rather than a sample scope.

## 5. Future Shadow-online fields

PFE-14 S4 remains blocked by the missing authorized MCFT-9 Scheduler Summary and Evidence Availability read contracts.

The prototype may show these labels as target structure:

- latest completed slot;
- next target slot;
- scheduler lag;
- Evidence age/freshness/coverage;
- missed slot/backfill;
- restart/recovery;
- Runtime degradation.

But until the server contract is authorized and implemented, every corresponding value is `UNAVAILABLE_AUTHORITY`.

The browser may not derive any of those values.

## 6. Relationship to the existing taskbook

This amendment changes only the prototype data policy. It does not change:

- one governed six-key Scope architecture;
- primary navigation `运行总览 / 地块`;
- canonical `/operator/fields/*` route ownership;
- GET-only/read-only product boundary;
- PFE-14 S0-S3 effectiveness;
- PFE-14 S4 dependency hold;
- MCFT-CAP-09 authority;
- production/device/gateway/pilot/controlled-execution nonclaims.

Where PFE-14 v0.2 text permits design sample values, this amendment controls the reviewed prototype and replaces that allowance with the no-fabrication rule.

## 7. Required companion

All new visual prototype work must consume:

`docs/frontend-productization/PFE-14-PROTOTYPE-TRUTH-MATRIX-V1.json`

That matrix maps each of the 12 product surfaces to its current route/API source and explicitly identifies S4-only unavailable authority.
