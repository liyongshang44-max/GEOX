# 🍎 Apple II · Judge
## 设计总览（Design Overview）

Doc ID：GEOX-AII-00  
Status：DRAFT → READY TO FREEZE  
Applies to：Apple II（Judge）  
Depends on：Apple I Phase-5（Evidence-Only Monitoring）  

Explicit Non-Goal：
- 不输出行动
- 不裁决合法性
- 不产生作业建议
- 不替代人类判断

⸻

## 0. Apple II 的定位（Role Definition）

Apple II（Judge）不是“决策系统”，而是：

在证据之上，识别、结构化、并暴露“问题态（ProblemState）”的不确定性系统。

它的存在目的只有一个：

让系统知道：哪里“可能有问题”，问题结构可能是什么，但目前知道得还不够清楚。

⸻

## 1. 核心输出结构（冻结）

Apple II 只允许三种输出对象，且层级关系严格如下：

ProblemStateV1   ← 唯一核心锚点（本体）
  ├─ LBCandidateV1 (0..n)  ← 解释结构（候选）
  └─ AO-SENSE (0..n)       ← 补观测请求（最弱动作）

⸻

## 2. 核心锚点：ProblemStateV1（唯一本体输出）

### 2.1 定义

ProblemStateV1 是 Apple II 的唯一“本体输出”。

它描述的是：

在某个 SpatialUnit i、某个时间窗内，系统认为出现了一个“需要进一步辨识的不确定问题态”。

### 2.2 输入（冻结）

ProblemStateV1 只能基于以下输入生成：

- StateVectorV1（来自 Apple I）
- Evidence Ledger（Observables + QC + Markers）
- 时间窗参数
- SpatialUnit & Scale Policy

明确禁止作为输入的内容：
- LBCandidate
- 任何 Action / AO / Control 结果
- 人工主观结论（除非以 marker_v1 形式写入 Ledger）

硬约束：
ProblemState 不允许引用 LBCandidate 作为输入证据，
防止解释结构反向“证明”问题本体。

### 2.3 ProblemStateV1 允许表达的内容

ProblemState 只回答以下问题：

- Where：哪个 SpatialUnit
- When：哪个时间窗
- What kind of problem-ness：出现了哪一类异常 / 偏移 / 冲突
- How sure：系统对该判断的置信度与不确定性来源
- Why not sure：证据冲突、缺失、新鲜度问题

### 2.4 明确禁止的内容

ProblemStateV1 不得包含：

- 原因判断（cause / diagnosis）
- 风险裁决（risk_level / legal / illegal）
- 行动含义（should / recommend / need）
- 作业暗示（灌溉 / 施肥 / 干预）

⸻

## 3. 派生认知对象：LBCandidateV1（解释结构）

### 3.1 定义

LBCandidateV1 是对 ProblemState 的解释性结构假设。

它不是结论，而是：

如果要解释这个 ProblemState，可能的结构有哪些？

### 3.2 性质（冻结）

- 永远是 candidate（候选）
- 允许多个并列
- 允许相互冲突
- 允许被撤销
- 不具备任何行动含义

### 3.3 输入约束

LBCandidate 可以引用：

- ProblemStateV1
- StateVectorV1
- Evidence Ledger
- 历史同类 ProblemState（仅作结构参考，不作证据）

LBCandidate 不允许：

- 作为 ProblemState 的输入
- 直接生成 AO / Control

⸻

## 4. 派生动作对象：AO-SENSE（最弱，仅为修复认知）

### 4.1 定义

AO-SENSE 是 Apple II 唯一允许的动作型输出，但它不是作业，也不是干预。

AO-SENSE 的含义是：

为修复或澄清 ProblemState 而提出的补观测请求。

### 4.2 性质（冻结）

- 没有独立意义
- 必须绑定到一个 ProblemState
- 只能请求“看 / 采 / 确认”
- 不能请求“做 / 改 / 干预”

硬约束：
AO-SENSE 不允许在没有 ProblemState 的情况下单独存在。

### 4.3 AO-SENSE 允许表达的内容

- 去哪里（SpatialUnit / sensor / 区域）
- 看什么（哪类 observable / metric）
- 为什么需要（修复哪一类不确定性）
- 期望减少的不确定性类型

⸻

## 5. Apple II 的能力边界（冻结）

Apple II 允许：

- 状态分层（原子 / 派生 / 记忆）
- 不确定性建模
- 证据冲突识别
- 为风险空间构建提供前置结构

Apple II 明确不做：

- 风险裁决（Risk State Space）
- 控制许可（Hard No / OK / Priority）
- 执行体接口
- 是否允许干预的判断

风险空间、控制信号、反应类型库全部属于 Apple III。

⸻

## 6. 设计结论（冻结声明）

- ProblemStateV1 是 Apple II 的唯一锚点
- LBCandidate 只解释，不裁决
- AO-SENSE 只为修复认知
- Apple II 不产生行动合法性
- Apple II 不越权进入 Control 层

Apple II 的价值不在于“更聪明”，而在于“更诚实”。