# 灌溉动作名映射（v1）

本文档明确当前仓库中灌溉动作的“两层动作名”现实，并冻结映射口径，避免 recommendation 与 control-plane 之间漂移。

## 1) recommendation 层动作名

- 固定动作名：`irrigation.start`
- 使用层级：recommendation payload（例如 `suggested_action.action_type`）

## 2) approval / operation_plan / task / execute 层动作名

- 固定动作名：`IRRIGATE`
- 使用层级：提交审批、后续作业计划、任务下发与执行链路

## 3) customer-facing 文案动作名

- 固定文案：`灌溉`
- 该文案用于对外展示，不引入新的灌溉同义名。

## 4) 口径说明

当前仓库现实是“两层动作名”，不是“一层统一名”：

- recommendation 层保留领域可读动作：`irrigation.start`
- control-plane 执行链路保留动作标准化枚举：`IRRIGATE`

二者通过单一来源 helper 映射，避免在业务代码中散落硬编码字符串。

当前仓库动作映射单一来源 helper 为 `apps/server/src/domain/controlplane/irrigation_action_mapping_v1.ts`。
recommendation / control-plane / customer-facing 不允许在其他业务代码重新定义灌溉动作名语义。
