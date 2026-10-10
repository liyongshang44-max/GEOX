# GEOX B-05c Legacy Crop-Stage Compatibility Adapter V1

## 0. Status

B-Line bounded B-05 phase stacked exactly on corrected B-05b completion head:

`476eedd8b881077dd12dbb17f8dd278c269ddd93`

This phase does not change the historical resolver runtime and does not connect MCFT.

## 1. Problem

The legacy stage resolver supports:

- explicit stage;
- days after planting;
- start-date calculation.

Historical convenience behavior also normalizes some malformed values:

- negative DAP is clamped to zero;
- invalid start date becomes zero elapsed days;
- future start date becomes zero elapsed days.

Those behaviors may remain for product compatibility, but they cannot be promoted into canonical stage authority.

## 2. Adapter boundary

B-05c adds:

`projectLegacyCropStageCompatibilityV1`

It is a pure registered capability with no route/job/runtime consumer.

The adapter validates compatibility inputs before invoking the historical resolver.

## 3. Valid legacy representation

Valid explicit stage:

```text
COMPATIBILITY_NON_AUTHORITATIVE
source_class = DECLARED_STAGE_COMPATIBILITY
decision_input_eligible = false
```

Valid nonnegative DAP:

```text
COMPATIBILITY_NON_AUTHORITATIVE
source_class = DAP_CALCULATOR
decision_input_eligible = false
```

Valid non-future start date:

```text
COMPATIBILITY_NON_AUTHORITATIVE
source_class = START_DATE_CALCULATOR
decision_input_eligible = false
```

No compatibility state may carry `derived_state_ref`.

## 4. UNKNOWN preservation

The following become canonical `UNKNOWN`:

- missing stage input;
- invalid explicit stage with no valid lower-priority source;
- non-finite DAP;
- negative DAP;
- invalid start date;
- future start date;
- unsupported crop;
- legacy resolver returning `unknown`.

Canonical UNKNOWN is always:

```text
stage = null
source_class = NONE
decision_input_eligible = false
derived_state_ref = null
```

The adapter never converts `unknown` into `seed` or `seedling`.

## 5. Priority compatibility

The adapter preserves legitimate legacy priority without preserving malformed normalization:

```text
valid explicit
-> explicit compatibility

invalid explicit + valid DAP
-> DAP compatibility

invalid/missing explicit + no DAP + valid start date
-> start-date compatibility

malformed selected compatibility source
-> UNKNOWN
```

A negative DAP does not silently fall through to a start date because the malformed higher-priority source must fail closed.

## 6. Governance

The adapter is registered under:

`context.crop_stage.registered_producers`

as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`

with no runtime consumer.

B-02 guard:

`G-B02-12-qualified-crop-stage-instantiation`

now permits this exact adapter path and no unregistered QualifiedCropStage producer.

This is representation capability, not stage authority activation.

## 7. Historical authority remains unchanged

B-05c does not modify:

- `stage_resolver.ts`;
- context_builder;
- rule_engine;
- Decision Engine;
- field_program_state;
- operation_state.

The architecture amendment states that actual historical semantic-authority removal is a B-09 operation after replacement, shadow comparison and divergence inventory.

Therefore B-05c does not delete, disable, or silently downgrade current product paths.

## 8. MCFT boundary

`TWIN_QUALIFIED` remains contract capability only.

B-05c creates:

- no MCFT binding;
- no Twin Runtime producer;
- no MCFT provider/scheduler/Formal/persistence mutation;
- no `TWIN_DERIVED_STATE` output.

## 9. Completion gate

B-05c is complete only when one exact product head proves:

- valid explicit -> compatibility-only PASS;
- valid DAP -> compatibility-only PASS;
- valid start date -> compatibility-only PASS;
- negative DAP -> UNKNOWN PASS;
- invalid start date -> UNKNOWN PASS;
- future start date -> UNKNOWN PASS;
- unknown crop/resolver -> UNKNOWN PASS;
- missing stage -> UNKNOWN PASS;
- invalid explicit + valid DAP priority PASS;
- invalid evaluated_at fail-closed PASS;
- no TWIN_QUALIFIED output PASS;
- adapter has no runtime consumer PASS;
- B-02 governance PASS;
- B-05a/B-05b regressions PASS;
- B-03/B-04 regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
