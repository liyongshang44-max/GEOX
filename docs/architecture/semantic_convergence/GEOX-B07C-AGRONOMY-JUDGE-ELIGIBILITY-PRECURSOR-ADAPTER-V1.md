# GEOX B-07c Agronomy Judge Eligibility Precursor Adapter V1

## 0. Status

B-Line bounded B-07 phase stacked exactly on completed B-07b product head:

`ecb3c83e2d2741de77bc846668cc6b89574e8139`

B-07c adds a pure compatibility adapter for the existing Agronomy Judge V2 output.

It does not create a final DecisionEligibilityDecisionV1 producer.

## 1. Why Agronomy Judge cannot map directly to final eligibility

Current Agronomy Judge verdicts relevant to irrigation are:

- `WATER_DEFICIT`;
- `PASS`;
- `BLOCKED`.

These are not canonical Decision Eligibility verdicts.

The producer mixes:

1. irrigation requirement/deficit calculation results;
2. a legacy Evidence Judge override that turns DEVICE_OFFLINE / INSUFFICIENT_EVIDENCE / STALE_DATA into `BLOCKED`.

Therefore the following mappings are forbidden:

`WATER_DEFICIT -> PASS`

`PASS -> PASS`

`BLOCKED -> BLOCK`

B-07c emits criterion-level precursor semantics only.

## 2. Scope

B-07c supports only:

`candidate_action_type = IRRIGATE`.

Agronomy Judge V2 is currently an irrigation-specific judge.

Other candidate action types fail closed instead of generalizing the legacy semantics.

## 3. WATER_DEFICIT mapping

A valid Agronomy Judge `WATER_DEFICIT` must contain:

`irrigation_requirement_detected`

in source reasons.

It maps to:

`STATE = SATISFIED`

for an IRRIGATE candidate only when the caller supplies at least one canonical CalculationResult ref.

The legacy Judge `outputs` object is not promoted to CalculationResult authority.

The result remains criterion-only and does not mean final eligibility PASS.

## 4. PASS mapping

Agronomy Judge `PASS` currently means:

`no_irrigation_requirement`.

For an IRRIGATE candidate, B-07c maps that to:

`STATE = VIOLATED`.

This states that the canonical calculation support does not support the irrigation candidate's requirement condition.

It is not a final BLOCK.

Other criteria may still matter, and final verdict aggregation belongs to the later canonical Decision Eligibility runtime.

## 5. BLOCKED mapping

Agronomy Judge `BLOCKED` is accepted only when:

- source reasons contain `blocked_by_evidence_judge`; and
- `inputs.evidence_judge_verdict` is exactly one of:
  - DEVICE_OFFLINE;
  - INSUFFICIENT_EVIDENCE;
  - STALE_DATA.

It maps only to:

`QUALIFIED_EVIDENCE = MISSING`.

It never maps directly to canonical BLOCK.

This is the central B-07 correction to the historical shortcut:

`evidence failure -> action BLOCKED`.

## 6. Canonical support refs

For WATER_DEFICIT/PASS:

`support_refs`

come only from explicit caller-supplied canonical CalculationResult refs.

For BLOCKED:

`support_refs`

come only from explicit caller-supplied canonical EvidenceQualification refs.

Legacy:

- `evidence_refs`;
- `outputs.calculation_trace`;
- irrigation skill outputs;
- crop_stage;

are not promoted into canonical authority.

## 7. Downstream contamination

If an extended JudgeResult object carries approval/plan/task/receipt/as-executed/as-applied identity, B-07c fails closed.

Criterion projection may not collapse downstream state back into eligibility precursor semantics.

## 8. Runtime boundary

B-07c does not modify or connect:

- Agronomy Judge;
- Evidence Judge;
- Judge route/persistence;
- Stage-1;
- Approval;
- OperationPlan;
- Task;
- MCFT implementation.

The adapter is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

## 9. Machine governance

Final eligibility guard remains:

`G-B02-16-decision-eligibility-instantiation`

with zero registered paths.

Criterion guard:

`G-B02-17-decision-eligibility-criterion-instantiation`

expands to exactly two paths:

1. B-07b Stage-1 precursor adapter;
2. B-07c Agronomy Judge precursor adapter.

Any third criterion producer is forbidden until explicitly registered.

## 10. Historical authority

Agronomy Judge remains:

`GRANDFATHERED_PRECURSOR`

with:

`removal_target = B-09`.

B-07c does not alter its current route behavior.

## 11. Next B-07 frontier

After B-07c, both currently registered historical eligibility precursor families have criterion-level compatibility mappings:

- Stage-1;
- Agronomy Judge.

The next bounded B-07 phase may define the canonical criterion aggregation/runtime, but must still remain separate from Approval and must not remove historical authority before B-09.

## 12. Completion gate

B-07c is complete only when one exact product head proves:

- WATER_DEFICIT -> STATE=SATISFIED criterion, not PASS PASS;
- PASS -> STATE=VIOLATED criterion, not final PASS/BLOCK PASS;
- BLOCKED evidence override -> QUALIFIED_EVIDENCE=MISSING, not BLOCK PASS;
- explicit canonical CalculationResult support required PASS;
- explicit canonical EvidenceQualification support retained PASS;
- legacy Judge evidence/calculation outputs not promoted PASS;
- only IRRIGATE candidate supported PASS;
- malformed Judge semantics fail closed PASS;
- downstream-contaminated JudgeResult fails closed PASS;
- direct_verdict_authority remains NONE PASS;
- final DecisionEligibilityDecisionV1 producer count remains zero PASS;
- criterion producer set exactly B-07b + B-07c PASS;
- third unregistered criterion producer rejected PASS;
- Judge/Stage-1/Approval/runtime surfaces untouched PASS;
- B-07b/B-07a/B-06/B-05/B-03/B-04 regressions PASS;
- B-09-only removal boundary preserved PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
