GEOX · Control Constitution
Rule Templates v0（模板化裁决规则）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Rule Templates

0. 文档定位（关键）

Rule Templates v0 是 Control Constitution 中唯一允许产生具体规则的方式。

后续所有规则新增，都只能是：
选择模板 → 填枚举参数 → 给出三值 verdict
而不是“自由写条件”。

1. 模板总原则（冻结）

所有 Rule Template 必须满足：

只使用以下谓词能力：

EQ / IN / EXISTS / INTERSECTS / WINDOW_MATCH

AND / OR / NOT

参数 只能是枚举值或枚举集合

输出 只能是：

ALLOW

DENY

UNDETERMINED

不允许任何数值、阈值、计数、排序、概率、文本匹配

2. 模板清单（v0 冻结 7 个）
T1 · Field Equals

template_id：FIELD_EQ

语义：字段等于某个枚举值

形式：

EQ(field_path, enum_value)

典型用途：

problem_type 等值判断

T2 · Field In Set

template_id：FIELD_IN

语义：字段属于枚举集合

形式：

IN(field_path, enum_set)

T3 · Field Exists

template_id：FIELD_EXISTS

语义：字段存在性判断

形式：

EXISTS(field_path)

T4 · Set Intersects

template_id：SET_INTERSECTS

语义：两个枚举集合存在交集

形式：

INTERSECTS(field_path, enum_set)

典型用途：

不确定性来源集合判断

T5 · Window Match

template_id：WINDOW_MATCH

语义：窗口结构一致性校验

形式：

WINDOW_MATCH(window)

❌ 禁止用于时间长短、频率等推断

T6 · Logical AND

template_id：LOGICAL_AND

语义：多个子模板同时成立

形式：

AND(template_ref[])

T7 · Logical OR / NOT

template_id：LOGICAL_OR_NOT

语义：

OR(template_ref[])

NOT(template_ref)

3. 模板参数约束（冻结）

模板参数：

只能引用 inputs_used 中已声明的字段

只能填枚举值 / 枚举集合

模板不得：

引入默认值

推断缺省语义

访问 supporting_evidence_refs 的内容

4. 模板与规则的关系

一条具体规则 =
rule_id + rule_version + template_id + 参数 + verdict

不允许：

自定义条件

组合未声明模板

嵌套超过模板定义允许的结构

5. 冻结声明

本文件冻结了 Control Constitution 的全部规则表达能力

新增规则 ≠ 新增能力，只是填充模板

任何想新增谓词/操作符/参数类型的行为：

必须修改本文件

等同于修改控制系统治理哲学