# GEOX · Sprint 12
# AO-ACT ReadModel Governance Patch（冻结）

适用层级：Judge（Apple II）  
裁定级别：冻结级（不可回滚）  
依赖前置：
- Sprint 10 · AO-ACT v0 Contracts（Step 4）
- Sprint 11 · Contract / Negative Spec / Determinism Discipline

---

## 0. 裁定背景（一句话）

Sprint 12 的唯一目标不是“让 Judge 使用 AO-ACT”，  
而是**防止 AO-ACT 被误用为 Judge 的决策杠杆**。

---

## 1. AO-ACT ReadModel 的存在意义（冻结）

AO-ACT ReadModel 在 Judge 中的唯一合法存在价值是：

> **解释上下文（explain mirror）**

它用于回答问题：
- “这个 task / receipt 发生过吗？”
- “这个执行事实是否存在？”
- “它与当前 problem_state 的时间 / 空间是否有重叠？”

**它不回答**：
- 是否正确
- 是否有效
- 是否应该影响状态
- 是否意味着下一步行动

---

## 2. 明确允许（Allowlist）

在 Judge 内部，AO-ACT ReadModel **仅允许**：

- 被 explain / debug 逻辑读取
- 用于日志、审计、人工排查
- 用于 acceptance / regression / snapshot 对比
- 作为“人类理解用镜子”，而非系统判断依据

---

## 3. 明确禁止（Hard Redlines）

以下行为在 Sprint 12 起 **永久禁止**：

### 3.1 禁止驱动状态

AO-ACT ReadModel **不得**：
- 触发 problem_state 变化
- 影响 lifecycle_state
- 作为 state transition 的 if / guard 条件
- 改写 UNKNOWN / DEGRADED / RESOLVED 等状态

### 3.2 禁止参与确定性输入

AO-ACT ReadModel **不得进入**：
- determinism_hash
- state_inputs_used
- cache key / memoization key
- 任意“看似只是方便”的稳定性判断逻辑

### 3.3 禁止进入稳定 API 语义

AO-ACT ReadModel **不得**：
- 出现在 `/api/judge/run` 的稳定字段中
- 被前端当作“语义字段”展示
- 被调用方当作“状态信号”使用

如需展示，仅允许：
- explain/debug 明确标识字段
- 或完全内部使用（推荐）

---

## 4. 查询稳定性裁定（冻结）

即便用于 explain / debug，AO-ACT ReadModel 查询也必须满足：

- 所有 list 输出必须有稳定排序
  - 排序键：`occurred_at ASC, fact_id ASC`
- 若存在“latest receipt”语义：
  - 必须显式声明 tie-breaker
- 不允许依赖数据库隐式顺序
- 不允许“当前看起来没问题”的随机顺序

---

## 5. Sprint 12 Negative Acceptance 约束（冻结）

以下断言必须成立，否则 Sprint 12 视为失败：

1. 在 AO-ACT facts 写入前后：
   - Judge 的 determinism_hash 不变
   - Judge 的稳定语义投影完全一致

2. AO-ACT facts 的存在：
   - 不改变 problem_states 的语义内容
   - 不改变 ao_sense 的语义内容
   - 不改变 effective_config_hash

3. Judge 的稳定语义投影中：
   - 不包含任何 AO-ACT 字段或 key
   - 不包含 task / receipt 的引用痕迹

---

## 6. 设计哲学冻结说明（非实现）

AO-ACT 是“**执行事实**”，不是“**判断依据**”。

Judge 的职责是：
- 判断“我是否知道足够多”
- 判断“我是否需要更多观测”

而不是：
- 判断“某次执行是否成功”
- 判断“某次操作是否值得信任”

这一边界在 Sprint 12 被正式、不可逆地冻结。

---

## 7. 后续影响声明（冻结）

从 Sprint 12 起：

- 任何试图让 AO-ACT：
  - 直接影响 Judge 状态
  - 或间接影响 determinism
  - 或通过 explain 渗透为语义字段  
  都被视为 **越权设计**

- 若未来需要“执行效果评估”：
  - 必须通过新的层级（例如 Agronomy / Analysis）
  - 不得回写或污染 Judge

---

## 8. 结论（冻结）

AO-ACT ReadModel 在 Judge 中是：

> **可被看见，但不可被依赖**  
> **可被解释，但不可被引用**  
> **可被记录，但不可被判断**

Sprint 12 至此完成。
