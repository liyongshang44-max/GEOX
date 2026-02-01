# GEOX · Sprint 17
# Apple III · AO-ACT Executor Adapter v0 (Implementation-only)

Status
- Implementation-only: adds manual executor adapters (scripts), plus acceptance.
- No new governance: does not modify AO-ACT v0 contracts/schemas or downstream read boundaries.

Goal
Provide the missing middle: task → executor → receipt, as a manual adapter that can be run by a human operator or a supervised process.

Non-goals (hard boundaries)
- No scheduler: no prioritization, no retry logic, no concurrency model, no backoff, no timeouts, no skipping policy, no “best task” logic.
- No server-side autostart: no docker compose service, no pm2, no background daemon in apps/server.
- No new action types, no new schema fields, no contract edits.
- No ProblemState auto-trigger chain.

Artifacts introduced (new files only)
- scripts/ao_act_executor/ao_act_executor_sim_v0.cjs
- scripts/ao_act_executor/ao_act_executor_device_v0.cjs
- scripts/ao_act_executor/device_gateway_stub_v0.cjs
- scripts/ao_act_executor/receipt_builder_v0.cjs
- scripts/ao_act_executor/ao_act_client_v0.cjs
- scripts/ACCEPTANCE_AO_ACT_EXECUTOR_V0.ps1
- scripts/ACCEPTANCE_AO_ACT_EXECUTOR_V0_RUNNER.cjs

Execution modes
1) Sim executor (deterministic)
- Input: explicit task selector (preferred): --taskFactId <fact_id> or --actTaskId <act_task_id>
- Behavior: builds ao_act_receipt_v0 with observed_parameters := task.parameters

2) Device executor (stubbed device gateway)
- Input: explicit task selector (preferred): --taskFactId <fact_id> or --actTaskId <act_task_id>
- Behavior: calls a device gateway (/execute) to obtain observed_parameters, then writes ao_act_receipt_v0
- This repo includes a local stub to simulate the gateway; it is not a registry and not a governance asset.

Selection discipline (anti-scheduler)
- Preferred mode: explicit task execution only.
  - The adapter executes exactly the specified task and exits.
- Demo-only convenience: --once
  - If no explicit selector is provided, --once selects the first index row that has no latest receipt (index order), writes exactly one receipt, and exits.
  - This is explicitly not scheduling and must not grow new “selection strategy” knobs.

APIs used (negative guard)
The adapters and acceptance only use three AO-ACT endpoints:
- POST /api/control/ao_act/task
- POST /api/control/ao_act/receipt
- GET  /api/control/ao_act/index

How to run (manual)
Prereq: apps/server is running and reachable (GEOX_BASE_URL).

Sim executor
- node scripts/ao_act_executor/ao_act_executor_sim_v0.cjs --baseUrl http://localhost:3000 --taskFactId <fact_id>

Device executor with stub gateway
- node scripts/ao_act_executor/device_gateway_stub_v0.cjs --port 18080
- node scripts/ao_act_executor/ao_act_executor_device_v0.cjs --baseUrl http://localhost:3000 --deviceGatewayUrl http://127.0.0.1:18080 --taskFactId <fact_id>

Acceptance
- powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ACCEPTANCE_AO_ACT_EXECUTOR_V0.ps1

Notes on determinism
- The adapters avoid randomness in observed_parameters:
  - sim: observed_parameters is a deterministic mapping from task.parameters
  - device: observed_parameters comes from the device gateway response; the included stub echoes task.parameters
- Receipt payload fields are strictly limited to those already required by the server route schema.
