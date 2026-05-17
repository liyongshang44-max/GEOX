# Formal Scenario Artifact / Persistence Strategy V1

## Status and scope

This document defines the P0.6 close-out artifact strategy for Formal Scenario Kernel outputs and the P0.7 decision boundary.

`runFormalScenarioKernelV1(...)` currently operates as an in-memory driver kernel and returns:

- `run`
- `fixture`
- `manifest`
- `verify`
- `api_snapshots` (inside manifest)

At **P0.6-post M1 (2026-05-17)**, persistence strategy is selected as **JSON artifacts** and dev/internal persistence endpoints are introduced.
At **P0.7 planning gate**, this M1 path can either continue or migrate to facts/tables with compatibility readers.

---

## 1) How CLI gate manifest / verify / snapshots are saved

### P0.6 (current)

- CLI acceptance/gate scripts must emit final JSON to stdout.
- The JSON must include:
  - `run`
  - `manifest`
  - `verify`
  - `manifest.api_snapshots`
- CI logs are the temporary artifact carrier for P0.6 diagnosis.

### P0.6-post M1 selected strategy (implemented)

Persist artifacts per `run_id` under repo/runtime workspace:

- `.geox/formal_scenario_runs/<run_id>/manifest.json`
- `.geox/formal_scenario_runs/<run_id>/verify.json`
- `.geox/formal_scenario_runs/<run_id>/snapshots.json`
- optional: `.geox/formal_scenario_runs/<run_id>/run.json`

---

## 2) How Flight Table run associates with FormalScenarioRunV1

- Association key: **`run_id`** (FormalScenarioRunV1 `run_id`, prefix `fsr_`).
- Flight Table run may store a reference field such as:
  - `formal_scenario_run_id` (nullable in P0.6)
- P0.6 does **not** require replaying or reloading Formal Scenario artifacts from Flight Table.
- P0.7 should define read-path contract for diagnostic/replay tooling using that `run_id` link.

---

## 3) Artifact storage options: JSON files, facts, or dedicated table

Three options are explicitly recognized:

1. **JSON artifacts (short/mid-term default)**
   - Fastest to implement and debug.
   - Suitable for CI + local replay.
2. **facts stream (domain event style)**
   - Better auditability, but schema/query complexity is higher.
3. **dedicated tables (e.g. `formal_scenario_run_v1` + children)**
   - Best queryability and lifecycle controls in production-like environments.

### Decision policy

- P0.6: do not block release on full persistence.
- P0.7: must select one of the above as **official persistence path** (JSON-only transitional mode is allowed if explicitly approved).

---

## 4) Customer report access policy

Formal Scenario artifacts are **internal governance/dev artifacts**.

- They are **NOT** part of customer report formal chain.
- They must **NOT** be exposed via customer-facing report APIs.
- Only dev/governance/operator-internal surfaces may access them under strict scopes.

---

## 5) Artifact lifecycle and cleanup

Recommended lifecycle policy:

- Default retention:
  - local/dev CI artifacts: 7–30 days
  - shared integration env artifacts: 30–90 days
- Cleanup triggers:
  - periodic TTL cleanup job
  - manual cleanup by run_id prefix/range
  - environment reset hooks
- Cleanup must delete all per-run files/rows consistently:
  - run
  - manifest
  - verify
  - snapshots

---

## 6) run_id as correlation key

Yes. `run_id` is the canonical correlation key across:

- kernel return payload
- CLI output artifact bundle
- Flight Table reference field (`formal_scenario_run_id`)
- optional DB/file persistence path

No alternate primary correlation key should be introduced before P0.7 design review.

---

## 7) Snapshot payload and redaction

`api_snapshots` may include request/response payloads for diagnosis, but must follow redaction policy:

- never persist raw credentials/secrets/tokens/private keys
- mask sensitive fields before persistence/logging
- apply payload size cap/truncation for oversized bodies
- preserve enough fields for reproducibility of failures

Minimum recommended fields:

- `snapshot_id`
- `method`
- `path`
- `status_code`
- `ok`
- `created_at`
- redacted `request`
- redacted `response`

---

## Implementation phases

### Short-term (P0.6 close)

- Keep kernel in-memory behavior.
- Keep CLI stdout artifact output as baseline.
- Flight Table integrates shared lane definitions only (no mandatory formal-run replay).

### Mid-term (P0.7)

- Add persisted artifact bundle per `run_id` under `.geox/formal_scenario_runs/`.
- Add internal read API or devtool loader for replay/diagnostics.
- Finalize redaction and retention defaults.

### Long-term

- Optional migration from JSON artifacts to facts or dedicated relational tables.
- Maintain backward-compatible readers during migration window.

---

## Acceptance alignment

This strategy explicitly states:

- P0.6 does **not** require complete persistence infrastructure.
- P0.7 must choose and commit to JSON artifact vs facts/table official strategy.
- Artifacts must not enter customer-report formal chain.


## M1 guardrails (implemented)

- Storage mode is fixed to `JSON_ARTIFACT_M1` for this phase.
- Write/read paths are dev-only endpoints under `/api/v1/dev/flight-table/...` and require `security.admin` scope.
- Artifacts are explicitly marked `customer_chain_eligible: false`.
- Customer/export APIs must not read these artifacts to form customer-visible conclusions.
