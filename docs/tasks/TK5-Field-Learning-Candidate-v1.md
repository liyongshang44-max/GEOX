# docs/tasks/TK5-Field-Learning-Candidate-v1.md

# TK5 — Field Learning Candidate v1

TK5 introduces the next formal Twin Kernel object:

- `field_learning_candidate_v1`

This task converts formal TK4 error evidence into a deterministic learning candidate. It does not write formal Field Memory, does not update a model, does not write ROI, does not create a decision cycle, does not create recommendations, does not request approval, and does not create execution tasks.

## Position in the original Twin Kernel line

Original task line:

```text
TK0 → TK1 → TK2 → TK3 → TK4 → TK5 → TK6
```

Current position:

```text
TK0 ✅ Twin Kernel Preflight
TK1 ✅ field_state_snapshot_v1
TK2 ✅ forecast_run_v1
TK3 ✅ scenario_set_v1
TK4 ✅ calibration_replay_v1 + forecast_error_v1
TK5 ⬅️ field_learning_candidate_v1 → formal Field Memory
TK6 未开始：decision_cycle_v1 / human-in-the-loop loop
```

## Input boundary

TK5 may read only formal Twin Kernel objects from prior stages:

- `calibration_replay_v1`
- `forecast_error_v1`

TK5 may also accept formal gate references in the request payload, such as acceptance, post-irrigation verification, or formal evidence references. TK5 must not read raw telemetry directly.

## H58 boundary

H58 defines the formal Field Memory lane. TK5 must not bypass it.

Formal Field Memory remains available only through:

```text
POST /api/v1/field-memory/from-acceptance
```

TK5 can mark a candidate as formal-gate-ready, but it must not create formal Field Memory. Only the H58 formal lane can write `FORMAL_FIELD_MEMORY`, `FORMAL_ACCEPTED`, `customer_visible_memory=true`, and `learning_eligible=true`.

## Output object

`field_learning_candidate_v1` records a candidate agricultural learning statement derived from observed forecast error.

Minimum fields:

- `field_learning_candidate_id`
- `calibration_replay_id`
- `forecast_error_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `as_of_ts`
- `candidate_status`
- `learning_scope`
- `learning_statement_json`
- `supporting_evidence_refs_json`
- `counter_evidence_refs_json`
- `confidence_json`
- `formal_gate_refs_json`
- `h58_gate_status_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

## TK5 scope

The first version supports only water-response learning candidates derived from TK4 forecast error.

A candidate must answer:

- what might be learned
- which forecast error supports it
- which evidence references support it
- which counter-evidence or missing evidence weakens it
- whether it is ready for the H58 formal Field Memory gate

## Hard boundaries

TK5 must not:

- write formal Field Memory
- call `POST /api/v1/field-memory/from-acceptance`
- write ROI records
- write `decision_cycle_v1`
- mutate `forecast_run_v1`
- mutate `scenario_set_v1`
- mutate `calibration_replay_v1`
- mutate `forecast_error_v1`
- update model parameters
- create recommendations
- create approvals
- create operation plans
- create AO-ACT tasks
- create `/api/v1/actions/*` tasks
- create execution receipts

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK5_FIELD_LEARNING_CANDIDATE_V1_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
acceptance = TK5_FIELD_LEARNING_CANDIDATE_V1_ACCEPTANCE
field_learning_candidate_v1_present = true
formal_field_memory_write_missing = true
decision_cycle_v1_missing = true
no_forbidden_writes = true
```

## Done

TK5 is done when the repository has a schema migration, deterministic builder, registered routes, and acceptance proving that `field_learning_candidate_v1` exists without creating formal Field Memory, ROI, decision cycles, recommendations, approvals, or execution tasks.
