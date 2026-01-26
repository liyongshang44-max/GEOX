# GEOX-AII · ProblemState Lifecycle v1

Status: FROZEN (Sprint 9)

Applies to: Apple II (Judge)

Ownership: System Governance (Not owned by Judge)

---

## 1. 定位声明（冻结）

本规范的唯一目标是：防止 ProblemState 被滥用、重复消费或隐式裁决。

本规范不提升系统能力，不引入智能，不改变任何既有语义，仅对已存在的 ProblemStateV1 建立可静态描述、可验收、可冻结的生命周期规则。

---

## 2. 关键参数与输入约定（冻结）

### 2.1 asOfTs（强制）

- asOfTs：生命周期判定的唯一“现在”。
- 所有生命周期判断仅允许使用 asOfTs。
- 禁止使用系统当前时间 / wall-clock time。

Acceptance 要求：所有离线 / 回放 / CI 验收必须显式注入 asOfTs，且验收用例必须固化 asOfTs。

### 2.2 常量（冻结）

- MERGE_OVERLAP_RATIO = 0.6
- EXPIRY_BUFFER_MS = 0
- REUSE_GRACE_MS = 0

---

## 3. 不可变锚点（冻结）

以下字段在 ProblemStateV1 实例内完全不可变（read-only, immutable）：

- problem_state_id
- schema_version
- created_at_ts
- subjectRef
- scale
- window.startTs
- window.endTs
- problem_type
- uncertainty_sources
- supporting_evidence_refs

任何“变化”必须通过生成新 ProblemStateV1 实例表达；禁止修改既有实例。

---

## 4. 生命周期状态（治理层元状态，冻结）

生命周期状态不进入 ProblemStateV1 本体，仅存在于治理索引 problem_state_index_v1。

枚举：

- ACTIVE：当前可被引用的问题态
- SUPERSEDED：已被更新的 ProblemState 取代
- EXPIRED：在给定 asOfTs 下，超出窗口有效期
- FROZEN：治理动作封存，永久只读

---

## 5. input_digest（最小变化锚点，冻结）

为消除“证据变化”歧义，本规范要求每个 ProblemState 在生命周期计算时必须具备 input_digest，用于“同/不同”判定。

约束：

- input_digest 必须可比较（相等 / 不等）。
- input_digest 的判定不得依赖理解证据内容。
- input_digest 可由治理索引在计算时派生得到；不得回写 ProblemStateV1。

---

## 6. 窗口关系（冻结）

对两个窗口 A=[a0,a1], B=[b0,b1]：

- duration(A) = max(1, a1-a0)
- overlap_duration = max(0, min(a1,b1) - max(a0,b0))
- overlap_ratio = overlap_duration / min(duration(A), duration(B))

窗口关系优先级（从高到低）：

1) Containment（包含）
2) Overlap（重叠）
3) Disjoint（无重叠）

Containment 定义：A 完全包含 B 当且仅当 a0 <= b0 且 a1 >= b1。

---

## 7. Creation（生成判定，冻结）

给定一个候选新 ProblemState N，以及同组（subjectRef + scale + problem_type）下现存的 ACTIVE 集合 S：

### 7.1 允许生成的必要条件（ALL）

1) input_digest 变化：N.input_digest != 任意 s∈S 的 input_digest。

2) window 合法：N.window.endTs > N.window.startTs。

3) 独立性：

- problem_type 不同，或
- uncertainty_sources 集合不相等（set inequality）。

### 7.2 禁止生成（拒绝）

若满足以下任意组合（等价于重复声明），必须拒绝：

- input_digest 相等
- window 相等
- problem_type 相等
- uncertainty_sources 集合相等

### 7.3 包含关系的前置门

若 N.window 完全包含任一现存 ACTIVE 的 window，则禁止“直接创建”作为重复扩张；必须进入 Merge 机制（见 §8）。

---

## 8. Merge（合并判定，冻结）

对两个 ProblemState A、B（同组：subjectRef + scale + problem_type）：

### 8.1 触发合并条件

情形 A（Containment，强制）：A.window 包含 B.window 或反之。

情形 B（Overlap，允许）：overlap_ratio >= MERGE_OVERLAP_RATIO。

### 8.2 合并结果

- 生成新的 ProblemState C（新实例）。
- A、B 生命周期状态标记为 SUPERSEDED。
- C.supporting_evidence_refs = union(A.refs, B.refs)（去重）。

严格禁止：

- 修改 A / B
- 向 A / B 追加 supporting_evidence_refs

---

## 9. Reuse（复用判定，冻结）

ProblemState P 可被复用，当且仅当：

- lifecycle_state(P) = ACTIVE
- asOfTs ∈ [P.window.startTs, P.window.endTs + REUSE_GRACE_MS]
- 不存在 superseding 的新实例（见 problem_state_index_v1 的 superseded_by）

复用严格语义：

- 仅用于引用 / 展示 / 审计 / 关联说明。
- 明确禁止：作为任何执行触发条件（尤其 Apple III）。

---

## 10. Expire / Freeze（过期与冻结，冻结）

### 10.1 自动过期（Expire）

当且仅当：asOfTs > window.endTs + EXPIRY_BUFFER_MS。

### 10.2 冻结（Freeze）

- Freeze 为治理动作（非业务逻辑）。
- Freeze 后永久只读，不参与 Creation / Merge / Reuse / Expire 计算。

v1 明确不引入：事实撤销、证据撤销、审计撤销等系统外语义。

---

## 11. lifecycle 存放位置（冻结）

生命周期状态必须存放于治理索引 problem_state_index_v1（或等价视图/表）。

约束：

- problem_state_index_v1 ≠ Ledger。
- 由 Judge 计算生成或重算生成快照。
- 严禁回写 ProblemStateV1。

---

## 12. Acceptance 可判定性（冻结）

所有规则必须可通过以下输入得到唯一确定结果：

- ProblemStateV1 集合
- 常量
- asOfTs

规则不得依赖：

- 系统当前时间
- 证据内容理解
- 人工解释

