# GEOX Commercial Evidence Demo v1

Status: **OFF-MAIN COMMERCIAL DEMO — NOT PRODUCTION AUTHORITY**

This is a standalone CEO-facing Commercial Evidence Demo. It packages the six requested evidence items without registering a new route in the GEOX production Server or Operator application and without modifying MCFT-CAP-09 authority, scheduler, persistence, provider, schema, or Formal state.

## 1. One concrete problem

GEOX prevents an agricultural decision system from treating evidence that was not actually knowable at decision time as if it had been known.

The flagship comparison intentionally keeps the exact rainfall / ET0 values equal and changes only availability chronology:

```text
decision boundary T = 12:00
exact interval = (11:00, 12:00]
rainfall = 0.8 mm
historical ET0 = 0.13 mm

Case A available_to_runtime_at = 12:00
Case B available_to_runtime_at = 12:20
```

Case A may be exact provider forcing at T. Case B is not part of the T knowledge state even though the observation describes a historical interval.

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

The Commercial Evidence trace is presented as:

```text
Evidence → State → Forecast → Scenario → Runtime decision boundary
```

## 3. Real Runtime demo

`tools/commercial-evidence-demo/packet.ts` imports and executes the existing canonical MCFT-CAP-09 selector:

```text
apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts
```

The demo does not reimplement this selector in browser JavaScript and does not hardcode its PASS/FAIL outcome.

The deterministic cases prove:

```text
exact provider pair available at T
→ EXACT_PROVIDER_INTERVAL_PAIR
→ HEALTHY
→ CONTINUE

same exact payload available at T+20m + prior causal pair exists
→ PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
→ DEGRADED
→ ASSUMED / ASSUMED
→ DEGRADE_AND_CONTINUE

conflicting source identity
→ FAIL_CLOSED

no exact pair and no causal prior
→ AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR
→ FAIL_CLOSED
```

Every `/api/demo` request recomputes these cases through the canonical selector and surfaces the selector's real `selection_hash`.

## 4. Complete Decision Trace

The demo now provides two trace levels.

### 4.1 Default Runtime Value Trace — no database required

The standalone server executes the repository's existing:

```text
scripts/governance_acceptance/TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs
```

That acceptance loads and runs the existing Twin Kernel TypeScript builders and constructs:

```text
field_state_snapshot_v1
→ forecast_run_v1
→ scenario_set_v1
→ calibration_replay_v1
→ forecast_error_v1
→ field_learning_candidate_v1
→ decision_cycle_v1
```

It runs the builder chain twice and requires a stable deterministic fingerprint. The microsite calls `/api/runtime-value-trace`, displays all seven real object IDs and determinism hashes, and summarizes the resulting State, 7-day Forecast, Scenario count, and Decision stage.

The trace objects are not embedded in `index.html` or `app.js`.

### 4.2 Optional stronger proof — persisted readback

When a real persisted `decision_cycle_id` is supplied, the microsite proxies the existing read-only endpoint:

```text
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

It displays the persisted chain's object IDs and determinism hashes and links to the existing Operator Twin Trace page.

`scripts/commercial_evidence/PREPARE_COMMERCIAL_EVIDENCE_TRACE_V1.cjs` can reuse the existing TK10 persisted Runtime chain in a controlled environment and print the exact demo URL containing its real `decision_cycle_id`.

## 5. Three failure cases

### Provider late

The exact provider pair has the same numerical payload as the healthy case but is available only at `T+20m`.

At snapshot T, GEOX excludes it and uses an already causal prior assumption pair:

```text
forcing_mode = PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
runtime_health = DEGRADED
precipitation_epistemic_class = ASSUMED
et0_epistemic_class = ASSUMED
provider_wait_required = false
completed_tick_retroactive_rewrite_authorized = false
```

### Source conflict

Two records share a source identity but carry conflicting source hashes / values. The real selector fails closed rather than choosing one.

### Missing evidence

With neither an exact provider pair nor a prior causal assumption pair, the real selector raises:

```text
AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR
```

No invented current-interval forcing is authorized.

## 6. Fail closed / degrade / continue

The demo presents the governed behavior matrix:

```text
exact evidence valid and available by T      → CONTINUE
provider late + causal prior exists           → DEGRADE + CONTINUE
State valid / Forecast prerequisite missing   → BLOCK FORECAST + CONTINUE STATE
no causal current-interval forcing            → FAIL CLOSED
source identity conflict                      → FAIL CLOSED
late exact evidence later arrives             → APPEND FORWARD / NO RETROACTIVE REWRITE
```

## Run

From repository root:

```powershell
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

Open:

```text
http://127.0.0.1:4177
```

The default demo needs no database and no provider connection. It executes the pure Amendment-19 selector plus the existing Twin Kernel Runtime Value Trace builders.

Optional environment variables:

```text
COMMERCIAL_EVIDENCE_DEMO_PORT=4177
GEOX_BASE_URL=http://127.0.0.1:3001
GEOX_OPERATOR_BASE_URL=http://127.0.0.1:5173
```

## Optional persisted trace preparation

Only use a controlled GEOX environment with the TK10 migrations and source-index rows prepared. Do not target a production database.

```powershell
node scripts/commercial_evidence/PREPARE_COMMERCIAL_EVIDENCE_TRACE_V1.cjs
```

The script prints:

```text
commercial_evidence_demo_url = http://127.0.0.1:4177/?decision_cycle_id=<real-persisted-id>
operator_trace_url = <existing GEOX Operator Twin Trace URL>
```

## Acceptance

```powershell
node scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
```

The acceptance requires all of the following:

```text
six Commercial Evidence Pack sections present
canonical Amendment-19 selector actually executed
provider late = DEGRADE_AND_CONTINUE
source conflict = FAIL_CLOSED
missing evidence = FAIL_CLOSED
existing Twin Kernel Runtime Value Trace builders actually executed
complete 7-object trace built
determinism stable
forbidden automatic writes absent
provider request count = 0
database write count = 0
canonical Runtime write count = 0
Formal effect = false
```

The PR-only workflow `.github/workflows/commercial-evidence-demo-v1.yml` runs this acceptance with read-only GitHub permissions and deliberately has no privileged Runtime trigger or secret/database/provider binding.

## Repository boundary

This branch changes only:

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
CONTROLLED_RUNTIME_VALUE_TRACE_IS_NOT_PERSISTED_PRODUCTION_STATE
NO_MCFT_CAP09_COMPLETION_CLAIM
NO_FORMAL_O00_O23_CLAIM
NO_AUTONOMOUS_RECOMMENDATION_OR_DISPATCH
NO_RETROACTIVE_TICK_REWRITE
```
