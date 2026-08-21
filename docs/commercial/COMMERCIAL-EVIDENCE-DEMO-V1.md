# GEOX Commercial Evidence Demo v1

Status: **OFF-MAIN COMMERCIAL DEMO — NOT PRODUCTION AUTHORITY**

This is a standalone CEO-facing Commercial Evidence Demo. It packages the six requested evidence items without registering a new route in the GEOX production Server or Operator application and without modifying MCFT-CAP-09 authority, scheduler, persistence, provider, schema, or Formal state.

## CEO default presentation path

The default page is deliberately compressed into a four-screen, roughly 60-second commercial proof:

```text
1. Problem
   decision-time unknowable evidence must not be represented as known

2. Causality proof
   same payload + different availability chronology
   -> different governed epistemic/runtime outcome

3. Persisted trace
   historical Neon qualification evidence
   -> Evidence -> State -> Forecast -> Scenario -> Health -> Checkpoint

4. Governed behavior
   CONTINUE / DEGRADE + CONTINUE / FAIL CLOSED / APPEND FORWARD
```

The frozen architecture, deterministic failure cards, Product Twin Kernel Decision Trace, builder proof, explicit IDs and hashes remain available under **Engineering details**. They are not removed; they are intentionally secondary so a buyer does not have to parse internal engineering surfaces before understanding the commercial claim.

The top-level commercial translation is:

> GEOX lets agricultural automation, AI decisions, and agronomic recommendations prove what evidence was used, what evidence was rejected, and why the resulting computation was authorized at that point in time.

The demo has three deliberately separate evidence surfaces:

```text
Canonical Runtime causality proof
Historical MCFT Runtime evidence from Neon
Product Twin Kernel Decision Trace
```

They are not relabeled as one another.

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

The page retains the frozen GEOX Runtime path under the Engineering evidence appendix:

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

The executive view emphasizes the causal experiment itself: **same payload, only availability changes, and the governed claim changes with it**. The hash and selector identity remain inspectable but are not the visual headline.

## 4. Complete Decision Trace

The default executive trace is the historical MCFT Neon read model. Product and builder trace surfaces remain under Engineering details because they have different authority boundaries.

### 4.1 Historical MCFT Runtime Evidence — Neon

`GET /api/mcft-runtime-evidence` is a standalone Demo-server route that can read one explicitly allowlisted historical database:

```text
geox_mcft_cap09_s6_accel24t_am19_v3
```

Configuration is server-side only:

```text
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected Neon PostgreSQL URL ending in /geox_mcft_cap09_s6_accel24t_am19_v3>
```

The browser never receives this connection string. The server rejects any other database name with `MCFT_DATABASE_NOT_ALLOWLISTED`, starts `BEGIN READ ONLY`, applies a short statement timeout, executes fixed SELECT statements only, and rolls the transaction back before closing the connection. No caller-supplied SQL, table, database, or write method is accepted.

The read model exposes the latest persisted qualification chain:

```text
Evidence Window
→ selected/rejected evidence chronology
→ current-interval forcing authority
→ State
→ Forecast
→ Scenario
→ Runtime Health
→ Checkpoint
```

This is **PERSISTED ENGINEERING QUALIFICATION** evidence: the runtime objects and facts were actually persisted in Neon. It is not production-live field data. The accelerated Amendment-19 weather / ET0 evidence in this database explicitly contains `ENGINEERING_FIXTURE_ONLY` and `NOT_FORMAL_EXTERNAL_EVIDENCE` limitations. Therefore the UI must retain all of these nonclaims:

```text
NOT_PRODUCTION_LIVE_DATA
NOT_FORMAL_EXTERNAL_EVIDENCE_AS_A_WHOLE
NOT_FINAL_MCFT_CAP09_FORMAL_O00_O23_CLOSURE
ENGINEERING_FIXTURE_PRESENT_IN_ACCELERATED_QUALIFICATION
```

This database is historical and completed. The Demo must not read from or write to the current fresh/Formal databases used by the final wall-clock time-chain qualification.

The buyer-facing interpretation immediately after this trace is:

> GEOX knows what was actually knowable at the boundary, excludes evidence that was not, degrades explicitly when necessary, and continues only computations still authorized by the resulting evidence state.

### 4.2 Connected Product Decision Trace — persisted GEOX read model

This surface is collapsed under **Engineering details** by default.

When the local/controlled GEOX Server has eligible `decision_cycle_v1` data, the Demo calls:

```text
GET /api/v1/twin-kernel/operator-workflow/decision-cycles
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

The microsite displays the persisted seven-object Product Twin Trace. If that product read model is unavailable, it shows `DISCONNECTED`; it does not substitute builder output and call it persisted data. Because this state can legitimately be disconnected while the MCFT Neon evidence is connected, hiding it in Engineering details prevents a buyer from misreading two separate authority surfaces as one contradictory connection state.

### 4.3 Runtime Value Trace — no database required

This surface is also collapsed under **Engineering details** by default.

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

It runs the builder chain twice and requires a stable deterministic fingerprint. This surface is an engineering proof and is not described as persisted production state.

### 4.4 Explicit persisted Product Trace readback

This surface is also collapsed under **Engineering details** by default.

When a real persisted `decision_cycle_id` is supplied, the microsite proxies the existing read-only endpoint:

```text
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

It displays the persisted chain's object IDs and determinism hashes and links to the existing Operator Twin Trace page.

`scripts/commercial_evidence/PREPARE_COMMERCIAL_EVIDENCE_TRACE_V1.cjs` can reuse the existing TK10 persisted Runtime chain in a controlled environment and print the exact demo URL containing its real `decision_cycle_id`.

## 5. Three failure cases

The failure cards remain in the Engineering evidence appendix; the executive page instead summarizes the governed behavior matrix.

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

The demo presents the governed behavior matrix as the fourth executive screen:

```text
exact evidence valid and available by T      → CONTINUE
provider late + causal prior exists          → DEGRADE + CONTINUE
State valid / Forecast prerequisite missing  → BLOCK FORECAST + CONTINUE STATE
no causal current-interval forcing           → FAIL CLOSED
source identity conflict                     → FAIL CLOSED
late exact evidence later arrives            → APPEND FORWARD / NO RETROACTIVE REWRITE
```

## Evidence boundary

The page no longer ends with a visually dominant negative disclaimer. It ends with an **Evidence boundary** statement and keeps the exact machine-readable nonclaims inspectable underneath it.

The semantic boundary has not changed:

```text
Persisted engineering qualification evidence
!= production live evidence
!= final Formal O00–O23 closure
!= autonomous recommendation or dispatch authority
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

The canonical selector and builder trace need no database. The historical Neon panel stays safely disconnected until its server-side read URL is configured.

Optional environment variables:

```text
COMMERCIAL_EVIDENCE_DEMO_PORT=4177
GEOX_BASE_URL=http://127.0.0.1:3001
GEOX_OPERATOR_BASE_URL=http://127.0.0.1:5173
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected historical-v3 Neon URL>
```

Do not place `COMMERCIAL_EVIDENCE_MCFT_READ_URL` in browser JavaScript, HTML, checked-in `.env` files, PR text, CI workflow literals, or logs.

## Optional persisted Product Trace preparation

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
six Commercial Evidence Pack sections still present
CEO default path contains Problem / Causality proof / Persisted trace / Governed behavior
engineering surfaces remain available but secondary
canonical Amendment-19 selector actually executed
provider late = DEGRADE_AND_CONTINUE
source conflict = FAIL_CLOSED
missing evidence = FAIL_CLOSED
existing Twin Kernel Runtime Value Trace builders actually executed
complete 7-object trace built
determinism stable
forbidden automatic writes absent
historical Neon endpoint and allowlist guard present
historical Neon transaction explicitly READ ONLY
CI requires no Neon secret and tests safe disconnected behavior
provider request count = 0
database write count = 0
canonical Runtime write count = 0
Formal effect = false
```

The PR-only workflow `.github/workflows/commercial-evidence-demo-v1.yml` runs this acceptance with read-only GitHub permissions and deliberately has no privileged Runtime trigger or secret/database/provider binding. CI does not connect to Neon.

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
protected main
apps/server production route registration
apps/web Operator route registration
MCFT-CAP-09 authority documents
scheduler / lease / fencing
persistence schema
provider adapters
current fresh/Formal database state
final wall-clock time-chain qualification
```

## Hard nonclaims

```text
COMMERCIAL_DEMO_IS_NOT_PRODUCTION_RUNTIME_AUTHORITY
CONTROLLED_DEMO_INPUT_IS_NOT_FORMAL_EXTERNAL_EVIDENCE
CONTROLLED_RUNTIME_VALUE_TRACE_IS_NOT_PERSISTED_PRODUCTION_STATE
HISTORICAL_NEON_QUALIFICATION_IS_NOT_PRODUCTION_LIVE_DATA
HISTORICAL_NEON_QUALIFICATION_IS_NOT_FINAL_FORMAL_CLOSURE
NO_MCFT_CAP09_COMPLETION_CLAIM
NO_FORMAL_O00_O23_CLAIM
NO_AUTONOMOUS_RECOMMENDATION_OR_DISPATCH
NO_RETROACTIVE_TICK_REWRITE
```
