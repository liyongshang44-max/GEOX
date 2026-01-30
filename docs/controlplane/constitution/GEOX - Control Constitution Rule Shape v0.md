GEOX · Control Constitution
Rule Shape v0（裁决规则形态白名单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Allowlist + Negative Spec（规则形态宪法）

0. 文档目的（Purpose）

本文件用于一次性锁死 Control Constitution 允许存在的规则形态，以确保：

规则是可审计、可复算、可冻结的；

规则不会演化成“隐式策略/优先级系统”；

Kernel 只是执行者，Constitution 才是规则真源；

规则不会通过结构或默认值偷渡解释、优化、推荐或执行意图。

1. 适用前提（Preconditions）

本文件默认以下宪法已生效且优先级更高：

GEOX-ControlConstitution-NonGoals-v0.md

GEOX-ControlConstitution-AllowedInputs-v0.md

GEOX-ControlKernel-NonGoals-v0.md

GEOX-ControlKernel-AllowedOutputs-v0.md

Uncertainty 三件套宪法 + PermissionSet v0

若任何规则形态与上述文件冲突，以上述文件为准，本文件不得成为绕过入口。

2. 核心裁定（一句话）

Control Constitution 的规则，只允许表达：
对某个 action_code，在给定输入字段满足的情况下，返回 ALLOW / DENY / UNDETERMINED。

除此之外的表达（排序、评分、推荐、解释、生成任务、触发）均为越权。

3. 规则形态总览（Allowed Rule Shapes）
3.1 原子规则（Atomic Rule）——唯一允许的基本单元

原子规则必须满足：

只针对 一个 action_code

只读取 Allowed Inputs v0 允许的字段

只输出一个 verdict ∈ {ALLOW, DENY, UNDETERMINED}

不产生任何副作用

可被独立审计（rule_id + rule_version + rule_ref）

原子规则的结构被允许表达为以下三段（均为结构性，不含策略意图）：

Scope：适用范围（subjectRef/scale/window 只能作为匹配，不得跨合并）

Guard：输入谓词（只允许布尔谓词，见 4）

Verdict：输出枚举值（ALLOW/DENY/UNDETERMINED）

注：UNDETERMINED 的含义已在 Kernel 输出白名单中冻结：不是建议、不是等待、不是补数据。

3.2 规则集（RuleSet）——规则的唯一组合方式

允许存在规则集，其组合方式必须满足：

同一 action_code 的多个原子规则可以组成一个 RuleSet

RuleSet 的求值顺序只能是以下之一（必须显式声明，且不得隐藏）：

A) First-Match Wins（首条匹配生效）
B) Deny-Overrides（只要命中 DENY 即 DENY；否则若命中 ALLOW 则 ALLOW；否则 UNDETERMINED）

禁止任何其它组合方式（尤其是加权、打分、投票、排序）。

4. 允许的谓词语言（Allowed Predicates）

为避免规则形态滑向“解释/推理/优化”，谓词语言必须是极小且封闭的。

4.1 允许引用的输入字段

必须严格继承 Allowed Inputs v0：

ProblemStateV1（仅允许列出的字段）

UncertaintyEnvelope v0（仅允许列出的字段）

PermissionSet v0（仅允许列出的字段）

任何其它字段不可引用。

4.2 允许的谓词操作符（最小集合）

只允许以下布尔操作符：

AND, OR, NOT

EQ(field, value)：等值判断（枚举/字符串）

IN(field, set)：集合包含（枚举集合）

EXISTS(field)：存在性判断

INTERSECTS(setA, setB)：集合交集非空（仅用于枚举集合，如 uncertainty_sources）

WINDOW_MATCH(window)：仅用于验证输入 window 结构一致性（不得用于“时间越久越危险”等推断）

禁止任何数值比较、阈值、范围、距离、相似度、概率等运算。

4.3 明确禁止的谓词能力（Negative）

❌ 数值比较：> < >= <=

❌ 阈值：任何形式的 “超过 X”

❌ 计数/累加：COUNT(...)

❌ 排序：SORT / TOPK

❌ 加权：WEIGHT / SCORE

❌ 概率：P(...)

❌ 时间衰减：DECAY(...)

❌ 推断：IMPLY / INFER

❌ 文本匹配：substring/regex（避免解释文本渗入）

❌ 读取 supporting_evidence_refs 的“内容”并做判断（只能引用其存在，不解析内部语义）

5. Verdict 输出规则（Allowed Verdict Semantics）

规则只能输出：

ALLOW

DENY

UNDETERMINED

并额外冻结两条语义纪律：

UNDETERMINED 不是失败，不是建议，不触发任何后续行为。

ALLOW/DENY 只表示“规则上的裁决”，不表示安全性、优先级、紧急度。

6. 必须具备的审计字段（Auditability Requirements）

每条规则必须具备以下可审计信息（作为规则元数据；不进入求值语义）：

rule_id：稳定标识

rule_version：SemVer

rule_owner：固定为 Control Constitution（禁止由模块漂移）

action_code：该规则裁决的 AO code

verdict：规则命中后的输出

inputs_used：列出被引用的字段路径（用于审计复算）

禁止“隐藏依赖”：任何被使用的字段必须显式列出。

7. 与 PermissionSet 的强绑定（防止越权扩张行动空间）

规则对 action_code 的裁决必须满足：

只允许对 PermissionSet.candidate_actions 内出现的 action_code 做 ALLOW/DENY/UNDETERMINED

明确禁止：

❌ 对 PermissionSet 未声明的 action_code 给出 ALLOW（这等同于扩大行动空间）

❌ 通过规则集“生成新 action_code”

❌ 在 Constitution 内自建 AO taxonomy

8. 明确禁止的“策略化倾向”（关键风险条款）

为防止规则形态变成隐式策略系统，以下一律禁止：

❌ “当不确定性较高时，倾向于…”（倾向/偏好 = 排序）

❌ “尽量允许”或“尽量禁止”（目标函数式表达）

❌ “在多个可行动作中选最安全/最省钱/最快”（优化）

❌ “给出建议的下一步”或“建议补观测”（触发/推荐）

❌ “输出理由文本”或“输出解释字段”（解释器化）

规则只能裁决，不能指导。

9. 冻结声明（Freeze Verdict）

本文件冻结了 Control Constitution 允许的规则形态与谓词语言。

任何扩展谓词能力（阈值、比较、计数、评分、排序、概率、文本匹配）均视为架构级越权。

修改本文件等同于改变控制系统的治理哲学，必须进行全局裁定。

10. 一句话版本（给实现者）

Constitution 只能写“布尔条件 → 三值裁决”。
一旦你想加阈值、加评分、加排序、加解释，说明你越权了。