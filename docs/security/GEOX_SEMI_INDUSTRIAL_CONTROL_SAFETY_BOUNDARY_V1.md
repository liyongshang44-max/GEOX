# GEOX Semi-Industrial Control Safety Boundary V1

1. GEOX is governed as a semi-industrial control system due to real-world execution impact.
2. Token sources: structured env/file sources only in staging/production; example fallback only in dev/test.
3. Roles: admin, agronomist, approver, operator, executor, auditor, viewer, client, support.
4. Scopes: fine-grained recommendation/prescription/approval/action/judge/acceptance/field_memory/roi/field.zone/security scopes.
5. Role-scope matrix is `ROLE_SCOPE_MATRIX_V1` in `apps/server/src/domain/auth/roles.ts`.
6. Tenant/project/group boundary enforced per request; mismatches return 404.
7. Skill execution cannot bypass scope, tenant boundary, approval, or action safety gate.
8. Env differences: dev/test allows bootstrap fallback; staging/production disallow example and single-token fallback.
9. Step10 follow-up: audit logs, fail-safe, human takeover, CORS/secrets/runtime hardening.
