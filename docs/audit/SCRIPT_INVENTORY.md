# Script Inventory

Status: P2-H3 script audit baseline  
Scope: package scripts, release-gate scripts, smoke/selfcheck scripts, acceptance scripts, runtime worker commands, and selected standalone script families used during P2 governance  
Primary sources: root `package.json`, workspace `package.json` files, and `scripts/agronomy_acceptance/*`

## Purpose

This inventory prevents script, CI, release-gate, smoke-test, and documentation drift after P2.

Every script listed below records:

- purpose
- owner
- whether it is a release gate
- whether failure blocks release / merge / deployment

Any PR that adds, removes, renames, or changes script semantics must update this file in the same PR.

## Blocking policy

| Failure blocks? | Meaning |
| --- | --- |
| Yes | Failure should block merge, release, or deployment when this script is part of the relevant gate. |
| Conditional | Failure blocks only for the domain or release mode that invokes it. |
| No | Developer utility, local smoke, or advisory script. Failure should be investigated but is not automatically a release blocker. |

## Root workspace scripts

| Script | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pnpm dev:server` | Start server in dev mode through `@geox/server`. | Platform / Server | No | No | Local development only. |
| `pnpm dev:web` | Start Vite web frontend. | Frontend | No | No | Local development only. |
| `pnpm dev:judge` | Start Judge package dev command if package exists in current workspace. | Judge / Engineering Support | No | No | Keep aligned with actual workspace presence. |
| `pnpm typecheck:server` | Run server TypeScript typecheck. | Platform / Server | Yes | Yes | Required for backend PRs. |
| `pnpm typecheck:web` | Run web TypeScript typecheck. | Frontend | Yes | Yes | Required for frontend PRs. |
| `pnpm typecheck:judge` | Run Judge TypeScript typecheck if package exists. | Judge | Conditional | Conditional | Blocks Judge changes when Judge package is active. |
| `pnpm build:server` | Build server package. | Platform / Server | Yes | Yes | Required before release build. |
| `pnpm build:web` | Build web package. | Frontend | Yes | Yes | Required before frontend release. |
| `pnpm build:judge` | Build Judge package if package exists. | Judge | Conditional | Conditional | Blocks Judge release if Judge package is active. |
| `pnpm acceptance:stage5` | Run agronomy Stage5 backend acceptance and frontend acceptance. | Agronomy / Frontend | Conditional | Conditional | Blocks Stage5/agronomy release scope. |
| `pnpm ci:server:no-legacy-agronomy-imports` | Guard against legacy agronomy imports. | Agronomy / Platform | Yes | Yes | Architecture boundary gate. |
| `pnpm ci:web:views-boundary` | Enforce frontend view boundary. | Frontend Governance | Yes | Yes | UI architecture gate. |
| `pnpm ci:web:operation-detail-hooks` | Lint OperationDetailPage hooks. | Frontend Operations | Conditional | Conditional | Blocks operation detail frontend changes. |
| `pnpm qa:release-gate-check` | Run release-gate audit report generator. | QA / Release Governance | Yes | Yes | Writes report under `docs/qa/reports/release_gate_report.json`. |
| `pnpm ci:simulator:ingest-guard` | Guard simulator ingest behavior. | Sensing / Simulator | Conditional | Conditional | Blocks sensing/simulator changes. |
| `pnpm ci:server:dashboard-status-source-of-truth` | Guard dashboard status SSOT. | Reporting / Customer Product | Yes | Yes | Prevents customer/reporting status drift. |
| `pnpm ci:route-dependency-guard` | Check route dependency boundary. | Architecture Governance | Yes | Yes | Prevents route dependency drift. |
| `pnpm selfcheck:smoke:pending-acceptance` | Run pending-acceptance smoke selfcheck. | Acceptance / Reporting | Conditional | Conditional | Blocks acceptance smoke gate when invoked. |
| `pnpm selfcheck:p1-skill-loop-minimal` | Run P1 skill loop selfcheck. | AO-ACT / Skill Governance | Conditional | Conditional | Blocks P1 regression gate when invoked. |
| `pnpm test:acceptance` | Run generic acceptance runner. | QA / Release Governance | Conditional | Conditional | Blocks acceptance gate where configured. |
| `pnpm acceptance:release-audit:evidence-bundle:v1` | Run release-audit evidence bundle acceptance. | Evidence / Release Audit | Yes | Yes | P2 evidence/release audit gate. |
| `pnpm acceptance:commercial:mvp0:syntax` | Syntax-check commercial MVP0 acceptance scripts. | Commercial / QA | Conditional | Conditional | Blocks commercial MVP0 script changes. |
| `pnpm acceptance:commercial:mvp0:release-gate` | Run commercial MVP0 release gate. | Commercial / QA | Yes | Yes | Blocks commercial MVP0 release. |

## Server package scripts

| Script | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pnpm --filter @geox/server dev` | Run server with tsx watch. | Platform / Server | No | No | Local development only. |
| `pnpm --filter @geox/server build` | TypeScript build and dist entry generation. | Platform / Server | Yes | Yes | Required server release gate. |
| `pnpm --filter @geox/server typecheck` | Server TypeScript no-emit check. | Platform / Server | Yes | Yes | Required for backend changes. |
| `pnpm --filter @geox/server seed:p6.1-real-chain` | Generate P6.1 real-chain sample data. | Agronomy / Demo Data | No | No | Demo/seed utility. |
| `pnpm --filter @geox/server test:agronomy:stage5` | Run Stage5 agronomy backend acceptance test. | Agronomy | Conditional | Conditional | Blocks Stage5/agronomy changes. |
| `pnpm --filter @geox/server test:stage5:frontend` | Run Stage5 frontend acceptance script. | Agronomy / Frontend | Conditional | Conditional | Blocks Stage5 acceptance. |
| `pnpm --filter @geox/server test:sensing:closed-loop` | Run sensing fertility closed-loop E2E test. | Sensing / Agronomy | Conditional | Conditional | Blocks sensing/fertility changes. |
| `pnpm --filter @geox/server test:p2:evidence-summary-builder` | Test P2 evidence summary builder. | Evidence / Reporting | Yes | Yes | Blocks P2-B evidence summary changes. |
| `pnpm --filter @geox/server check:smoke:param-keys` | Check smoke script parameter keys. | QA / Acceptance | Conditional | Conditional | Blocks smoke script parameter changes. |
| `pnpm --filter @geox/server check:route-dependency-guard` | Run route dependency guard from server package. | Architecture Governance | Yes | Yes | Equivalent guard entry from server package. |
| `pnpm --filter @geox/server test:evidence-export:s3-smoke` | Smoke test evidence export S3/object-store behavior. | Evidence / Storage | Conditional | Conditional | Blocks evidence export/storage changes. |
| `pnpm --filter @geox/server test:p1:smoke` | Run P1 skill loop smoke. | AO-ACT / Skill Governance | Conditional | Conditional | Blocks P1 regression gate when invoked. |
| `pnpm --filter @geox/server test:p1:acceptance-smoke` | Run P1 acceptance smoke. | Acceptance / AO-ACT | Conditional | Conditional | Blocks P1 acceptance regression gate. |
| `pnpm --filter @geox/server test:p1:selfcheck` | Run P1 minimal selfcheck. | AO-ACT / Skill Governance | Conditional | Conditional | Blocks P1 selfcheck gate. |
| `pnpm --filter @geox/server test:p1:openapi-selfcheck` | Run OpenAPI alignment selfcheck. | API Governance | Yes | Yes | Blocks OpenAPI contract changes. |
| `pnpm --filter @geox/server acceptance:release-audit:evidence-bundle:v1` | Run evidence bundle release audit through server package. | Evidence / Release Audit | Yes | Yes | Same gate as root evidence release audit. |
| `pnpm --filter @geox/server smoke:operator-facade-readonly` | Smoke test operator readonly facade. | Operator Workbench | Conditional | Conditional | Blocks operator read facade changes. |
| `pnpm --filter @geox/server smoke:operator-b-readonly` | Smoke test operator B readonly facade. | Operator Workbench | Conditional | Conditional | Blocks operator B/read-only facade changes. |

## Web package scripts

| Script | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pnpm --filter @geox/web dev` | Start Vite dev server. | Frontend | No | No | Local development only. |
| `pnpm --filter @geox/web build` | Build frontend bundle. | Frontend | Yes | Yes | Required frontend release gate. |
| `pnpm --filter @geox/web typecheck` | Web TypeScript no-emit check. | Frontend | Yes | Yes | Required for frontend changes. |
| `pnpm --filter @geox/web lint` | Run frontend boundary lint chain. | Frontend Governance | Yes | Yes | Includes views, customer-facing, operation status, operator boundary checks. |
| `pnpm --filter @geox/web lint:views-boundary` | Check views boundary. | Frontend Governance | Yes | Yes | Blocks UI boundary drift. |
| `pnpm --filter @geox/web lint:operation-status-convergence` | Check operation status convergence. | Frontend Operations / Reporting | Yes | Yes | Prevents frontend status source drift. |
| `pnpm --filter @geox/web lint:operation-detail-hooks` | ESLint OperationDetailPage hooks. | Frontend Operations | Conditional | Conditional | Blocks operation detail page changes. |
| `pnpm --filter @geox/web lint:customer-facing-boundary` | Check customer-facing boundary. | Customer Product / Frontend | Yes | Yes | Prevents customer UI leaking internal language/data. |
| `pnpm --filter @geox/web check:customer-boundary` | Check customer boundary. | Customer Product / Frontend | Yes | Yes | Customer surface release gate. |
| `pnpm --filter @geox/web check:customer-export-same-source` | Ensure customer exports use same source as page. | Customer Product / Reporting | Yes | Yes | Required for Pages = Export principle. |
| `pnpm --filter @geox/web check:customer-routes` | Check customer route rules. | Customer Product / Frontend Governance | Yes | Yes | Prevents customer route drift. |
| `pnpm --filter @geox/web check:no-raw-enum-customer` | Prevent raw engineering enums in customer UI. | Customer Product / Frontend | Yes | Yes | Customer safety gate. |
| `pnpm --filter @geox/web check:operator-boundary` | Check operator frontend boundary. | Operator Workbench / Frontend | Yes | Yes | Prevents operator write/read boundary drift. |

## Executor package scripts

| Script | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pnpm --filter @geox/executor once` | Run executor once. | Execution / Device Ops | No | No | Local/ops utility unless used in external smoke. |
| `pnpm --filter @geox/executor dispatch-once` | Run dispatch loop once. | Execution / Dispatch | Conditional | Conditional | Blocks executor dispatch changes only when used in smoke. |
| `pnpm --filter @geox/executor build` | Stub build command. | Execution | No | No | Currently exits 0; not a real compile gate. |
| `pnpm --filter @geox/executor dispatch-mqtt-once` | Run MQTT downlink once. | Execution / MQTT | Conditional | Conditional | Blocks MQTT dispatch smoke when invoked. |
| `pnpm --filter @geox/executor device-sim-once` | Run MQTT device simulation once. | Device Ops / Simulator | Conditional | Conditional | Blocks simulator smoke when invoked. |
| `pnpm --filter @geox/executor receipt-uplink-once` | Run MQTT receipt uplink once. | Execution / Receipt | Conditional | Conditional | Blocks receipt uplink smoke when invoked. |

## Telemetry ingest package scripts

| Script | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pnpm --filter @geox/telemetry-ingest dev` | Run telemetry ingest in dev mode. | Sensing / Telemetry | No | No | Local development. |
| `pnpm --filter @geox/telemetry-ingest once` | Run telemetry ingest once. | Sensing / Telemetry | Conditional | Conditional | Blocks telemetry ingest smoke when invoked. |
| `pnpm --filter @geox/telemetry-ingest build` | Stub build command. | Sensing / Telemetry | No | No | Currently exits 0; not a real compile gate. |
| `pnpm --filter @geox/telemetry-ingest start` | Start telemetry ingest. | Sensing / Telemetry | No | No | Runtime command, not release gate by itself. |

## Shared packages scripts

| Script | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `pnpm --filter @geox/contracts build` | Build shared contracts. | Contracts / API Governance | Yes | Yes | Blocks contract changes. |
| `pnpm --filter @geox/contracts test` | Minimal contracts smoke. | Contracts / API Governance | Conditional | Conditional | Blocks contract package if configured in CI. |
| `pnpm --filter @geox/device-skills build` | Build device skill package. | Skill Governance / Device Ops | Yes | Yes | Blocks device skill changes. |
| `pnpm --filter @geox/skill-registry build` | Build skill registry package. | Skill Governance | Yes | Yes | Blocks skill registry changes. |

## Standalone release / acceptance scripts

| Script file | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `scripts/qa/check_release_gates.cjs` | Generate/check release gate report. | QA / Release Governance | Yes | Yes | Invoked by `pnpm qa:release-gate-check`. |
| `scripts/check_no_legacy_agronomy_imports.cjs` | Prevent legacy agronomy imports. | Agronomy / Architecture Governance | Yes | Yes | Invoked by root CI script. |
| `scripts/check_simulator_ingest_guard.cjs` | Guard simulator ingest behavior. | Sensing / Simulator | Conditional | Conditional | Invoked by root CI script. |
| `scripts/check_dashboard_status_source_of_truth.cjs` | Guard dashboard status SSOT. | Reporting / Customer Product | Yes | Yes | Invoked by root CI script. |
| `scripts/check_route_dependency_guard.cjs` | Guard route dependency boundary. | Architecture Governance | Yes | Yes | Invoked by root and server package scripts. |
| `scripts/acceptance/run_acceptance.cjs` | Generic acceptance runner. | QA / Release Governance | Conditional | Conditional | Invoked by `pnpm test:acceptance`. |
| `scripts/acceptance/__tests__/pending_acceptance_smoke_selfcheck.test.cjs` | Pending acceptance smoke selfcheck. | Acceptance / QA | Conditional | Conditional | Invoked by root selfcheck. |
| `scripts/agronomy_acceptance/ACCEPTANCE_RELEASE_AUDIT_EVIDENCE_BUNDLE_V1.cjs` | Evidence bundle release audit. | Evidence / Release Audit | Yes | Yes | P2 release audit gate. |
| `scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_RELEASE_GATE.cjs` | Commercial MVP0 release gate. | Commercial / QA | Yes | Yes | Blocks commercial MVP0 release. |
| `scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs` | Commercial MVP0 irrigation acceptance. | Commercial / Agronomy | Conditional | Conditional | Syntax checked by root MVP0 syntax script; may be invoked by release gate. |
| `scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_V1.cjs` | ROI ledger acceptance. | ROI / Commercial | Conditional | Conditional | Blocks ROI ledger release scope when invoked. |
| `scripts/agronomy_acceptance/ACCEPTANCE_PRESCRIPTION_CONTRACT_V1.cjs` | Prescription contract acceptance. | Prescription / Agronomy | Conditional | Conditional | Blocks prescription contract changes when invoked. |
| `scripts/agronomy_acceptance/ACCEPTANCE_AS_EXECUTED_AS_APPLIED_V1.cjs` | As-executed / as-applied acceptance. | Execution / Agronomy | Conditional | Conditional | Blocks as-executed/as-applied changes when invoked. |
| `scripts/agronomy_acceptance/ACCEPTANCE_AGRONOMY_E2E_V1.cjs` | Agronomy E2E acceptance. | Agronomy / QA | Conditional | Conditional | Requires correct `FIELD_ID`, `SEASON_ID`, `DEVICE_ID` env defaults for reliable demo acceptance. |

## Server local script files

| Script file | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `apps/server/scripts/p1_skill_loop_minimal.mjs` | P1 minimal skill loop smoke. | AO-ACT / Skill Governance | Conditional | Conditional | Invoked by `test:p1:smoke`. |
| `apps/server/scripts/p1_skill_loop_acceptance_smoke.mjs` | P1 skill loop acceptance smoke. | Acceptance / AO-ACT | Conditional | Conditional | Invoked by `test:p1:acceptance-smoke`. |
| `apps/server/scripts/p1_skill_loop_minimal_selfcheck.mjs` | P1 minimal selfcheck. | AO-ACT / Skill Governance | Conditional | Conditional | Invoked by `test:p1:selfcheck`. |
| `apps/server/scripts/p1_3_openapi_alignment_selfcheck.mjs` | OpenAPI alignment selfcheck. | API Governance | Yes | Yes | Invoked by `test:p1:openapi-selfcheck`. |
| `apps/server/scripts/check_smoke_parameter_keys.mjs` | Smoke parameter key checker. | QA / Acceptance | Conditional | Conditional | Invoked by server check script. |
| `apps/server/scripts/evidence_export_s3_smoke.mjs` | Evidence export S3 smoke. | Evidence / Storage | Conditional | Conditional | Invoked by evidence export smoke. |
| `apps/server/scripts/operator_facade_readonly_smoke.mjs` | Operator facade readonly smoke. | Operator Workbench | Conditional | Conditional | Invoked by server operator smoke. |
| `apps/server/scripts/operator_b_readonly_facade_smoke.mjs` | Operator B readonly smoke. | Operator Workbench | Conditional | Conditional | Invoked by server operator B smoke. |

## Web local guard scripts

| Script file | Purpose | Owner | Release gate? | Failure blocks? | Notes |
| --- | --- | --- | --- | --- | --- |
| `apps/web/scripts/check-views-boundary.mjs` | Enforce frontend view boundary. | Frontend Governance | Yes | Yes | Invoked by web lint chain. |
| `apps/web/scripts/check-operation-status-convergence.mjs` | Ensure operation status convergence. | Frontend Operations / Reporting | Yes | Yes | Prevents frontend status derivation drift. |
| `apps/web/scripts/check-customer-facing-boundary.mjs` | Guard customer-facing boundary. | Customer Product / Frontend | Yes | Yes | Prevents internal data/language leaks. |
| `apps/web/scripts/check-customer-boundary.mjs` | Customer boundary check. | Customer Product / Frontend | Yes | Yes | Customer surface gate. |
| `apps/web/scripts/check-customer-export-same-source.mjs` | Verify page/export same-source principle. | Customer Product / Reporting | Yes | Yes | Required for report/export alignment. |
| `apps/web/scripts/check-customer-routes.mjs` | Check customer route governance. | Customer Product / Frontend Governance | Yes | Yes | Prevents customer route drift. |
| `apps/web/scripts/check-no-raw-enum-customer.mjs` | Prevent raw enum exposure in customer UI. | Customer Product / Frontend | Yes | Yes | Customer-safe language gate. |
| `apps/web/scripts/check-operator-boundary.mjs` | Enforce operator frontend boundary. | Operator Workbench / Frontend | Yes | Yes | Required for P2-C operator write/read split. |

## Recommended minimum release gate set

A P2 release candidate should not be accepted unless these pass:

```bash
pnpm --filter @geox/server typecheck
pnpm --filter @geox/web typecheck
pnpm --filter @geox/web build
pnpm --filter @geox/server test:p1:openapi-selfcheck
pnpm --filter @geox/server test:p2:evidence-summary-builder
pnpm --filter @geox/web check:customer-export-same-source
pnpm --filter @geox/web check:customer-routes
pnpm --filter @geox/web check:no-raw-enum-customer
pnpm --filter @geox/web check:operator-boundary
pnpm acceptance:release-audit:evidence-bundle:v1
pnpm qa:release-gate-check
```

Domain-specific gates should be added when touching the corresponding domain:

- Agronomy: `pnpm acceptance:stage5`
- Commercial MVP0: `pnpm acceptance:commercial:mvp0:release-gate`
- Sensing: `pnpm --filter @geox/server test:sensing:closed-loop`
- Evidence export/storage: `pnpm --filter @geox/server test:evidence-export:s3-smoke`
- Operator read facade: `pnpm --filter @geox/server smoke:operator-facade-readonly`
- P1 chain regression: `pnpm --filter @geox/server test:p1:smoke` and `pnpm --filter @geox/server test:p1:acceptance-smoke`

## Release audit findings

1. Several workspace `build` commands are true release gates (`server`, `web`, shared packages), but `@geox/executor build` and `@geox/telemetry-ingest build` are currently stub commands that exit 0. They must not be mistaken for real compile gates.
2. Customer-facing frontend scripts provide strong boundary coverage and should remain release blockers for customer UI changes.
3. Operator frontend boundary checks should remain blockers after P2-C because operator pages now include write actions.
4. OpenAPI selfcheck must remain blocking for any API contract change.
5. Standalone acceptance scripts are domain gates; they should be promoted to mandatory release gates only when their domain is included in the release scope.
6. New scripts must declare owner, release-gate status, and failure-blocking behavior in this inventory before merge.

## Update requirement

Any PR that adds, removes, renames, or changes a script must update this file.

For each new script, include:

- script command or file path
- purpose
- owner
- whether it is a release gate
- whether failure blocks release/merge/deployment
- notes about required environment variables or external services
