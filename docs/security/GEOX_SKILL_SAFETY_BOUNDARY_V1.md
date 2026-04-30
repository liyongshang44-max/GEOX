# GEOX Skill Safety Boundary V1

- Skill 分类：SENSING / AGRONOMY / DEVICE / ACCEPTANCE / OPS / CONTROL / OBSERVABILITY。
- AGRONOMY 仅 recommendation/prescription 语义，不能输出 device command / approval decision / task id。
- DEVICE 仅 capability/adapter/evidence，不能输出 approval/acceptance/ROI 覆盖结果。
- ACCEPTANCE 仅 verdict/explanation/metrics，不能修改 task/receipt/prescription/roi/field memory。
- Skill 不能绕过 IAM、tenant triple、field allowlist、approval、task create、receipt submit、acceptance evaluate、manual takeover/fail-safe。
- `skill_trace` 不是权限凭证；`skill_run` success 不是 operation success。
- skill binding API 写入必须包含 actor_id/token_id/change_reason + tenant scope + `security_boundary_version`。
- 设备执行能力绑定仅允许 DEVICE 类 skill。
