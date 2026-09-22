# GEOX Frontend Canonical Blueprint V1

```text
document_id: GEOX-FRONTEND-CANONICAL-BLUEPRINT-V1
status: CANONICAL_CONTINUATION_BASELINE_CANDIDATE
baseline_main_sha: 6ff48eca10c1d25365c39f9d1e4dbb14d6c1ad91
baseline_date: 2026-09-22
scope: FRONTEND_PRODUCT_CONTINUATION
domain_authority: NONE
route_mutation: NONE
runtime_mutation: NONE
backend_mutation: NONE
```

## 0. Purpose

This document consolidates the historical GEOX frontend productization line into one continuation baseline.

After this document is merged to protected main, future frontend work should not re-audit the full H58-H67, F0-F2, PFE-0-PFE-14, PFA, Customer Frontend, and FOUI history by default.

Future work should start from this document plus any explicitly newer frontend authority that declares it supersedes or amends this baseline.

This document is a frontend continuation baseline only.

It does not override MCFT, ADR, B-Line, Outcome, Identity, Asset, or other domain authority. If a frontend statement conflicts with a current domain authority, the domain authority wins and this blueprint must be amended.

## 1. Default continuation rule

Default rule after protected-main adoption:

```text
READ THIS BLUEPRINT FIRST.

DO NOT RESCAN HISTORICAL FRONTEND DOCS
unless a re-audit trigger in Section 15 is satisfied.

Implementation code existence
!= formal product authorization.

Route existence
!= formal product surface.

Frontend projection
!= domain authority.
```

For normal frontend continuation, the minimum source set is:

1. this document;
2. its machine-readable companion manifest;
3. any newer explicit frontend taskbook/contract that declares supersession or amendment;
4. the exact current domain authority needed by the page being implemented.

Historical documents remain provenance, not default working context.

## 2. Frontend source-of-truth precedence

For frontend product continuation, use this precedence:

```text
A. Current domain authority
   MCFT / ADR / B-Line / Outcome / Identity / Asset
   (highest for domain semantics and authorization)

B. Newer explicit frontend authority
   A later taskbook/contract that explicitly supersedes or amends this blueprint

C. GEOX Frontend Canonical Blueprint V1
   This document after protected-main merge

D. PFE-14 v0.2
   Current Operator Runtime Console design authority within its scope

E. PFE-13 frozen Product Frontend v1
   Frozen role-separated route/product baseline

F. PFA retained findings
   Product-quality debt and review evidence

G. PFE-0 through PFE-12, F0-F2, H58-H67
   Historical provenance and inherited constraints

H. Current implementation code
   Implementation fact only; never sufficient to promote a route/capability
```

The precedence above is intentionally asymmetric:

- current domain authority can invalidate frontend assumptions;
- frontend code cannot invalidate product governance;
- an old route cannot become canonical merely because it still renders.

## 3. Historical consolidation and closure map

### 3.1 H58-H67

Classification:

```text
HISTORICAL / CLOSED
```

Retained value:

- original frontend productization plan;
- route ownership history;
- Operator runtime shell history;
- Field Runtime tab history;
- replay/demo productization;
- runtime health and pilot-readiness surface history;
- Customer/Admin cleanup history;
- design-system hardening;
- release readiness and route manifest provenance.

Continuation rule:

```text
Do not reopen H-line work.
Do not add a new H-line frontend phase.
Use later PFE/PFA/PFE-14/FOUI authority instead.
```

### 3.2 F0-A / F0-B / F1 / F2

Classification:

```text
HISTORICAL CLOSED BASELINE
```

Inherited requirements remain valid unless explicitly replaced:

- role-separated shells;
- bilingual product copy;
- raw identifiers remain raw;
- keyboard/focus baseline;
- accessibility baseline;
- responsive intent;
- explicit empty/loading/error states;
- visual smoke discipline;
- performance budget discipline;
- no hidden promotion of legacy/debug routes.

F0-B closed further H-line expansion and required new frontend product work to have its own contract, route ownership, nonclaim boundary, bilingual requirement, responsive/accessibility/state baseline, and acceptance gate.

### 3.3 PFE-0

Classification:

```text
HISTORICAL AUDIT BASELINE
```

Retained principle:

```text
Formal route classification must come from governed inventory,
not memory and not implementation existence alone.
```

Its six-way historical vocabulary remains useful:

- formal v1 page;
- formal sub-surface;
- export/print secondary surface;
- URL-only compatibility;
- future product-contract page;
- do-not-build page.

This blueprint maps those concepts into the continuation decisions in Section 6.

### 3.4 PFE-1

Classification:

```text
HISTORICAL PAGE-CONTRACT BASELINE
```

Retained invariants:

- each formal page has owner, primary user, purpose, source owner, allowed actions, forbidden actions, must-show, must-not-show, states, nonclaims, locale, accessibility, responsive and acceptance requirements;
- Customer remains reporting-safe;
- Operator remains read/review-safe unless separately governed;
- Admin remains governance/readback-safe.

### 3.5 PFE-2

Classification:

```text
KEEP
```

PFE-2 Product Design System semantics remain canonical design-system ancestry.

Retain these primitives or equivalent semantics:

```text
ProductPageShell
ProductPageHeader
ProductSectionCard
ProductMetricTile
ProductDataTable
ProductEmptyState
ProductLoadingState
ProductErrorState
ProductBoundaryBanner
ProductTraceLink
ProductScopeBar
ProductStatusBadge
ProductStateBlock
ProductTechnicalDisclosure
ProductSegmentedControl
```

A future implementation may rename or recompose primitives, but must not lose their product semantics.

### 3.6 PFE-3 / PFE-4 / PFE-5

Classification:

```text
KEEP ROLE BOUNDARIES / EVOLVE UX
```

Retain:

- Customer Portal = customer-safe reporting/product consumption surface;
- Operator Runtime Console = runtime review surface;
- Admin Console = governance/readback surface.

Do not collapse all three roles into one generic admin dashboard.

### 3.7 PFE-6 through PFE-12

Classification:

```text
KEEP QUALITY BASELINE / EVOLVE WHERE PFA FOUND DEBT
```

Retain:

- accessibility and keyboard requirements;
- responsive requirements;
- explicit state handling;
- visual regression discipline;
- performance/bundle discipline;
- bilingual copy baseline;
- demo/release-candidate boundary.

### 3.8 PFE-13

Classification:

```text
FROZEN PRODUCT FRONTEND V1 BASELINE
```

PFE-13 remains the frozen route/product baseline for surfaces not explicitly superseded by later work.

It does not mean:

- production launch;
- commercial launch;
- live runtime;
- real device control;
- field pilot execution;
- AO-ACT dispatch.

### 3.9 PFA

Classification:

```text
QUALITY AUDIT PARTIALLY COMPLETE
PFA-0 COMPLETE
PFA-1 COMPLETE
PFA-2 COMPLETE
PFA-3..PFA-7 PAUSED
```

Retain the 16 unresolved findings as OPEN_RETAINED_PRODUCT_DEBT.

They do not globally block MCFT, but they do remain mandatory input to future frontend UX work.

### 3.10 PFE-14 v0.2

Classification:

```text
CURRENT OPERATOR DESIGN AUTHORITY
WITH STALE HISTORICAL MCFT DEPENDENCY SNAPSHOT
```

Retain as current Operator Runtime Console design authority:

- one governed six-key Scope;
- read-only productization;
- primary navigation = Runtime Overview + Fields;
- no multi-field concurrent Shadow Runtime claim;
- no device-control center;
- no production-gateway control center;
- no Recommendation / Approval / Dispatch workspace;
- no automatic action claim;
- target-state prototype rules;
- Apple-inspired visual foundation;
- technical-detail progressive disclosure.

Do not reuse the old PFE-14 dependency snapshot as evidence of current MCFT readiness. Any future PFE-14 implementation must rebind to current MCFT authority rather than repeat the 2026-08 dependency conclusion.

### 3.11 Customer Frontend MVP V1

Classification:

```text
HISTORICAL CUSTOMER NARRATIVE / KEEP PRODUCT INTENT
```

Retain the customer comprehension chain:

```text
经营总览
-> 地块病历
-> 作业闭环报告
-> 同源客户报告
```

Retain the broader business journey as product intent only:

```text
发现风险
-> 形成建议
-> 审批
-> 执行
-> 证据
-> 验收
-> 价值记录
-> 田块记忆
```

However, later authority maturity controls whether each capability can be shown as active. Historical presence in copy does not authorize ROI, Field Memory, approval, dispatch, or execution behavior.

### 3.12 FOUI Product Projection Wave-01

Classification:

```text
LATEST UNIFIED PRODUCT-PROJECTION SEMANTICS
MACHINE-QUALIFIED
GOVERNANCE LABEL STILL PRE-CONSTRUCTION FREEZE CANDIDATE
```

At commit:

```text
b32a2432fe6b39b0c973c40567b386bebc57b9d7
```

the dedicated workflow:

```text
foui-projection-contract-wave01
```

completed successfully.

The document itself still says:

```text
PRE-CONSTRUCTION FREEZE CANDIDATE
```

Therefore this blueprint adopts FOUI Wave-01 as the latest product-projection semantic direction, but does not claim broad high-fidelity FOUI construction is formally authorized until a later governance artifact explicitly closes that status gap.

## 4. Canonical product model

GEOX frontend is role-separated at the shell level and unified at the governed product-projection level.

```text
                         GEOX PRODUCT
                              |
          +-------------------+-------------------+
          |                   |                   |
     Customer Portal    Operator Runtime      Admin Console
          |                Console                 |
          |                   |                   |
          +-------------------+-------------------+
                              |
                       Product Projection
                              |
              +---------------+---------------+
              |               |               |
             MCFT            ADR            B-Line
              |               |               |
              +---------------+---------------+
                              |
                         Outcome / Evidence
```

Important:

```text
Role shell separation
!=
domain isolation.

Product composition
!=
authority collapse.
```

The frontend may compose read models across domains only through governed projection contracts and exact linkage.

## 5. Role boundaries

### 5.1 Customer Portal

Purpose:

```text
customer-safe understanding, reporting, traceable delivery
```

May:

- view authorized summary;
- view fields;
- view field reports;
- view customer-safe operation reports;
- browse reports;
- export/print governed delivery surfaces;
- later consume governed Action Case projections if separately productized.

Must not, by default:

- dispatch;
- approve;
- write facts;
- mutate MCFT state;
- create ADR decisions;
- create AO-ACT;
- control devices;
- claim execution authorization;
- mutate acceptance;
- write Outcome/Attribution.

### 5.2 Operator Runtime Console

Purpose:

```text
read-only runtime observation and trace inspection
```

Current PFE-14 primary navigation:

```text
运行总览
地块
```

Must remain separate from future B-Line command surfaces.

### 5.3 Admin Console

Purpose:

```text
governance and readback
```

Admin is not a production control cockpit.

A readback of device capability or health does not imply control authority.

## 6. Canonical route decisions

Decision vocabulary:

```text
KEEP
= preserve current route/surface and its product meaning.

EVOLVE
= preserve product meaning, redesign UX/IA/density/responsive behavior.

LEGACY
= implementation may remain reachable, but it is not a canonical formal product surface.

HOLD
= capability or surface may be valid future product work, but current authority/maturity is insufficient for formal release.

NEW
= genuinely new product work not already represented by a governed route/contract; requires a new product contract before implementation.
```

### 6.1 Customer

| Route / surface | Decision | Canonical meaning |
|---|---|---|
| `/customer/dashboard` | KEEP + EVOLVE | Customer executive/operating summary |
| `/customer/fields` | KEEP + EVOLVE | Authorized field list |
| `/customer/fields/:fieldId` | KEEP + EVOLVE | Customer-readable field report / field record |
| `/customer/operations` | KEEP + EVOLVE | Customer-visible operation reporting list |
| `/customer/operations/:operationId` | KEEP + EVOLVE | Customer operation report detail |
| `/customer/reports` | KEEP + EVOLVE | Report center |
| `/customer/export` | KEEP SECONDARY + EVOLVE | Delivery/print surface, not a primary product domain |
| field/operation export routes | KEEP SECONDARY + EVOLVE | Delivery/print surfaces |

Customer navigation placement may evolve. In particular, export is a secondary delivery function even if the historical shell exposes it as a top-level item.

### 6.2 Operator Runtime Console

| Route / surface | Decision | Canonical meaning |
|---|---|---|
| `/operator/twin` | KEEP + EVOLVE | Single-scope Runtime Overview |
| `/operator/fields` | KEEP + EVOLVE | Exact Scope Navigator |
| `/operator/fields/:fieldId` | KEEP + EVOLVE | Field Runtime overview |
| `.../state` | KEEP + EVOLVE | State readback |
| `.../forecast` | KEEP + EVOLVE | Forecast readback; forecast != recommendation |
| `.../scenario` | KEEP + EVOLVE | Scenario comparison; scenario != task/dispatch |
| `.../action-lifecycle` | KEEP READ-ONLY + EVOLVE | Read-only trusted execution/action lifecycle evidence |
| `.../residual` | KEEP + EVOLVE | Residual verification |
| `.../calibration` | KEEP + EVOLVE | Calibration replay/readback |
| `.../evidence-trace` | KEEP + EVOLVE | Canonical Evidence Trace / Audit surface |
| `.../health` | KEEP + EVOLVE | Runtime Health readback |
| `.../evidence` | KEEP ALIAS | Alias of Evidence Trace where preserved |
| `.../audit` | KEEP ALIAS | Alias of Evidence Trace where preserved |
| `/operator/pilot` | HOLD | Existing implementation/history; not current PFE-14 v0.2 formal primary route |
| `/operator/twin/gateway-demo` | LEGACY / DEMO URL-ONLY | Historical replay/demo surface |
| `/operator/twin/fields/*` | LEGACY | Old Operator Twin route family |
| `/operator/twin/production-workflow` | LEGACY | Historical route, not current formal PFE-14 navigation |
| `/operator/twin/traces/*` | LEGACY TRACE BRIDGE | Compatibility/trace bridge |

Current formal Operator primary navigation remains:

```text
Runtime Overview
Fields
```

Do not add global Evidence, global Health, Pilot, Settings, Forecast, or Calibration as top-level Operator navigation without a new governed product contract.

### 6.3 Historical Operator workbench routes

The following current-code route family is not a canonical formal surface merely because it exists:

```text
/operator/workbench
/operator/approvals
/operator/dispatch
/operator/acceptance
/operator/evidence
/operator/devices-alerts
/operator/roi-ledger
/operator/field-memory
/app/operator/fields/:fieldId/evidence-twin
...
```

Continuation classification:

```text
ROUTE = LEGACY / NON-CANONICAL FORMAL SURFACE
CAPABILITY = HOLD unless separately governed by current authority
```

Future Approval, Dispatch, Execution, Evidence Acceptance, Outcome, or Field Memory product experiences must receive a new explicit product contract rather than promoting these historical routes.

### 6.4 Admin

| Route / surface | Decision | Canonical meaning |
|---|---|---|
| `/admin/dashboard` | KEEP + EVOLVE | Governance dashboard |
| `/admin/fields` | KEEP + EVOLVE | Field governance readback |
| `/admin/operations` | KEEP + EVOLVE | Operation governance readback |
| `/admin/devices` | KEEP + EVOLVE + CONTRACT GAP | Device asset/status readback; no control |
| `/admin/evidence` | KEEP + EVOLVE | Evidence governance readback |
| `/admin/skills` | KEEP + EVOLVE | Config/skill readback; route naming debt retained |
| `/admin/healthz` | KEEP + EVOLVE | Health readback |

Debug, import, acceptance, dev-tool, and other compatibility routes remain non-formal unless separately governed.

### 6.5 Supporting

```text
/login                -> KEEP
LocaleToggle          -> KEEP
Product Design System -> KEEP / EVOLVE
```

## 7. Canonical Operator Field Runtime information architecture

PFE-14 v0.2 is retained.

Primary shell:

```text
运行总览
地块
```

Field Runtime primary tabs:

```text
总览
证据
状态
预测
运行健康
审计
```

More:

```text
情景
行动生命周期
残差验证
校准
```

Runtime Overview target hierarchy:

First layer:

```text
Runtime Context
Exact Scope
Latest Completed Slot
Next Target Slot
Evidence Eligibility
Current Runtime Health
```

Second layer:

```text
24-hour slot strip
recent runtime events
stale / missed / backfill / recovery summary
State / Forecast status summary
```

Third layer, progressive disclosure:

```text
canonical refs
checkpoint ref
cursor ref
response hash
limitations
```

Long IDs and raw technical payloads must never dominate the primary hierarchy.

## 8. Canonical visual and interaction foundation

Retain PFE-14 Apple-inspired principles without Apple brand imitation:

```text
CLARITY
DEFERENCE
DEPTH
CONTINUITY
```

Retain current visual direction:

```text
page background: #F5F5F7
panel: white / translucent white
primary text: #1D1D1F
secondary text: #6E6E73
GEOX accent: #176B45
font weights: 400 / 500 / 600
thin separators
minimal shadows
progressive technical disclosure
```

Forbidden defaults:

- dark full-height sidebar;
- heavy card shadows;
- disabled navigation placeholders as product IA;
- continuous pulse;
- permanent spinner;
- flashing warning;
- decorative number animation;
- raw long IDs as primary headings;
- color-only status.

Future visual implementation may evolve the exact tokens, but must preserve the product principles unless a later design-system contract explicitly replaces them.

## 9. PFA debt converted into mandatory redesign requirements

The 16 retained PFA findings are not historical trivia. They become mandatory constraints for future design.

### 9.1 Customer

Must fix:

- dashboard duplicate report-entry content;
- unbalanced desktop columns;
- mechanical mobile stacking;
- dense Reports Center;
- viewport sensitivity;
- weak naming in demo/list rows;
- long ID and wrapped badge readability;
- mobile export/print collapse.

Required design response:

```text
summary -> drill-down
bounded sections
clear report grouping
compact mobile navigation
customer names before technical IDs
technical IDs progressive / secondary
deliberate mobile export strategy
```

### 9.2 Operator

Must fix:

- overly wide runtime detail;
- horizontal overflow;
- underused desktop space in some lists;
- viewport-sensitive laptop/mobile behavior;
- long source/reference tables;
- long 10-17 viewport pages;
- weak scanability in audit/calibration/pilot/demo history.

Required design response:

```text
summary -> detail
section navigation
tabs / accordion / progressive disclosure
contained table overflow
bounded lists
desktop density without width waste
mobile compact shell
technical refs secondary
```

### 9.3 Admin

Must fix:

- awkward table wrapping;
- Admin Devices status-readback contract gap.

Admin Devices future accepted readback must cover:

```text
device identity
device asset record
field binding
connectivity readback
telemetry recency
health state
degraded / unavailable state
declared capability
source evidence
```

Required state vocabulary:

```text
known
unknown
unavailable
stale
degraded
```

None of these states authorize control.

## 10. FOUI unified product-projection baseline

FOUI is the canonical future composition direction.

### 10.1 Permanent authority ceiling

```text
FOUI-PROJ
= non-authoritative customer/product composition read model

FOUI-PROJ
!= MCFT authority
!= ADR authority
!= B-Line authority
!= Outcome authority
!= command authorization
```

### 10.2 Query / command separation

Projection APIs remain read-only:

```text
GET / HEAD allowed
POST / PUT / PATCH / DELETE forbidden under FOUI-PROJ
```

A visible interaction hint is not authorization.

Correct pattern:

```text
GET projection
-> show caller-relative intent
-> user chooses
-> explicit authority-owner command
-> authority owner reauthorizes
-> authority owner mutates its own authority
-> projection recomputes
```

### 10.3 Current world vs decision-time world

Permanent invariant:

```text
CURRENT BEST-KNOWN WORLD
!=
DECISION-TIME WORLD
```

Frontend must preserve:

```text
current_context
decision_time_basis
later_changes
```

If historical basis is unavailable, show unavailable/partial. Never substitute current MCFT state for the historical decision basis.

### 10.4 Governed Action Case

Future product composition may reference this decomposed chain:

```text
Agronomic Decision
Recommendation Candidate
Approval Request
Approval Decision
Operation Plan
Execution Authorization
Task
Dispatch
Executor
Device
Execution Receipt
As Executed
Evidence Artifacts
Execution Evidence Acceptance
Outcome
Attribution
```

Missing objects remain missing.

Frontend must not synthesize absent authority objects.

### 10.5 Attention Queue

Frontend triage may use:

```text
triage_bucket
attention_reason_code
blocking_state
presentation_rank
sort_reason_code
```

Frontend must not invent:

```text
priority
severity
risk_score
```

If a source authority declares severity, display it as source-declared and bind it to the exact authority ref.

### 10.6 Capability availability

A route, API, or implemented screen does not prove product availability.

Canonical axes:

```text
PRODUCT IMPLEMENTATION
BUILT / PARTIAL / NOT_BUILT

AUTHORITY MATURITY
AUTHORIZED / PREVIEW / NOT_AUTHORIZED

OPERATIONAL ELIGIBILITY
CURRENT / DEGRADED / EXPIRED / UNAVAILABLE
```

Only then may the product derive customer-facing availability.

## 11. Future full-product IA: allowed direction, not yet route authority

The following concepts are valid future product directions because FOUI contracts support them semantically:

```text
Attention Queue
Governed Action Case
Capability Availability
Decision-time History / Current-vs-Then
Cross-domain provenance
```

Current classification:

```text
HOLD
```

They are not authorized new route names in this document.

Before they become formal pages, a future phase must define:

- primary user;
- role surface;
- route ownership;
- source projection;
- command boundary;
- authority/non-authority refs;
- availability rule;
- bilingual copy;
- responsive/accessibility/state contracts;
- acceptance gate.

## 12. Sites / React / other implementation policy

This blueprint is implementation-framework neutral.

ChatGPT Sites, React, Next.js, or another frontend may implement the product only if it preserves:

- role separation;
- canonical route meanings or governed migration;
- design-system semantics;
- authority boundaries;
- FOUI non-authoritative projection boundary;
- command reauthorization;
- current-vs-decision-time separation;
- explicit degraded/unavailable states.

No implementation platform may become authority merely because it can store data or perform server-side actions.

## 13. What future frontend work should read

### Normal page/UX continuation

Read:

```text
GEOX-FRONTEND-CANONICAL-BLUEPRINT-V1.md
GEOX-FRONTEND-CANONICAL-BLUEPRINT-V1.json
current page implementation
current source API/read-model contract
```

Do not re-read H58-H67 / F0-F2 / PFE-0-PFE-13 / old PFA by default.

### Operator Runtime work

Also read:

```text
PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md
current MCFT-CAP-09 authority/read contract required by the page
```

Do not trust the old PFE-14 dependency snapshot without fresh rebind.

### Unified MCFT + ADR + B-Line product work

Also read:

```text
GEOX-FOUI-PROJECTION-CONTRACT-WAVE-01-V1.md
the current authority contracts of the participating domains
```

## 14. Watched paths for incremental continuation

Future work does not need a full historical audit.

Instead, compare the baseline SHA with current protected main and inspect only changes under:

```text
docs/frontend-productization/**
docs/frontend-acceptance/**
docs/frontend/**
docs/product_projection/**
apps/web/src/app/routes/**
apps/web/src/layouts/**
apps/web/src/design-system/**
apps/web/src/styles/**
apps/web/src/features/**
apps/web/src/api/**
apps/server/src/product_projection/**
```

A change outside these paths does not by itself require frontend re-audit, unless it changes a domain contract consumed by the frontend.

Product Projection implementation paths are watched explicitly because the Canonical Product UI contract now spans both frontend consumers and the read-only server projection layer. A server-side Product Projection change is therefore a frontend/product-contract re-audit trigger even when no React file changes.

## 15. Re-audit triggers

A historical frontend re-audit is required only if one or more of these is true:

1. a newer document explicitly says it supersedes or replaces this blueprint;
2. formal route topology changes after the baseline SHA;
3. role ownership changes between Customer, Operator, and Admin;
4. a new formal nav item is proposed;
5. FOUI projection schema/version changes materially;
6. a domain authority changes semantics that the frontend projects;
7. command ownership or authorization flow changes;
8. a previously LEGACY/HOLD surface is proposed for formal promotion;
9. a new product design system explicitly replaces the inherited PFE-2/PFE-14 visual baseline;
10. the machine-readable companion manifest fails to describe the current governed frontend state.

Otherwise:

```text
NO FULL HISTORICAL FRONTEND AUDIT.
USE INCREMENTAL DIFF + THIS BLUEPRINT.
```

## 16. Update protocol

Any future frontend phase that changes a canonical decision must update this blueprint or explicitly supersede it.

Minimum update record:

```text
new protected-main SHA
changed decision
superseded section
new governing artifact
route/surface impact
authority impact
PFA debt impact
acceptance evidence
```

Do not leave a new frontend authority stranded only in a phase-local document.

## 17. Accepted continuation statement

After this document is merged to protected main, the allowed continuation statement is:

```text
GEOX frontend history through the baseline SHA has been consolidated into the
Canonical Frontend Blueprint V1. Future frontend work should use this blueprint
and incremental governed changes rather than re-auditing the full historical
frontend document set by default.
```

This statement does not claim:

- all current pages are product-quality complete;
- PFA debt is closed;
- PFE-14 is fully rebound to current MCFT;
- FOUI broad construction is formally authorized;
- production runtime or controlled action is enabled.

## 18. Product data contract succession

Canonical product data construction is governed by:

```text
GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1
```

After adoption of this blueprint and its succession artifact:

```text
CANONICAL BUSINESS PERSISTENCE
= existing GEOX PostgreSQL architecture

CANONICAL NEW PRODUCT READ CONTRACT
= FOUI Product Projection

CANONICAL NEW PRODUCT API NAMESPACE
= /api/product/v1/*
```

Pre-FOUI customer/report/portfolio APIs remain compatibility-era interfaces only:

```text
/api/v1/customer/*
/api/v1/reports/*
/api/v1/fields/portfolio
```

Rules:

1. Existing legacy consumers may remain until an explicit successor and migration gate are complete.
2. New Customer, Operator, Admin, Sites, React, mobile, or alternate-host product consumers must not add new dependencies on those legacy API families.
3. `/api/v1/customer/fields/:field_id/confirmed-twin-summary` is specifically `LEGACY_DO_NOT_ADOPT` for new product construction because historical fallback/default business semantics must not become FOUI truth.
4. `/api/v1/fields/portfolio` is `PRE_FOUI_LEGACY_PROJECTION`; its historical risk-filter/sort model does not authorize product-owned risk or severity in the new product.
5. A canonical Product API route must ultimately be backed by governed authority/basis readers and a Product Projection Builder. A permanent wrapper over a legacy presentation API is forbidden.
6. The current Sites Customer Portal test remains a new product consumer. Its first real-data binding must target `/api/product/v1/*`, not the legacy Customer APIs.
7. No second GEOX business database is introduced by frontend hosting. Host-local storage does not become GEOX authority or canonical product persistence merely because the host can store data.

Legacy lifecycle:

```text
LEGACY_ACTIVE_READ
  -> DEPRECATED
  -> EMERGENCY_COMPAT_ONLY
  -> REMOVED
```

A legacy surface may advance only after the canonical successor exists, canonical consumers have migrated, relevant acceptance is green, and no canonical consumer remains.

The succession artifact is the governing source for exact legacy-route classifications, historical document disposition, canonical namespace, null/unknown discipline, and the first successor construction unit.

