# GEOX Security Audit Log V1

- 业务 facts 记录业务状态；`security_audit_event_v1` 记录安全责任链。
- 审计覆盖关键动作：approval/prescription/action/receipt/judge/acceptance/field-memory/roi/skill binding。
- result 语义：`ALLOW`(允许并执行)、`DENY`(被拒绝)、`ERROR`(执行异常)。
- 每条审计要求携带 actor_id/token_id/role + tenant/project/group，涉及地块时应带 field_id。
- 关键写接口审计失败应导致失败；读接口可降级记录日志但不阻塞。
- skill binding 变更必须审计并记录变更原因。
- 后续 fail-safe / manual override 同样进入审计链。
