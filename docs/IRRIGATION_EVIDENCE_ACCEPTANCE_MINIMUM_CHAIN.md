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

## 灌溉 formal evidence 冻结口径

### A. formal evidence 最小集合（明确）

- **formal log evidence**：日志 `kind` 必须通过 `isFormalLogKind(...)` 才算正式日志证据。
- **formal artifact evidence**：artifact 的 `kind` 只要不是 debug-only（如 `sim_trace`）且 `inferEvidenceLevel(kind)` 不为 `DEBUG`，即可作为 formal artifact candidate。

### B. supporting evidence 集合（明确）

- `media`
- `metrics`

当前仓库中它们只算 supporting evidence，**不能单独决定 operation 为有效执行**。

### C. 非 formal evidence 集合（明确）

- `sim_trace`（debug-only）

`sim_trace` 明确不算 formal evidence，不能直接用于通过有效执行判定。

## INVALID_EXECUTION 与证据不足

- 当 receipt 存在且显示已执行（executed），但 formal evidence 不足时，当前仓库 detail 语义为 `INVALID_EXECUTION`。
- 这表示“执行链路在证据上无效”，不是 acceptance 的替代结论。

## 四种典型状态

1. 有 task 无 receipt
   - 客户态：`PENDING_RECEIPT`
2. 有 receipt 无 formal evidence
   - detail 最终态：`INVALID_EXECUTION`
3. 有 acceptance_result_v1
   - 已形成正式验收结果
4. 无 acceptance_result_v1 但已到 receipt/evidence
   - 不等于 completed，仍由 operation_state 最终判定
