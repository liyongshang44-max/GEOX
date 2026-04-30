# GEOX Approval / Execution Separation V1

1. 职责分离：推荐/处方、审批提交、审批决定、任务创建、回执提交、验收评估必须由独立权限边界控制。
2. 角色动作边界：
   - approver/admin 可审批；
   - operator/admin 可创建 task；
   - executor/operator/admin 可提交 receipt；
   - acceptance evaluate 仅 operator/admin。
3. 禁止自批：请求人 actor/token 与审批人 actor/token 相同返回 `APPROVAL_SELF_APPROVAL_DENIED`。
4. 禁止审批者直接执行：approver 不可创建 action task。
5. 禁止执行者自验收：executor 不可调用 acceptance/evaluate。
6. 变量处方安全流：`agronomist -> approver -> operator -> executor -> operator acceptance`。
7. Skill 不能绕过审批与执行权限：skill_trace/skill_output 不是权限凭证。
8. 兼容策略：保留旧 `ao_act.task.write` scope 过渡，但角色校验仍按上述边界执行。
9. 过渡债：历史自动发任务仅在 `proposal.meta.allow_auto_task_issue===true` 时允许；变量处方继续 `skip_auto_task_issue=true`。
