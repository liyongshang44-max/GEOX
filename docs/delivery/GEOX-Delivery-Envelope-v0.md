# GEOX · Sprint 23
# Delivery Envelope v0 — Commercial Readiness / Delivery Prep (FROZEN CANDIDATE)

Applies to: Delivery / Commercial Readiness（交付壳层）

Depends on (already frozen governance semantics):
- Sprint 19: AO-ACT AuthZ v0
- Sprint 20: AO-ACT Idempotency v0
- Sprint 21: AO-ACT Device Evidence Adapter v0
- Sprint 22: AO-ACT Multi-tenant Isolation v0

This document defines ONLY the delivery envelope: installation, acceptance-as-product, rollback boundary, and evidence-pack export.
It MUST NOT introduce new governance semantics and MUST NOT change any frozen sprint semantics.

---

## 1. Non-goals (MUST NOT)

1) MUST NOT introduce automation, scheduler, queue, or auto-triggered execution.
2) MUST NOT introduce cross-tenant aggregation views or convenience read APIs.
3) MUST NOT introduce soft isolation.
4) MUST NOT mutate or delete ledger facts; facts remain append-only.

---

## 2. Delivery profile single entrypoint (FROZEN)

The ONLY allowed delivery startup entrypoint is:

`docker compose -f docker-compose.yml -f docker-compose.delivery.yml up -d`

`docker-compose.delivery.yml` is allowed to change ONLY:
- mount boundaries (volumes)
- read-only mount flags
- port mappings
- resource limits

`docker-compose.delivery.yml` MUST NOT:
- add new services
- change the semantic responsibility of existing services
- add scheduler/queue/databases

---

## 3. Rollback boundary (FROZEN)

Rollback is allowed ONLY for code/runtime versions (git tag / image tag / compose files).

Rollback is FORBIDDEN for the ledger:
- Facts MUST remain append-only.
- No deletion, no mutation, no reverse replay.

Rollback acceptance requirement:
- After rollback to a frozen tag, the delivery acceptance suite (Section 4) MUST still pass.

---

## 4. Acceptance-as-Product (FROZEN)

Delivery acceptance MUST be runnable by a customer without internal knowledge.

### 4.1 Output paths (FROZEN)

The delivery acceptance MUST write exactly:
- `_exports/delivery/acceptance_report_v0.json`
- `_exports/delivery/acceptance_report_v0.txt`

### 4.2 JSON schema (FROZEN)

`acceptance_report_v0.json` MUST contain:
- `timestamp`
- `repo_commit`
- `repo_tags`
- `baseUrl`
- `cases[]`

Each element of `cases[]` MUST contain:
- `case_id`
- `ok`
- `stdout_path`
- `stderr_path`
- `artifacts[]`
- `sha256`

Hash algorithm is FROZEN to `sha256`.

### 4.3 Delivery acceptance suite composition (FROZEN)

The delivery acceptance suite MUST include these frozen acceptances in a fixed order:
- Sprint 19: `ACCEPTANCE_AO_ACT_AUTHZ_V0`
- Sprint 20: `ACCEPTANCE_AO_ACT_IDEMPOTENCY_V0`
- Sprint 21: `ACCEPTANCE_AO_ACT_DEVICE_ADAPTER_V0`
- Sprint 22: `ACCEPTANCE_AO_ACT_MULTITENANT_ISOLATION_V0`

---

## 5. Evidence Pack export (FROZEN)

Evidence Pack export is a delivery artifact for third-party audit.

### 5.1 Inputs (FROZEN)

Export inputs MUST be explicit:
- `tenant_id`
- `project_id`
- `group_id`
- `task_id`

### 5.2 Isolation binding (FROZEN)

All export queries MUST be filtered by the tenant triple:
- `tenant_id + project_id + group_id`

If scope does not match, the export MUST fail with HTTP `404` (non-enumerable), consistent with Sprint 22.

### 5.3 Determinism constraints (FROZEN)

Evidence Pack MUST include `MANIFEST.json` with deterministic ordering:
- file list MUST be sorted by filename

Allowed-to-change fields in the manifest are strictly whitelisted:
- `pack_generated_at`
- `tool_version` (optional)

The following MUST NOT change across repeated exports for the same inputs:
- the set of exported files
- each file sha256
- the manifest ordering

### 5.4 Secrets (FROZEN)

Evidence Pack MUST NOT contain secrets:
- no tokens
- no DB passwords
- no private keys

---

## 6. Compliance checklist (customer-facing)

A delivery is considered valid v0 if:
1) customer can start the system using the single entrypoint command
2) customer can run delivery acceptance and obtain the frozen report outputs
3) customer can export an evidence pack for a specific task within a specific tenant triple
4) rollback to a frozen tag does not break the delivery acceptance suite
