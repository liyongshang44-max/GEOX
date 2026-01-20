# Apple III v0 · Sprint 4 Freeze: next_task selector + executor audit without contract changes

Sprint 4 goals
- Provide a minimal "pull task" mechanism for executors (human/device) without introducing a task state table.
- Preserve v0 contracts: AO_SENSE_TASK_v1 and AO_SENSE_RECEIPT_v1 remain unchanged.
- Preserve append-only: no updates/deletes, no mutable state.

1) New endpoint: GET /api/control/ao_sense/next_task

Query params (required)
- projectId
- groupId

Frozen "unclaimed task" definition (read-only join on facts)
- Task: facts where record_json.type == "ao_sense_task_v1"
- Receipt: facts where record_json.type == "ao_sense_receipt_v1"
- Receipt references task: receipt.record_json.task_id == task.record_json.task_id
- Unclaimed task: no receipt exists for the task_id

Return rule (frozen)
- Return exactly one task: the unclaimed task with maximal AO_SENSE_TASK_v1.created_at_ts
- If none exists: return HTTP 204 No Content

Sorting anchor (frozen)
- Use record_json.created_at_ts as the primary ordering key.
- facts.occurred_at may drift in future; created_at_ts is the contract-level anchor.

2) Executor audit without Task/Receipt contract change

Executor identity is recorded as new evidence via marker_v1, not as fields on Receipt.

Frozen encoding (Sprint 4)
- Use existing POST /api/marker, without changing marker contract.
- Marker.note MUST start with prefix: "AO_SENSE_EXECUTION "
- Suffix MUST be a compact JSON object containing:
  - executor_kind: "human" | "device"
  - executor_id: string
  - task_id: string

Receipt evidence linkage
- AO_SENSE_RECEIPT_v1.evidence_refs MUST include:
  { kind: "marker_v1", ref_id: "<marker_fact_id>" }

3) Acceptance update (Sprint 4)
- scripts/ACCEPTANCE_APPLEIII_AOSENSE.ps1 MUST assert:
  1) next_task returns the created task before receipt exists.
  2) after receipt is created, next_task returns 204.