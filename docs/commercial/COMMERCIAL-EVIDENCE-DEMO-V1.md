# GEOX Commercial Evidence Demo v1

Status: **OFF-MAIN COMMERCIAL DEMO — NOT PRODUCTION AUTHORITY**

Commercial gate: **PASS_FOR_CUSTOMER_DISCOVERY**

This revision is the final customer-discovery / paid-pilot-preparation pass requested by CEO review. It does not claim `PASS_FOR_PAID_PILOT_SALES` by itself. Paid-pilot sales still require customer validation, customer economics, and the separately governed production/Formal qualification frontier.

The Demo remains a standalone read-only microsite. It does not register a new route in the GEOX production Server or Operator application and does not modify MCFT-CAP-09 authority, scheduler, lease/fencing, provider, persistence schema, current fresh/Formal database state, or final wall-clock qualification.

## CEO default presentation path

The default customer path is deliberately commercial rather than architectural:

```text
1. Real irrigation decision
   Field A / 19:00
   planned irrigation 20 mm          ASSUMPTION
   tomorrow-rain forecast 25 mm      ASSUMPTION
   question: IRRIGATE / DELAY / ABSTAIN?
   first GEOX question: was that forecast actually knowable at 19:00?

2. Look-alike A/B decision
   Case A: same 25 mm forecast, available_at 18:43 -> ELIGIBLE
   Case B: same 25 mm forecast, available_at 19:17 -> INELIGIBLE at 19:00

3. Real persisted Runtime evidence
   historical Neon qualification
   Evidence -> State -> Forecast -> Scenario -> Runtime qualification

4. Governed behavior + economic exposure + capability boundary
   CONTINUE / DEGRADE + CONTINUE / FAIL CLOSED / APPEND FORWARD
```

The 20 mm irrigation plan, 25 mm forecast, and Field A are **business explanation assumptions**, not a crop recommendation authority. They must never be represented as measured customer data or as production agronomic thresholds.

A real production irrigation recommendation would require authorized inputs including root-zone depletion, crop stage, forecast timing/amount, system capacity and other applicable agronomic/runtime authority. This Demo deliberately stops before claiming a production-qualified crop recommendation.

## The killer A/B explanation

The customer-facing example changes one thing only:

```text
Decision time: 19:00
Forecast content: tomorrow rain 25 mm

CASE A
available_at = 18:43
-> the forecast was actually knowable at 19:00
-> ELIGIBLE for the applicable downstream decision boundary

CASE B
available_at = 19:17
-> the forecast did not exist in the 19:00 knowledge state
-> INELIGIBLE as a 19:00-known fact
-> later truth cannot be retroactively relabeled as knowledge available at decision time
```

This A/B example is an explanatory business scenario. The machine-verifiable canonical experiment beneath it remains separate and executes the current-interval forcing selector with controlled engineering evidence; the Demo does not falsely claim that the 25 mm business scenario is itself an agronomic authority record.

## Interactive Runtime cases

The customer can click four cases:

```text
NORMAL
PROVIDER LATE
SOURCE CONFLICT
MISSING EVIDENCE
```

These are not static front-end cards. Every click issues a fresh `GET /api/demo?...` request. The standalone server rebuilds `buildCommercialEvidencePacketV1()`, which directly invokes:

```text
apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts
```

The deterministic outcomes are:

```text
NORMAL
exact provider pair available
-> HEALTHY
-> CONTINUE

PROVIDER LATE
exact pair not available at boundary + prior causal pair exists
-> PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
-> DEGRADED
-> DEGRADE_AND_CONTINUE
-> no provider wait
-> no retroactive tick rewrite

SOURCE CONFLICT
conflicting payload under the same source identity
-> FAIL_CLOSED
-> no qualified State/Scenario output

MISSING EVIDENCE
no exact pair and no causal prior
-> FAIL_CLOSED
-> no invented current-interval forcing
```

The UI exposes the exact subject SHA, canonical selector identity, case input, selector outcome, `selection_hash` or error code, and zero-side-effect boundary under **查看本次机器证据**.

## Machine-verifiable proof

The primary machine proof endpoint is:

```text
GET http://127.0.0.1:4177/api/demo
```

It returns a fresh packet built by the repository TypeScript code. Important fields include:

```text
runtime_context.subject_sha
runtime_context.canonical_selector_source
canonical_selector_contract_id
canonical_selection_policy_id
cases[].input
cases[].outcome
cases[].outcome.selection_hash / error_code
side_effects
```

The server route is read-only. The controlled canonical selector proof has:

```text
provider_request_count = 0
database_read_count = 0
database_write_count = 0
scheduler_write_count = 0
canonical_runtime_write_count = 0
recommendation_write_count = 0
approval_write_count = 0
action_write_count = 0
dispatch_write_count = 0
model_activation_write_count = 0
```

A second machine proof is the dedicated selftest:

```powershell
pnpm exec tsx tools/commercial-evidence-demo/selftest.ts
```

And the full acceptance is:

```powershell
node scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
```

## Persisted engineering qualification — Neon

`GET /api/mcft-runtime-evidence` reads one explicitly allowlisted historical database:

```text
geox_mcft_cap09_s6_accel24t_am19_v3
```

Configuration stays server-side:

```text
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected Neon PostgreSQL URL ending in /geox_mcft_cap09_s6_accel24t_am19_v3>
```

The browser never receives the URL. The server requires the exact allowlisted database, executes `BEGIN READ ONLY`, sets a short statement timeout, runs fixed SELECTs only, and rolls back before connection close.

This surface is **PERSISTED ENGINEERING QUALIFICATION**. The historical objects were actually persisted and can prove chronology, State, Forecast, Scenario, Health and Checkpoint behavior. The database also contains accelerated engineering fixture evidence, so it is not production-live evidence and not final Formal closure.

Required nonclaims remain:

```text
NOT_PRODUCTION_LIVE_DATA
NOT_FORMAL_EXTERNAL_EVIDENCE_AS_A_WHOLE
NOT_FINAL_MCFT_CAP09_FORMAL_O00_O23_CLOSURE
ENGINEERING_FIXTURE_PRESENT_IN_ACCELERATED_QUALIFICATION
```

The Commercial Demo must not read or write the current fresh/Formal qualification databases.

## Customer economics — exposure, not ROI

The Demo contains a browser-side exposure calculator. Its purpose is to ask the customer what one wrong irrigation decision could expose, not to manufacture ROI.

The default scenario values are explicitly tagged:

```text
Field area: 120 ha              ASSUMPTION
Planned irrigation: 20 mm       ASSUMPTION
```

Customer-entered monetary inputs are tagged:

```text
pumping $/mm/ha                 CUSTOMER_RATE_CARD
energy                          CUSTOMER_RATE_CARD
labor                           CUSTOMER_RATE_CARD
equipment                       CUSTOMER_RATE_CARD
```

The provenance vocabulary displayed by the Demo is:

```text
MEASURED
CUSTOMER_RATE_CARD
AGRONOMIC_MODEL
EXTERNAL_BENCHMARK
ASSUMPTION
```

The calculator computes only direct arithmetic from the displayed inputs. It does not use internal GEOX engineering cost constants as customer economics authority.

Yield and quality exposure remain:

```text
CUSTOMER DATA REQUIRED
```

The commercial conclusion remains:

```text
NOT_PROVEN_CUSTOMER_ROI
```

## Capability boundary

### PROVEN NOW

The Demo can truthfully show:

```text
Evidence chronology / as-of boundary
State propagation
Forecast
Scenario
Runtime qualification boundary
provenance / trace
degrade / fail-closed behavior
```

### NOT YET A COMMERCIAL CLAIM

The Demo must not claim:

```text
autonomous irrigation
unattended field actuation
production-qualified crop recommendation
proven customer ROI
```

The current MCFT / shadow-online qualification evidence is a prerequisite for later controlled action. It is not itself permission to operate a field actuator.

## Real architecture and Page → repo/runtime component mapping

The engineering appendix shows the customer-visible system path:

```text
Provider / Sensor
-> Raw / Canonical Evidence
-> As-of / Authority Boundary
-> Current-interval Forcing Selector
-> Canonical Runtime Core
-> State
-> Forecast
-> Scenario
-> Decision Boundary
-> Human Approval
-> [future controlled execution]
```

The mapping is constrained to real components:

| Page / architecture node | Repository/runtime component | Evidence role |
| --- | --- | --- |
| Reality / Provider / Sensor → Evidence | canonical facts + external evidence bindings | chronology, source identity, quality |
| As-of / Authority Boundary | `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md` | real availability / ingress chronology |
| Current-interval Forcing Selector | `apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts` | directly executed by `/api/demo` |
| Canonical Runtime Core / persistence | `apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts` | persistent State / Forecast / Scenario / Health / Checkpoint path |
| Canonical store | PostgreSQL `facts` | append-only canonical fact store |
| State | `twin_state_estimate_v1` | persisted posterior state |
| Forecast | `twin_forecast_run_v1` | persisted forecast run |
| Scenario | `twin_scenario_set_v1` | persisted scenario set |
| Scheduler | `twin_shadow_online_scheduler_slot_v1` | qualification scheduler projection |
| Health / recovery | `twin_runtime_health_v1` + `twin_runtime_checkpoint_v1` | degradation reason codes / continuation checkpoint |
| Product Twin Trace | `apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx` | read-only operator trace |
| Future controlled execution | **NOT YET A COMMERCIAL CLAIM** | current Demo stops before field actuation |

Persistence, scheduler, health/recovery and trace/provenance are also shown as side concerns.

Lease/fencing is intentionally described only as **current MCFT qualification governance not invoked or modified by this Demo**. No exact lease/fencing file path is invented on the sales page until independently verified from the repository. This is an intentional evidence-faithfulness constraint, not an omission to be filled with marketing text.

## Four CEO delivery artifacts

### 1. Demo URL / reproducible local startup

From the repository root:

```powershell
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

Open:

```text
http://127.0.0.1:4177
```

Optional protected historical Neon read model:

```text
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected historical-v3 Neon URL>
```

Never place that URL in HTML, browser JavaScript, PR text, checked-in `.env`, CI literals or logs.

### 2. Exact commit SHA

At presentation time:

```powershell
git rev-parse HEAD
```

The page itself reads the exact running subject SHA from the Demo server and exposes it under **查看机器证据标识** and each interactive machine proof.

### 3. Real machine trace / artifact

Use:

```text
GET /api/demo
```

for a live canonical selector trace, and:

```text
GET /api/mcft-runtime-evidence
```

for the historical persisted Neon qualification trace when the protected read URL is configured.

The dedicated GitHub Actions `Commercial Evidence Demo v1` acceptance run is the CI artifact for an exact PR head.

### 4. Page → repo/runtime component mapping

The engineering appendix renders the mapping table above in the live Demo. It intentionally separates:

```text
business explanation scenario
canonical selector machine proof
historical persisted MCFT Runtime evidence
Product Twin Kernel decision trace
```

These surfaces are not relabeled as one another.

## Run

```powershell
cd C:\Users\mylr1\GEOX
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

Open:

```text
http://127.0.0.1:4177
```

Optional environment variables:

```text
COMMERCIAL_EVIDENCE_DEMO_PORT=4177
GEOX_BASE_URL=http://127.0.0.1:3001
GEOX_OPERATOR_BASE_URL=http://127.0.0.1:5173
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected historical-v3 Neon URL>
```

## Acceptance

```powershell
node scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
```

Acceptance guards include:

```text
irrigation decision anchor present
20 mm / 25 mm business values explicitly ASSUMPTION
18:43 vs 19:17 look-alike availability comparison present
four interactive Runtime cases present
each case re-fetches /api/demo and therefore re-executes canonical selector
machine proof surface present
canonical Amendment-19 selector actually executes
provider late = DEGRADE_AND_CONTINUE
source conflict = FAIL_CLOSED
missing evidence = FAIL_CLOSED
customer economics provenance labels present
NOT_PROVEN_CUSTOMER_ROI retained
PROVEN NOW / NOT YET boundary retained
real repo/runtime component mapping present
no invented lease/fencing path
historical Neon allowlist + READ ONLY guard retained
CI requires no Neon secret
provider requests = 0
database writes = 0
canonical Runtime writes = 0
Formal effect = false
```

## Repository boundary

This branch remains limited to:

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
NOT_PROVEN_CUSTOMER_ROI
