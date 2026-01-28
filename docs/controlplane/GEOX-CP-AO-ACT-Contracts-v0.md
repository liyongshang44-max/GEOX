# GEOX · Sprint 10
# AO-ACT v0 — Contracts / Schemas（Step 4 · 冻结候选 v2）

适用：Control Plane  
约束来源：docs/controlplane/GEOX-CP-AO-ACT-Execution-Contract-v0.md（Step 3 冻结文档）  
本 Step 4 仅定义：Task/Receipt 的 contract + schema（可静态验收）

---

## 0. 全局规则（冻结）

### 0.1 forbid list 的匹配方式（必须收敛）

forbid list 检查采用对 payload 的递归深度遍历：

- 对任意层级 object 的 key 做 exact match（大小写敏感）
- array 元素若为 object 也必须递归检查
- 命中任一 forbid key ⇒ reject

### 0.2 string(enum) 的可判定规则（必须收敛）

对 parameters / constraints / observed_parameters：

允许 string 值仅当该 key 在 parameter_schema.keys[] 中定义：
- type = "enum"
- 且 string 值 ∈ enum[]

其他任何 string（包括自由文本）⇒ reject

---

## A. AO-ACT Task v0（Schema Draft）

### A.1 语义定位（冻结）

AO-ACT task 是“由人类显式创建的、物理可验证的执行指令声明”。  
不包含任何决策权/农技语义/策略语义/ProblemState 引用。

### A.2 字段（冻结）

type (required, const) = "ao_act_task_v0"

act_task_id (required, read-only, immutable) : string

issuer (required, immutable) : object
- kind (required) = "human"
- id (required) : string
- namespace (required) : string

冻结判定：issuer 合法性仅按 kind/namespace；禁止引入可信度/权限分数/动态信任。

action_type (required, immutable) : string  
必须 ∈ allowlist(v0)：PLOW / HARROW / SEED / SPRAY / IRRIGATE / TRANSPORT / HARVEST

target (required, immutable) : object
- kind (required) enum: "field" | "area" | "path"
- ref (required) : string

指针式引用硬约束（冻结）：
- target.ref 不得包含自然语言描述（例如中文句子、空格分隔描述）
- 只能是 ID / hash / URI-like token（工程上由实现层保证）

time_window (required, immutable) : object
- start_ts : number(ms)
- end_ts : number(ms)
规则：start_ts <= end_ts

parameter_schema (required, immutable) ：object
- keys: array(minItems=1) of
  - name : string
  - type : enum("number"|"boolean"|"enum")
  - min : number (only for number, optional)
  - max : number (only for number, optional)
  - enum : string[] (only for enum, required when type=enum)

规则：
- parameters 的每个 key 必须在 schema.keys 中出现一次（1:1 覆盖）
- number bounds 校验：min/max
- enum in-list 校验

parameters (required, immutable) : object
- 值类型：number | boolean | string(enum)（受 0.2 约束）
- 禁止 object/array

constraints (required, immutable) : object（允许 {} 但字段必须存在）
- 值类型：number | boolean | string(enum)（受 0.2 约束）
- 禁止 object/array

created_at_ts (required, read-only, immutable) : number(ms)

meta (optional, immutable) : object（审计元数据，不得含决策/农技）

### A.3 forbid list（必须拒绝，递归遍历 keys）

Task 顶层与任意嵌套中不得出现（exact match, case-sensitive）：

problem_state_id, lifecycle_state,  
recommendation, suggestion, proposal,  
agronomy, prescription, severity, priority,  
expected_outcome, effectiveness, quality, desirability,  
next_action, follow_up, autotrigger, auto,  
profile, preset, mode,  
success_criteria

### A.4 validation rules（可静态验收）

- type const
- issuer.kind == "human"
- start_ts <= end_ts
- parameters/constraints 不得含 object/array
- parameter_schema 必须存在，且 parameters keys 必须 1:1 覆盖 schema.keys
- number bounds 校验；enum in-list 校验（并据 0.2 拒绝自由 string）
- action_type ∈ allowlist(v0)

---

## B. AO-ACT Receipt v0（Schema Draft）

### B.1 语义定位（冻结）

Receipt 是“执行实际发生了什么”的事实声明。  
仅表达执行完成度相对 task 约束，不表达效果/价值/农技正确性。

### B.2 字段（冻结）

type (required, const) = "ao_act_receipt_v0"

act_task_id (required, immutable) : string

executor_id (required, immutable) : object
- kind enum "human"|"script"|"device"
- id : string
- namespace : string

execution_time (required, immutable) : object
- start_ts : number
- end_ts : number
规则：start_ts <= end_ts

execution_coverage (required, immutable) : object
- kind "area"|"path"|"field"
- ref : string
指针式引用：同 Task 的“非自然语言”约束（可复用相同校验）

resource_usage (required, immutable) : object
必须包含且至少包含以下 4 个 key（值可 null）：
- fuel_l (nullable number)
- electric_kwh (nullable number)
- water_l (nullable number)
- chemical_ml (nullable number)

logs_refs (required, immutable) : array(minItems=1) of object
- kind : string
- ref : string

status (optional, immutable)
若存在，仅允许 enum： "executed" | "not_executed"
冻结解释：仅表示执行是否发生；不得编码质量/效果/合理性。

constraint_check (required, immutable) : object
- violated : boolean
- violations : string[] (required)
一致性：violated=false ⇒ violations 必须为空数组

observed_parameters (required, immutable) : object
- 值类型：number | boolean | string(enum)（受 0.2 约束）
- 禁止 object/array

created_at_ts (required, read-only, immutable) : number(ms)

meta (optional, immutable) : object

### B.3 forbid list（必须拒绝，递归遍历 keys）

Receipt 顶层与任意嵌套中不得出现（exact match, case-sensitive）：

agronomy, prescription,  
severity, priority,  
effectiveness, quality, desirability,  
recommendation, next_action, follow_up,  
problem_state_id, lifecycle_state,  
success_score, yield, profit,  
mode, profile, preset

### B.4 validation rules（可静态验收）

- type const
- execution_time start<=end
- status 若存在必须 ∈ {"executed","not_executed"}
- resource_usage 必须存在且包含 4 keys（值可 null）
- logs_refs minItems=1
- observed_parameters 不得含 object/array，string(enum) 受 0.2 限制
- constraint_check 一致性规则

---

## C. Ledger 写入形态（facts record_json 冻结草案）

在 Ledger 中以 record_json 存储，至少包含：
- type: "ao_act_task_v0" 或 "ao_act_receipt_v0"
- payload: 对应 schema 对象

并满足：append-only；不允许更新/删除；不允许旁路写入。

---

## D. Step 4 Acceptance 锚点（用于 Step 5 的验收，不在本步实现）

必须可静态断言：
- action_type ∈ allowlist(v0)
- issuer.kind 必须 human（仅 type/namespace 判定，无评分/权限）
- forbid list：递归遍历 keys，exact match
- parameters/constraints/observed_parameters：禁止 object/array；string(enum) 必须由 parameter_schema 判定
- receipt completeness：resource_usage 4 keys 必须存在；logs_refs>=1
- determinism：同输入 facts ⇒ 同校验输出（纯函数）
