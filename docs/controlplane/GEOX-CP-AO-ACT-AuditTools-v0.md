# GEOX · Sprint 18
# AO-ACT Audit Tools v0 — Evidence Pack + Integrity Check (offline)

Scope

This Sprint delivers AO-ACT audit tooling as **offline, explicit-call scripts**. It does **not** add any server runtime endpoint, any list/index beyond existing AO-ACT endpoints, or any discovery behavior.

Non-goals (must remain true)

1) No server endpoint is added for audit export or integrity checks.
2) No list / discovery / scan API is introduced.
3) No scheduler behavior is introduced.
4) No new governance semantics are introduced (no schema changes, no new ruleset loading behavior).
5) No Judge/Agronomy coupling is introduced.

Artifacts

1) Evidence Pack exporter (DB-only)

- Script: scripts/audit/ao_act_evidence_pack_v0.cjs
- Input: explicit act_task_id
- Output: evidence_pack.json
- Ordering: receipts ordered by **fact_id lex asc** (frozen)
- Refs: conservative pointer collection from receipt.payload.logs_refs only (no dereference)

2) Integrity Check (DB-only)

- Script: scripts/audit/ao_act_integrity_check_v0.cjs
- Input: explicit act_task_id
- Output: integrity_report.json
- Checks:
  - task exists
  - receipts link to same act_task_id
  - executor_id structure
  - constraint_check structure + consistency
  - logs_refs structure
  - observed_parameters primitive + keys ⊆ task.parameter_schema.keys + basic type/bounds checks
  - optional existence check for refs whose kind implies fact_id pointers (audit-only)

How to run (manual)

Evidence pack:

- node scripts/audit/ao_act_evidence_pack_v0.cjs --actTaskId <id> --out .\acceptance\evidence_pack.json

Integrity check:

- node scripts/audit/ao_act_integrity_check_v0.cjs --actTaskId <id> --out .\acceptance\integrity_report.json

DB configuration

- Priority: --databaseUrl > DATABASE_URL > PG* env vars (defaults: host=127.0.0.1 port=5432 db=landos user=landos pass=landos_pwd)
- .env at repo root is supported (loaded without overriding existing env)

Acceptance

- Entry: scripts/ACCEPTANCE_AO_ACT_AUDIT_V0.ps1
- Behavior:
  - Create one AO-ACT task via existing AO-ACT API
  - Write two receipts for the same act_task_id (sim/device executor_id) via existing AO-ACT API
  - Run offline tools and assert:
    - evidence pack structure stable
    - receipts ordering = fact_id_lex_asc
    - integrity_report.ok = true
  - Negative guard: only calls the three AO-ACT endpoints (task/receipt/index)

Risk notes

- Offline scripts require DB connectivity from the host shell. If server is running inside docker-compose, host scripts should use DATABASE_URL pointing to 127.0.0.1:5432 (not postgres:5432).
- Evidence pack contains raw record_json for task/receipts; this is audit output and is not a runtime dependency.

Next

- If/when a server audit endpoint is desired, it must be introduced under a separate governance sprint with explicit non-goals and negative acceptance that prevents it from becoming a queue/list/discovery surface.
