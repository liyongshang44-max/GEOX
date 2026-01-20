# Apple III v0 · AO-SENSE → Task → Receipt 冻结说明

## 边界
Apple III v0 仅负责将 Apple II（Judge）输出的 AO-SENSE 结果固化为账本事实（facts）。
不做农技、不做价值判断、不兜底物理失败。

## 冻结口径
- AO-SENSE 来源于 /api/judge/run 的 ao_sense[]。
- Apple III 仅写入 AO_SENSE_TASK_v1 与 AO_SENSE_RECEIPT_v1 两类事实。
- Receipt 必须引用证据（evidence_refs 非空），但不要求问题态发生变化。
- 第二次 /api/judge/run 仅做 non-regression 验证，不要求 problem_state 减少。

## 可审计性
所有 Task / Receipt 必须 append-only 写入 facts，并可被第三方复现。