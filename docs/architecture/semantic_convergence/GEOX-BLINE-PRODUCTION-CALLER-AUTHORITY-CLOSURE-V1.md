# GEOX B-Line Production Caller-Authority Closure V1

**Status:** PR-SEC-1 / INVENTORY COMPLETE / B-SEC-0 OPEN  
**Mission:** B-SEC-0 — Production Caller-Authority Closure  
**Canonical predecessor:** #3452 @ `b6f141c5471cd6f329ba60bd79cf6e4085546264`  
**Predecessor qualification:** CI `33592626515` — build-test SUCCESS / acceptance SUCCESS  
**MCFT boundary:** no MCFT implementation change

## 1. Why this line exists

B-Line semantic ownership work has already removed or narrowed multiple duplicate producer authorities, but that does not prove caller authority.

The production authority chain is now evaluated as:

```text
principal
→ credential / token
→ capability scope
→ product principal permission
→ tenant / project / group binding
→ runtime entrypoint
→ producer
→ semantic output
→ downstream consequence
```

A valid semantic provenance chain does not imply a valid principal authority chain.

## 2. PR-SEC-1 boundary

This package is inventory and machine-governance only.

It does not:

- add or remove a production capability;
- change token grants or role grants;
- add server-side containment to an existing route;
- change Recommendation, DecisionEligibility, Approval, OperationPlan, Task, Dispatch, Acceptance, Twin State, Forecast, Scenario, Calibration or Field Memory semantics;
- change MCFT implementation or qualification;
- claim B-SEC-0 COMPLETE;
- claim ACTIVE_GRAPH_FULLY_DISPOSED.

The machine-readable authority map is:

`docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json`

The gate is:

`scripts/governance_acceptance/ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1.cjs`

## 3. Audit root

Caller-authority reachability is rooted at `docker-compose.commercial_v1.yml`, not at one server module registrar.

The inventory explicitly disposes:

```text
Commercial Compose
├── postgres
├── database-platform-bootstrap
├── mcft-cap07-migration      [foreign MCFT boundary; no B-Line modification]
├── mqtt
├── minio
├── minio-init
├── server
│   ├── bootstrap/server
│   │   └── app
│   │       ├── core
│   │       ├── domain
│   │       ├── compatibility
│   │       ├── openapi
│   │       └── admin
│   └── bootstrap/workers
├── telemetry-ingest
├── jobs
├── executor
└── web
```

PR-SEC-1 does not yet declare this graph fully closed. Later B-AUDIT packages must prove all process/subprocess/runtime activation edges.

## 4. Entrypoint identity

The minimum surface identity is:

```text
source_path
+
entry_symbol
+
activation_mode
```

A file is not an authority class.

For example:

- `human_ops_v1.ts` read APIs and `startHumanOpsKpiRefreshWorker` are separate surfaces.
- `human_executors_v1.ts` HTTP mutation handlers and `startAssignmentExpiryWorker` are separate surfaces.
- the HTTP heartbeat route and MQTT heartbeat ingestion are separate caller/principal models even though both affect device health.

## 5. Current high-risk caller-authority debt recorded by the inventory

The inventory must preserve, not hide, these current facts until a later implementation PR changes runtime:

- the two legacy Operator Twin submit-recommendation POST routes have no server-side caller auth gate;
- Weather Forecast ingest has no caller auth and lets caller scope/provider data reach a forecast authority consumed by Decision Engine;
- the HTTP device heartbeat route remains Transitional / Acceptance-Compatible and may trust body scope;
- legacy Twin base mutation routes are production-registered without caller auth and must be Commercial fail-closed rather than given a new long-term capability;
- Twin production-ingestion, operator workflow and formalization routes do not verify authenticated principals and trust declared actor fields;
- AO-SENSE task/receipt writers are unauthenticated;
- Admin CAF import is an unauthenticated evidence-ingress route and spawns `scripts/loadfact.ts`;
- `?__internal__=true` writers are WEAK_INTERNAL_BOUNDARY, not authenticated internal callers;
- legacy monitoring marker/canopy/overlay writers remain caller-unverified;
- Admin Groups mutation routes remain unauthenticated P1 legacy-context configuration authority.

Independent audit also records caller-capability debt on already authenticated routes where a read or semantically unrelated capability currently permits a mutation. Examples include recommendation generation under read capability, evidence-report job creation under read capability, generic AO-ACT fallbacks, and several domain writers using broad compatibility scopes.

These are caller-authority findings only. They do not authorize semantic redesign in this PR.

## 6. Subprocess promotion rule

PR-SEC-1 records the first required promotion edge:

```text
Commercial server
→ POST /api/admin/import/caf_hourly
→ spawn(ts-node, scripts/loadfact.ts)
→ facts / raw_samples mutation
```

Therefore:

```text
AUX directory classification
≠
runtime non-reachability
```

The general spawn/exec/fork/shell/package/Docker reachability scanner is deferred to B-AUDIT-R2, but this known production edge is already inventoried and may not disappear from authority accounting.

## 7. Device heartbeat contract reconciliation

`docs/contracts/v2/DEVICE_HEARTBEAT_AUTH_CONTRACT_V2.md` is explicitly Transitional / Acceptance-Compatible.

PR-SEC-1 therefore records the HTTP heartbeat route as:

```text
CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE
```

It may not be classified as KEEP_DEVICE_HEALTH_AUTHORITY with no outstanding caller-security debt.

The target remains:

```text
authenticated device credential
→ registered device binding
→ tenant/project/group/device registry
→ scoped heartbeat projection
```

Device-credential implementation is reserved for PR-SEC-4.

## 8. Machine-gate semantics

The inventory gate validates:

1. every row has the complete caller-authority field set;
2. entrypoint identities are unique;
3. Commercial Compose roots have explicit dispositions;
4. production server import reachability is scanned from bootstrap/app;
5. every discovered literal mutating HTTP route is represented by an entrypoint row;
6. known dynamic registration indirections are explicitly adjudicated;
7. high-risk unauthenticated and weak-internal sentinels remain visible;
8. Device Heartbeat transitional debt is reconciled with its contract;
9. Admin CAF import's subprocess edge is promoted to production reachability;
10. mixed-file worker/API sentinels are independently classified;
11. telemetry, jobs and executor service roots have principal dispositions;
12. PR-SEC-1 must report non-zero B-SEC debt and must not claim closure.

A PASS here means:

```text
inventory structure + current-debt representation + static reachability coverage are internally consistent
```

It does not mean:

```text
B-SEC-0 caller authority is closed
```

## 9. Exact inventory qualification

PR-SEC-1 inventory is machine-qualified complete on:

```text
qualified head                               5633a76d20fb1d7f20d2159fbef6567493e516ed
exact CI                                     33608456999
build-test                                   SUCCESS
caller-authority inventory reverse-scan      SUCCESS
residual authority audit                     SUCCESS
active runtime surface closure               SUCCESS
Typecheck                                    SUCCESS
Build                                        SUCCESS
Server selfcheck                             SUCCESS
acceptance                                   SUCCESS
Controlled Pilot strict release              SUCCESS
Commercial MVP0 release                      SUCCESS
runtime hygiene                              SUCCESS
```

Reverse-scan result:

```text
surfaces                                     192
runtime-reachable surfaces                   187
Commercial roots                             11
discovered literal mutation methods          178
explicit non-authority POST dispositions     4
subprocess promotion edges                   1
new missing mutation surfaces                0
```

Open caller-authority debt remains intentionally non-zero:

```text
mutating surface without authn               35
semantic writer without validated capability 109
unverified declared human actor              7
service writer without bound principal       3
caller-controlled/unbound tenant scope       16
```

These counters are the output of the inventory phase. They are not closure failures for PR-SEC-1 and must not be rewritten to zero until later authorized containment/principal work actually closes them.

This metadata does **not** declare B-SEC-0 complete and does **not** declare ACTIVE_GRAPH_FULLY_DISPOSED. PR-SEC-2 has not started.

The metadata-only completion rebind itself must now be exact-head requalified before PR-SEC-1 is considered finally settled.

## 10. Completion rule for this package

PR-SEC-1 is complete only when its exact head proves:

- inventory gate SUCCESS;
- existing B-Line residual/active-runtime governance remains SUCCESS;
- Typecheck/Build remain SUCCESS;
- no MCFT files changed;
- PR remains stacked on #3452 canonical predecessor;
- inventory still declares `bsec0_closed=false`.

After that exact qualification, report the inventory and findings to GEOX Owner and stop. Do not begin PR-SEC-2 without a new instruction.
