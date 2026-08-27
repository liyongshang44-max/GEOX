# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-27 — Phase 5 Production-Equivalent Containers / Accelerated Evidence Provider Frontier

Status: **CONVERSATION HANDOFF / CURRENT FRONTIER — NOT MASTER-TASK AUTHORITY**

Timestamp: **2026-08-27 18:36 +08:00**

Repository: liyongshang44-max/GEOX

Purpose: hand off the exact MCFT-CAP-09 production-hosting migration frontier after Phase 2, Phase 3, and Phase 4 were machine-closed as stacked predecessors and Phase 5 was opened. This continuation records the Phase 3 Evidence Runtime authority/fencing/cursor repairs, the Phase 4 Twin Runtime host/DB-clock/restart/ACL/successor closure, the first Phase 5 production process and service-principal packaging, the current accelerated Evidence provider boundary, the still-open central applicability registration for Phase 5, the exact work that remains before an accelerated 24T can be called production-equivalent, and the failure modes that must not be reintroduced.

> This section supersedes the earlier Phase 2-only top-level state in this same 2026-08-27 handoff.
>
> The original Phase 2 continuation is intentionally preserved in full below as a historical snapshot. Do not delete it: it explains how the current production-hosting lineage was reached.
>
> The 2026-08-26 handoff remains the historical record of the initial Phase 2 takeover state.
>
> This handoff does **not** supersede docs/SSOT.md, the MCFT Master Task Line, the CAP-09 taskbook, accepted CAP-01→08 predecessor authority, immutable Formal evidence, the qualification control plane, or the frozen production-hosting architecture route.

---

## C0. READ THIS FIRST — current authority reconstruction order

Before changing MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, container packaging, production ownership, Formal, Graduation, or qualification-control-plane logic, restore authority in this order:

1. docs/SSOT.md and repository-level frozen authority;
2. the digital-twin master task line / total task book;
3. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md;
4. accepted CAP-01→08 predecessor evidence;
5. immutable Formal-v4 NO-GO / later accepted successor evidence;
6. qualification-control-plane authorities and durable evidence registry;
7. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md;
8. Phase 2 closure c3346768a44b16b127378cb690ada1d8cfec1049;
9. Phase 3 closure 0e874b254c695b32fd94c7dc7034fd71b8aa3bc3;
10. Phase 4 closure 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1;
11. this handoff for the current Phase 5 conversation frontier;
12. current exact-head GitHub Actions evidence for PR #3323.

Do not infer current authority from branch names, PR titles, or an old green run alone. Exact SHA + exact dependency set + exact workflow evidence remain the governing unit.

### C0.1 Frozen architecture that still governs everything

The mandatory route remains:

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md

Frozen topology:

~~~text
External Providers
        ↓
Evidence Runtime / Live Evidence Plane
        ↓
governed database Evidence
        ↓
Twin Runtime Plane
        ↓
canonical Twin state / Forecast / Scenario / checkpoint
~~~

Evidence Runtime and Twin Runtime are separate production roles.

GitHub Actions remains:

~~~text
CI
qualification
deployment
independent audit
~~~

GitHub Actions must **not** remain the routine production provider clock, Twin tick scheduler, or production cadence owner after Phase 6.

### C0.2 Do not mix the three numbering systems

Capability line:

~~~text
MCFT-CAP-01 → MCFT-CAP-09
~~~

Qualification-control-plane line:

~~~text
CP-0 → CP-5
~~~

Production-hosting migration line:

~~~text
Phase 0
Phase 0A
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
~~~

There is no frozen CP-6.

Production-hosting Phase 6 means ownership cutover, not a new qualification-control-plane phase.

### C0.3 B-Line is a separate engineering line

A separate B-Line is being developed in parallel by another owner.

Hard rule:

~~~text
MCFT-9 production-hosting line != B-Line semantic-convergence line
~~~

This MCFT-9 continuation must not:

- merge B-Line work into this stack;
- mutate B-Line branches or PRs;
- use B-Line completion as a substitute for MCFT-9 qualification;
- let Phase 5 container work become a semantic-convergence refactor.

The two lines may be integrated only later under an explicit integration decision after MCFT-9 finishes its frozen migration scope.

---

## C1. Current task in one sentence

**Continue Production Hosting Phase 5 by building a production-equivalent two-service accelerated qualification around the already machine-closed Phase 3 Evidence Runtime and Phase 4 Twin Runtime, using the same production host/canonicalizer/persistence/lease/cursor/runner paths and substituting only the explicitly frozen test-provider boundary and waiting clock, without starting Phase 6 ownership cutover or Phase 7 Formal-v5.**

---

## C2. Exact current repository / branch / PR state

### C2.1 Protected main

Protected main is still exactly:

26c1383f7f45abb76c99e28ec3d06714e85d1b2c

It has not been moved by the Phase 2, Phase 3, Phase 4, Phase 5, or handoff work described here.

Do not merge stacked production-hosting PRs merely to simplify development.

### C2.2 Phase 2 closure

Draft PR #3299:

refactor(mcft-cap09): phase2a extract production Evidence provider seams

Branch:

feat/mcft-cap09-phase2-evidence-production-modules-v1

Base:

8943c752a354cb916cc7f144681203aa9a19f70b

Exact Phase 2 closure head:

c3346768a44b16b127378cb690ada1d8cfec1049

Current repository facts at handoff:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 74
files      = 28
additions  = 4319
deletions  = 368
~~~

Important closure evidence on c3346768…:

- ordinary ci run 33032685968 = SUCCESS;
- central qualification-control-plane run 33032685846 = SUCCESS;
- EA5E2 runtime dependency graph run 33032685856 = SUCCESS;
- successor runner run 33032685892 = SUCCESS;
- EA5C2B1 KBS soil successor run 33032685984 = SUCCESS.

Phase 2 is a historical closed predecessor for the current stack.

### C2.3 Phase 3 closure

Draft PR #3308:

feat(mcft-cap09): phase3 durable Evidence Runtime foundation

Base:

c3346768a44b16b127378cb690ada1d8cfec1049

Exact Phase 3 closure head:

0e874b254c695b32fd94c7dc7034fd71b8aa3bc3

Repository facts:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 73
files      = 34
additions  = 6111
deletions  = 296
~~~

Important exact-head evidence:

- Phase3 Evidence Runtime persistence run 33039951199 = SUCCESS;
- qualification control plane run 33039951208 = SUCCESS;
- EA5E2 graph run 33039951186 = SUCCESS;
- successor runner run 33039951242 = SUCCESS;
- AM19 persistent 24T compatibility run 33039951169 = SUCCESS;
- EA5C2B1 successor run 33039951185 = SUCCESS.

The generic ci run on that exact head was not the final production-hosting closure criterion because it exposed a migration-order integration defect later repaired in Phase 4. That defect is recorded below and must not be forgotten.

Phase 3 is treated by the current stacked route as the machine-closed Evidence Runtime predecessor.

### C2.4 Phase 4 closure

Draft PR #3315:

feat(mcft-cap09): build Phase4 Twin Runtime persistence

Branch:

feat/mcft-cap09-phase4-twin-runtime-persistence-v1

Base:

0e874b254c695b32fd94c7dc7034fd71b8aa3bc3

Exact Phase 4 closure head:

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Repository facts:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 39
files      = 15
additions  = 2708
deletions  = 11
~~~

Exact-head closure runs:

- ordinary ci run 33048911663 = SUCCESS;
- Phase4 Twin Runtime persistence run 33048911787 = SUCCESS;
- central qualification-control-plane run 33048911662 = SUCCESS;
- EA5E2 graph run 33048911804 = SUCCESS;
- successor runner run 33048911766 = SUCCESS.

Central proved at closure:

~~~text
blocker_count = 0
unknown_changed_paths = []
~~~

Phase 4 is frozen. Do not append new Phase 5 code to #3315.

### C2.5 Current Phase 5 implementation PR

Draft PR #3323:

feat(mcft-cap09): build Phase5 production-equivalent containers

Branch:

feat/mcft-cap09-phase5-production-equivalent-containers-v1

Exact base:

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Current exact head at this handoff:

8671ac74873d2312ee170870bc737927502a9206

Repository facts:

~~~text
state      = open
Draft      = true
merged     = false
commits    = 14
files      = 9
additions  = 1827
deletions  = 2
~~~

Current changed files are only the first-layer Phase 5 packaging / principal boundary:

- .github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml
- apps/server/scripts/write_dist_entries.cjs
- apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts
- apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts
- apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts

This exact changed-file list is important because the planned Phase 3 composition seam described later is **not yet committed** at this handoff.

### C2.6 Current conversation handoff PR

Docs-only Draft PR #3298 remains:

docs(mcft-cap09): hand off Phase 2 KBS/graph frontier

Branch:

docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier

Base:

26c1383f7f45abb76c99e28ec3d06714e85d1b2c

Before this update its head was:

29b82bc9b7a63490e3646e5bb28eeb56b649d952

The handoff remains docs-only and must not perturb any implementation dependency graph.

---

## C3. Current production-hosting phase map

~~~text
CP-5 qualification control plane                    HISTORICAL CLOSED
        ↓
Phase 1 typed Runtime composition                   HISTORICAL CLOSED
        ↓
Phase 2 production Evidence productization          MACHINE CLOSED
        exact = c3346768…
        ↓
Phase 3 durable Evidence Runtime                    MACHINE CLOSED
        exact = 0e874b25…
        ↓
Phase 4 durable Twin Runtime                        MACHINE CLOSED
        exact = 16ff7160…
        ↓
Phase 5 production-equivalent two-service 24T       IN PROGRESS  ← CURRENT
        exact current head = 8671ac74…
        ↓
Phase 6 production ownership cutover                NOT STARTED / FORBIDDEN NOW
        ↓
Phase 7 fresh Formal-v5                             NOT ARMED
~~~

MCFT-CAP-09 remains:

~~~text
IN PROGRESS
NOT COMPLETE
NOT GRADUATED
PHASE5 NOT CLOSED
PHASE6 NOT STARTED
FORMAL-V5 NOT ARMED
PROTECTED MAIN UNCHANGED
~~~

---

## C4. Phase 3 — what was actually fixed and why it matters to Phase 5

Phase 3 was not just “add a durable cursor”. Several authority defects were found during audit and had to be corrected before Evidence Runtime could be trusted as a production predecessor.

### C4.1 DB Evidence writer authority was repaired

The Evidence Runtime database role must not have arbitrary INSERT authority over public.facts.

The repaired design is:

~~~text
Evidence Runtime role
        ↓
no direct arbitrary facts INSERT
        ↓
governed SECURITY DEFINER Evidence append boundary
        ↓
record-type / scope / fence checks
        ↓
External Evidence canonical fact only
~~~

Machine qualification proved:

- direct arbitrary INSERT facts is denied;
- Twin canonical facts cannot be manufactured through the Evidence writer;
- Evidence role cannot mutate Twin runtime state;
- facts UPDATE / DELETE remain denied on the Evidence plane.

This is a hard production boundary. Do not re-grant broad facts write authority for convenience in Phase 5 containers.

### C4.2 Fencing was moved to the governed COMMIT boundary

The original weakness was that stale Evidence ownership could be noticed only when advancing EvidenceSupplyCursor.

That was insufficient: a stale owner could theoretically have written canonical Evidence before the cursor failed.

The repair bound governed ingress to the current EvidenceProducerLeaseClaim and rechecked lease owner / fencing token / expiry inside the database write transaction.

Required invariant:

~~~text
stale Evidence owner
        ↓
must fail before canonical fact insert / COMMIT
        ↓
stale canonical fact count = 0
~~~

Phase 5 duplicate Evidence-container qualification must preserve this exact property.

### C4.3 EvidenceSupplyCursor became a two-axis durable model

The earlier single watermark mixed two different concepts:

1. when a publication became available to Runtime;
2. whether observation/event-time data is continuous.

That is wrong for real KBS publication behavior.

Phase 3 split them.

Publication axis:

~~~text
publication_available_through
~~~

Event-time axis:

~~~text
event_time_contiguous_from
event_time_contiguous_through
event_time_max_seen
event_gap_count
~~~

A durable per-event ledger was added to support:

- KBS daily batch;
- true hourly publication;
- outage / gap;
- late backfill;
- same-event governed revision;
- publication order different from event-time order.

Do not collapse this back into a single “latest timestamp”.

### C4.4 Generic cadence/profile qualification was added

At minimum, three supply models are now machine-qualified:

~~~text
KBS daily batch
true hourly
hourly outage + backfill + revision
~~~

For KBS daily batch, many hourly event records may share the same publication timestamp.

Therefore:

~~~text
same publication timestamp != duplicate event
daily batch != hourly publication
~~~

This directly constrains the Phase 5 accelerated provider adapter.

### C4.5 Central applicability reached unknown_changed_paths = 0

Phase 3 explicitly repaired the central resolver rather than hiding unknown paths with broad wildcards.

The correct pattern remains:

~~~text
new production dependency
        ↓
exact resolver ownership
        ↓
machine applicability plan
        ↓
unknown_changed_paths = 0
~~~

Do not silence central by broad directory wildcarding.

### C4.6 Phase 3 migration exposed a generic ordering bug later

Phase 3 introduced same-day persistence and ACL migrations.

The generic migration runner sorted files lexically, which caused:

~~~text
..._acl.sql
before
..._persistence.sql
~~~

in ordinary commercial bootstrap.

The Phase 3 focused workflow did not reveal the defect because it manually applied persistence before ACL.

Phase 4 repaired the generic migration ordering rule:

~~~text
same date:
schema/data migrations
        ↓
ACL migration
~~~

This is a major lesson: a focused qualification workflow can accidentally mask production bootstrap ordering.

Phase 5 must continue to run the full database-platform bootstrap, not only hand-picked migrations.

---

## C5. Phase 4 — machine-closed Twin Runtime foundation

Phase 4 converted the already-qualified canonical Runtime graph into a long-running production-hostable Twin Runtime without creating a second execution algorithm.

### C5.1 Long-running Twin Runtime host

Product host:

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts

Hard design:

~~~text
long-running process lifecycle
        ↓
PostgreSQL transaction-time clock
        ↓
existing ExternalFormalV3Amendment19RunnerV1.executeOneDueSlot()
        ↓
existing canonical tick / persistence graph
~~~

The host does not implement a simplified Twin algorithm.

### C5.2 Product composition was lifted out of acceptance-only wiring

Product composition:

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts

It reuses:

- PostgresPersistentSequentialSchedulerAdapterV1;
- PostgresExternalFormalAmendment19EvidenceSourceV1;
- PostgresNextTickRepositoryV1;
- PostgresRuntimeRepositoryV1;
- PostgresForecastScenarioRecoveryRepositoryV1;
- ExternalFormalV3Amendment19PersistentTickServiceV1;
- ExternalFormalV3Amendment19RunnerV1;
- materializeExternalFormalA18CropContextV3.

The rule established here is critical for Phase 5:

**qualification and production packaging must instantiate this same graph, not a test-only runner.**

### C5.3 Database clock is the Runtime time authority

Phase 4 added:

PostgresTwinRuntimeDatabaseClockV1

Clock source:

~~~sql
SELECT transaction_timestamp() AS database_now
~~~

This avoids:

~~~text
Node wall-clock authority
GitHub workflow clock authority
container local-clock authority
~~~

for governed scheduler decisions.

### C5.4 Durable RuntimeTickCursor and scheduler fencing were requalified

Real PostgreSQL qualification proved:

- oldest-due-first;
- future-slot rejection;
- same-owner idempotent claim;
- duplicate owner rejection;
- expired active slot recovery;
- monotonic fencing-token advance;
- stale fence rejection;
- process restart reads durable cursor;
- bounded O00→O03 catch-up;
- no scheduler-only canonical fact write.

### C5.5 Twin Runtime database ACL was separated from Evidence plane

Independent privilege role:

geox_mcft_cap09_twin_runtime_v1

It may use only the governed Runtime/Twin/Forecast/Scenario persistence surface it actually needs.

It is explicitly denied direct mutation of:

~~~text
external_evidence_producer_lease_v1
external_evidence_supply_event_v1
external_evidence_supply_cursor_v1
~~~

It reads governed Evidence through public.facts.

This separation must remain true when Phase 5 introduces real LOGIN service principals.

### C5.6 Read-only successor viability replaced old forcing-target control semantics

The old V13 successor-viability path could mutate autonomous forcing-target control state.

That was rejected for Phase 4 because it would reintroduce Evidence/forcing ownership into the Twin Runtime plane.

Phase 4 instead added read-only successor viability:

apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts

It proves after a terminal tick:

~~~text
terminal scheduler row exists
RuntimeTickCursor last_terminal matches
RuntimeTickCursor next slot matches
canonical checkpoint next_tick_logical_time matches
active slot count = 0
~~~

O23 is allowed only as range complete.

It does not fetch providers and does not mutate EvidenceSupplyCursor or forcing target state.

### C5.7 Phase 4 central closure

Exact closure:

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Machine result:

~~~text
blocker_count = 0
unknown_changed_paths = []
~~~

Phase 4 durable evidence, DB-clock scheduler, restart/fencing, successor viability, Twin ACL, ordinary CI, graph, and successor qualification are all closed at that exact predecessor.

Do not reopen Phase 4 merely because Phase 5 needs qualification seams. If Phase 5 must change a Phase 3 or Phase 4 source file, treat that as an explicit predecessor dependency change and requalify the affected predecessor.

---

## C6. Phase 5 — frozen purpose and allowed substitution

Frozen Phase 5 route:

~~~text
Evidence Runtime
       ↓
governed database Evidence
       ↓
Twin Runtime
       ↓
canonical persisted Twin state / Forecast / Scenario / checkpoint
~~~

The accelerated clock substitutes **waiting only**.

Phase 5 must test at least:

~~~text
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
~~~

The system under qualification must remain production-equivalent except at explicitly permitted test boundaries.

### C6.1 What may be substituted

The frozen route allows an explicit test provider-adapter boundary for accelerated qualification.

That means a controlled qualification provider may replace:

~~~text
real external network/provider availability
~~~

It must **not** replace:

~~~text
Evidence Runtime host
Evidence cycle service
raw retention
canonicalizer
governed fenced DB COMMIT
post-COMMIT visibility
EvidenceSupplyCursor
Evidence lease/fencing
Twin Runtime host
canonical Twin runner
Runtime scheduler
RuntimeTickCursor
checkpoint
Twin persistence
service DB principals
~~~

This distinction is now the central Phase 5 engineering rule.

---

## C7. Phase 5 first-layer production packaging — completed

The first layer of Phase 5 is real product packaging, not the final two-container 24T yet.

### C7.1 Shared production process lifecycle

Product file:

apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts

It provides shared:

- SIGTERM / SIGINT handling;
- wait / backoff;
- health lifecycle;
- failure classification.

This lifecycle belongs to product code, not scripts/runtime_acceptance.

### C7.2 Twin Runtime production process

Product file:

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts

It directly composes the Phase 4 canonical Twin Runtime composition.

Required process authority includes:

~~~text
GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL
Twin-specific DB principal assertion
Phase4 composeMcftCap09TwinRuntimeV1
shared lifecycle
~~~

It must not acquire Evidence provider credentials.

### C7.3 Stable compiled Twin Runtime entrypoint

Production build now writes a stable compiled entry:

apps/server/dist/runtime/mcft_cap09_twin_runtime.js

Phase 5 workflow proves it exists and contains the Twin production process entry without importing acceptance scripts.

### C7.4 Evidence Runtime production process factory

Product file:

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts

It directly composes the Phase 3 Evidence Runtime composition.

Required process authority includes:

~~~text
GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL
Evidence-specific S3 credentials
Phase3 composeEvidenceRuntimeV1
target planner
shared lifecycle
~~~

Twin Runtime must not receive those S3 credentials.

### C7.5 Evidence and Twin use different DB URLs

Phase 5 does not rely on a single all-powerful runtime login.

The two process contracts use separate database URLs.

This is intentional even though both ultimately target the same PostgreSQL database.

### C7.6 Independent PostgreSQL LOGIN principals

Two LOGIN principals now exist:

~~~text
geox_mcft_cap09_evidence_runtime_login_v1
geox_mcft_cap09_twin_runtime_login_v1
~~~

They are not the privilege roles themselves.

Membership model:

~~~text
Evidence LOGIN
        ↓
inherits only geox_mcft_cap09_evidence_runtime_v1

Twin LOGIN
        ↓
inherits only geox_mcft_cap09_twin_runtime_v1
~~~

Cross-plane membership is forbidden.

The service principal bootstrap and runtime startup both verify expected identity.

### C7.7 Phase 5 process/principal qualification is already green

The first key Phase 5 run:

33060881394

completed SUCCESS.

At the latest exact head 8671ac74…, Phase 5 process-packaging run:

33061092188

also completed SUCCESS.

Those runs prove:

- TypeScript;
- production build;
- production PostgreSQL init chain;
- exact database-platform bootstrap + full migration inventory;
- service-principal provisioning;
- real Evidence/Twin login;
- cross-plane DB privilege denial;
- stable compiled Twin entrypoint;
- process authority boundaries.

This is **not** proof that Phase 5 as a whole is complete.

---

## C8. Current exact-head CI nuance — Phase 5 is green but central registration is not closed

At current head:

8671ac74873d2312ee170870bc737927502a9206

important observed runs include:

- Phase5 production-equivalent process-packaging run 33061092188 = SUCCESS;
- ordinary ci = SUCCESS;
- EA5E2 successor runner = SUCCESS;
- EA5E2 runtime dependency graph run 33061092176 = FAILURE.

The graph failure happens before full graph qualification:

~~~text
Generate central applicability plan = FAILURE
Route EA5E2 from central planner = not reached
full graph qualification = not reached
~~~

Current central plan reports these Phase 5 paths as unknown:

- .github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml
- apps/server/scripts/write_dist_entries.cjs
- apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts
- apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts
- apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts
- apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts
- scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts

At that failure:

~~~text
authority_errors = []
resolver_errors  = []
~~~

Therefore this red lane is a bounded central-applicability ownership gap, not evidence that the process packaging itself failed.

Do not rebind the EA5E2 graph digest before central ownership is repaired and the graph generator actually runs.

---

## C9. Current critical Phase 5 frontier — accelerated Evidence provider boundary

This is the most important unfinished engineering point.

### C9.1 Why a tiny fake GFS payload is not acceptable

The product GFS scientific decoder expects the real product scientific geometry / data contract.

The current product SFLUX path expects native regular_gg N=768 scale, including the real point-count contract.

Therefore it is not legitimate to create a tiny fake GRIB merely to make Phase 5 run quickly.

That would prove:

~~~text
test-only decoder path
~~~

not:

~~~text
future production decoder / canonical Evidence path
~~~

The Phase 5 qualification must not “measure another implementation”.

### C9.2 The correct permitted seam

The converged design is to add an injectable work-item factory seam to:

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts

Target API concept:

~~~text
composeEvidenceRuntimeV1(...)
        ↓
optional work_item_factory injection
~~~

Default production behavior must remain:

~~~text
ProductionEvidenceWorkItemFactoryV1
~~~

Only Phase 5 qualification supplies a controlled provider work-item factory.

### C9.3 What the qualification seam must not bypass

After the controlled provider work item enters the Evidence Runtime, the remainder must still be the exact production graph:

~~~text
Evidence Runtime host
        ↓
cycle
        ↓
raw retention
        ↓
canonicalizer
        ↓
fenced governed COMMIT
        ↓
post-COMMIT database visibility
        ↓
EvidenceSupplyCursor
~~~

No Phase 5 qualification adapter may write public.facts directly.

No Phase 5 qualification adapter may advance EvidenceSupplyCursor directly.

No Phase 5 qualification adapter may bypass raw retention.

No Phase 5 qualification adapter may manufacture Twin state.

### C9.4 Current implementation status of this seam

**Not yet committed at this handoff.**

Evidence:

the current #3323 changed-file list does not include:

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts

Therefore the next engineer must not assume the work-item seam already exists.

The design is agreed; implementation and requalification remain.

### C9.5 Phase 3 must be freshly requalified after the seam lands

This is non-negotiable.

The seam changes a Phase 3 composition source.

Even if the default remains ProductionEvidenceWorkItemFactoryV1, the dependency subject changed.

Therefore:

~~~text
modify Phase3 composition
        ↓
fresh Phase3 exact-head requalification
        ↓
do not carry old Phase3 durable evidence blindly
~~~

The qualification must prove:

- default production composition still instantiates ProductionEvidenceWorkItemFactoryV1;
- only the explicit Phase 5 qualification path injects the controlled factory;
- no host / canonicalizer / DB / retention / lease / cursor path changes;
- product process still uses the default production behavior unless explicitly configured for qualification.

---

## C10. Phase 5 work that remains

Do not say “Phase 5 complete” until these are closed at one governed exact head.

### C10.1 Central applicability registration

Register all Phase 5 product / workflow / acceptance paths in the qualification control plane.

Goal:

~~~text
unknown_changed_paths = []
authority_errors = []
resolver_errors = []
~~~

Prefer a bounded Phase 5 resolver or import closure. Do not use a broad wildcard to hide future dependencies.

### C10.2 Implement the Evidence work-item factory seam

Modify the Phase 3 Evidence composition with an optional injected factory.

Default must remain ProductionEvidenceWorkItemFactoryV1.

Add focused proof for default identity.

### C10.3 Fresh Phase 3 requalification

Because Phase 3 composition changes, rerun the exact Phase 3 qualification set and regenerate durable evidence only after the dependency set stabilizes.

Do not register durable evidence early.

### C10.4 Controlled qualification provider adapter

Build a controlled provider boundary that can deterministically produce the provider work items required for accelerated Phase 5.

It must replace only the external provider boundary.

It must not replace scientific/canonical persistence semantics that are supposed to be production-owned.

### C10.5 Evidence qualification process entrypoint

Add a qualification entrypoint that launches the real Evidence process/composition with the controlled work-item factory.

Keep the production entrypoint/default untouched.

### C10.6 Dedicated Phase 5 qualification Compose

Build a dedicated qualification topology, not an accidental production cutover.

Expected roles:

~~~text
PostgreSQL
Evidence Runtime container A
optional duplicate Evidence Runtime container B
Twin Runtime container A
optional duplicate Twin Runtime container B
controlled provider adapter / fixture boundary
qualification clock/control harness
~~~

Do not mutate docker-compose.commercial_v1.yml into the production owner merely to run this test.

### C10.7 Duplicate Evidence-container fencing

Prove:

~~~text
two Evidence containers
        ↓
one valid producer owner
        ↓
stale/losing owner rejected before canonical COMMIT
        ↓
no duplicate canonical Evidence
        ↓
no duplicate cursor advance
~~~

### C10.8 Evidence Runtime restart

Prove restart using durable:

~~~text
Evidence producer lease / fencing
Evidence event ledger
EvidenceSupplyCursor
canonical facts
raw retention references
~~~

Restart must not rely on in-memory target history.

### C10.9 Duplicate Twin-container fencing

Prove two Twin Runtime containers cannot both own the same governed Runtime slot.

Use the existing Phase 4 database-clock lease/fencing path.

Do not implement a container-level mutex that bypasses the database authority.

### C10.10 Twin Runtime restart

Prove restart reconstructs from:

~~~text
RuntimeTickCursor
canonical checkpoint
scheduler slot ledger
canonical persisted Twin / Forecast / Scenario state
~~~

No provider fallback is allowed.

### C10.11 DB reconnect and idempotent retry

Prove both services recover safely from a transient PostgreSQL reconnect.

Important distinctions:

~~~text
retry transport/process failure
!=
repeat semantic write
~~~

Idempotency/fencing must determine whether a write is new, repeated, stale, or conflicting.

### C10.12 Missing Evidence backpressure

When Evidence is unavailable or not yet eligible:

~~~text
Twin Runtime
        ↓
NOT_READY_PRECLAIM / backpressure
        ↓
no provider fallback
        ↓
no guessed evidence
        ↓
no cursor corruption
~~~

### C10.13 Cursor independence

Prove simultaneously:

~~~text
EvidenceSupplyCursor
!=
RuntimeTickCursor
~~~

Evidence publication progress must not be inferred from Twin progress.

Twin tick progress must not mutate Evidence supply state.

### C10.14 Post-COMMIT visibility in the two-service topology

Evidence must become consumable by Twin only after:

~~~text
fenced canonical COMMIT
        ↓
fresh DB readback
        ↓
exact identity verification
        ↓
EvidenceSupplyCursor advancement
~~~

The container topology must not weaken this ordering.

### C10.15 Accelerated full 24T

Only after all previous subproofs stabilize, execute the production-equivalent accelerated O00→O23.

The accelerated clock may replace waiting.

It must not replace:

~~~text
schema
runtime config chain
persistent repositories
scheduler
lease/fencing
host
runner
health
checkpoint
canonical state propagation
forecast
Evidence ingress
Evidence/Twin service separation
~~~

### C10.16 Final Phase 5 exact-head closure

At one final exact head, require:

- Phase5 dedicated qualification workflow PASS;
- ordinary ci PASS;
- central control plane PASS;
- unknown_changed_paths = 0;
- EA5E2 graph PASS;
- successor runner PASS;
- affected Phase3 fresh requalification PASS;
- all duplicate/restart/backpressure/reconnect scenarios PASS;
- accelerated 24T PASS;
- durable Phase5 evidence registered only after dependency state is final;
- no Phase6 ownership cutover;
- no Formal-v5 arm.

---

## C11. Phase 6 and Phase 7 remain out of scope

### C11.1 Phase 6 — not started

Phase 6 is the actual ownership cutover.

Only after Phase 5 production-equivalent qualification closes may the project consider:

~~~text
GitHub routine Evidence acquisition owner → removed
GitHub routine Twin wake/tick owner → removed
long-running service ownership → enabled
deployment / audit workflows remain
~~~

At this handoff:

**Phase 6 has not started.**

Do not delete, disable, or rewrite current routine GitHub ownership paths yet.

### C11.2 Phase 7 / Formal-v5 — not armed

Formal-v5 remains forbidden until the frozen production-hosting prerequisites close.

Do not interpret a green accelerated 24T as Formal qualification.

Do not mutate Graduation.

---

## C12. Failure / repair history — high-value lessons that must survive the conversation

### C12.1 Never test a different implementation just because it is easier to accelerate

This is the most important Phase 5 rule.

Bad pattern:

~~~text
engineering lane
    uses simplified runner / fake decoder
production lane
    uses canonical core / real decoder
~~~

That can yield:

~~~text
engineering PASS
production FAIL
~~~

Phase 5 must share the same canonical production graph.

### C12.2 A fake tiny GFS GRIB is not a valid substitute for the product decoder

If the product decoder requires the native scientific geometry, do not weaken it for qualification.

Use the explicitly permitted provider-adapter seam instead.

### C12.3 Accelerated clock substitutes waiting only

Do not use acceleration to replace:

- scheduler semantics;
- lease expiry semantics;
- persistence;
- checkpoint;
- DB readback;
- canonical processing;
- container ownership;
- Evidence/Twin separation.

### C12.4 Do not give both services one broad database login

The two LOGIN principals are part of the production-equivalence claim.

Do not regress to:

~~~text
one postgres superuser URL for both containers
~~~

because it makes cross-plane ACL proofs meaningless.

### C12.5 Evidence S3 credentials belong only to Evidence Runtime

Twin Runtime must not receive raw-provider / S3 acquisition credentials.

If Twin needs raw-object access to continue, the architecture has regressed.

### C12.6 Twin Runtime must never use provider fallback

The correct missing-Evidence behavior is backpressure / fail-closed.

Never “make the 24T pass” by letting Twin call the provider.

### C12.7 Stale Evidence owner must fail before COMMIT

Cursor failure after a stale canonical write is too late.

Keep the Phase 3 DB fence at the governed canonical write boundary.

### C12.8 Do not collapse publication cadence into event-time cadence

KBS is a daily batch of many hourly events.

Publication availability and event continuity are separate axes.

Do not reintroduce:

~~~text
authority_pass = age <= N hours
~~~

as a universal Evidence admission rule.

### C12.9 Backfill and revision are not the same as duplicate publication

The durable event ledger distinguishes:

- exact idempotent republish;
- later availability update;
- backfill of a missing event;
- governed semantic revision at the same event time.

Keep those cases explicit.

### C12.10 Do not directly grant Evidence Runtime arbitrary INSERT facts

The SECURITY DEFINER governed writer exists because table-level arbitrary INSERT is too broad.

Phase 5 service LOGIN must inherit the privilege role, not bypass it.

### C12.11 Do not directly grant Twin Runtime Evidence-plane coordination rights

Twin consumes governed Evidence through facts.

It must not mutate:

- external_evidence_producer_lease_v1;
- external_evidence_supply_event_v1;
- external_evidence_supply_cursor_v1.

### C12.12 Same-day migration ACL ordering matters

The generic migration runner previously applied ACL before schema because of lexical ordering.

Keep:

~~~text
same-day schema/data
        ↓
same-day ACL
~~~

and continue testing full bootstrap.

### C12.13 Central unknown paths are supposed to fail closed

The current Phase 5 graph red is useful.

Do not hide the nine unknown Phase 5 paths with a broad wildcard.

Register them deliberately.

### C12.14 EA5E2 graph digest is not a magic constant

Correct order:

~~~text
stabilize dependency set
        ↓
central ownership PASS
        ↓
run graph generator
        ↓
inspect expected digest
        ↓
legal carrier rebind if required
~~~

Do not guess or precompute the digest before the full graph step is reached.

### C12.15 Strict lexical gates can be tripped by comments

Earlier phases hit false positives because comments contained forbidden tokens such as RuntimeTickCursor.

Do not weaken the gate.

Fix scanner-safe comments when the dependency is not real.

### C12.16 Historical gates must remain historical

Do not rewrite old EA5C2B1, AM19, Formal, or predecessor gates to accept a new Phase 5 candidate.

Use successor routing / fresh requalification.

### C12.17 Durable evidence must be registered late

Do not register a run before the dependency set is stable.

Any later source/path change can invalidate the digest and force a new exact-head run.

### C12.18 A green focused workflow does not equal stage closure

Phase 5 process-packaging is green.

Phase 5 is still incomplete because:

- central ownership is not closed;
- provider acceleration seam is not implemented;
- duplicate/restart scenarios are not closed;
- accelerated 24T is not run.

### C12.19 Do not turn commercial Compose into production owner during Phase 5 qualification

Phase 5 requires a dedicated production-equivalent qualification topology.

Actual ownership cutover belongs to Phase 6.

### C12.20 Do not mix the B-Line

B-Line is a parallel project line.

Do not “helpfully” resolve an MCFT-9 blocker by importing unintegrated B-Line semantics.

---

## C13. Recommended exact execution sequence from this handoff

### Step 1 — lock the current Phase 5 exact head

Verify:

~~~text
#3323 Draft = true
#3323 base = 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
#3323 head = expected current head
protected main = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
~~~

If head changed, do not reuse the exact run assumptions below blindly.

### Step 2 — repair Phase 5 central applicability ownership

Register all current nine Phase 5 paths.

Rerun central applicability.

Target:

~~~text
unknown_changed_paths = []
~~~

Do this before graph digest work.

### Step 3 — implement the work_item_factory seam in Phase 3 composition

Keep default:

ProductionEvidenceWorkItemFactoryV1

Inject only in explicit qualification composition.

Add focused default-identity and injection-boundary tests.

### Step 4 — rerun fresh Phase 3 qualification

Because the Phase 3 composition source changed, obtain new exact-head Phase 3 evidence.

Do not carry the old Phase 3 run solely because behavior is intended to be identical.

### Step 5 — add controlled provider adapter / work-item factory

Make it deterministic and explicit.

Do not write canonical facts directly.

### Step 6 — add Evidence qualification entrypoint

Launch the same production Evidence host/process graph with only the provider work-item factory substituted.

### Step 7 — add dedicated qualification Compose

Keep commercial production ownership unchanged.

Use real service LOGIN principals.

### Step 8 — duplicate/restart/fencing matrix

Execute:

~~~text
duplicate Evidence
Evidence restart
duplicate Twin
Twin restart
DB reconnect
idempotent retry
missing Evidence
~~~

### Step 9 — accelerated O00→O23

Only after the topology and failure matrix are green.

### Step 10 — final central / graph / durable evidence closure

Run all required exact-head workflows.

Register durable evidence only at the stable final Phase 5 dependency set.

Then and only then evaluate opening Phase 6.

---

## C14. First 45 minutes for the next engineer

### Minute 0–5 — restore authority

Read:

- docs/SSOT.md;
- MCFT Master Task Line;
- docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md;
- frozen production-hosting route;
- this current section;
- the preserved historical Phase 2 snapshot below if a dependency history is unclear.

### Minute 5–10 — verify stacked SHAs

Confirm:

~~~text
main   = 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
Phase2 = c3346768a44b16b127378cb690ada1d8cfec1049
Phase3 = 0e874b254c695b32fd94c7dc7034fd71b8aa3bc3
Phase4 = 16ff7160473c0a25dc059db6b2b6b7ba07f54dd1
Phase5 base = 16ff7160…
~~~

### Minute 10–15 — inspect #3323 current changed files

If mcft_cap09_evidence_runtime_composition_v1.ts is now changed, the work-item seam has started and Phase 3 fresh requalification is mandatory.

If it is not changed, do not assume the seam exists.

### Minute 15–20 — inspect central red

Current known exact-head central red is unknown Phase 5 paths.

Check whether that is still true before making any graph change.

### Minute 20–30 — implement the smallest central ownership patch

Use an exact Phase 5 resolver / bounded import closure.

No wildcard.

Rerun central.

### Minute 30–45 — implement/inspect the qualification work-item seam

Verify:

~~~text
production default factory unchanged
qualification injection explicit
no direct facts write
no direct cursor write
raw retention preserved
canonicalizer preserved
fenced COMMIT preserved
post-COMMIT visibility preserved
~~~

---

## C15. High-value exact file map

### Frozen route / task authority

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md

### Central control plane

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json

docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json

scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs

.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml

### Phase 3 Evidence Runtime

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_supply_cadence_profile_v1.ts

apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.ts

apps/server/src/persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.ts

apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_persistence.sql

apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_acl.sql

### Phase 4 Twin Runtime

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts

apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.ts

apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts

apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts

apps/server/db/migrations/2026_08_27_mcft_cap_09_phase4_twin_runtime_acl.sql

.github/workflows/mcft-cap-09-phase4-twin-runtime-persistence.yml

### Phase 5 product packaging

apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.ts

apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts

apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts

apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts

apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts

apps/server/scripts/write_dist_entries.cjs

.github/workflows/mcft-cap-09-phase5-production-equivalent-containers.yml

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts

scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1.ts

### EA5E2 graph

scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs

scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs

.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml

---

## C16. Exact commits / runs worth preserving in the mental model

### Phase 2 closure

c3346768a44b16b127378cb690ada1d8cfec1049

### Phase 3 closure

0e874b254c695b32fd94c7dc7034fd71b8aa3bc3

Central:

33039951208 = SUCCESS

Phase3:

33039951199 = SUCCESS

### Phase 4 closure

16ff7160473c0a25dc059db6b2b6b7ba07f54dd1

Central:

33048911662 = SUCCESS

Phase4:

33048911787 = SUCCESS

Ordinary ci:

33048911663 = SUCCESS

### Phase 5 initial packaging commits

1c6d88d62b59998ec65897651f8b052c207c5546
feat(mcft-cap09): add production process lifecycle adapters

a65f0e610f3615b9d8f6c034c6c8855c85ff7157
feat(mcft-cap09): add Twin Runtime production process

d025f6dd4ac1ddca430c132760901e365294944d
build(mcft-cap09): package Twin Runtime entrypoint

158ab8cb7d171ae02c09ed410af37555287cf300
feat(mcft-cap09): add Evidence Runtime production process factory

e956cd4306f030d7abcc4771ef422735451bfdb3
test(mcft-cap09): qualify Phase5 process boundaries

89883b065e651cc64e12175d8bbf9757cc7bb407
ci(mcft-cap09): qualify Phase5 production process packaging

548633baba6f11eee23acc586198bec351cb844d
feat(mcft-cap09): add isolated service database principals

b34fcec573db272b55ac45c2da23ea3cb127a0ba
fix(mcft-cap09): harden service principal bootstrap SQL

c7d81ae84e359c74bf24d9e95347939930a279ee
fix(mcft-cap09): verify Twin Runtime database principal on startup

0627ecc41c0613b68c9950e1bf829b945020c62e
fix(mcft-cap09): verify Evidence Runtime database principal on startup

b9f7294ae403e6e4766735b8cd918ca308ede0d5
test(mcft-cap09): qualify isolated service database principals

d1741bbfc96d0855419b1b5cb084eab757b1d21a
ci(mcft-cap09): qualify isolated Phase5 service principals

5ae3a6acbfa2a5afb43fd997d865f1ae00ae4ede
feat(mcft-cap09): add service principal bootstrap entry

8671ac74873d2312ee170870bc737927502a9206
build(mcft-cap09): package Phase5 principal bootstrap

### Phase 5 key runs

33060881394 = Phase5 process-packaging SUCCESS

33061092188 = latest exact-head Phase5 process-packaging SUCCESS

33061092176 = EA5E2 graph FAILURE at central applicability plan because current Phase5 paths are unregistered

---

## C17. Exact non-effects that still hold

As of this handoff:

- protected main remains unchanged;
- #3299 remains Draft / unmerged;
- #3308 remains Draft / unmerged;
- #3315 remains Draft / unmerged;
- #3323 remains Draft / unmerged;
- B-Line is untouched;
- production commercial Compose is not the new owner;
- Phase 6 GitHub ownership cutover has not started;
- Formal-v5 is not armed;
- Graduation is not mutated;
- Evidence Runtime is not allowed to mutate Twin canonical state;
- Twin Runtime is not allowed to fetch provider/R2 fallback;
- Twin Runtime does not receive Evidence S3 credentials;
- Evidence and Twin service LOGIN principals remain separated;
- accelerated 24T has not yet been executed as the Phase 5 production-equivalent proof;
- Phase 5 is not complete;
- MCFT-CAP-09 is not complete.

---

## C18. Current blockers / not-blockers

### Current real blockers

1. Phase 5 paths are not yet centrally registered, so EA5E2 graph routing fails closed at the planner.
2. The controlled accelerated Evidence provider boundary is not yet implemented.
3. Phase 3 work-item factory seam is not yet committed.
4. Fresh Phase 3 requalification after that seam is still required.
5. Dedicated qualification Compose is not yet built.
6. duplicate Evidence / duplicate Twin fencing is not yet qualified.
7. Evidence restart / Twin restart is not yet qualified in the Phase 5 two-service topology.
8. DB reconnect / idempotent retry / missing Evidence backpressure is not yet qualified in that topology.
9. accelerated O00→O23 has not yet run.
10. final Phase 5 durable evidence / central closure is not yet registered.

### Not blockers / already solved

- Phase 2 provider productization;
- Phase 3 durable Evidence Runtime;
- Phase 3 DB writer authority;
- stale Evidence pre-COMMIT fencing;
- daily-batch-aware EvidenceSupplyCursor;
- Phase 4 long-running Twin Runtime host;
- DB-clock scheduler;
- RuntimeTickCursor persistence;
- Twin restart/fencing/checkpoint;
- read-only successor viability;
- Twin ACL;
- same-day migration ACL ordering;
- first-layer Phase 5 process packaging;
- separate Evidence/Twin service principals;
- stable compiled Twin entrypoint.

Do not reopen solved layers unless a new dependency change actually invalidates them.

---

## C19. Handoff bottom line

The project is no longer at the Phase 2 KBS/graph frontier preserved in the historical section below.

The exact current state is:

~~~text
Phase 2
production Evidence provider modules
machine closed at c3346768…
        ↓
Phase 3
durable Evidence Runtime
DB writer authority
pre-COMMIT fencing
two-axis EvidenceSupplyCursor
daily-batch / gap / backfill / revision qualification
machine closed at 0e874b25…
        ↓
Phase 4
long-running Twin Runtime
DB-clock scheduler
RuntimeTickCursor
restart / fencing / checkpoint
read-only successor viability
Twin ACL
machine closed at 16ff7160…
        ↓
Phase 5
production-equivalent containers
IN PROGRESS
current head 8671ac74…
        ↓
shared process lifecycle exists
Twin production process exists
Evidence production process exists
stable compiled Twin entry exists
separate DB URLs exist
independent Evidence/Twin LOGIN principals exist
cross-plane DB denial is machine-proved
Phase5 process-packaging is green
        ↓
BUT
central Phase5 path ownership is not closed
accelerated provider seam is not implemented
Phase3 composition seam is not committed
fresh Phase3 requalification remains
dedicated qualification Compose remains
duplicate/restart/reconnect/backpressure matrix remains
accelerated full 24T remains
        ↓
Phase5 remains IN PROGRESS
Phase6 ownership cutover NOT STARTED
Formal-v5 NOT ARMED
MCFT-CAP-09 NOT COMPLETE
~~~

The immediate next action is **not** to fake a small GFS product, not to start Phase 6, and not to modify commercial Compose into the production owner.

The immediate sequence is:

~~~text
register current Phase5 paths centrally
        ↓
central unknown_changed_paths = 0
        ↓
implement optional work_item_factory seam in Phase3 composition
production default remains ProductionEvidenceWorkItemFactoryV1
        ↓
fresh Phase3 requalification
        ↓
controlled Phase5 provider adapter
        ↓
same production Evidence host/cycle/retention/canonicalizer/fenced COMMIT/visibility/cursor
        ↓
dedicated qualification Compose
        ↓
duplicate/restart/fencing/backpressure/reconnect matrix
        ↓
accelerated O00→O23 with clock-only acceleration
        ↓
final central / graph / durable-evidence closure
        ↓
only then consider Phase6
~~~

Keep #3323 Draft.

Keep #3315 frozen.

Keep protected main untouched.

Keep B-Line separate.

Keep Phase 6 closed.

Keep Formal-v5 unarmed.

---

# Historical snapshot retained below — original 2026-08-27 Phase 2 continuation

The following section is the original 2026-08-27 Phase 2 frontier. It is intentionally retained so later engineers can reconstruct why the current Phase 3/4/5 architecture exists. Treat its “current” language as historical relative to the C0–C19 continuation above.

## 0. READ THIS FIRST — mandatory authority order

Before changing MCFT-CAP-09 runtime, workflow, schema, database, provider, scheduler, Compose, production ownership, Formal, Graduation, or qualification-control-plane logic, reconstruct authority in this order:

1. repository-level SSOT / frozen repository authority;
2. MCFT Master Task Line / digital-twin total task book;
3. applicable CAP Taskbooks;
4. accepted CAP-01→08 predecessor evidence;
5. immutable Formal-v4 NO-GO authority;
6. frozen v13 successor subject;
7. qualification control-plane / CP-5 closure;
8. frozen production-hosting architecture route;
9. Production Hosting Phase 1 closure;
10. `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md` for the initial Phase 2 takeover state;
11. **this handoff** for the current Phase 2 implementation frontier;
12. current exact-head GitHub Actions evidence.

### 0.1 Mandatory frozen architecture document

Read in full before continuing Phase 2:

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

Frozen architecture commit:

`2f7a065cc95e4a5a2c95411fb381fe5e4479d645`

Hard architecture:

```text
External Providers
        ↓
Evidence Runtime / Live Evidence Plane
        ↓
governed database Evidence
        ↓
Twin Runtime Plane
        ↓
canonical Twin state / Forecast / Scenario / checkpoint
```

Evidence Runtime and Twin Runtime are separate production roles.

GitHub Actions remains CI / qualification / deployment / independent audit. It must not become the routine production provider clock, the Twin tick scheduler, or the production cadence owner.

### 0.2 Do not mix the numbering systems

Capability sequence:

```text
MCFT-CAP-01 → MCFT-CAP-09
```

Qualification-control-plane sequence:

```text
CP-0 → CP-5
```

Production-hosting migration sequence:

```text
Phase 0
Phase 0A
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
```

There is no frozen `CP-6`.

`Phase 6` in the production-hosting plan means production ownership cutover, not a qualification-control-plane phase.

---

## 1. Current task in one sentence

**Continue Production Hosting Phase 2 by making the KBS Raw Hourly Evidence path fully governed and qualification-equal-to-production, then productize the remaining GFS scientific core, while preserving post-COMMIT visibility / EvidenceSupplyCursor ordering and without starting Phase 3, a production Evidence Runtime host, Compose, Formal-v5, or production cadence ownership.**

---

## 2. Exact authority / branch / PR state at handoff time

### 2.1 Protected main

Protected `main` remains:

`26c1383f7f45abb76c99e28ec3d06714e85d1b2c`

No Phase 2 implementation work in this conversation has been merged into protected `main`.

Do not casually rebase Phase 2 onto a later main.

Any main movement must be treated as a new authority event, not as a harmless sync.

### 2.2 CP-5 predecessor

CP-5 closure predecessor remains:

PR #3291 exact head:

`14653ba622bb12261a1ea79f3ea7e42be0b49f92`

### 2.3 Production Hosting Phase 1 predecessor

Phase 1 implementation / qualification predecessor remains:

PR #3297 exact head:

`8943c752a354cb916cc7f144681203aa9a19f70b`

This is the exact base of the current Phase 2 implementation PR.

### 2.4 Current Phase 2 implementation PR

Draft PR:

**#3299 — `refactor(mcft-cap09): phase2a extract production Evidence provider seams`**

Branch:

`feat/mcft-cap09-phase2-evidence-production-modules-v1`

Base:

`feat/mcft-cap09-phase1-typed-runtime-composition-v1`

Exact base SHA:

`8943c752a354cb916cc7f144681203aa9a19f70b`

Current exact head at this handoff:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

At verification time:

```text
state      = open
Draft      = true
merged     = false
mergeable  = true
commits    = 35
files      = 18
additions  = 2156
deletions  = 264
```

Do not merge #3299 merely because individual lanes are green.

Phase 2 is not closed.

### 2.5 Conversation handoff PR

The docs-only conversation handoff remains in:

PR #3298

Branch:

`docs/mcft-cap09-handoff-2026-08-26-phase2-evidence-module-frontier`

It is deliberately separate from #3299 so handoff edits do not perturb the implementation PR's controlled dependency graph.

The 2026-08-27 handoff is added to that docs-only branch.

---

## 3. Current phase map

```text
CP-5 exact-head closure                         PASS / HISTORICAL CLOSED
        ↓
Phase 1 typed Runtime composition               PASS / HISTORICAL CLOSED
        ↓
CAP08_FROZEN_REPLAY_EQUIVALENCE                 PASS / HISTORICAL CLOSED
        ↓
Phase 2 production Evidence productization      IN PROGRESS  ← CURRENT
        ↓
Phase 3 Evidence Runtime host                   BLOCKED ON PHASE 2
        ↓
Phase 4 Twin Runtime host                       BLOCKED
        ↓
Phase 5 two-service accelerated 24T             BLOCKED
        ↓
Phase 6 production ownership cutover            BLOCKED
        ↓
Phase 7 fresh Formal-v5                         FORBIDDEN / NOT ARMED
```

MCFT-CAP-09 remains:

```text
IN PROGRESS
NOT COMPLETE
NOT GRADUATED
FORMAL-V5 NOT ARMED
PRODUCTION OWNERSHIP NOT CUT OVER
```

---

## 4. Frozen Phase 2 boundary — what belongs here

Phase 2 is the production-module extraction / composition phase for the Evidence plane.

Allowed Phase 2 concerns include:

```text
provider acquisition
HTTPS transport
scientific decoding
raw-retention-first composition
canonical Evidence construction
governed Evidence ingress composition
post-COMMIT physical visibility proof
EvidenceSupplyCursor contract / ordering
qualification proving future production uses the same modules
machine governance of exact changed paths / dependencies
```

Phase 2 does **not** mean:

```text
production Evidence Runtime host
production cadence loop
durable Evidence Runtime ownership
production scheduler
lease/fencing owner
Compose service activation
durable EvidenceSupplyCursor database table
cursor migration
Formal-v5
Graduation
production Twin Runtime host
```

The most important boundary reconfirmed during this conversation is:

**Phase 2 requires the EvidenceSupplyCursor contract/composition and the ordering proof. Durable cursor persistence belongs to Phase 3.**

Therefore do not add a cursor table or migration now just because an `EvidenceSupplyCursorPortV1` exists.

---

## 5. What Phase 2 has materially completed so far

This section records only work that actually entered the current Phase 2 implementation lineage.

### 5.1 Formal HTTPS transport exists in product tree

Product module:

`apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts`

This is the production Evidence transport seam used by the product provider modules.

The intent is to avoid a future architecture where qualification fetches one way and production fetches another way.

### 5.2 KBS variate-25 soil provider was extracted into product tree

Product module:

`apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts`

Historical `formal_live_kbs_soil_ingress_executor_v1.ts` was retained as compatibility composition while provider/decoder behavior moved toward formal product modules.

Historical EA5C2B1 authority was not rewritten.

### 5.3 Historical EA5C2B1 governance was preserved by successor routing

The old EA5C2B1 gate was a historical exact-base / exact-candidate gate.

It was not legal to simply edit that old gate to pretend the Phase 2 candidate was the historical candidate.

The correct repair was:

```text
historical gate stays historical
        +
Phase 2 successor requalification gate
        +
exact Phase 1 predecessor
```

Current successor governance gate:

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs`

It requires exact Phase 1 base:

`8943c752a354cb916cc7f144681203aa9a19f70b`

It freezes historical authority dependencies and permits only explicitly declared sensitive deltas.

### 5.4 EA5E2 / AM19 governance history was repaired without rewriting history

During Phase 2 extraction, several dependency closures legitimately changed.

The work did **not** rewrite historical evidence.

Instead it used:

```text
successor requalification
rolling dependency graph rebind
durable requalification evidence
exact predecessor sets
```

A historical AM19 V3/V4 authority-symbol mismatch was discovered only after an older base guard stopped masking it.

The Phase 1 base already contained that mismatch.

It was therefore wrong to "fix" the historical runner as if Phase 2 had caused it.

The solution was a byte-locked generated compatibility subject:

`scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts`

That compatibility proof does not mutate the historical runner, does not activate persistent Formal execution, and does not convert a historical qualification inconsistency into a new runtime semantic change.

### 5.5 Central control-plane reached a historical all-green Phase 2 point

At exact head:

`11c44224cf95b102164c27d73190db30749d8fe2`

commit:

`gov(mcft-cap09): govern phase2 visibility and supply cursor modules`

the Phase 2 visibility/cursor paths were explicitly registered in the central control plane.

At that point, repository Actions evidence showed ordinary `ci` SUCCESS.

During the same stabilized lineage, central control-plane, EA5E2 graph, successor runner, and AM19 reached SUCCESS before the next KBS Raw Hourly adapter delta moved the governed dependency frontier again.

This is important:

**do not interpret the current red central/EA5E2 status as proof that those mechanisms are fundamentally broken. They were closed before the new KBS adapter became a new governed dependency.**

### 5.6 Post-COMMIT visibility entered product tree

Product Evidence-plane composition:

`apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts`

Product PostgreSQL read-only visibility adapter:

`apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts`

The frozen ordering is:

```text
governed ingress returns after COMMIT
        ↓
fresh PostgreSQL readback
        ↓
exact committed Evidence identity verification
        ↓
EvidenceSupplyCursor advance
```

The product composition is:

`PostCommitVisibleExternalFormalEvidenceIngressV1`

The PostgreSQL adapter performs a fresh read of `public.facts` by exact `fact_id` and verifies:

```text
record_type
source_record_id
source_record_hash
semantic hash
retention_ref
raw_sha256
raw_bytes
```

before cursor advancement is allowed.

There is no raw-object fallback in the visibility adapter.

### 5.7 EvidenceSupplyCursor is currently a contract / port, not durable state

The Phase 2 contract is:

`EvidenceSupplyCursorPortV1`

with:

`advanceAfterVisibleEvidence(...)`

This proves the supply-side ordering seam.

It does **not** create:

```text
cursor table
cursor migration
durable cursor repository
scheduler
lease/fencing
runtime host
production cadence owner
```

Those belong to Phase 3.

### 5.8 Visibility/cursor acceptance was repaired for Node 20 / tsx

Acceptance:

`scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1.ts`

The initial version used:

`import.meta.dirname`

under the Node 20 / tsx execution path.

That caused startup failure before the actual acceptance semantics ran.

Commit:

`2e482bbbdc7abea4240391b0e334315d2ec8a1d0`

changed the root resolution to:

`path.resolve(process.cwd())`

The important lesson is that this was an acceptance bootstrapping defect, not an Evidence ordering defect.

After the repair, the post-COMMIT visibility / cursor-ordering proof executed.

### 5.9 KBS Raw Hourly scientific core is now product-owned

Product Python scientific core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

The current product core owns, among other things:

```text
KBS Raw Hourly CSV header discovery
provider UTC timestamp parsing
exact target-hour row selection
provider-latest diagnostic age
rainfall range checks
temperature / vapor / solar / wind checks
10 m → 2 m wind factor
W/m² → MJ/m²/h conversion
ASCE short hourly ET0 via refet
exact interval JSON result
```

The current core is no longer a wrapper around the old EA4 acceptance Python.

It imports product/runtime dependencies directly:

```text
numpy
refet
```

and does not import from `scripts/runtime_acceptance`.

That is a material improvement over the earlier Phase 2 frontier.

### 5.10 KBS Raw Hourly TypeScript product adapter exists

Product adapter:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

It exports:

```text
KbsRawHourlyLiveTransportV1
KbsRawHourlyExactIntervalDecoderV1
```

Transport behavior reuses:

`HttpsExternalEvidenceTransportV1`

The scientific decoder invokes the product-owned Python core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

The TypeScript adapter does not own:

```text
raw retention
database writer
scheduler
lease/fencing
Twin state mutation
GitHub run identity
production cadence ownership
```

The product Python core is invoked as a scientific decoding process, not as an acceptance runner.

### 5.11 KBS Raw Hourly successor governance explicitly recognizes the product modules

Current Phase 2 successor gate explicitly names:

```text
apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts
apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py
```

and checks forbidden dependency markers.

The gate deliberately rejects product scientific code that contains direct qualification/runtime-control dependencies such as:

```text
scripts/runtime_acceptance
acceptance-output
MCFT_SUBJECT_SHA
GITHUB_
github.run
importlib.util
subprocess
os.environ
tempfile
urlopen
INSERT INTO
RuntimeTickCursor
twin_state
```

for the Python scientific core.

### 5.12 Strict lexical governance caught a comment-only false positive

The KBS TypeScript adapter originally contained the literal marker:

`RuntimeTickCursor`

inside a comment describing what the adapter does **not** own.

The strict successor gate is lexical and rejected that marker.

This was not an actual RuntimeTickCursor import or dependency.

The correct response was **not** to weaken the gate.

Commit:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

changed only the comment wording:

`RuntimeTickCursor` → `runtime tick cursor`

and preserved the gate.

This exact pitfall must not be "fixed" later by broadening or disabling the forbidden-marker check.

---

## 6. Current exact-head status — `b24c8109…`

Current #3299 exact head:

`b24c81097da101f5f17ba4d72b8761d54d53505e`

### 6.1 Current green lanes

At this head, verified successful lanes include:

```text
EA5E2 successor runner qualification
AM19 persistent-24T static/successor qualification
EA5C2B1 live KBS soil successor qualification
release-lane / policy / ruleset related checks
candidate declaration checks
```

These successes mean the current problem should not be diagnosed as a generic runtime collapse.

### 6.2 Current central control-plane red

Current run:

`mcft-cap-09-qualification-control-plane-v1`

run:

`32995220687`

job:

`98262519972`

fails at:

`Prove generation, durable-anchor, and dependency-digest semantics`

The preceding steps pass:

```text
Checkout exact control-plane subject                     PASS
Require governed successor predecessor                  PASS
Prove central applicability semantics                   PASS
```

The failure occurs before immutable evidence resolution / exact PR blocker enumeration.

### 6.3 Current EA5E2 graph red happens before full graph qualification

Current run:

`mcft-cap-09-ea5e2-runtime-dependency-graph`

run:

`32995220862`

job:

`98262520479`

fails at:

`Generate central applicability plan`

The following graph steps are skipped:

```text
Route EA5E2 from central planner                    SKIPPED
Run full EA5E2 runtime dependency qualification     SKIPPED
Validate full EA5E2 qualification proof             SKIPPED
```

Therefore:

**there is no current generated expected graph digest from this head that is safe to bind yet.**

Do not edit the carrier digest speculatively.

### 6.4 Exact central-planner gap causing the current frontier

The current central authority defines:

`PHASE2_EVIDENCE_PROVIDER_MODULES`

as an exact path set.

It currently includes the KBS product Python core:

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

but it does **not** currently include the new TypeScript adapter:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

This is the key current governance drift.

The adapter exists in the product tree and is recognized by the KBS successor gate, but the central Phase 2 resolver has not yet been advanced to own that exact path.

This is why the next step starts in central planning, not by changing the EA5E2 digest.

---

## 7. EA5E2 graph capability already supports the required fix

EA5E2 graph acceptance:

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs`

already has explicit sets:

```text
ENTRY
STATIC
MUST
```

and an import/discovery closure.

It is not necessary to introduce a directory wildcard to govern the KBS product modules.

The graph can explicitly add stable production dependencies.

For the KBS Raw Hourly path, the intended governance approach is:

```text
explicit exact product adapter path
+
explicit exact product Python scientific-core path
+
existing import/generated closure
```

not:

```text
apps/server/src/external_evidence/provider/**
```

as a semantic dependency declaration.

Workflow path triggers may remain broad where historically required, but the governed runtime dependency graph itself must remain explicit and reviewable.

---

## 8. What remains incomplete in the KBS Raw Hourly path

### 8.1 Central control-plane registration

Add the exact adapter path:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

to the appropriate Phase 2 control-plane resolver / governed dependency set.

Do not solve this with an unknown-path exemption.

Do not solve it with a branch-name exemption.

### 8.2 EA5E2 production dependency graph registration

Once central planning recognizes the path, add the KBS adapter + scientific core to EA5E2 graph using the existing explicit STATIC/MUST mechanism as appropriate.

Do not change the rolling carrier digest before this governed path set is stable and the graph generator actually runs.

### 8.3 Focused qualification of the actual product adapter is still required

The repository now contains:

```text
KbsRawHourlyLiveTransportV1
KbsRawHourlyExactIntervalDecoderV1
```

but Phase 2 is not closed merely because those classes exist and the Python core selftest passes.

A focused qualification must actually instantiate:

`KbsRawHourlyLiveTransportV1`

and:

`KbsRawHourlyExactIntervalDecoderV1`

and prove that qualification is executing the same implementation intended for future production.

The test should prove at minimum:

```text
real product transport class is instantiated
real product decoder class is instantiated
decoder calls product-owned Python core
same exact-T semantics
same diagnostic freshness semantics
same ASCE ET0 method/version
no acceptance Python implementation used as scientific authority
no GitHub run identity required
no direct DB writer
no scheduler
no RuntimeTickCursor
no Twin state mutation
no production cadence activation
```

This focused qualification is the missing bridge between:

```text
"product module exists"
```

and:

```text
"qualification proves future production uses this module"
```

### 8.4 KBS current production-core caveat from earlier audit is resolved

Earlier in the Phase 2 conversation, an intermediate KBS product-core version still loaded EA4 qualification helpers.

That is no longer true at current head.

Do **not** carry that old blocker forward.

At `b24c8109…`, the KBS product Python core contains its own parsing / exact-T / ET0 implementation and the successor gate explicitly forbids `scripts/runtime_acceptance`.

The remaining KBS blocker is governance + focused product-adapter qualification, not acceptance-Python import removal.

---

## 9. GFS scientific core remains the larger Phase 2 debt

After KBS Raw Hourly closes, Phase 2 still is **not** complete.

GFS scientific/provider logic still needs the same productization treatment.

The remaining GFS scientific debt includes, at minimum:

```text
cycle selection
provider-cycle availability semantics
NOMADS / GFS acquisition semantics
GRIB / eccodes decoding
APCP accumulation differencing
solar integration / interval semantics
ASCE ET0 computation
quality / exact-source / exact-time handling
```

The frozen rule is:

**do not create one GFS algorithm for qualification and a different simplified GFS algorithm for production.**

The product module must become the implementation both use.

A valid Phase 2 GFS extraction should end with:

```text
qualification runner
        ↓
product GFS provider / scientific core
        ↓
same future production Evidence module
```

not:

```text
qualification-only Python
        +
new production rewrite
```

---

## 10. Phase 2 visibility / cursor closure semantics

The current Evidence-plane order is a hard contract:

```text
raw provider bytes
        ↓
durable raw retention
        ↓
decode retained bytes
        ↓
canonicalize Evidence
        ↓
governed DB ingress
        ↓
COMMIT
        ↓
fresh DB readback
        ↓
exact identity verification
        ↓
EvidenceSupplyCursor advance
```

Two ordering rules must not be weakened:

1. raw retention occurs before decode / canonical Evidence admission;
2. EvidenceSupplyCursor advances only after committed Evidence is physically visible and identity-matched.

If fresh readback returns:

```text
0 rows
>1 row
wrong source_record_hash
wrong semantic hash
wrong raw provenance
missing fact_id
```

cursor advancement must fail closed.

---

## 11. Phase 2 vs Phase 3 — do not cross this line

### Phase 2 owns

```text
EvidenceSupplyCursorPortV1
cursor advance request/result contract
ordering composition
post-COMMIT visibility
read-only visibility adapter
focused qualification
provider/scientific product modules
```

### Phase 3 owns

```text
durable Evidence Runtime host
durable cursor persistence
cursor table / migration if frozen design requires it
lease/fencing
restart/recovery ownership
provider cadence loop
runtime process lifecycle
production configuration / secrets binding
Compose service if authorized
```

Do not add Phase 3 artifacts to #3299 to make Phase 2 "look complete."

---

## 12. Exact non-effects that still hold

At current frontier, none of the Phase 2 work authorizes or performs:

```text
protected main mutation
production Evidence Runtime activation
production Twin Runtime activation
production provider cadence ownership
Runtime provider fallback
Formal-v5 arm
Formal database production mutation
Graduation
MCFT-CAP-09 completion
Phase 3 durable EvidenceSupplyCursor persistence
new cursor table
new cursor migration
production Compose service
```

Keep these explicit in every Phase 2 acceptance result and governance gate.

---

## 13. Failure / repair history that must be remembered

### 13.1 EA5E2 graph digest is not a magic constant

Earlier Phase 2 changes legitimately changed the governed graph.

A stale carrier digest caused failure.

The safe sequence is:

```text
finish exact governed path set
        ↓
central planner PASS
        ↓
run generated graph
        ↓
read generated expected digest
        ↓
only then rebind carrier
        ↓
rerun exact-head graph qualification
```

Do not guess the digest.

### 13.2 Distinguish inner frozen authority from rolling carrier binding

Do not see one digest mismatch and change every digest-like value.

Historical/frozen graph identity and rolling successor carrier identity may be different layers.

Changing the wrong layer rewrites history.

### 13.3 Unknown changed paths are supposed to fail closed

When central planning says a path is unknown, that is not CI noise.

It means the control plane has no machine-owned reason why the path is allowed to change.

The repair is:

```text
explicit resolver ownership
+
exact predecessor
+
qualified execution workflow
```

not:

```text
ignore unknown path
```

### 13.4 Do not use broad directory wildcards as governance semantics

The EA5E2 graph can name STATIC/MUST product dependencies explicitly.

Use that.

Avoid turning Phase 2 governance into:

`provider/**`

because it destroys the ability to tell which files are actually part of the qualified runtime graph.

### 13.5 Strict lexical gates can be triggered by comments

The `RuntimeTickCursor` comment incident proves this.

When a forbidden marker appears only in commentary:

- verify it is not a real dependency;
- keep the gate strict;
- remove/rephrase the misleading literal from the comment.

Do not weaken the gate just because a false positive is inconvenient.

### 13.6 Node 20 / tsx does not guarantee `import.meta.dirname`

The visibility acceptance failed before test execution because it relied on:

`import.meta.dirname`

The stable repo-root execution path used:

`path.resolve(process.cwd())`

For future acceptance scripts, do not introduce runtime-specific path assumptions without proving them in the repository's pinned Node/tsx environment.

### 13.7 Do not rewrite historical gates to accept new candidates

EA5C2B1 and AM19 both showed why this is dangerous.

Historical gate:

```text
historical subject
historical base
historical blobs
historical meaning
```

Successor change:

```text
new exact predecessor
new successor gate
new requalification evidence
```

Do not turn the historical gate into a moving allowlist.

### 13.8 Do not "fix" a pre-existing historical failure as a Phase 2 semantic change

The AM19 V3/V4 symbol mismatch existed in the Phase 1 base.

Phase 2 merely exposed it after a base guard was repaired.

The correct repair was a byte-frozen compatibility proof, not changing the historical runner.

### 13.9 Do not register durable requalification evidence too early

If a workflow or dependency path will still change, its digest can change again.

The safe sequence is:

```text
finish governing code
        ↓
exact-head successful run
        ↓
final dependency digest
        ↓
immutable evidence binding
        ↓
durable anchor
```

Registering evidence before the dependency graph stabilizes creates immediately stale evidence.

### 13.10 Separate independent red lanes

Do not assume:

```text
central red
EA5E2 red
AM19 red
KBS red
```

all have one cause.

Earlier in this conversation, several were independently classified:

```text
dependency graph requalification
historical base guard
historical V3/V4 compatibility
central evidence registry
```

Always inspect the exact failed step before editing code.

### 13.11 A green successor runner does not mean the graph is closed

At current `b24c8109…`:

successor runner is green while the EA5E2 graph workflow fails in central planning.

These are different proofs.

Do not infer graph closure from runner success.

### 13.12 A product class existing is not enough

For KBS Raw Hourly, the TypeScript adapter exists.

Phase 2 still requires focused qualification to instantiate it.

The architecture requirement is:

**qualification implementation == future production implementation**

not merely:

**qualification semantics approximately match product code.**

---

## 14. Current KBS Raw Hourly semantic facts to preserve

The current product scientific core preserves these important semantics:

### 14.1 Exact target-hour admission

The target must be canonical UTC hour.

There must be exactly one matching row at target T.

### 14.2 Provider availability vs historical freshness diagnostic

The old `<=6h` concept remains diagnostic.

It is not the late-authoritative admission gate.

Current product result explicitly carries:

`freshness_is_late_authoritative_admission_gate: false`

Do not regress to:

```text
authority_pass = age <= 6h
```

### 14.3 Plausibility / quality bounds

Current core validates finite and bounded:

```text
rainfall
air temperature
actual vapor pressure
solar radiation
wind
ET0
```

Do not silently remove these checks in a future "production rewrite."

### 14.4 ASCE hourly ET0 method

Current core uses `refet.Hourly` with:

`method="asce"`

and the product adapter records:

`method_version: "refet-0.4.2"`

Keep qualification and future production on the same method.

---

## 15. Current central-control-plane repair sequence

The immediate repair sequence should be:

### Step A — lock exact head

Before modifying anything:

```text
PR #3299 head
PR #3299 base
protected main
current workflow runs
```

If head moved from `b24c8109…`, rebuild evidence from the new exact head.

### Step B — register the missing KBS adapter path centrally

Add exact:

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

to the appropriate Phase 2 resolver / control-plane ownership.

Do not add an unknown-path escape hatch.

### Step C — rerun central plan before graph digest work

The expected signal is that the central planner gets past the current exact-path ownership problem.

Only after that should EA5E2 proceed to generated graph qualification.

### Step D — add KBS adapter + core to EA5E2 graph explicitly

Use existing STATIC/MUST facilities.

The exact choice between STATIC and MUST should reflect whether the dependency is required to be present in the qualified production path, not merely changed in the PR.

Do not use a directory wildcard.

### Step E — generate graph and inspect the actual expected digest

Only when the graph acceptance actually runs should the new expected digest be read.

If:

`carrier_dependency_graph_sha256 != expected_dependency_graph_sha256`

then perform one legal rolling carrier rebind.

Do not touch unrelated frozen graph authority.

### Step F — rerun exact-head graph + central + successor lanes

Minimum evidence:

```text
central control-plane PASS
unknown_changed_paths = 0
authority_errors = 0
resolver_errors = 0
EA5E2 graph PASS
successor runner PASS
AM19 PASS
KBS soil successor PASS
ordinary CI PASS
```

Do not declare closure from a subset.

---

## 16. Focused KBS product-adapter qualification design

The focused qualification should be bounded.

Recommended shape:

```text
fixture / retained raw bytes
        ↓
instantiate KbsRawHourlyLiveTransportV1
        ↓
instantiate KbsRawHourlyExactIntervalDecoderV1
        ↓
product-owned Python scientific core
        ↓
GovernedDecodedEvidenceDraftV1[]
```

The qualification should avoid creating a second scientific implementation.

### 16.1 Positive proof

Prove:

```text
correct request builder / endpoint
HTTPS final-host constraints
product transport identity
product decoder identity/version
product scientific core path
exact-T decode
rainfall Evidence draft
historical ET0 Evidence draft
diagnostic freshness flag remains non-authoritative
raw payload not embedded
no direct SQL
no Twin mutation
```

### 16.2 Negative proof

Prove fail-closed for at least:

```text
non-canonical target hour
missing exact target row
duplicate target row
invalid / nonfinite ET0 inputs
out-of-range rain
out-of-range air temperature
out-of-range vapor
out-of-range solar
out-of-range wind
scientific result target mismatch
provider locator mismatch
provider id mismatch
source family mismatch
```

### 16.3 Product/qualification identity proof

The qualification should assert it imports/instantiates the product TypeScript classes.

Do not duplicate their behavior inside the acceptance script.

---

## 17. GFS Phase 2 extraction plan after KBS

Do not start this until the KBS graph / focused qualification is stable.

### GFS step 1 — map actual qualification implementation

Inventory the exact current files/functions for:

```text
cycle selection
provider request
GRIB download
eccodes field extraction
APCP differencing
solar integration
temperature/dewpoint/wind transformation
ASCE ET0
quality semantics
```

### GFS step 2 — identify which logic is scientific core vs transport

Keep separate:

```text
transport / request / bytes
scientific decoding / transformation
Evidence canonicalization
```

### GFS step 3 — move scientific implementation to product-owned module

Do not rewrite from memory.

Move the qualified algorithm.

### GFS step 4 — route qualification through the product module

The old qualification runner may remain as orchestration, but its scientific decision must call the product implementation.

### GFS step 5 — graph/control-plane registration

Add exact product paths.

Generate digest after path set stabilizes.

### GFS step 6 — focused product proof

Prove:

```text
qualification uses product GFS core
same cycle selection
same APCP difference
same solar interval meaning
same ET0
same causal source-time semantics
```

---

## 18. Phase 2 completion definition

Do not say "Phase 2 complete" until all of the following are true at one exact head:

### Product modules

- [ ] KBS Raw Hourly TypeScript adapter governed.
- [ ] KBS Raw Hourly scientific core governed.
- [ ] focused KBS product-adapter qualification PASS.
- [ ] GFS transport/provider product seam complete.
- [ ] GFS scientific core product-owned.
- [ ] GFS qualification uses product implementation.
- [ ] no second GFS scientific algorithm exists only for production.
- [x] formal HTTPS transport product-owned.
- [x] KBS variate-25 soil provider product-owned.
- [x] raw retention adapter already product-owned.
- [x] canonicalizer already product-worthy.
- [x] governed ingress adapter already product-worthy.
- [x] post-COMMIT visibility product-owned.
- [x] EvidenceSupplyCursor contract/composition product-owned.

### Governance / graph

- [ ] all Phase 2 product paths explicitly owned by central control plane.
- [ ] unknown_changed_paths = 0.
- [ ] authority_errors = 0.
- [ ] resolver_errors = 0.
- [ ] EA5E2 generated graph contains the required product dependencies.
- [ ] carrier digest equals generated expected digest.
- [ ] no broad semantic wildcard introduced to hide dependencies.
- [ ] immutable/requalification evidence only reflects final dependency state.

### CI / qualification

- [ ] central control-plane PASS.
- [ ] EA5E2 graph PASS.
- [ ] successor runner PASS.
- [ ] AM19 PASS.
- [ ] KBS successor/live soil qualification PASS.
- [ ] ordinary CI PASS.
- [ ] focused KBS adapter proof PASS.
- [ ] focused GFS product proof PASS.

### Non-effects

- [ ] no protected main mutation.
- [ ] no production Evidence Runtime activation.
- [ ] no production Twin Runtime activation.
- [ ] no production cadence owner.
- [ ] no Runtime provider fallback.
- [ ] no durable Phase 3 cursor persistence.
- [ ] no Compose production service.
- [ ] no Formal-v5 arm.
- [ ] no Graduation.
- [ ] MCFT-CAP-09 still not marked complete until later frozen phases close.

Only after these hold may Phase 3 be opened.

---

## 19. First 30 minutes for the next engineer

### Minute 0–5 — restore authority

Read:

```text
docs/SSOT.md
MCFT master task line
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-26.md
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-27.md
```

### Minute 5–10 — lock GitHub facts

Verify:

```text
main == 26c1383f7f45abb76c99e28ec3d06714e85d1b2c
#3299 base == 8943c752a354cb916cc7f144681203aa9a19f70b
#3299 head == expected current head
#3299 Draft == true
#3299 merged == false
```

If any SHA changed, do not reuse old CI conclusions blindly.

### Minute 10–15 — inspect current red steps

For central:

```text
which exact step failed?
did central applicability semantics pass?
did exact PR plan run?
unknown_changed_paths?
authority_errors?
resolver_errors?
```

For EA5E2:

```text
did failure occur at central plan?
did route step run?
did full graph generator run?
was a new expected digest actually emitted?
```

### Minute 15–20 — inspect exact Phase 2 resolver

Confirm whether:

`kbs_raw_hourly_live_provider_v1.ts`

is present in `PHASE2_EVIDENCE_PROVIDER_MODULES`.

At this handoff it is not.

### Minute 20–30 — make the smallest governance patch

Preferred first patch:

```text
central resolver exact-path registration
+
EA5E2 explicit STATIC/MUST product dependency registration
```

Then rerun before touching carrier digest.

---

## 20. Things not to do in the next conversation

Do not:

1. start again from old Draft PR #3295;
2. call Phase 1 incomplete;
3. start Phase 2 from protected main;
4. merge #3297 just to simplify the stack;
5. merge #3299 before Phase 2 closure;
6. change Formal-v5;
7. start production Evidence Runtime host;
8. add Compose production service;
9. add durable EvidenceSupplyCursor table in Phase 2;
10. add production scheduler / lease owner;
11. let Twin Runtime fetch provider/R2 fallback directly;
12. change graph digest before the graph generator runs;
13. use a directory wildcard to silence unknown paths;
14. weaken strict forbidden-marker gates because a comment tripped one;
15. rewrite historical EA5C2B1 or AM19 authority;
16. "fix" historical AM19 runner semantics as a Phase 2 change;
17. create a simplified GFS production algorithm that differs from qualification;
18. declare KBS closed before focused product-adapter qualification;
19. declare Phase 2 complete before GFS scientific core is product-owned;
20. interpret one green workflow as complete system qualification.

---

## 21. High-value exact file map

### Frozen route

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md`

### Central control plane

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json`

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json`

`scripts/governance_acceptance/PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs`

`.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml`

### EA5E2 graph

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs`

`scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs`

`.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml`

### Existing product Evidence core

`apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts`

`apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts`

`apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts`

### Visibility / supply cursor

`apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.ts`

`apps/server/src/persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.ts`

`scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE2_POST_COMMIT_VISIBILITY_CURSOR_V1.ts`

### KBS product modules

`apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts`

`apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts`

`apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts`

`apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py`

### KBS successor governance

`scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs`

`.github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml`

### AM19 compatibility

`scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_AM19_PHASE2_AUTHORITY_SYMBOL_COMPATIBILITY_V1.ts`

`.github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml`

---

## 22. Exact known commits worth preserving in the mental model

### Initial Phase 2 implementation branch base

`8943c752a354cb916cc7f144681203aa9a19f70b`

Phase 1 closure / exact predecessor.

### Visibility/cursor control-plane registration

`11c44224cf95b102164c27d73190db30749d8fe2`

Message:

`gov(mcft-cap09): govern phase2 visibility and supply cursor modules`

### Node 20 / tsx acceptance root fix

`2e482bbbdc7abea4240391b0e334315d2ec8a1d0`

Message:

`fix(mcft-cap09): resolve phase2 visibility acceptance from repo root`

### Current comment-only strict-gate repair / handoff head

`b24c81097da101f5f17ba4d72b8761d54d53505e`

Message:

`fix(mcft-cap09): avoid false runtime-cursor marker in KBS provider`

---

## 23. Why the current problem is bounded

The current red state is not an unknown production failure.

Evidence:

```text
successor runner = SUCCESS
AM19 = SUCCESS
KBS soil successor = SUCCESS
central applicability semantics step = SUCCESS
EA5E2 full graph step = not reached
```

The new TypeScript adapter was introduced after a previously stabilized governance state.

The central Phase 2 exact path set has not yet been updated to own that adapter.

Therefore the next investigation should remain in:

```text
control-plane exact-path ownership
        ↓
EA5E2 explicit graph dependency
        ↓
generated digest
```

not jump to:

```text
provider semantics rewrite
database change
scheduler
Formal
```

---

## 24. Why Phase 2 must not be declared complete yet

Three independent reasons remain:

### Reason 1 — current exact head is not centrally qualified

Central / EA5E2 are red at `b24c8109…`.

### Reason 2 — KBS product adapter is not yet focused-qualified

The product classes exist but qualification has not yet fully demonstrated that it instantiates the exact future-production adapter/decoder pair.

### Reason 3 — GFS scientific core is still acceptance-era debt

Even a fully closed KBS path does not close Phase 2 while GFS scientific logic remains qualification-only.

---

## 25. Recommended next PR slicing inside #3299

Do not widen #3299 into Phase 3.

Preferred bounded slices:

### Slice A — KBS governance closure

```text
central exact-path registration
EA5E2 exact production dependency registration
generated digest / legal carrier rebind if required
```

### Slice B — KBS focused product qualification

```text
instantiate product transport
instantiate product decoder
product Python core
positive / negative proof
machine non-effects
```

### Slice C — GFS scientific-core extraction

```text
move existing qualified scientific semantics into product-owned core
qualification routes through product core
focused product proof
graph / central registration
```

### Slice D — Phase 2 exact-head closure

```text
central
EA5E2
successor
AM19
KBS
GFS focused proof
ordinary CI
non-effects
```

Only after Slice D:

open Phase 3.

---

## 26. Handoff bottom line

The project is no longer at:

```text
"Phase 2 has not started"
```

and it is also not at:

```text
"Phase 2 complete"
```

The precise current state is:

```text
Phase 2 product Evidence architecture materially exists
        +
post-COMMIT visibility / EvidenceSupplyCursor ordering is productized
        +
KBS Raw Hourly scientific core is product-owned
        +
KBS Raw Hourly TypeScript transport/decoder adapter exists
        +
historical successor governance has been preserved
        +
central/EA5E2 were previously green before the latest adapter delta
        ↓
current adapter is not yet fully registered in central/EA5E2 governed dependency sets
        +
focused qualification of the product adapter pair is still missing
        +
GFS scientific core remains to be productized
        ↓
Phase 2 remains IN PROGRESS
```

The immediate next action is **not** to change graph digest.

It is:

```text
register exact KBS adapter ownership in central control plane
        ↓
register exact KBS product dependencies in EA5E2 STATIC/MUST graph
        ↓
rerun central plan
        ↓
only after graph generation, read/rebind digest if needed
        ↓
focused-qualify KbsRawHourlyLiveTransportV1
+ KbsRawHourlyExactIntervalDecoderV1
        ↓
then productize GFS scientific core
```

Keep #3299 Draft.

Keep protected `main` untouched.

Keep Formal-v5 unarmed.

Keep Phase 3 closed until Phase 2 exact-head closure is machine-proved.
