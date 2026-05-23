# PEST DISEASE MAIN CHAIN ALIGNMENT V1

## 0. Position

P2-C is Inspection Evidence Chain, not Treatment Chain.

P2-C Pest & Disease Inspection completes a formal inspection evidence chain. It may support later recommendations, prescriptions, AO-ACT execution, ROI, or Field Memory in later phases, but it does not create or imply those downstream chains.

```text
AO-SENSE / Manual Scout / Drone / Fixed Trap
→ Pest & Disease Inspection Evidence Chain
→ Guarded Customer Report
```

The chain stops at inspection evidence acceptance.

## 1. AO-SENSE boundary

AO-SENSE task and receipt only represent sensing or inspection task execution and evidence return.

- AO-SENSE receipt success does not equal AO-ACT execution success.
- AO-SENSE receipt success does not confirm pest/disease.
- AO-SENSE receipt success does not equal inspection acceptance PASS.
- AO-SENSE receipt success can reference a `pest_disease_observation_v1` fact by `fact_id`.

## 2. Skill boundary

Pest/disease skills only create technical signals.

- pest_disease_signal_v1 is a technical signal, not a formal assessment.
- SkillRun SUCCESS does not confirm pest/disease.
- SkillRun SUCCESS ≠ pest_disease_inspection_assessment CONFIRMED.
- confidence=HIGH does not confirm pest/disease.
- confidence=HIGH ≠ pest_disease_inspection_assessment CONFIRMED.
- Skill signal only不得 customer-visible confirmed.

## 3. Inspection acceptance boundary

Inspection acceptance is evidence-chain acceptance only.

- pest_disease_inspection_acceptance PASS = 巡检证据链完整
- Inspection acceptance PASS means evidence-chain completeness only.
- Inspection acceptance PASS does not confirm pest/disease existence.
- Inspection acceptance PASS does not create spray recommendation.
- Inspection acceptance PASS does not create spot spray prescription.
- Inspection acceptance PASS does not create AO-ACT spray task.
- Inspection acceptance PASS does not create dispatch command.
- Inspection acceptance PASS does not create ROI.
- Inspection acceptance PASS does not create Field Memory.

Acceptance-required literals:

- pest_disease_inspection_acceptance PASS ≠ spray recommendation
- pest_disease_inspection_acceptance PASS ≠ spot spray prescription
- pest_disease_inspection_acceptance PASS ≠ AO-ACT spray task
- pest_disease_inspection_acceptance PASS ≠ ROI
- pest_disease_inspection_acceptance PASS ≠ Field Memory

## 4. AO-ACT boundary

AO-ACT task is an explicit physical task. P2-C does not create physical treatment tasks.

- P2-C does not create spray AO-ACT task.
- P2-C does not create device dispatch.
- P2-C does not convert an inspection report into an execution task.
- P2-C does not imply AO-ACT execution success.

## 5. Report boundary

FORMAL_PEST_DISEASE_INSPECTION.formal_chain_status=PASSED means only that the inspection evidence chain passed.

It does not mean:

- spraying is complete;
- treatment is complete;
- AO-ACT execution succeeded;
- crop risk is resolved;
- pest pressure has been eliminated;
- ROI has been produced;
- Field Memory has learned a treatment effect.

Customer report must say inspection evidence is recorded and remains subject to formal chain validation, not treatment completed.

## 6. Customer copy baseline

Customer-facing copy must stay inside the inspection evidence chain and must not turn raw inspection PASS into a customer treatment or completion conclusion.

Required customer-safe Chinese copy:

- 巡检证据已有记录，可作为后续处理建议依据；仍以正式链路校验为准，且不代表防治闭环。
- 巡检结果已确认，但尚未进入补喷处方。
- 当前仅为识别信号，不作为正式巡检结论。

Allowed meanings:

- 巡检证据已有记录；
- 发现疑似风险；
- 需要人工复核；
- 巡检结果已确认但未进入补喷处方；
- 可作为后续处理建议依据；
- 仍以正式链路校验为准。

Forbidden customer meanings outside this forbidden-list section:

- 已喷药；
- 已防治；
- 已完成防治；
- 防治完成；
- 喷药完成；
- 病虫害已解决；
- 作物风险已解除；
- 防治效果已达成；
- 执行成功。

## 7. Operator note

P2-C 当前只完成巡检证据闭环。如需补喷、药剂处方、设备执行或防治效果验收，应进入 P2-D Spot Spray 链路。