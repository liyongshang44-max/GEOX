# GEOX Security Commercial Gate V1

## Purpose
Security Commercial Gate is the release gate for Step10 A-H.

## Covered gates
1. IAM / Scope / Token
2. Tenant Isolation
3. Approval / Execution Separation
4. Skill Safety Boundary
5. Security Audit Log
6. Fail-safe / Manual Takeover
7. Runtime Hardening
8. Step9 Variable Prescription
9. Step8 Field Memory

## Pass criteria
- All scripts exist.
- Every script exits 0.
- Every script returns JSON with ok=true.
- No check is false.
- No static-success acceptance script is allowed.
- Step9 and Step8 still pass after security hardening.

## Failure triage
- IAM / Scope / Token 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_IAM_SCOPE_V1.cjs` 输出与 `/api/v1/recommendations/generate`、`/api/v1/actions/receipt`、`/api/v1/field-memory/summary` 返回错误码。
- Tenant Isolation 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_TENANT_ISOLATION_V1.cjs` 输出与 `/api/v1/fields/:field_id/zones`、`/api/v1/prescriptions/:prescription_id`、`/api/v1/field-memory/summary` 的跨租户/allowlist 返回。
- Approval / Execution Separation 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_APPROVAL_EXECUTION_SEPARATION_V1.cjs` 与 `/api/v1/approvals/:approval_request_id/decide`、`/api/v1/actions/task/from-variable-prescription`、`/api/v1/acceptance/evaluate` 返回。
- Skill Safety Boundary 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_SKILL_BOUNDARY_V1.cjs` 与 `/api/v1/skills/rules`、`/api/v1/skills/rules/switch` 返回及审计日志。
- Security Audit Log 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_AUDIT_LOG_V1.cjs` 与 `/api/v1/security/audit-events` 查询过滤器（action/result）以及 actor_id/token_id/error_code 字段。
- Fail-safe / Manual Takeover 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_FAIL_SAFE_MANUAL_TAKEOVER_V1.cjs`、`/api/v1/fail-safe/events`、`/api/v1/manual-takeovers` 及对应 route/service 日志。
- Runtime Hardening 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_RUNTIME_HARDENING_V1.cjs` 子进程输出、`apps/server/src/runtime/runtime_security_v1.ts`、`/api/admin/healthz` 的 runtime_security 字段。
- Step9 Variable Prescription 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_VARIABLE_PRESCRIPTION_V1.cjs` 与 variable prescription/action/receipt/acceptance 链路日志。
- Step8 Field Memory 失败：检查 `scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs` 与 `/api/v1/field-memory`、`/api/v1/field-memory/summary`、相关 migration/service 日志。

## Local command
node scripts/agronomy_acceptance/ACCEPTANCE_SECURITY_COMMERCIAL_GATE_V1.cjs

## Security acceptance token fixture

Security Commercial Gate requires the server process to be started with:

```powershell
$env:GEOX_RUNTIME_ENV="test"
$env:GEOX_TOKENS_FILE="config/auth/security_acceptance_tokens.json"
```

For Docker/container runtime, mount the file into server container and point `GEOX_TOKENS_FILE` to in-container path.

Acceptance scripts do not mutate server environment variables; they only send Bearer tokens to running server.
