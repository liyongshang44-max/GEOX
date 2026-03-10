# GEOX · Sprint 10

## AO-ACT v0 — Remote Action Minimal Control Plane (Governance Draft)

> Status: **Draft (Pending Freeze)**
> Scope: Sprint 10 only
> Applies to: Control Plane (System-wide)
> Ownership: Governance-level (not owned by Apple II / Judge)

This specification defines an execution transport and audit contract only, and explicitly does not define decision authority.

---

## 1. Goal（目标）

Sprint 10 的唯一目标是：

> 在**不引入任何农技判断、不引入自动化决策、不消费 ProblemState** 的前提下，
> 建立一个**可审计、可回放、低风险**的远程行动闭环（AO-ACT v0）。

系统必须能够：

1. 接收一个**明确由人类发起**的行动任务（AO-ACT task）
2. 将该任务交由 executor（人 / 脚本 / 设备）执行
3. 接收并记录执行回执（AO-ACT receipt）
4. 将 task 与 receipt 作为 **append-only facts** 写入 Ledger
5. 在不触碰 Apple II / ProblemState 语义的情况下，支持事后回放与审计

一句话：**系统获得“遥控器”，但不获得“自动驾驶”。**

---

## 2. Hard Boundaries（冻结边界 / 禁止事项）

Sprint 10 明确禁止以下行为（默认不可做）：

* ❌ 不引入任何农技字段、农艺建议、处方、严重性、优先级
* ❌ 不允许 AO-ACT task 由 ProblemState 自动生成或触发
* AO-ACT task creation must require an explicit human issuer identity and an explicit create call; any implicit, derived, templated, or default generation path is forbidden.
* ❌ 不允许 Apple III / executor 直接或间接消费 ProblemState 作为执行条件
* ❌ 不允许任何事实被修改或删除（append-only 不变）
* ❌ 不修改 ProblemStateV1 schema
* ❌ 不修改 Sprint 9 ProblemState Lifecycle 规则
* ❌ UI 不得提供“一键执行”“自动下发”等改变语义的能力

若违反任一条，即视为 Sprint 10 失败。

---

## 3. AO-ACT v0 概念定义（语义级）

### 3.1 AO-ACT Task（行动任务）

AO-ACT task 是一个**人为下发的、物理可验证的行动指令声明**。

它的语义特征：

* 描述“**要做什么**”，而不是“**为什么要做**”
* 不包含任何判断、建议或策略含义
* 不表达成功与否的期待，仅表达执行约束

#### 3.1.1 Action Type Allowlist（v0）

Sprint 10 允许的 action_type 最小集合：

* `tillage` / `plow`
* `harrow`
* `seed`
* `spray`
* `irrigate`
* `transport`

任何不在 allowlist 中的 action_type 必须被拒绝。

#### 3.1.2 Task 必须包含的语义要素

* `action_type`（allowlist 内）
* `target`：空间目标（地块 / 区域 / 路径）
* `time_window`：允许执行的时间范围
* `parameters`：

  * 仅允许**物理可验证参数**（如深度、剂量、速度、时长上限）
  * 参数必须有工程上限（safety bounds）
  * Parameters must be scalar, numeric, or enumerated physical values; composite, named profiles, presets, or semantic modes are forbidden.
* `issuer`：任务发起者（人类身份）

Task **不允许**包含：

* 农艺理由
* 成功判定条件
* 后续动作建议

---

### 3.2 AO-ACT Receipt（执行回执）

AO-ACT receipt 是一个**关于“执行发生了什么”的事实声明**。

它的语义特征：

* 描述“**实际发生了什么**”
* 不评价执行是否“正确”“合理”“有益”
* 不推导任何结论

#### 3.2.1 Receipt 必须包含的最小要素

* `task_id`（指向对应 AO-ACT task）
* `executor_id`（人 / 设备 / 脚本）
* `execution_time`（开始 / 结束）
* `execution_coverage`（空间覆盖 / 路径 / 区域）
* `resource_usage`（油 / 电 / 水 / 药剂等；可为 null，但字段必须存在）
* `logs_refs`（原始日志或遥测的引用指针）

Receipt success, if present, refers only to execution completion relative to task constraints, and must not encode outcome quality, effectiveness, or desirability.

Receipt **不允许**包含：

* 农艺效果评价
* 是否“值得这样做”的判断
* 对后续行动的建议

---

## 4. Ledger 语义与派生边界

### 4.1 事实写入（Facts）

以下对象必须作为 append-only facts 写入 Ledger：

* AO-ACT task
* AO-ACT receipt

任何 task / receipt 的更新、覆盖、删除均被禁止。

### 4.2 派生索引（Index / View）

系统允许存在 **Action Index**，用于：

* 组织 task ↔ receipt 的对应关系
* 支持回放、审计、可视化

Index 规则：

* 只读派生
* 可重算
* 不得回写 Ledger
* Action Index outputs must not be used as execution triggers or control inputs for AO-ACT or any other action system.

---

## 5. Acceptance（验收）必须覆盖的断言

Sprint 10 的 acceptance 必须至少覆盖以下断言：

1. **No Auto Trigger**

   * 不存在任何路径从 ProblemState 自动生成 AO-ACT task

2. **Append-only Integrity**

   * AO-ACT task / receipt 只能新增，不能修改或删除

3. **Allowlist Enforcement**

   * 非 allowlist action_type 必须被拒绝

4. **Safety Bounds Enforcement**

   * 参数超出安全上限必须被拒绝

5. **Receipt Completeness**

   * receipt 的最小要素必须齐全（即便值为 null）

6. **Determinism**

   * 给定同一组 task / receipt facts，Action Index 的输出必须 deterministic

7. **No Semantic Leak**

   * receipt / index 中不得出现任何农技、处方、严重性、自动化字段

---

## 6. 非目标声明（Explicit Non-Goals）

Sprint 10 明确不解决：

* 行动是否“正确”
* 行动是否“高效”
* 行动是否“符合农艺最佳实践”
* 行动是否应被自动触发

这些问题被明确推迟到未来 Sprint，且必须新版本号 + 新 acceptance。

---
# Execution Protocol v1  
## AO-ACT / AO-DECIDE / Human 三方边界与执行治理规范

状态：Draft（Sprint 10 · Step 2，待冻结）  
适用范围：Control Plane（系统级）  
归属：治理级规范（不隶属于 Apple II / Judge）

本文件仅定义**执行与权限边界**，  
不定义任何决策权、自动化逻辑或农艺语义。

---

## 一、三方角色定义（不可混淆）

### 1. AO-ACT（Execution Transport / 执行通道）

**定义**

AO-ACT 是执行传输与审计外壳，仅负责：

- 接收**明确由人类发起**的 AO-ACT task
- 将任务交付给 executor（人 / 脚本 / 设备）
- 接收执行回执（receipt）
- 将 task / receipt 作为 append-only facts 写入 Ledger

**允许的职责**

- 接收 AO-ACT task
- 向 executor 分发任务
- 接收 executor 回传的 receipt
- 写入 task / receipt 事实（append-only）

**绝对禁止**

- 任何形式的决策或判断
- 任何自动触发或隐式生成
- 任何策略 / 农技 / 价值判断语义
- 直接或间接消费 ProblemState
- 基于 Index / 派生结果触发执行

---

### 2. AO-DECIDE（Decision Suggestion Plane，仅定义边界）

**定义**

AO-DECIDE 是建议/候选生成层，仅用于输出**供人类审阅的行动提案（proposal）**。

Sprint 10 不实现 AO-DECIDE，仅冻结其边界。

**允许的职责**

- 只读 Ledger / Evidence / 各类 Index
- 基于证据生成行动建议（proposal-only）

**绝对禁止**

- 创建 AO-ACT task
- 调用 executor
- 写入 AO-ACT receipt
- 写入任何执行相关事实
- 以任何形式触发执行

---

### 3. Human（Authority / Issuer）

**定义**

Human 是 v0 / v1 阶段中**唯一的执行授权主体**。

**允许的职责**

- 显式创建 AO-ACT task（必须有 issuer 身份）
- 审阅、修改或拒绝 AO-DECIDE 提案
- 决定是否下发执行

**不可被替代**

- 在未引入新版本授权策略前  
  任何系统组件不得替代 Human 发起执行

---

## 二、允许的数据流与权限流（Allowed Paths）

以下路径被明确允许：

1. **Human → AO-ACT**

- Human 通过显式 create 调用创建 AO-ACT task
- task 作为事实写入 Ledger（append-only）

2. **AO-ACT → Executor**

- executor 只消费 AO-ACT task
- executor 不得消费 ProblemState / AO-DECIDE 输出

3. **Executor → AO-ACT**

- executor 回传执行回执（receipt）
- AO-ACT 写入 receipt 事实

4. **Ledger → AO-DECIDE（只读）**

- AO-DECIDE 只读 facts / evidence 指针
- 不得写入任何事实

5. **AO-DECIDE → Human**

- 仅输出 proposal
- 不产生任何执行副作用

---

## 三、禁止路径（Forbidden Paths，必须可验收）

以下路径必须被制度性禁止：

### F1）ProblemState → AO-ACT

- 禁止任何形式的自动触发
- 禁止模板化 / 默认填充生成
- 禁止无 issuer 的任务创建

### F2）AO-DECIDE → AO-ACT

- AO-DECIDE 不得调用 AO-ACT create 接口
- AO-DECIDE 不得生成等价于 task 的事实对象

### F3）Index / 派生结果 → 执行触发

- Action Index / ProblemState Index / Agronomy 输出仅可读
- 禁止 on-change / hook / 隐式触发机制

### F4）Receipt → 下一任务

- receipt 不得自动衍生新的 AO-ACT task
- 禁止形成闭环自动化

---

## 四、三方能力矩阵（冻结）

| 能力 / 角色 | Human | AO-DECIDE | AO-ACT |
|------------|-------|-----------|--------|
| 创建 AO-ACT task | 允许（显式 + issuer） | 禁止 | 禁止（仅接收） |
| 生成行动建议 | 允许（人工） | 允许（proposal-only） | 禁止 |
| 触发执行 | 允许（通过创建 task） | 禁止 | 允许（仅消费 task） |
| 消费 ProblemState | 允许（查看） | 只读 | 禁止 |
| 写入 Ledger（facts） | 仅通过受控 API | 禁止 | 允许（task / receipt） |
| 写入 receipt | 禁止 | 禁止 | 允许 |
| 包含农技 / 策略语义 | 允许（人脑） | 允许（proposal 内） | 禁止 |

---

## 五、治理级验收断言（Sprint 10 · Step 2）

- AO-ACT task 创建必须包含 issuer
- 不存在 AO-DECIDE 写 AO-ACT task 的代码路径
- AO-ACT 执行链路不读取 ProblemState / Index
- Index 输出不可触发任何执行
- receipt 不得自动生成下一任务

---

End of Execution Protocol v1
