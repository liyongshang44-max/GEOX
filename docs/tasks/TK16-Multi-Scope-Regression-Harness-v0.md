# docs/tasks/TK16-Multi-Scope-Regression-Harness-v0.md

## Purpose

TK16 adds a multi-scope regression harness for the completed Twin Kernel v1 runtime chain.

The harness verifies that the production ingestion, operator workflow, explicit formalization, and trace readback surfaces continue to compose without changing Twin Kernel semantics.

TK16 is a regression task only.

## Scope

TK16 adds:

```text
scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs
docs/tasks/TK16-Multi-Scope-Regression-Harness-v0.md
```

TK16 does not add a migration, route, UI page, domain object, or new state-machine stage.

## Runtime chain under test

For each configured field learning candidate, the harness runs:

```text
POST /api/v1/twin-kernel/production-ingestion/source-refs
GET  /api/v1/twin-kernel/operator-workflow/decision-cycles
POST /api/v1/twin-kernel/operator-workflow/sessions
POST /api/v1/twin-kernel/operator-workflow/reviews
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/roi
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory
GET  /api/v1/twin-kernel/traces/:decision_cycle_id
```

## Candidate configuration

The default candidate list is:

```text
flc_c23a3ace34c48ce59c205110
```

Additional candidates may be supplied by environment variable:

```powershell
$env:TK16_FIELD_LEARNING_CANDIDATE_IDS="flc_one,flc_two,flc_three"
```

The harness treats every candidate as an independent scope fixture.

## Regression guarantees

For each candidate, the harness verifies:

```text
production_ingestion_event_v0 is written
production refs are mapped into decision_cycle_v1.external_refs_json
operator queue sees the decision cycle before formalization
operator_session_v0 is written
operator_decision_review_v0 is written
operator ROI action writes roi_entry_v1
operator Field Memory action writes field_memory_v1
trace reaches CALIBRATED after explicit operator formalization
ROI_FORMALIZATION_MISSING is cleared
FORMAL_FIELD_MEMORY_MISSING is cleared
H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL remains visible
forbidden_auto_writes_absent remains true
model_updated remains false
automatic recommendation, approval, task, receipt, acceptance, ROI, Field Memory remain false
scope refs do not cross between fixture cases
```

## Boundary

TK16 does not create new product behavior.

TK16 does not mutate route semantics.

TK16 does not add production ROI computation.

TK16 does not add production Field Memory policy.

TK16 does not change the trace read model.

TK16 does not make Twin Kernel autonomous.

## Acceptance command

```powershell
node scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs
```

Runtime preconditions:

1. API server is running.
2. TK1 through TK15 migrations are applied.
3. TK13, TK14, and TK15 routes are registered.
4. At least one configured `field_learning_candidate_id` exists.

## Expected result

The script must return:

```json
{
  "ok": true,
  "acceptance": "TK16_MULTI_SCOPE_REGRESSION_HARNESS"
}
```

The final `next_step` is:

```text
TK17_PRODUCTION_UX_V0
```
