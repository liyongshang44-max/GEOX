# GEOX MCFT-CAP-09 Production Hosting Architecture and Development Route V1

Status: **FROZEN DEVELOPMENT ROUTE — ARCHITECTURE FREEZE — DOCS ONLY**

Date: **2026-08-26**

Repository: `liyongshang44-max/GEOX`

Protected-main baseline at freeze: `26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

Frozen v13 predecessor subject: PR `#3289`, exact head `3bbf096ee5cb73e8e0e0251dc400733d6cab501f`

This document is a successor development-route freeze for MCFT-CAP-09. It does **not** reopen or rewrite the frozen Master Task Line, CAP-01 through CAP-09 Taskbooks, CAP-01 through CAP-08 completion evidence, or the immutable Formal-v4 NO-GO. It defines how subsequent implementation work must productize the already-established MCFT semantics without violating the frozen separation between live Internet evidence collection and the Twin Runtime.

It is intentionally non-runtime. This document does not activate workflows, provision databases, issue provider requests, mutate Formal state, open Graduation, arm Formal-v5, execute O00-O23, or claim MCFT-CAP-09 completion.

---

## 1. Frozen architectural conclusion

The MCFT-CAP-01 through CAP-09 chain must **not** be productized by moving all MCFT-CAP-09 responsibilities into one `twin-runtime` Docker service.

The frozen production boundary is:

```text
Live Evidence Plane
!=
Twin Runtime Plane
```

The Twin Runtime may consume only already-governed Evidence through an authorized database Evidence adapter. It must not call public providers, download raw provider payloads, or self-canonicalize raw provider objects in order to satisfy a missing runtime tick.

The production hosting model therefore contains at least two independent long-running operational roles:

```text
GEOX Evidence Runtime
        ↓
raw retention / canonicalization / governed ingress
        ↓
R2/S3 + Neon/Postgres
        ↓
GEOX Twin Runtime
```

GitHub Actions is not a production execution host. Its target role is restricted to:

1. CI;
2. qualification;
3. deployment;
4. independent audit/readback.

GitHub Actions must not own production provider cadence, Formal runtime wake cadence, production tick execution, or durable operational cursor state.

---

## 2. MCFT-CAP-01 through CAP-09 capability map

The frozen interpretation of the capability chain is:

| CAP | Established capability | Primary mode | Long-running production host ownership |
| --- | --- | --- | --- |
| CAP-01 | First-Class Water State Estimate / bootstrap | Replay | No |
| CAP-02 | Hourly Dynamics and Persistence | Replay | No |
| CAP-03 | Observation Assimilation | Replay | No |
| CAP-04 | 72h Forecast and Scenarios | Replay | No |
| CAP-05 | Human Decision / Execution Feedback consumption | Replay | No |
| CAP-06 | Calibration Candidate and Historical Shadow Evaluation | Replay / governed job | No permanent hourly loop |
| CAP-07 | Minimal Field Twin Read Model and Timeline | Read-only server | Existing server |
| CAP-08 | 24-Tick End-to-End Closure | Bounded Replay | No permanent host |
| CAP-09 Evidence | Live evidence acquisition and governed ingress | Shadow-online support | Yes — Evidence Runtime |
| CAP-09 Runtime | Real-boundary shadow-online state progression | Shadow-online | Yes — Twin Runtime |

This map does not reopen prior CAP completion. It defines the final hosting ownership of already-established semantics.

---

## 3. Canonical Runtime Kernel

MCFT-CAP-01 through CAP-06 establish the canonical Twin capability stack. These semantics remain one logical Runtime Kernel even though they are invoked by different hosts.

The kernel includes, subject to the frozen Taskbooks and current canonical implementations:

```text
bootstrap
reality binding
evidence-window selection
state propagation
observation selection
innovation / bounded assimilation
posterior state
forecast
scenario
feedback consumption
residual semantics
persistence
checkpoint
lineage
restart / recovery
idempotency
trace / audit semantics
```

The kernel is not itself a production scheduler.

The production migration must not create alternate or simplified implementations of these semantics for Docker qualification or Formal-v5.

Hard invariant:

```text
qualification canonical core
==
production canonical core
```

---

## 4. Runtime Hosts are not the Runtime Kernel

A unified Runtime does not mean one daemon for every MCFT capability.

### 4.1 Replay Host

Purpose:

- CAP-01 through CAP-06 replay execution;
- CAP-08 bounded 24-tick closure and future regression qualification.

Properties:

```text
one-shot
controlled clock
bounded execution
explicit start/stop
no production cadence ownership
```

Historical manual runners and acceptance scripts may remain as immutable evidence or compatibility entrypoints, but future formal application composition should not depend on test-only script wiring.

### 4.2 Online Twin Runtime Host

Purpose:

- CAP-09 and later shadow-online/online operation.

Properties:

```text
long-running
real clock
durable scheduler
durable runtime cursor
database-clock lease/fencing
slot claim
canonical tick execution
checkpoint/recovery
health
```

### 4.3 Evidence Host

Purpose:

- CAP-09 and later live external evidence supply.

Properties:

```text
long-running
provider acquisition
raw immutable retention
decode/canonicalize
governed database ingress
durable evidence-supply cursor
evidence producer lease/fencing
post-COMMIT physical visibility readback
```

### 4.4 Read/API Host

CAP-07 remains in the existing GEOX server/read-model surface.

Correct data direction:

```text
Twin Runtime
    ↓
canonical state / facts / projections
    ↓
Postgres
    ↓
GEOX Server / CAP-07 read APIs
    ↓
operator / customer UI
```

CAP-07 must not be moved into the new Twin Runtime service as a reason to combine read and write ownership.

### 4.5 Governance / Calibration jobs

CAP-06 candidate generation and historical shadow evaluation remain governed one-shot jobs.

They must not become an hourly self-learning loop inside `twin-runtime`.

The migration must preserve:

```text
Calibration Candidate != Active Model
Historical Shadow Evaluation != Shadow-online Runtime
```

No automatic parameter update or model activation is introduced by this architecture.

---

## 5. Target production topology

The target operational topology is:

```text
                    External Providers
                           │
                           ▼
                 GEOX Evidence Runtime
          ┌────────────────────────────────┐
          │ provider adapters              │
          │ acquisition scheduling         │
          │ raw immutable retention        │
          │ decoder / canonicalizer        │
          │ governed evidence ingress      │
          │ EvidenceSupplyCursor           │
          │ evidence lease / fencing       │
          │ post-COMMIT visibility readback│
          └────────────────────────────────┘
                    │              │
                    ▼              ▼
                  R2/S3      Neon / Postgres
             raw provenance   governed Evidence
                                    │
                                    ▼
                           GEOX Twin Runtime
          ┌─────────────────────────────────────┐
          │ DatabaseEvidenceAdapter only        │
          │ RuntimeTickCursor                   │
          │ real scheduler                      │
          │ runtime lease / fencing             │
          │ slot claim                          │
          │ canonical tick core                 │
          │ state / assimilation                │
          │ forecast / scenario                 │
          │ checkpoint / recovery               │
          │ trace / health                      │
          │ successor viability                 │
          └─────────────────────────────────────┘
                                    │
                                    ▼
                         canonical state/facts
                                    │
                                    ▼
                              GEOX Server
                           CAP-07 read APIs
                                    │
                                    ▼
                              Operator / UI
```

Existing commercial services such as `jobs`, `executor`, `telemetry-ingest`, `mqtt`, `server`, `web`, and storage services keep their current responsibilities unless separately governed by another architecture decision.

This route does not authorize MCFT-CAP-09 to absorb those services.

---

## 6. Evidence Runtime boundary

The future `evidence-runtime` operational role owns live external evidence supply.

### 6.1 Allowed responsibilities

```text
external provider HTTP/API access
provider acquisition cadence
provider-specific adapters
forcing supply cursor
raw immutable retention
R2/S3 write/read required for retention/canonicalization
decoder
canonicalizer
governed evidence ingress
provider watermark / acquisition state
evidence producer claim / lease / fencing / heartbeat
post-COMMIT physical visibility readback
visibility evidence emission
retry / restart recovery for evidence supply
```

### 6.2 Forbidden responsibilities

```text
Twin State mutation
Forecast mutation
Scenario mutation
RuntimeTickCursor mutation
runtime scheduler slot claim
runtime checkpoint mutation
runtime successor terminalization
recommendation creation
approval creation
action dispatch
device command
model activation
```

Evidence Runtime may prove that governed Evidence became physically visible after COMMIT. It must not use that fact to execute or advance Twin state.

---

## 7. Twin Runtime boundary

The future `twin-runtime` operational role owns online Twin state progression.

### 7.1 Allowed responsibilities

```text
read already-governed database Evidence
resolve runtime readiness from governed Evidence
RuntimeTickCursor
real scheduler
runtime slot claim
runtime lease / fencing / heartbeat
bootstrap
state propagation
assimilation
forecast
scenario
checkpoint
runtime health
trace
restart / bounded catch-up
terminal result
successor viability
```

### 7.2 Forbidden responsibilities

```text
public Internet provider calls
provider API authentication
raw provider downloads
provider acquisition orchestration
raw R2/S3 fallback reads to manufacture missing governed Evidence
provider decoding
provider canonicalization
EvidenceSupplyCursor mutation
raw retention metadata mutation
recommendation creation
approval creation
action/task/dispatch creation
device command
automatic parameter update
model activation
```

Hard input rule:

```text
Twin Runtime evidence authority
=
already-governed Evidence through an authorized database Evidence adapter
```

A missing required Evidence condition must resolve according to the frozen causal/availability semantics as wait, degraded, blocked, fail-closed, or NO-GO as applicable. It must never trigger a provider fallback from the Twin Runtime.

---

## 8. Two independent durable cursors

The system must preserve physical and semantic independence between evidence supply progression and Twin state progression.

### 8.1 EvidenceSupplyCursor

Answers:

```text
What external evidence boundary has been durably acquired,
retained, canonicalized, committed, and made physically visible?
```

Owned only by Evidence Runtime.

### 8.2 RuntimeTickCursor

Answers:

```text
What Twin runtime slot has been durably claimed/executed/terminalized,
and what is the next runtime slot eligible for execution?
```

Owned only by Twin Runtime.

Hard invariant:

```text
EvidenceSupplyCursor advancement
!=
RuntimeTickCursor advancement
```

Evidence readiness does not directly execute a Twin tick.

Runtime due-ness does not authorize provider acquisition from the Twin Runtime.

The runtime scheduler may inspect governed evidence readiness, but it must not mutate the EvidenceSupplyCursor.

---

## 9. Production owner uniqueness is per role

The frozen v13 authority requires exactly one production owner **per role** before effectiveness.

The production architecture therefore requires at least:

```text
Evidence production owner count = exactly 1
Twin Runtime scheduler owner count = exactly 1
```

This is not a single global owner constraint.

The two roles must have independent ownership records and independent fencing.

The implementation must not collapse them into one generic `mcft_cap09_owner` lease that grants cross-plane authority.

---

## 10. Lease and fencing separation

At minimum the architecture must distinguish:

```text
EvidenceProducerLease
TwinRuntimeSchedulerLease
```

Each lease requires durable database-clock authority, fencing identity, heartbeat/expiry semantics, and fail-closed behavior according to the applicable frozen Runtime contracts.

A process that holds the Evidence producer fence must not thereby gain authority to claim a Runtime slot.

A process that holds the Runtime scheduler fence must not thereby gain authority to acquire or promote public-provider Evidence.

Duplicate service instances must be safe:

```text
multiple containers may exist transiently
but only one effective fenced owner per role may mutate that role's state
```

---

## 11. Storage authority separation

### 11.1 R2/S3

R2/S3 is raw retention/provenance storage for external evidence payloads and related immutable artifacts.

It is not a Twin Runtime evidence authority by itself.

Hard invariant:

```text
raw object exists in R2/S3
!=
Runtime may consume it
```

### 11.2 Governed PostgreSQL / Neon Evidence

Runtime-consumable Evidence becomes authoritative only after the governed ingress path has completed according to the frozen evidence rules.

The Twin Runtime must not bypass governed ingress by reading raw provider objects directly from R2/S3.

### 11.3 Operational state

Durable production cursors, leases, checkpoints, scheduler state, and recovery facts must reside in durable operational storage governed by the application architecture, not in ephemeral GitHub Actions workflow state or expiring artifact retention.

---

## 12. Database role / ACL separation

Service separation must be enforced below the TypeScript interface layer.

The target design requires distinct database roles/permissions or an equivalently enforceable database authorization boundary.

### 12.1 Evidence Runtime database authority

May mutate only the tables/records required for:

```text
raw/provenance metadata
governed evidence ingress
provider watermark/acquisition state
EvidenceSupplyCursor
evidence producer lease/fence
visibility/readback evidence
```

Must be denied direct mutation authority over:

```text
Twin state
Forecast
Scenario
RuntimeTickCursor
Runtime scheduler state
Twin checkpoint
Twin runtime terminal state
```

### 12.2 Twin Runtime database authority

May:

```text
read governed Evidence
write canonical Twin state
write Forecast/Scenario
write runtime cursor/scheduler/lease state
write checkpoint/recovery/trace/health state
```

Must be denied direct mutation authority over:

```text
provider acquisition state
raw retention metadata
EvidenceSupplyCursor
provider watermark authority
```

A successful architecture qualification must include negative ACL tests, not only code-level mocks.

---

## 13. Physical visibility versus independent audit

Evidence Runtime owns the production mechanics of:

```text
COMMIT
→ fresh transaction/readback
→ exact evidence identity verification
→ DB-clock/chronology verification as required
→ visibility evidence emission
```

However, Evidence Runtime is not its own sole independent auditor.

GitHub qualification/audit or another independent read-only adjudicator may verify the resulting proof.

The architecture must preserve:

```text
production evidence generation
!=
independent qualification/adjudication
```

---

## 14. Provider implementation extraction

Any current CAP-09 provider acquisition path that depends on acceptance-script source rewriting, temporary generated source, GitHub run identity, or test-only process spawning is qualification plumbing, not the final production provider implementation.

The provider capability must be promoted into formal application modules, for example conceptually:

```text
apps/server/src/external_evidence/
    provider/
    retention/
    decoder/
    canonicalizer/
    ingress/
```

The exact final package path is an implementation decision and is not frozen by this document.

The frozen semantic requirement is:

```text
GitHub qualification
and
Evidence Runtime production host
must call the same production provider/canonicalization modules
```

No separate simplified qualification provider implementation is permitted.

---

## 15. CAP-08 composition debt and equivalence extraction

CAP-08 remains an accepted bounded Replay closure and must not be rewritten retroactively.

Where CAP-08 runtime wiring currently lives under acceptance-oriented script entrypoints/port bundles, that wiring may be extracted into formal application composition only through semantic-equivalence qualification.

Required migration pattern:

```text
frozen CAP-08 replay composition
        ↓
semantic/result digest X

new ReplayHost composition
        ↓
semantic/result digest X
```

The objective is to lift composition into production-grade application code while preserving the already-proven semantics.

Failure of equivalence blocks adoption of the new composition. It does not invalidate the historical CAP-08 completion record.

---

## 16. CAP-05 and action execution boundary

Docker productization must not convert CAP-05 feedback semantics into an autonomous action-control service.

Twin Runtime may consume already-existing trustworthy decision/approval/action/execution Evidence according to frozen semantics.

It must not create:

```text
decision
approval
task
dispatch
receipt
device command
```

unless a separate future capability/task line explicitly authorizes such behavior.

MCFT-CAP-09 shadow-online remains non-dispatching.

---

## 17. CAP-06 calibration boundary

CAP-06 candidate generation and shadow evaluation remain offline/governed capabilities.

The architecture must preserve:

```text
NO_BACKGROUND_SELF_LEARNING
NO_AUTOMATIC_PARAMETER_UPDATE
NO_MODEL_ACTIVATION
```

A future Dockerized calibration evaluator, if used, is a one-shot governed job and not part of the Twin Runtime hourly loop.

The CAP-06 historical lesson is adopted as an engineering governance rule for this route:

```text
when a structural architecture defect is identified,
stop and freeze the corrected architecture;
do not preserve the old architecture by indefinitely inserting ad-hoc prerequisites/gates.
```

---

## 18. GitHub target role

GitHub Actions MAY:

```text
build
static test
integration test
bounded replay qualification
accelerated qualification
exact-SHA proof
artifact/evidence registry proof
deployment
read-only independent audit
final readback/adjudication
```

GitHub Actions MUST NOT own routine production behavior for Formal-v5 or later:

```text
production provider cadence
production provider request loop
EvidenceSupplyCursor
Formal runtime wake cadence
RuntimeTickCursor
production slot claim
production Twin tick execution
Formal Twin checkpoint mutation
production retry/recovery state
```

Deployment authorization does not imply continuing runtime clock ownership.

Hard production target:

```text
GitHub provider request count during Formal = 0
GitHub Formal Twin DB mutation count = 0
GitHub production tick execution count = 0
GitHub hourly wake dependency = 0
```

---

## 19. GitHub outage independence

The following become hard architecture acceptance requirements before Formal-v5 activation:

```text
GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_EVIDENCE_INGRESS
```

```text
GITHUB_CONTROL_PLANE_OUTAGE_DOES_NOT_STOP_TWIN_RUNTIME
```

```text
EVIDENCE_RUNTIME_OUTAGE_DOES_NOT_CAUSE_TWIN_RUNTIME_PROVIDER_FALLBACK
```

```text
TWIN_RUNTIME_OUTAGE_DOES_NOT_ALLOW_EVIDENCE_RUNTIME_TO_ADVANCE_TWIN_STATE
```

```text
PROCESS_RESTART_RECOVERS_FROM_DURABLE_OPERATIONAL_AUTHORITY_WITHOUT_GITHUB_ARTIFACT_REHYDRATION
```

Interpretation:

A GitHub Actions outage must not stop a correctly deployed Formal production graph when Docker/container hosting, PostgreSQL/Neon, R2/S3, network/provider access, and required infrastructure remain healthy.

GitHub artifacts may remain audit evidence. They must not be required to recover the live production cursor/checkpoint after process restart.

---

## 20. Backpressure and missing-evidence behavior

The Twin Runtime must not repair Evidence-plane failure by crossing the plane boundary.

When required governed Evidence is unavailable, Twin Runtime behavior is limited to the states authorized by the frozen causal/availability contracts, including where applicable:

```text
WAIT
ASSUMED / DEGRADED
BLOCKED
NO-GO
```

Forbidden recovery:

```text
missing governed Evidence
→ Twin Runtime calls provider
```

```text
missing governed Evidence
→ Twin Runtime reads raw R2/S3
→ Twin Runtime decodes/canonicalizes its own Evidence
```

```text
Evidence Runtime unavailable
→ fallback GitHub production collector
```

Any such path is an architecture violation.

---

## 21. Production-equivalent qualification principle

The qualification objective is **same production graph**, not merely same image.

The system may use separate service images if necessary. What must remain equivalent is the production implementation and composition.

For accelerated qualification:

```text
Qualification Evidence Host
=
Production Evidence Host
except explicitly permitted test clock/provider adapter boundaries
```

```text
Qualification Twin Host
=
Production Twin Host
except accelerated clock/wait boundary
```

The accelerated clock may replace elapsed waiting. It may not replace:

```text
schema
runtime config chain
repositories
persistence
EvidenceSupplyCursor
RuntimeTickCursor
scheduler semantics
lease/fencing
provider/canonicalization production modules
tick runner
canonical tick core
checkpoint
health
restart/recovery
physical visibility semantics
```

No simplified runner may be introduced solely to make accelerated qualification pass.

---

## 22. Formal production owner cutover gate

Before a fresh Formal-v5 epoch can be armed, the hosting cutover must prove:

```text
GitHub scheduled production Evidence owner count = 0
GitHub scheduled production Twin owner count = 0
retired workflow_run production owner count = 0
retired downstream production trigger count = 0
Evidence Runtime effective owner count = exactly 1
Twin Runtime effective scheduler owner count = exactly 1
```

Routine manual tick dispatch must be forbidden during Formal.

Routine manual evidence rescue must be forbidden during Formal except where an explicitly frozen fail-closed operator procedure says otherwise; such a procedure must not silently change the epoch semantics.

---

## 23. Development route

The migration is frozen in the following order.

### Phase 0 — Freeze historical authority

Do not mutate or reopen:

1. CAP-01 through CAP-07 completion;
2. CAP-08 Stage 1A bounded Replay closure;
3. Formal-v4 immutable NO-GO;
4. frozen PR #3289 exact subject `3bbf096ee5cb73e8e0e0251dc400733d6cab501f`.

Do not use the hosting migration as a reason to continue the failed Formal-v4 epoch.

### Phase 0A — Freeze production hosting architecture

This document is the Phase 0A architecture route freeze.

Before implementation expansion, the following must remain explicit and machine-testable where practical:

```text
plane ownership
cursor ownership
lease/fencing ownership
storage authority
DB ACL boundaries
allowed effects
forbidden effects
outage behavior
restart behavior
qualification equivalence
production owner uniqueness
```

### Phase 1 — Extract common Runtime composition

Objective:

- lift production-worthy composition out of acceptance-only wiring;
- establish a formal ReplayHost/application composition;
- call the existing canonical Runtime Kernel;
- preserve CAP-08 semantics.

Mandatory proof:

```text
CAP08_FROZEN_REPLAY_EQUIVALENCE
```

No historical CAP-08 closure mutation is required or authorized.

### Phase 2 — Extract production Evidence provider modules

Objective:

- remove source-generation/string-replacement/test-run identity dependence from production implementation;
- formalize provider, raw retention, decoder, canonicalizer, governed ingress, visibility, and EvidenceSupplyCursor modules;
- ensure qualification and production host use the same modules.

No live production activation in this phase.

### Phase 3 — Build Evidence Runtime host

Objective:

- build a long-running Evidence Runtime service around the production modules;
- establish durable EvidenceSupplyCursor;
- establish Evidence producer lease/fencing;
- establish restart/retry/idempotency;
- establish raw retention and governed ingress;
- qualify database ACL separation;
- qualify post-COMMIT visibility behavior.

No authority to mutate Twin state.

### Phase 4 — Build Twin Runtime host

Objective:

- build a long-running Twin Runtime service around the canonical Runtime Kernel;
- establish RuntimeTickCursor;
- establish real scheduler and database-clock lease/fencing;
- establish oldest-due/eligible slot claim semantics as required by the frozen contracts;
- establish checkpoint, health, restart, bounded catch-up, and successor viability;
- enforce DatabaseEvidenceAdapter-only provider separation;
- qualify database ACL separation.

No authority to call public providers or mutate EvidenceSupplyCursor.

### Phase 5 — Production-equivalent two-service accelerated 24T

Required topology under qualification:

```text
Evidence Runtime
       ↓
governed database Evidence
       ↓
Twin Runtime
       ↓
canonical persisted Twin state / Forecast / Scenario / checkpoint
```

The accelerated clock substitutes waiting only.

This phase must test at least:

```text
normal progression
restart of Evidence Runtime
restart of Twin Runtime
duplicate Evidence containers with fencing
duplicate Twin containers with fencing
DB reconnect
idempotent retry
missing Evidence backpressure
no provider fallback from Twin Runtime
no Twin-state mutation from Evidence Runtime
checkpoint recovery
cursor independence
post-COMMIT visibility
owner uniqueness
```

### Phase 6 — Retire GitHub production execution and prove cutover

Only after the two-service production-equivalent graph passes qualification:

- remove/disable GitHub routine production Evidence acquisition ownership;
- remove/disable GitHub routine production runtime wake/tick ownership;
- retain CI/qualification/deployment/audit workflows as appropriate;
- prove zero retired production owners/triggers;
- prove GitHub outage independence;
- prove restart without GitHub artifact rehydration.

This phase must be a controlled ownership cutover, not a silent deletion of audit evidence.

### Phase 7 — Fresh Formal-v5

Only after Phases 0 through 6 are accepted:

```text
fresh Formal-v5 store / epoch
fresh arm
real external Evidence Runtime
real Twin Runtime
real wall clock
real O00-O23 scheduler boundaries
zero routine GitHub wake dependency
zero routine manual rescue
automatic/read-only final adjudication
```

Formal-v5 remains a fresh epoch. No failed Formal-v4 continuation or late repair is permitted.

---

## 24. Interaction with the qualification control-plane CP sequence

The existing qualification-control-plane route remains:

```text
CP-0
→ CP-1
→ CP-2
→ CP-3
→ CP-4
→ CP-5
```

There is no new `CP-6` created by this document.

The production-hosting migration is a separate architecture/development route.

It must not be folded into a large qualification-control-plane PR merely for convenience.

Central applicability planning may classify existing frozen evidence as `CARRY_FORWARD`, `REQUALIFY`, `REQUIRED`, `NOT_APPLICABLE`, `FORBIDDEN`, or `UNKNOWN` according to its own frozen rules, but it must not be used to bypass real requalification when hosting/composition dependencies have materially changed.

---

## 25. PR and branch discipline

The hosting migration should be executed through bounded, reviewable changes rather than one monolithic PR.

Preferred separation:

```text
architecture/docs freeze
Runtime composition extraction
Evidence module extraction
Evidence Runtime host
Twin Runtime host
production-equivalent qualification
production ownership cutover
Formal-v5 arm/run
```

Do not mutate frozen PR #3289 to retrofit the new hosting architecture.

Treat #3289 as predecessor evidence/subject. Successor implementation must explicitly determine which predecessor proofs remain immutable carry-forward evidence and which require requalification because governed dependencies changed.

---

## 26. Mandatory negative architecture tests

Before production activation, qualification must demonstrate that prohibited cross-plane effects are mechanically impossible or fail closed.

At minimum:

```text
Twin Runtime public-provider request → denied/fails qualification
Twin Runtime raw R2/S3 acquisition fallback → denied/fails qualification
Twin Runtime EvidenceSupplyCursor mutation → denied/fails qualification
Evidence Runtime Twin State mutation → denied/fails qualification
Evidence Runtime Forecast/Scenario mutation → denied/fails qualification
Evidence Runtime RuntimeTickCursor mutation → denied/fails qualification
GitHub routine Formal tick execution → zero
GitHub routine Formal provider request → zero
multiple effective Evidence owners → fail closed
multiple effective Twin scheduler owners → fail closed
GitHub outage → production graph continues if infrastructure is otherwise healthy
process restart → recovery from durable operational authority
```

---

## 27. Formal-v5 activation prerequisites

Formal-v5 may not be armed merely because the new containers build successfully.

The minimum architecture prerequisites are:

1. common Runtime composition extracted without semantic drift;
2. CAP-08 semantic-equivalence proof accepted;
3. production Evidence modules extracted from acceptance-only plumbing;
4. Evidence Runtime long-running qualification accepted;
5. Twin Runtime long-running qualification accepted;
6. database role/ACL negative proof accepted;
7. separate cursor/lease/fence ownership accepted;
8. production-equivalent two-service accelerated 24T accepted;
9. restart/recovery accepted for both services;
10. no Runtime provider fallback accepted;
11. no Evidence-to-Twin mutation crossing accepted;
12. GitHub production owner count zero;
13. exactly one effective Evidence owner;
14. exactly one effective Twin scheduler owner;
15. GitHub outage independence accepted;
16. production state recovery requires no GitHub artifact rehydration;
17. all generation/applicability/qualification gates applicable to the fresh successor are terminal and accepted;
18. fresh Formal-v5 store/epoch authority is established without reuse of failed Formal-v4 state.

Only then may a fresh real-wall-clock O00-O23 Formal window start.

---

## 28. Historical authorities explicitly preserved

This route does not reopen:

```text
CAP-01 completion
CAP-02 completion
CAP-03 completion
CAP-04 completion
CAP-05 completion
CAP-06 completion
CAP-07 completion
CAP-08 Stage 1A completion
Formal-v4 NO-GO
```

The migration is not a rewrite of MCFT-CAP-01 through CAP-08.

It productizes the hosting/composition around semantics already established by those capabilities.

---

## 29. Non-effects of this architecture freeze

This document itself causes none of the following:

```text
runtime_mutation = false
production_workflow_activation = false
formal_database_mutation = false
provider_request = false
graduation_effect = false
formal_v5_arm = false
formal_v5_o00_start = false
mcft_cap09_completed = false
```

It does not authorize deletion of historical workflows/evidence before successor qualification proves the replacement graph.

It does not authorize reusing failed Formal-v4 databases or epochs.

It does not authorize bypassing frozen causal forcing semantics.

---

## 30. Final frozen development direction

The MCFT capability stack is frozen for subsequent architecture work as:

```text
MCFT-CAP-01 through CAP-06
= Canonical Runtime capability stack

MCFT-CAP-07
= Read-only server surface

MCFT-CAP-08
= Replay end-to-end qualification host/closure

MCFT-CAP-09
= Online adapters + operations layer
```

MCFT-CAP-09 itself is frozen into two independent production planes:

```text
Live Evidence Plane
!=
Twin Runtime Plane
```

The target engineering statement is therefore:

> Productize the Twin Kernel already proven by MCFT-CAP-01 through CAP-08; establish an independent long-running Evidence Runtime and an independent long-running Twin Runtime; preserve CAP-07 in the server/read layer and CAP-06 calibration as governed one-shot work; retire GitHub from production execution while retaining CI, qualification, deployment, and independent audit.

Any future implementation that recombines live public-provider collection with the Twin Runtime, uses GitHub Actions as the routine production scheduler, requires GitHub artifacts to recover live operational cursor state, or introduces a second simplified canonical tick path contradicts this frozen development route and must fail architecture review before Formal-v5 activation.
