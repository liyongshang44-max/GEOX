# GEOX Tenant Isolation V1

- 所有业务资源必须绑定并校验 `tenant_id/project_id/group_id`。
- `field_id` 是二级隔离边界，受 `allowed_field_ids` 约束。
- `allowed_field_ids=[]` 视为不限制；非空时仅可访问 allowlist 内 field。
- 跨租户/项目/分组访问统一返回 `404 NOT_FOUND`（不返回 403）。
- 所有 `resource_id` 查询必须叠加 tenant triple，禁止 ID-only 查询。
- facts JSON 查询同样必须包含 tenant triple 条件（或等价结构化列条件）。
- Skill 调用链不得绕过 tenant scope。
- 如存在绕过 tenant scope 的内部 helper，仅允许后台受控任务使用，并在 Step10-E 审计。
