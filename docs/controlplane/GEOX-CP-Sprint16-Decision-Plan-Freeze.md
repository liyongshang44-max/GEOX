GEOX Control Plane
Decision / Plan Contract v0

（Sprint 16 · 冻结版）

文档元信息

Document: GEOX-CP-Decision-Plan-Contract-v0.md

Sprint: 16

Status: Frozen (v0)

Scope: Governance / Control Plane

Applies to: Facts Ledger, Audit, Offline Review

Non-Applies to: Judge, AO-ACT, Scheduler, UI execution logic

0. 一句话定义（不可替代）

Decision / Plan v0 是一种“被记录的行动设想”，
而不是系统意志、不是执行指令、不是判读输入。

它只存在于事实账本中，
在 Sprint 16 的所有系统路径中 不产生任何效果。

1. 引入目的（Purpose）

Decision / Plan v0 的引入仅服务于以下目的：

记录：

“在某个时间点，人类或系统曾经提出过某种行动设想”

审计：

可回溯“是谁、在何时、基于什么上下文提出了什么计划”

回放与对照：

用于未来对比“当时想做什么 vs 实际发生了什么”

它不是为了：

触发执行

影响 Judge

优化决策

指导调度

自动化任何行为

2. 在系统中的明确位置（Boundary）

Decision / Plan v0 只存在于 Facts Ledger 层：

Facts (append-only)
 ├─ raw_sample_v*
 ├─ marker_v*
 ├─ ao_act_task_v0
 ├─ ao_act_receipt_v0
 ├─ agronomy_interpretation_v1
 └─ decision_plan_v0   ← 本 Contract 定义对象


明确排除：

Judge 不读取 decision_plan_v0

Agronomy 不消费 decision_plan_v0

AO-ACT 不监听 decision_plan_v0

Scheduler / UI 不依赖 decision_plan_v0

3. 数据语义（Semantic Contract）
3.1 核心语义裁定

decision_plan_v0 表达的唯一语义是：

“一个计划被提出过”

它不表达、也不暗示：

该计划是正确的

该计划被批准

该计划将被执行

该计划优先级更高

该计划值得推荐

3.2 不存在的语义（Explicit Non-Semantics）

以下语义在 decision_plan_v0 中 被显式禁止：

执行状态（ready / approved / scheduled / executed）

优先级（priority / severity / urgency）

推荐性（recommendation）

触发条件（trigger / condition / auto）

结果预期（expected_outcome / success_criteria）

优化目标（yield / profit / efficiency）

4. Hash 与确定性裁定（关键冻结条款）
4.1 Hash 层级的绝对隔离

❌ decision_plan_v0 不得进入任何 hash 输入集合

包括但不限于：

determinism_hash

ssot_hash

effective_config_hash

任何派生、组合或二次计算的 hash

4.2 工程裁定说明（规范性）

decision_plan_v0 在 hash 层级的地位等同于 不存在

即使其内容发生变化：

Judge 的输出必须完全一致

AO-ACT index 必须完全一致

任何试图将其纳入 hash 的行为，视为破坏冻结。

5. 允许的数据结构（Schema 级约束）

本 Contract 只约束语义与边界，不强制字段名。
但字段必须满足以下类别划分。

5.1 允许字段类型

标识类

plan_id / fact_id

归属类

subjectRef（project / group / spatial unit）

叙述类

description / note / rationale

引用类

evidence_refs（只读引用，不消费）

元数据

created_at_ts

issuer（human / system）

5.2 禁止字段类型（硬禁止）

以下字段 不得出现于 schema / payload：

priority

recommendation

trigger

condition

auto_*

state

status

next_action

execute / execution / schedule

6. API 与可见性裁定（硬封口）
6.1 明确禁止的 API

Sprint 16 不允许新增：

GET /api/decision_plan/*

GET /api/plan/*

任何 decision_plan_v0 专用 list / query API

6.2 唯一允许的读取方式

通过 通用 facts 查询

SQL

内部审计工具

仅用于：

审计

回放

离线分析

不保证稳定、不保证可用性、不保证向后兼容。

7. 与其他模块的关系裁定
7.1 与 Judge

Judge 完全忽略 decision_plan_v0

Judge 的任何输出：

不得引用

不得暗示

不得泄漏 decision_plan_v0

7.2 与 AO-ACT

AO-ACT 不得：

监听

索引

响应

回写 decision_plan_v0

7.3 与 Agronomy

Agronomy 不得将 interpretation 转写为 decision_plan

decision_plan 不是 agronomy 的输出目标

8. Negative Acceptance 要求（治理强制）

任何 Sprint 16 的实现 必须通过以下 negative spec：

插入 decision_plan_v0 前后：

Judge determinism_hash 不变

effective_config_hash 不变

problem_states 不变

ao_sense 不变

AO-ACT index 前后完全一致

Judge / Control API 输出中：

不得出现 decision_plan

不得出现 plan_id / plan_payload

9. 冻结声明（Final）

Decision / Plan v0 是“被记录的想法”，不是系统行为。

在 Sprint 16 中：

它可以存在

可以被审计

可以被忽略

但不能被依赖。

任何试图赋予它“效果”的行为，
必须开启新的 Sprint，并显式打破本 Contract。

✅ 冻结完成判定

当且仅当：

本文档落盘

对应 negative acceptance 存在且全绿

repo 中无 decision_plan 专用 API

Sprint 16 的 Decision / Plan v0 Contract 才视为成立。