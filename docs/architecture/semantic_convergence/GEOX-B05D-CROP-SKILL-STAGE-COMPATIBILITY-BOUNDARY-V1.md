# GEOX B-05d Crop-Skill Stage Compatibility Boundary V1

## 0. Status

B-Line bounded B-05 phase stacked exactly on B-05c completion head:

`9b17fbf3c90b723544db1579c1965c72a18f0fbb`

This phase does not modify `rule_engine.ts` and does not connect MCFT.

## 1. Why this phase is required

B-01 froze two crop-stage calculator/helper families:

```text
stage_resolver      -> candidate/calculator helper
crop skill resolver -> candidate/calculator helper
```

B-05c covered the first.

The legacy crop skills still contain convenience behavior:

```text
if (!days_after_sowing) return "seedling"
```

and `rule_engine.ts` contains additional fallback/normalization paths to `seedling`.

Those historical product paths remain visible, but a future canonical stage path must not inherit their missing-input default.

## 2. Adapter boundary

B-05d adds:

`projectCropSkillStageCompatibilityV1`

It accepts an explicit `CropSkill` capability and an explicit day input.

The adapter does not import or activate the legacy crop-skill catalog by itself.

It is a pure capability island with no runtime consumer.

## 3. Missing versus zero

The core invariant is:

```text
missing DAP/DAS
-> UNKNOWN

explicit 0 days
-> skill may return seedling
-> COMPATIBILITY_NON_AUTHORITATIVE
```

This prevents legacy falsey-value convenience semantics from fabricating stage while preserving a legitimate explicit day-zero case.

## 4. Valid skill output

A valid enabled skill with matching crop code and explicit finite nonnegative day input may emit:

```text
authority_state = COMPATIBILITY_NON_AUTHORITATIVE
source_class = CROP_SKILL_CALCULATOR
decision_input_eligible = false
derived_state_ref = null
```

Recognized compatibility stage vocabulary is bounded to:

- seedling
- vegetative
- flowering
- fruiting
- reproductive

Unrecognized output becomes UNKNOWN.

## 5. Fail-closed cases

Canonical UNKNOWN is produced for:

- missing day input;
- non-finite day input;
- negative day input;
- crop/skill mismatch;
- disabled skill;
- unrecognized resolver output;
- resolver exception.

UNKNOWN remains:

```text
stage = null
source_class = NONE
decision_input_eligible = false
derived_state_ref = null
```

Invalid `evaluated_at` throws rather than synthesizing wall-clock time.

## 6. Governance

B-05d registers the adapter under:

`context.crop_stage.registered_producers`

as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`

and adds it to `G-B02-12-qualified-crop-stage-instantiation`.

B-05d also adds:

`G-B02-13-crop-skill-stage-touchpoints`

matching direct production `.resolveStage({` calls.

Current allowed production paths are exactly:

- `apps/server/src/domain/agronomy/rule_engine.ts` — grandfathered historical runtime;
- `apps/server/src/context/crop_skill_stage_compatibility_adapter_v1.ts` — capability-only adapter.

Any third direct crop-skill stage resolver touchpoint must fail governance until explicitly registered.

## 7. Historical runtime remains unchanged

B-05d does not modify:

- rule_engine;
- crop skill implementations;
- Agronomy Agent;
- Decision Engine;
- context_builder;
- stage_resolver.

Historical authority removal remains deferred to B-09 after replacement, shadow comparison and divergence inventory.

## 8. MCFT boundary

B-05d creates no:

- Twin Runtime producer;
- MCFT binding;
- provider/scheduler/Formal mutation;
- Twin persistence/schema mutation;
- TWIN_QUALIFIED output;
- TWIN_DERIVED_STATE output.

## 9. Completion gate

B-05d is complete only when one exact product head proves:

- missing day input -> UNKNOWN PASS;
- explicit zero day -> compatibility-only seedling PASS;
- valid crop-skill stage -> compatibility-only PASS;
- invalid/negative day -> UNKNOWN PASS;
- crop/skill mismatch -> UNKNOWN PASS;
- disabled skill -> UNKNOWN PASS;
- unrecognized/throwing resolver -> UNKNOWN PASS;
- no runtime consumer PASS;
- B-02 governance including G-B02-13 PASS;
- exact QualifiedCropStage producer set PASS;
- B-05a/B-05b/B-05c regressions PASS;
- B-03/B-04 regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
