GEOX-ControlConstitution-RepoConst-Ruleset-Loading-Policy-v0.md
文档状态

状态：Frozen

等级：Control Constitution

生效范围：All runtimes (kernel / judge / ao-act / agronomy / ui)

修改方式：仅允许新版本文档（v1+），禁止就地修订

1. 目的与裁定范围

本文档裁定 RuleSet 在系统中的加载语义（Loading Semantics），明确：

RuleSet 的存在位置

RuleSet 的加载条件

RuleSet 在 runtime / kernel / 审计链路中的可见性边界

本文档不定义规则内容、规则求值、或任何执行逻辑，仅定义加载与不存在的等价语义。

2. 核心裁定摘要（不可推翻）

RuleSet 的唯一规范载体是 repo-const（仓库文件）

系统 runtime 默认不加载任何 RuleSet

control-kernel 不包含任何 RuleSet 发现、扫描、路径或存在性逻辑

RuleSet 相关元信息（ruleset_ref / ruleset_status）仅用于审计锚定，不得被消费为行为信号

3. Loading Policy v0（冻结条款）
3.1 Repo-Const 是唯一 SSOT

RuleSet v0 仅允许以 repo-const 文件形式存在

不允许：

DB 存储

ledger 写入

环境变量注入

API 上传 / 查询

runtime 目录扫描

repo-const 的存在只代表可审计资产存在，不代表运行时生效。

3.2 Runtime 默认不加载（Default: NOT LOADED）

系统在启动或运行过程中：

不得自动加载

不得隐式解析

不得扫描目录

不得基于约定路径读取规则

RuleSet 只有在显式传入 ruleset 对象时，才可能参与一次性验证或求值。

🔒 不可误读补充条款 1（冻结）

即使 repo-const 中存在规则文件，
系统的运行行为在未显式传入 ruleset 对象的情况下，
必须与“规则完全不存在”时严格一致。

该条款用于否定任何形式的
“我只是读一下 / 看一下 / cache 一下，不算加载”的实现辩解。

3.3 Kernel 不含任何发现 / 感知逻辑

control-kernel 的职责是：

接收已经构造完成的输入对象

对其进行纯函数式、无副作用的裁定

Kernel 不得：

判断 ruleset 是否存在

判断 ruleset 是否缺失

判断 ruleset 是否未传入

根据 ruleset 是否为空改变执行路径

🔒 不可误读补充条款 2（冻结）

Kernel 对 ruleset 的“存在与否”不具备任何感知能力；
Kernel 不得区分“没有规则”与“未传入规则”的运行路径。

该条款直接禁止在 Kernel 内引入
if (ruleset == null)
if (!ruleset)
等任何分支逻辑。

3.4 RuleSet 缺失 / 无效的裁定语义

当 RuleSet：

未传入

校验失败

admission 被拒绝

Kernel 的行为必须满足：

裁定结果为 UNDETERMINED

不触发任何下游执行

不改变 Judge / AO-ACT / Agronomy / UI 的既有行为路径

RuleSet 的缺失或无效 等价于规则不存在。

3.5 Audit-only 锚点字段的不可消费性

Kernel 输出的 control_verdict_v0 中允许包含：

ruleset_ref

ruleset_status

但其语义严格受限。

🔒 不可误读补充条款 3（冻结）

ruleset_status 的任何值变化，
不得改变系统对同一输入的行为路径；
其变化只允许影响审计输出，不允许影响控制决策。

该条款明确禁止：

UI 基于 INVALID/MISSING 改变展示逻辑

Scheduler 基于 ruleset_status 改变队列或优先级

任意模块将其作为“预处理信号”

4. 禁止行为清单（非穷举）

以下行为在 v0 中明确禁止：

runtime ruleset 列表 API

热加载 / watch / reload

ruleset query / search

fallback 到“最近一次规则”

在 determinism_hash / ssot_hash 中混入规则信息

5. 执行与验收

本裁定通过以下方式强制：

negative acceptance（无 loader / 无 scan）

schema 冻结（不可混入执行字段）

constitution 文本冻结

git tag 锁定