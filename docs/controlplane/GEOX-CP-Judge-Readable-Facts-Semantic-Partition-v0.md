Judge 可读外部事实 · 语义分区表（Governance Freeze v0）
0. 使用说明（冻结）

本表是 治理级真相，高于实现与个人理解

若实现行为与本表冲突，视为 contract violation

表中“禁止”的含义是：
即使技术上可行，也不得发生

1. 事实类型分区总览
| 事实来源              | Fact Type           | Judge 是否可读 | 在 Judge 中的语义身份                 | 允许影响           |
| ----------------- | ------------------- | ---------- | ------------------------------ | -------------- |
| Monitor / Apple I | raw_sample_v1       | ✅          | Observation Evidence           | 证据充足性、覆盖性、不确定性 |
| Monitor / Apple I | marker_v1           | ✅          | Quality / Anomaly Evidence     | 证据可信度、冲突标记     |
| Apple II          | problem_state_v1    | ✅（自身）      | State Snapshot                 | 状态表达本体         |
| Apple III         | ao_sense_task_v0    | ✅          | Observation Request Record     | 覆盖缺口解释         |
| Apple III         | ao_sense_receipt_v0 | ✅          | Observation Execution Evidence | 覆盖完成/失败证据      |
| Apple III         | ao_act_task_v0      | ✅          | **Execution Evidence**         | 执行发生的事实        |
| Apple III         | ao_act_receipt_v0   | ✅          | **Execution Evidence**         | 执行结果的事实        |
| Apple IV          | agronomy_report_v0  | ❌          | N/A                            | Judge 不得读取     |
2. AO-ACT 专属冻结区（重点）
AO-ACT 在 Judge 中 只能：

作为「发生过某次执行」的事实存在

用于解释：

为什么某些状态暂未变化

为什么某些异常被延迟处理

为什么现场条件被改变（但不评价好坏）

AO-ACT 在 Judge 中 明确禁止：
| 行为                                       | 状态   |
| ---------------------------------------- | ---- |
| 触发 problem_state 进入 resolved / mitigated | ❌ 禁止 |
| 用 receipt.status 判定“问题是否解决”              | ❌ 禁止 |
| 将执行成功/失败转译为 agronomy 结论                  | ❌ 禁止 |
| 作为 recommendation / next_action 的依据      | ❌ 禁止 |
| 改写、覆盖、终止已有 problem_state                 | ❌ 禁止 |
一句话冻结：

AO-ACT 描述“做了什么”，不描述“做得对不对”。

3. AO-SENSE vs AO-ACT 的根本差异（防混淆）
| 维度         | AO-SENSE  | AO-ACT    |
| ---------- | --------- | --------- |
| 目的         | 请求观测      | 请求执行      |
| Judge 角色   | 证据补全机制    | 外部世界扰动记录  |
| Receipt 意义 | 覆盖是否完成    | 执行是否发生    |
| 是否可能影响不确定性 | ✅         | ❌（只能解释背景） |
| 是否可能影响结论   | 间接（通过新证据） | ❌         |

冻结结论：

AO-SENSE 改变“我们知道什么”，
AO-ACT 只改变“世界发生了什么”。

4. Identity 与 Hash 冻结
| 标识             | Judge 中的地位            |
| -------------- | --------------------- |
| fact_id        | 审计与排序                 |
| occurred_at    | 时序                    |
| act_task_id    | ❌ 不得成为 Judge identity |
| executor_id    | ❌ 不得参与 state identity |
| receipt.status | ❌ 不得参与 determinism    |
5. Determinism 输入资格表
| 字段                          | 是否允许进入 determinism |
| --------------------------- | ------------------ |
| record_json（原始）             | ✅                  |
| payload.parameters          | ❌                  |
| payload.observed_parameters | ❌                  |
| payload.status              | ❌                  |
| payload.meta                | ❌（除非未来治理另行声明）      |
6. 对 Agronomy 的硬隔离声明

Judge 不得：

为 Agronomy 解读 AO-ACT

将 AO-ACT 转译为“效果”“效率”“收益”

Agronomy 只能：

通过引用（pointer）看到 AO-ACT 事实

不得反向影响 Judge 或 Control

在 GEOX 体系中，
AO-ACT 是“执行发生的记录”，不是“执行意义的解释”。

Judge 读取 AO-ACT，只是为了保持对现实世界变化的感知一致性，
而不是为了判断世界是否“变好了”。