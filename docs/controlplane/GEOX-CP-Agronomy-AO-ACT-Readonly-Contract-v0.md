# GEOX · Sprint 13
# Agronomy v0 ← AO-ACT Receipt（只读输入证据）Contract v0（冻结候选）

适用：Agronomy（Apple IV / Read-only 解释层）
依赖：
- docs/controlplane/GEOX-CP-AO-ACT-Execution-Contract-v0.md（AO-ACT v0：Task/Receipt 的执行运输层）
- docs/controlplane/GEOX-CP-AO-ACT-Contracts-v0.md（AO-ACT v0：字段/forbid/enum 可判定规则）
- docs/controlplane/GEOX-CP-AO-ACT-ReadModel-Governance-Sprint12.md（Judge 侧 ReadModel：解释镜子，不得驱动语义）

本文件仅定义：Agronomy 如何“只读消费” AO-ACT Receipt 作为证据输入，以及 Agronomy 如何把任何结论写成新 facts（禁止回写 AO-ACT）。

---

## 0. 全局红线（冻结）

0.1 只读边界
- Agronomy 只能读取 AO-ACT 的 facts（type=ao_act_receipt_v0 / ao_act_task_v0）作为证据输入。
- Agronomy 不得写入 / 更新 / 删除任何 AO-ACT 相关事实（不得生成 ao_act_* type）。

0.2 结论写入形态
- Agronomy 的任何“解释/结论/摘要”必须写入为新的 facts（append-only）。
- 新 facts 的 type 必须属于 Agronomy 命名空间（不得冒用 AO-ACT）。

0.3 不得反向驱动
- Agronomy 的输出不得改变 Judge 的 determinism_hash / effective_config_hash / problem_states / ao_sense。
- Agronomy 不得向 Judge 写回任何 state / lifecycle / hint。

0.4 不得借道“解释字段”泄露到稳定 API
- Judge 的稳定输出（/api/judge/run）不得出现 ao_act / ao_act_readmodel / agronomy_ao_act_* 等字段。
- 若未来需要 UI 展示执行上下文，只能走独立 explain/debug 通道，并且明确不参与 determinism/hash。

---

## 1. Sprint 13 新增写入：Agronomy Interpretation Fact（v0）

### 1.1 语义定位（冻结）

Agronomy Interpretation Fact 是“对某一条 AO-ACT Receipt 的只读解释镜像”。
它的用途是：把执行回执的关键字段以 Agronomy 的只读视角记录下来，便于后续报表/审计/对比。

它不是：
- 不是对 AO-ACT 的“修正/补写/改写”
- 不是决策/推荐/处方
- 不是 Judge 的输入（不得进入 determinism 输入集合）

### 1.2 写入接口（冻结）

POST /api/agronomy/v0/ao_act/interpretation

Request body（冻结最小形态）：
- receipt_fact_id: string（必填；指向 facts.fact_id）
- meta?: object（可选；审计备注；不得引入决策/农技语义）

Response（冻结最小形态）：
- ok: true/false
- fact_id: string（新写入 facts 的 fact_id）
- interpretation_id: string（确定性 id）

### 1.3 读取接口（冻结）

GET /api/agronomy/v0/ao_act/interpretation?interpretation_id=...

只读查询，返回最近 N 条匹配的 interpretation facts（稳定排序）。

### 1.4 Ledger 写入事实形态（冻结）

写入 facts.record_json：

type = "agronomy_ao_act_receipt_interpretation_v0"

schema_version = "0"

payload（冻结最小字段集；仅复制/引用）：
- interpretation_id: string（确定性；见 1.5）
- receipt_fact_id: string（指针）
- act_task_id: string|null（从 receipt.payload.act_task_id 镜像）
- status: string|null（从 receipt.payload.status 镜像）
- execution_time: object|null（从 receipt.payload.execution_time 镜像）
- execution_coverage: object|null（从 receipt.payload.execution_coverage 镜像）
- constraint_check: object|null（从 receipt.payload.constraint_check 镜像）
- observed_parameters: object|null（从 receipt.payload.observed_parameters 镜像）
- created_at_ts: number(ms)（本次解释写入时间；facts.occurred_at 为权威）
- meta: object|null（来自请求；仅审计用途）

严格约束：
- 仅允许“镜像/复制 AO-ACT receipt 的字段”；不得向 payload 注入 agronomy 结论字段（如 recommendation / prescription 等）。
- 禁止写入任何 ao_act_* 类型事实。

### 1.5 interpretation_id 的确定性纪律（冻结）

interpretation_id 必须完全由：
- receipt_fact_id
- receipt 的 record_json（或其稳定子集）
经 stable stringify + sha256 得到。

目的：
- 同一 receipt 被重复解释时，interpretation_id 恒定（允许重复写入事实，但可稳定去重/对比）。

---

## 2. 不得影响 Judge（Sprint 13 关键红线）

- 任意新增 Agronomy facts 写入后，再次调用 /api/judge/run：
  - determinism_hash 不得变化（在同输入窗口条件下）
  - problem_states / ao_sense 的稳定投影不得变化
- /api/judge/run 的响应不得包含 “ao_act” / “agronomy_ao_act” 等字段（防止隐性依赖）

---

## 3. Sprint 13 Acceptance（冻结 gate）

必须通过 negative acceptance（脚本级工程事实）：
- Agronomy 写入前后，Judge 稳定投影一致
- Agronomy 写入前后，AO-ACT index 一致（只读证据，不得污染）
- Agronomy 写入必须产生新事实（facts.append-only），且 facts.source 不为空
