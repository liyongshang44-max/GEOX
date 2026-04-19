# IRRIGATION EVIDENCE / ACCEPTANCE MINIMUM CHAIN (v1)

## 四层语义冻结

1. **receipt 层**（`/api/v1/actions/receipt`）
   - 执行回执技术合同，描述“执行了什么”。
   - `receipt != evidence`。

2. **evidence 层**（`evidence_artifact_v1` / `evidence_bundle_v1`）
   - 汇聚作业证据与证据视图。
   - `evidence != acceptance`。

3. **acceptance 层**（`acceptance_result_v1`）
   - 正式验收输出，包含 verdict/metrics/rule_id/explanation_codes/evidence_refs/skill 信息。
   - `acceptance != final_status`。

4. **final_status 层**（operation detail / operation state）
   - 面向作业状态与闭环推进的最终判定。

## INVALID_EXECUTION 与证据不足

- 当 receipt 显示已执行（executed），但 formal evidence 不成立时，detail 最终态应为 `INVALID_EXECUTION`。
- 这表示“执行链路在证据上无效”，不是 acceptance 的替代结论。

## 灌溉 formal evidence 冻结边界

- `sim_trace` 仅为 simulator 调试痕迹，**不能**直接视为正式 evidence。
- formal log 必须通过 formal log kind 规则（沿用 evidence_policy 方向）。
- media / metrics 作为辅助证据维度参与 evidence 评估，但不改变 receipt/acceptance/final_status 的分层语义。

## 四种典型状态

1. 有 task 无 receipt
   - 客户态：`PENDING_RECEIPT`
2. 有 receipt 无 formal evidence
   - detail 最终态：`INVALID_EXECUTION`
3. 有 acceptance_result_v1
   - 已形成正式验收结果
4. 无 acceptance_result_v1 但已到 receipt/evidence
   - 不等于 completed，仍由 operation_state 最终判定
