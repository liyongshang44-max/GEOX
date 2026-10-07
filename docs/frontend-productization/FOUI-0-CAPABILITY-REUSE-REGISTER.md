# GEOX FOUI-0 — Capability Reuse Register

Status: STATIC REUSE REGISTER / NO IMPLEMENTATION AUTHORIZATION
Audit base: d054b334b3e74f3356b5d02498da9ba845eccdfb

## 0. Purpose

This register separates reusable frontend capability from legacy route/product semantics.

Core rule:

~~~
reuse code capability
!=
reuse legacy product meaning
~~~

A component, view model or API client may be technically reusable while its route, labels, ordering semantics or authority assumptions are not reusable.

## 1. Operator Workbench

Current source:

~~~
apps/web/src/views/operator/OperatorWorkbenchPage.tsx
apps/web/src/viewmodels/operatorWorkbenchVm.ts
apps/web/src/api/operatorWorkbench.ts
~~~

Reusable:

- loading / empty / permission-denied / error state handling;
- queue-card composition patterns;
- source text and technical-object navigation patterns;
- aggregation layout concepts;
- no-fake-item empty-state discipline.

Do not reuse as canonical FOUI semantics:

- legacy queue taxonomy;
- legacy item priority;
- priorityText;
- legacy workbench ordering;
- the /operator/workbench route as future Home.

Reason: Wave-01 AttentionQueueProjectionV1 forbids product-owned priority, severity and risk_score. Future Home must use triage_bucket, attention_reason_code, presentation_rank and sort_reason_code from the projection runtime.

Disposition:

~~~
route = LEGACY
layout/state patterns = REUSE
attention semantics = REPLACE WITH WAVE-01 PROJECTION
~~~

## 2. Operator Approvals

Current source:

~~~
apps/web/src/views/operator/OperatorApprovalsPage.tsx
apps/web/src/viewmodels/operatorApprovalsVm.ts
apps/web/src/api/operatorApprovals.ts
~~~

Current code already contains:

- fetchOperatorApprovals;
- submitOperatorApprovalAction;
- fetchSessionMe;
- PermissionGate;
- hasOperatorPermission;
- writeReady;
- self-approval blocking;
- exact technical identifiers for approval request / prescription / recommendation;
- explicit reload after successful command.

Reusable:

- approval request card structure;
- loading/error/permission states;
- self-approval-risk presentation;
- technical-ref disclosure;
- disabled/action feedback states;
- command UX pattern where the command API remains authority-owned.

Not reusable as FOUI authority:

- button visibility;
- client writeReady;
- local risk labels as agronomic/domain severity;
- route reachability;
- UI permission state as proof of authority.

Future FOUI command flow remains:

~~~
GET projection
→ display allowed intent
→ user chooses intent
→ B-Line command API
→ reauthentication / reauthorization
→ authority object created or changed
→ projection reread
~~~

Disposition:

~~~
route = compatibility / capability substrate
presentation = REFACTOR-CAPABILITY
command owner = B-Line
projection write = FORBIDDEN
~~~

## 3. Operator Dispatch

Current source:

~~~
apps/web/src/views/operator/OperatorDispatchPage.tsx
apps/web/src/viewmodels/operatorDispatchVm.ts
apps/web/src/api/operatorDispatch.ts
~~~

Current view model explicitly separates task, dispatch, acknowledgement and receipt presentation.

Reusable:

- task/dispatch/ack/receipt display decomposition;
- executor/device presentation when source-backed;
- failure/retry UX states;
- technical task and receipt references;
- loading/error/permission states.

Do not reuse as promoted semantics:

~~~
DISPATCHED -> executed
ACKED -> executed
RECEIPT_RECEIVED -> operation successful
COMPLETED -> evidence accepted
~~~

Future Operations and Action Case must take exact refs from GovernedActionCaseProjectionV1 rather than infer chain continuity from legacy row grouping.

Disposition:

~~~
presentation capability = REUSE / REFACTOR
route taxonomy = DO NOT PROMOTE AUTOMATICALLY
authority logic = B-Line
~~~

## 4. Operator Acceptance

Current source:

~~~
apps/web/src/views/operator/OperatorAcceptancePage.tsx
apps/web/src/viewmodels/operatorAcceptanceVm.ts
apps/web/src/api/operatorAcceptance.ts
~~~

Current view model distinguishes PENDING, EVIDENCE_INSUFFICIENT, FAILED, REVIEW_REQUIRED and PASSED.

Reusable:

- execution-evidence acceptance presentation;
- evidence-insufficient and review-required states;
- technical acceptance and operation references;
- permission/write-readiness UX patterns.

Permanent semantic ceiling:

~~~
acceptance_result_v1 PASS
= execution-evidence acceptance within B-Line boundary

acceptance_result_v1 PASS
!=
physical operation success
!=
agronomic outcome success
!=
causal effect
~~~

Disposition:

~~~
presentation = REUSE / REFACTOR
Outcome promotion = FORBIDDEN
~~~

## 5. Operator Evidence

Current source:

~~~
apps/web/src/views/operator/OperatorEvidencePage.tsx
apps/web/src/viewmodels/operatorEvidenceVm.ts
apps/web/src/api/operatorEvidence.ts
~~~

Important current fact: this page is primarily an evidence-export-job surface. It contains createOperatorEvidenceExportJob, export permission gating, manifest/checksum/artifact/download presentation and export status.

Reusable:

- evidence export UX;
- checksum/manifest/download presentation;
- export permission handling;
- evidence delivery state handling.

Not equivalent to:

~~~
EvidenceArtifact authority chain
Receipt -> AsExecuted -> EvidenceArtifact -> AcceptanceResult
Action Case proof composition
~~~

Therefore the future FOUI Evidence page must not simply rename this existing route.

Disposition:

~~~
export capability = REUSE
canonical evidence chain = NEW PRODUCT COMPOSITION
~~~

## 6. Evidence Twin adapter

Current source:

~~~
apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts
~~~

It already recognizes distinct nodes for recommendation, approval, operation plan, AO-ACT task, AsExecuted, evidence, acceptance and verification.

Reusable:

- decomposition vocabulary;
- missing-node rendering concepts;
- step visualization ideas;
- gap presentation.

Not reusable as exact product linkage:

- heuristic object joining;
- legacy source assumptions;
- any relationship not proven by Wave-01 exact refs/linkage_proofs.

Disposition:

~~~
presentation/decomposition concepts = REUSE
canonical Action Case data source = REPLACE WITH GovernedActionCaseProjectionV1
~~~

## 7. Canonical MCFT Field Runtime

Current source:

~~~
apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx
apps/web/src/api/mcftFieldTwinRuntime.ts
~~~

Disposition:

~~~
route owner = REUSE
read model = REUSE
exact six-key scope = PRESERVE
GET-only = PRESERVE
MCFT recalculation in FOUI = FORBIDDEN
~~~

Future Fields product work should refine presentation around this canonical source, not resurrect old twin routes.

## 8. Customer reports

Current customer field and operation report surfaces are reusable delivery/reporting surfaces.

Reusable:

- customer-readable summaries;
- export/print handling;
- report navigation;
- evidence summary presentation where source-backed.

Not reusable as authority:

~~~
report field != source authority
report label != authority maturity
report outcome-looking card != Outcome authority
~~~

## 9. Admin Console

Admin pages remain governance/readback surfaces.

Reuse policy:

~~~
admin shell/readback = REUSE
collapse into operator workflow = FORBIDDEN
admin route reachability = not FOUI capability availability
~~~

## 10. Legacy ROI Ledger and Field Memory

Current sources:

~~~
OperatorRoiLedgerPage
OperatorFieldMemoryPage
~~~

These remain HOLD / legacy internal substrate.

Permanent FOUI-0 rule:

~~~
ROI row != Outcome authority
Field Memory != causal attribution
~~~

They must not seed an OutcomeProjection before separate Outcome authority work is accepted.

## 11. Reuse summary

| Existing capability | Reuse level | Future target | Hard boundary |
|---|---|---|---|
| Workbench state/layout | partial | Home | replace priority semantics with AttentionQueueProjection |
| Approval cards/action UX | strong | Operations / Action Case | B-Line command owns mutation |
| Dispatch lifecycle presentation | strong | Operations / Action Case | exact refs required; no execution inference |
| Acceptance presentation | strong | Evidence / Action Case | acceptance != success/outcome |
| Evidence export center | strong but narrow | Reports / Evidence export | not canonical evidence chain |
| Evidence Twin decomposition | conceptual | Action Case | replace data source with governed projection |
| Canonical Field Runtime | strong / canonical | Fields / Field Detail | preserve MCFT semantics and scope |
| Customer reports | strong | Reports | reporting only |
| Admin shell | strong | Administration | governance/readback only |
| ROI / Field Memory | hold | Outcomes later | no authority promotion |

## 12. Conclusion

FOUI should be built by composing existing qualified capabilities around the Wave-01 projection contracts, not by renaming old routes and not by rebuilding every page.
