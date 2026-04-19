# acceptance_result_v1.verdict 正式语义冻结

本文档冻结 `acceptance_result_v1.verdict` 的正式业务语义，作为 acceptance 层对外口径。

## 冻结枚举与语义

- `PASS`：系统已形成正式验收通过结论。
- `FAIL`：系统已形成正式验收失败结论。
- `PARTIAL`：系统已完成正式验收计算，但结果不构成通过，且不能等同于 `PASS`。

## 边界约束（必须遵守）

- `verdict` 属于 **acceptance 层**，不等于 operation `final_status`。
- `verdict` 语义不得由前端进行二次改写；前端只能展示 acceptance 层已冻结语义。
- `acceptance_result_v1.verdict` 的正式语义仅以上述三值定义为准。
