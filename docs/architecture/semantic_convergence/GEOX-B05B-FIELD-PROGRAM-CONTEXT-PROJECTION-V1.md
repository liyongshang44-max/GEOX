# GEOX B-05b FieldProgram Declared-Context Compatibility Projection V1

## 0. Status

B-Line bounded B-05 runtime-capability phase.

Stacked exactly on B-05a completion head:

`38b8255d2bc1ac511a83be9fbc186bd3aa8f3816`

This is not protected-main authority and does not connect MCFT.

## 1. Why FieldProgram is split from crop-stage authority

The typed `FieldProgramV1` contract contains:

- tenant/project/group/program/field/season identity;
- `crop_code`;
- optional `variety_code`;
- goal profile;
- constraints;
- budget;
- execution policy;
- acceptance/evidence policy refs;
- status and timestamps.

It does **not** contain:

- `crop_stage`;
- `days_after_planting`;
- a planting event/date;
- management history.

Current historical runtime code can read `crop_stage` and `days_after_planting` directly from legacy `record_json`, but those fields are outside the typed FieldProgramV1 contract.

B-05b therefore refuses to promote them through the FieldProgram Context projection.

## 2. Pure compatibility projector

B-05b adds:

`projectFieldProgramDeclaredContextV1`

It is a pure registered capability with no route, job, scheduler, or decision consumer.

It emits only:

```text
CROP_IDENTITY
CULTIVAR (when variety_code exists)
DECLARED_FIELD_PROGRAM
CUSTOMER_GOAL
```

into `ContextAssertionV1`, then groups them into `ContextSnapshotV1`.

## 3. Explicit non-projection

B-05b does not emit:

```text
PLANTING_EVENT
MANAGEMENT_HISTORY
QualifiedCropStageStateV1
```

because the typed FieldProgram source does not establish those semantics.

Even if a legacy JavaScript object carries extra fields named:

```text
crop_stage
days_after_planting
```

they are not copied into canonical Context and cannot become canonical crop-stage authority.

## 4. Authority level

The source remains:

`COMPATIBILITY_LEGACY`

The projector is registered as:

`REGISTERED_CAPABILITY_ISLAND / INTENTIONAL_NONE runtime edge`

This means:

- the vocabulary is implemented;
- the mapping can be tested;
- no production consumer is connected;
- no new decision authority exists.

A later B-05 phase must explicitly register and prove any runtime consumer.

## 5. Fail-closed behavior

B-05b requires a valid typed program timestamp.

If both `updated_ts` and `created_ts` are invalid, projection fails closed with:

`B05B_FIELD_PROGRAM_TIMESTAMP_INVALID`

It does not synthesize current wall-clock time.

## 6. Machine governance

B-02 guard:

`G-B02-11-canonical-context-instantiation`

now explicitly permits exactly one canonical Context instantiation path:

`apps/server/src/context/field_program_context_projection_v1.ts`

No other production Context producer is authorized.

`G-B02-12-qualified-crop-stage-instantiation` remains with zero registered production producers.

## 7. Non-effects

B-05b does not modify:

- Agronomy Agent;
- Decision Engine;
- context_builder;
- stage_resolver;
- rule_engine;
- field_program_state;
- operation_state;
- Stage-1;
- Evidence Judge;
- EvidenceQualification;
- MCFT implementation/provider/scheduler/Formal/Twin persistence/schema/binding;
- CandidateDecision;
- Decision Eligibility;
- ADR/LLM;
- approval/AO-ACT/task/receipt/acceptance.

## 8. Completion gate

B-05b is complete only when one exact product head proves:

- typed FieldProgram -> canonical Context projection fixtures PASS;
- historical crop_stage/DAP extra-field exclusion PASS;
- no fabricated planting/management assertions PASS;
- invalid timestamp fail-closed PASS;
- B-02 governance PASS;
- QualifiedCropStage production producer count remains zero;
- server typecheck/build PASS;
- B-05a contract regressions PASS;
- B-03/B-04 regressions PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
