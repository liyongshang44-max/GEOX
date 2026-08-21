# GEOX Commercial Evidence Demo v1

Status: **OFF-MAIN COMMERCIAL DEMO — NOT PRODUCTION AUTHORITY**

This microsite packages six CEO-facing evidence items without registering any new route in the GEOX production Server or Operator application.

## 1. The one problem

GEOX prevents an agricultural decision system from treating evidence that was not actually knowable at decision time as if it had been known.

The demo is deliberately centered on one temporal-causality contrast:

```text
decision boundary T = 12:00
exact rainfall / ET0 interval ends at 12:00
payload values are the same in both cases

Case A availability = 12:00
Case B availability = 12:20
```

Case A is eligible exact provider forcing. Case B is not part of the 12:00 knowledge state even though its event interval is historical by 12:20.

## 2. Real architecture

The page shows the frozen GEOX Runtime path:

```text
Reality / Evidence
→ Evidence Window
→ Pure Domain Model
→ Runtime Orchestrator
→ Canonical append-only Facts
→ Rebuildable Projections
→ Read-only Operator APIs
→ Operator Runtime
```

The sales trace is presented as:

```text
Evidence → State → Forecast → Scenario → Runtime decision boundary
```

## 3. Real runtime demo

`tools/commercial-evidence-demo/packet.ts` imports and executes the existing canonical selector:

```text
apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts
```

The demo does not reimplement the selector in JavaScript and does not hardcode a fake PASS result.

The controlled cases prove:

- exact provider pair available at T → `CONTINUE / HEALTHY`;
- same exact payload available after T, prior causal assumption exists → `DEGRADE_AND_CONTINUE / ASSUMED`;
- conflicting source identity → `FAIL_CLOSED`;
- no exact pair and no causal prior → `FAIL_CLOSED`.

Every `/api/demo` request recomputes the cases through the canonical selector and exposes its real `selection_hash`.

## 4. Complete persisted decision trace

The microsite never fabricates State / Forecast / Scenario / Decision objects.

For the full persisted trace, it proxies the existing read-only endpoint:

```text
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

The expected persisted chain is:

```text
field_state_snapshot_v1
→ forecast_run_v1
→ scenario_set_v1
→ calibration_replay_v1
→ forecast_error_v1
→ field_learning_candidate_v1
→ decision_cycle_v1
```

The page displays persisted object IDs and determinism hashes, then links to the existing GEOX Twin Trace page for full inspection.

## 5. Three failure cases

### provider late

The exact provider pair has the same numerical payload as the healthy case, but `available_to_runtime_at = T+20m`.

At snapshot T, GEOX excludes it and uses an already causal prior assumption pair:

```text
forcing_mode = PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
runtime_health = DEGRADED
precipitation_epistemic_class = ASSUMED
et0_epistemic_class = ASSUMED
provider_wait_required = false
retroactive_rewrite = false
```

### source conflict

Two rows share one source identity but carry different hashes / values. The real selector fails closed rather than choosing a winner.

### missing evidence

With neither an exact provider pair nor a prior causal assumption pair, the real selector raises:

```text
AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR
```

No State write is authorized by the demo.

## 6. Fail closed / degrade / continue

The page contains a compact policy matrix:

```text
exact evidence timely                      → CONTINUE
provider late + causal prior               → DEGRADE + CONTINUE
State valid / Forecast prerequisite missing → BLOCK FORECAST + CONTINUE STATE
no causal current-interval forcing         → FAIL CLOSED
source identity conflict                   → FAIL CLOSED
late exact evidence later arrives          → APPEND FORWARD, NO RETROACTIVE REWRITE
```

## Run the demo without a persisted trace

From repository root:

```powershell
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

Open:

```text
http://127.0.0.1:4177
```

The temporal causality, provider-late, source-conflict and missing-evidence cases work without a database or provider connection because they execute the pure canonical selector over controlled deterministic demo inputs.

## Prepare and attach a real persisted Twin Trace

Prerequisites:

- a controlled GEOX server is running;
- the TK10 source-index rows and migrations exist in that controlled environment;
- do not point this preparation command at a production database.

Run:

```powershell
node scripts/commercial_evidence/PREPARE_COMMERCIAL_EVIDENCE_TRACE_V1.cjs
```

It executes the existing TK10 persisted runtime acceptance, reads the resulting `decision_cycle_id`, and prints a URL shaped as:

```text
http://127.0.0.1:4177/?decision_cycle_id=<persisted-id>
```

The microsite then reads the persisted trace through the existing read-only trace API.

Optional environment variables:

```text
GEOX_BASE_URL=http://127.0.0.1:3001
GEOX_OPERATOR_BASE_URL=http://127.0.0.1:5173
COMMERCIAL_EVIDENCE_DEMO_PORT=4177
COMMERCIAL_EVIDENCE_DEMO_URL=http://127.0.0.1:4177
```

## Acceptance

```powershell
node scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
```

This acceptance:

- invokes the canonical selector selftest through `tsx`;
- proves the provider-late behavior is `DEGRADE_AND_CONTINUE`;
- proves source conflict and missing evidence are `FAIL_CLOSED`;
- verifies all six evidence-pack sections exist;
- verifies the microsite only uses GET surfaces;
- verifies provider/database/canonical write counts are zero for the selector demo.

The PR-only workflow `.github/workflows/commercial-evidence-demo-v1.yml` runs this acceptance with read-only GitHub permissions and deliberately has no `push`, `schedule`, `workflow_dispatch`, `workflow_run`, secrets, DB binding, R2 binding, provider binding, or Formal trigger.

## Repository boundary

This v1 intentionally changes only:

```text
tools/commercial-evidence-demo/**
scripts/commercial_evidence/**
docs/commercial/**
.github/workflows/commercial-evidence-demo-v1.yml
```

It does not modify:

```text
apps/server production route registration
apps/web Operator route registration
MCFT-CAP-09 authority documents
scheduler / lease / fencing
persistence schema
provider adapters
Formal database state
```

## Hard nonclaims

```text
COMMERCIAL_DEMO_IS_NOT_PRODUCTION_RUNTIME_AUTHORITY
CONTROLLED_DEMO_INPUT_IS_NOT_FORMAL_EXTERNAL_EVIDENCE
NO_MCFT_CAP09_COMPLETION_CLAIM
NO_FORMAL_O00_O23_CLAIM
NO_AUTONOMOUS_RECOMMENDATION_OR_DISPATCH
NO_RETROACTIVE_TICK_REWRITE
```
