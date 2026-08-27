# GEOX B-05a Context / Crop Stage Separation Contracts V1

## 0. Status

B-Line bounded B-05 contract phase.

Stacked exactly on B-04 completion head:

`140e8f106cb9274f8c8f3150b9fbff2defb5fcf1`

This document is not repository-level SSOT and does not authorize protected-main merge.

## 1. Frozen problem

B-05 must separate three semantics that the current repository still mixes:

```text
Declared context
Observed phenology/evidence
Derived crop-stage state
```

The frozen target is:

```text
Declared customer/field context
  -> ContextAssertion

Phenology/scouting/management observation
  -> CanonicalObservation
  -> EvidenceQualification

Derived crop stage / phenology state
  -> Twin / qualified derived-state boundary

Decision Runtime
  -> consume
  -> never fabricate
```

B-01 already proved that legacy stage authority is duplicated across:

- field_program fields;
- stage_resolver DAP/startDate derivation;
- context_builder;
- crop-skill/rule-engine derivation;
- decision-engine direct resolver use;
- field_program_state projection;
- operation_state compatibility paths.

The most dangerous current compatibility behavior is rule-engine normalization that can turn missing/unrecognized stage into `seedling`.

B-05a does not change those runtime paths yet.

## 2. ContextAssertionV1

`ContextAssertionV1` represents declared identity/history only:

- crop identity;
- cultivar;
- planting event;
- declared field program;
- management history;
- customer goal.

It carries scope, provenance and assertion time.

It does not own observed phenology and does not create derived crop-stage authority.

## 3. ContextSnapshotV1

`ContextSnapshotV1` is a decision-time collection of declared assertions.

The schema is strict and has no `crop_stage` field.

Therefore a future Context Authority implementation cannot silently convert a convenience stage value into declared-context authority by adding it to the snapshot.

## 4. QualifiedCropStageStateV1

The stage contract explicitly separates:

```text
UNKNOWN
COMPATIBILITY_NON_AUTHORITATIVE
TWIN_QUALIFIED
```

### UNKNOWN

```text
stage = null
source_class = NONE
decision_input_eligible = false
```

Missing stage cannot become `seedling`.

### COMPATIBILITY_NON_AUTHORITATIVE

A concrete legacy value may be represented for product continuity, including values derived from:

- declared legacy stage;
- DAP calculator;
- start-date calculator;
- crop-skill calculator.

But:

```text
decision_input_eligible = false
```

A compatibility stage therefore cannot silently become canonical recommendation input.

### TWIN_QUALIFIED

The contract can represent a future qualified Twin-derived stage only when it has:

- a concrete stage;
- `source_class = TWIN_DERIVED_STATE`;
- `derived_state_ref`;
- `context_snapshot_ref`;
- explicit decision-input eligibility.

B-05a does not create a runtime producer for this state and does not bind MCFT.

Schema capability is not runtime authority.

## 5. Machine governance

B-02 receives two additional static guards:

`G-B02-11-canonical-context-instantiation`

`G-B02-12-qualified-crop-stage-instantiation`

Both begin with zero registered production instantiation paths.

Therefore B-05a freezes the vocabulary while preventing a new production Context or crop-stage owner from appearing silently.

A later bounded B-05 phase must explicitly register any producer before runtime use.

## 6. Existing runtime remains compatibility-only for now

B-05a does not modify:

- `stage_resolver.ts`;
- `context_builder.ts`;
- `rule_engine.ts`;
- `decision_engine_v1.ts`;
- `field_program_state_v1.ts`;
- `operation_state_v1.ts`.

Their current behavior remains grandfathered and visible in B-02 governance.

No existing legacy authority is removed in B-05a.

## 7. Non-effects

B-05a does not:

- create a Context Authority runtime;
- create or modify Twin Runtime;
- modify MCFT implementation, provider, scheduler, Formal, persistence, schema or binding;
- change EvidenceQualification;
- change Stage-1 behavior;
- change Evidence Judge behavior;
- change Agronomy Agent behavior;
- change rule-engine recommendation behavior;
- create CandidateDecision;
- create Decision Eligibility;
- connect ADR or LLM;
- change approval, AO-ACT, task, receipt or acceptance authority.

## 8. Completion gate

B-05a is complete only when one exact product head proves:

- ContextAssertionV1 contract tests PASS;
- ContextSnapshotV1 rejects crop-stage authority smuggling;
- UNKNOWN stage cannot become concrete/default stage;
- compatibility stage cannot become decision-input eligible;
- TWIN_QUALIFIED representation requires derived/context provenance;
- B-02 governance PASS with zero unregistered canonical Context/Stage producers;
- legacy stage-resolver priority behavior (`explicit > DAP/startDate > UNKNOWN`) remains unchanged;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.


## 9. Pre-existing stage5 acceptance debt

During B-05a exact-head qualification, the historical file:

`apps/server/src/domain/agronomy/stage5.acceptance.test.ts`

was executed in full.

Its two crop-stage resolver tests passed, but an unrelated historical rule-version assertion failed:

```text
expected: corn_water_balance_v2
actual:   corn_water_balance_v1
```

A separate exact baseline probe on the pre-B-05a B-04 completion head:

`140e8f106cb9274f8c8f3150b9fbff2defb5fcf1`

reproduced the identical failure.

Therefore this is pre-existing rule-selection debt, not a B-05a regression.

B-05a must not repair or re-order historical rule versions merely to obtain a green contract PR. Its compatibility gate is intentionally scoped to the resolver semantics relevant to B-05:

```text
valid explicit stage
> DAP/startDate calculator
> UNKNOWN
```

The historical rule-version mismatch remains visible and outside B-05a scope.
