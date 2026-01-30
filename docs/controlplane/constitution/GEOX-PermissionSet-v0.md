GEOX · PermissionSet v0（合法行动空间 · 只读存在化）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Object + Negative Spec（描述型对象）

0. 一句话定义（Normative Statement）

PermissionSet v0 是一种合法行动空间的只读描述对象：
它只声明在给定 subjectRef + window + scale 下，哪些行动算子类别（AO）仍属于“可被考虑的空间”，
但不表达任何裁决、优先级、推荐、充分性或前置条件。

PermissionSet v0 不是许可裁决，不是任务模板，不触发执行，不驱动调度，不驱动 UI 行为。

1. 目的与非目标（Purpose / Non-goals）
1.1 目的（只允许以下三点）

a) 将“行动空间”作为事实对象存在化，纳入审计链中间层。
b) 在 Control Constitution / Kernel 引入前，完成“解释 → 行动前”的语义净化。
c) 支持回放与审计：为什么当时行动空间被描述为这样（仅通过证据引用）。

1.2 非目标（必须拒绝）

a) 不判断是否可以行动。
b) 不建议应该采取何种行动。
c) 不提供 gating / readiness / eligibility 信号。
d) 不提供 list / query / index 等便利 API。
e) 不作为 AO-ACT task 的输入、模板或派生依据。

2. 宪法地位与单向依赖（One-way Dependency）
2.1 允许的依赖方向（冻结）
Evidence / State
        ↓
   ProblemStateV1
        ↓
(Agronomy Interpretation / Decision Plan / Uncertainty*)
        ↓
   PermissionSet v0   （只读存在化）
        ↓
（未来）Control Constitution / Control Kernel / Permission → Task


Uncertainty 指已冻结的三件套：Aggregation 禁令 / Taxonomy / Envelope。

2.2 明确禁止（冻结）

PermissionSet v0 不得被任何模块读取并据此改变系统行为
（Judge / Agronomy / Decision / AO-ACT / UI / Scheduler 一律禁止）。

PermissionSet v0 不得反证、修正或绕过 ProblemState 与 Uncertainty。

PermissionSet v0 不得作为任何管线的通过 / 失败条件。

3. 对象 Contract（最小字段集）

设计原则：
只保留身份锚定 + 时间窗 + 行动空间声明 + 证据指向。
不引入任何可能被误读为裁决或充分性的结构。

3.1 顶层字段（必填）

type：permission_set_v0（const）

schema_version：MAJOR.MINOR.PATCH

permission_set_id：全局唯一（minLength ≥ 8）

created_at_ts：毫秒时间戳（integer ≥ 1）

subjectRef：身份锚定

仅允许：projectId / groupId / plotId / blockId

禁止任何语义字段

scale：string

仅声明尺度，不允许外推

window：

startTs / endTs

硬规则：endTs > startTs

candidate_actions[]：

action_code 字符串列表（去重，无顺序语义）

action_code 的合法性 不在本文件定义，见 AO Authority Rule

3.2 AO taxonomy 引用锚点（可选但推荐）

action_taxonomy_ref：string

指向本 PermissionSet 编制时所依赖的 AO taxonomy 版本锚点

示例（非规范）：

contracts:ao_action_taxonomy_v1

tag:apple_iii_ao_act_v0

用途：审计与回放一致性，而非校验或 gating。

3.3 证据引用（可选）

supporting_evidence_refs[]

仅允许引用以下 EvidenceRef kind：

ledger_slice

state_vector

reference_view

qc_summary

文案必须保持中性，仅用于说明“为何这样描述行动空间”。

3.4 说明字段（极限克制）

notes：string | null（≤ 280 chars）

仅允许中性描述

禁止出现：should / recommend / allow / deny / priority / ready / safe 等词

4. AO Authority Rule（冻结级 · 关键）
4.1 AO taxonomy 的规范真源（Normative Source）

AO taxonomy 的所有权属于：
AO-ACT / AO-SENSE 的 contract 层
（或未来统一的 AO Registry 宪法文件）

PermissionSet v0 不定义、不枚举、不扩展 AO code

4.2 冲突裁定规则（冻结）

若 PermissionSet 中出现的 action_code 与 AO contracts 冲突：

以 AO contracts 为准

PermissionSet 仅允许通过：

bump schema_version

更新 action_taxonomy_ref
来对齐，不得私自修订 AO 语义

4.3 新 AO 的引入纪律

任何新 AO（如 AO-MEASURE / AO-MOVE / AO-MAP）：

必须先进入 AO contracts 的 Normative Source

再被 PermissionSet 引用

禁止 PermissionSet 成为“私有 AO”的诞生地

4.4 示例（非规范）

以下仅为当前系统已存在 AO 的示例集合，不具备规范权威：

AO-ENTER

AO-APPLY

AO-REMOVE

AO-STRUCT

AO-EXTRACT

AO-SENSE

5. Negative Spec（硬禁令）
5.1 禁止裁决语义

PermissionSet v0 不得出现或表达：

HardNo / Warn / OK / Priority

allow / deny / permit / block

safe / unsafe / ready / eligible

should / recommend / best / preferred

5.2 禁止 gating / readiness

禁止字段或结构：gate / readiness / eligibility / precondition

禁止“满足条件后才进入下一步”的表述

禁止将 PermissionSet 用作流程前置条件

5.3 禁止排序、评分与聚合

禁止对 action_code 排序

禁止 score / weight / rank

禁止“总体可行动性 / 总体许可度”

（精神上受制于
GEOX-UncertaintyAggregation-Prohibition.md）

5.4 禁止任务化（防滑条款）

PermissionSet v0 不得包含：

任何执行参数

任何 AO-ACT task 的字段镜像

任何可直接生成 task 的结构

5.5 禁止便利 API / 索引暴露

禁止 list / query / index API

禁止“获取当前 PermissionSet”的便捷接口

禁止 UI / Scheduler 依赖 PermissionSet 形成隐式工作流

6. 与不确定性宪法的绑定关系

PermissionSet v0 必须服从并不削弱：

GEOX-UncertaintyAggregation-Prohibition.md

GEOX-UncertaintySource-Taxonomy-v0.md

GEOX-UncertaintyEnvelope-v0.md

明确禁止：

利用 Uncertainty 对象生成行动 gating

将不确定性“解释”为可行动前置条件

7. 冻结声明（Freeze Verdict）

PermissionSet v0 仅允许“合法行动空间的只读存在化”。

AO taxonomy 的所有权不在本文件。

任何引入裁决、排序、任务化、便利 API 的修改，均视为破坏冻结。

后续 Control Constitution / Kernel 只能在其之上裁决，不得回填或污染本对象。

8. 一句话版本（给工程 / 评审）

PermissionSet v0 只是把“行动空间”作为事实放进审计链；
它不裁决、不排序、不前置、不模板化，
也不拥有 AO 的定义权。