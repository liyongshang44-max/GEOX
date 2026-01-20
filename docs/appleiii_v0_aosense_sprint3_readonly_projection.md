# Apple III v0 · Sprint 3 Freeze: Read-only projections for AO-SENSE

Scope
- Add read-only operational visibility for Apple III AO-SENSE Task/Receipt by querying the facts ledger.
- No new mutable tables; no updates/deletes; no scheduling semantics.

New endpoints (Sprint 3)
1) GET /api/control/ao_sense/tasks
- Data source: facts where record_json.type == "ao_sense_task_v1"
- Optional filters:
  - projectId
  - groupId
  - limit (default 20, max 200)
- Response: { ok: true, items: [{ fact_id, occurred_at, source, record_json }] }

2) GET /api/control/ao_sense/receipts
- Data source: facts where record_json.type == "ao_sense_receipt_v1"
- Optional filters:
  - task_id
  - limit (default 20, max 200)
- Response: { ok: true, items: [{ fact_id, occurred_at, source, record_json }] }

Acceptance update
- scripts/ACCEPTANCE_APPLEIII_AOSENSE.ps1 MUST assert that:
  - created task appears in GET /tasks projection
  - created receipt appears in GET /receipts projection filtered by task_id
- Judge rerun remains non-regression only.