GEOX · AO Action Taxonomy v0

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Normative Registry（规范真源）

0. 一句话定义

本文件冻结 GEOX 系统中 action_code 的唯一规范集合（AO Action Taxonomy）。
所有出现 action_code / action_type 的地方，都必须以本文件为真源进行校验与对齐。

1. 所有权裁定

AO Action Taxonomy 的规范真源属于 Control Plane Constitution。

AO-ACT / AO-SENSE 的 schema 可以使用 string 表达 action，但其合法值必须受本文件约束。

PermissionSet v0 / Control Constitution / Control Kernel 只消费本真源，不定义 action_code。

2. 术语对齐（非常关键）

action_code：宪法层/裁决层/PermissionSet 使用的规范名。

action_type：AO-ACT task schema 中的字段名（string）。

对齐规则（冻结）：

ao_act_task_v0.action_type 的取值必须等于某个 action_code。

permission_set_v0.candidate_actions[*].action_code 的取值必须等于某个 action_code。

control_ruleset_v0.action_code 取值必须等于某个 action_code。

control_verdict_v0.action_code 取值必须等于某个 action_code。

3. 枚举集合（Normative Allowlist）

本版本 v0 冻结以下 action_code：

AO-ENTER

AO-APPLY

AO-REMOVE

AO-STRUCT

AO-EXTRACT

AO-SENSE

4. 兼容与扩展纪律（冻结）

禁止在实现中硬编码新增 action_code。

新增 action_code 只能通过修改本文件完成，并必须：

bump 本文件版本（v0 → v1 或 v0.1 等按你们规则）

同步更新相关 acceptance（至少覆盖：PermissionSet / RuleSet / Kernel 输入校验）

禁止通过“字符串随便填”绕过治理：任何未知 action_code 视为非法输入。

5. 冻结声明

本文件为 action_code 的唯一规范真源。

任何与本文件冲突的实现/文档/示例均无效。

修改本文件等同于扩大或改变系统可行动空间，必须全局裁定。

6. 一句话版本

schema 里可以是 string，但治理上不是自由字符串：
action 的合法集合只能从这里来。