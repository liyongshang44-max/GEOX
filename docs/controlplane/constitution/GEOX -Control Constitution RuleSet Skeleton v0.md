一、GEOX · Control Constitution
RuleSet Skeleton v0（规则集骨架 · 非空冻结）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Structure Definition

0. 文档定位

RuleSet Skeleton v0 用于冻结每一组裁决规则的“外形与行为边界”，
但不承载任何具体策略判断。

它解决的是：
“这一组规则怎么被组织、怎么被审计、怎么被求值”，
而不是“规则内容是什么”。

1. 适用范围

每个 action_code 必须且只能对应一个 RuleSet Skeleton

RuleSet Skeleton 是 Control Constitution 中：

规则组合方式的唯一载体

Kernel 可安全执行的结构单元

2. RuleSet Skeleton · 固定字段（冻结）
2.1 必填字段

type：control_ruleset_v0（const）

schema_version：MAJOR.MINOR.PATCH

ruleset_id：稳定唯一

action_code：string

必须来自 PermissionSet.candidate_actions

combine_strategy：枚举（冻结）

允许值：

DENY_OVERRIDES（推荐）

FIRST_MATCH

default_verdict：枚举（冻结）

允许值：

UNDETERMINED（推荐）

❌ 禁止默认 DENY（防止把未知偷换成禁止）

2.2 审计与治理字段

inputs_used[]：固定字段路径白名单

只能从 Allowed Inputs v0 中选择

必须显式列出（禁止隐式依赖）

allowed_template_ids[]：

本 RuleSet 允许使用哪些 Rule Template

禁止使用未列入的模板

3. 明确禁止（Negative）

RuleSet Skeleton 不得包含：

具体规则条件

数值、阈值、范围

优先级、权重

文本解释

执行暗示

RuleSet Skeleton 不是规则，是规则容器的宪法级定义。

4. 冻结声明

本文件冻结了 RuleSet 的组织方式与裁决缺省语义

后续新增或修改具体规则：

不得修改 combine_strategy / default_verdict

不得扩展 inputs_used

不得引入未允许的模板

修改本文件等同于修改控制系统的裁决哲学