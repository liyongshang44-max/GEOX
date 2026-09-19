# GEOX FOUI-0 — Field Operations Product Surface Matrix

Status: PRODUCT-SURFACE FREEZE CANDIDATE
Audit base: d054b334b3e74f3356b5d02498da9ba845eccdfb

## 0. Rule

This matrix separates four things that must not be conflated:

~~~
target information architecture
current route reachability
current release surface
authority ownership
~~~

A target page may exist in the information architecture while its release state is PREVIEW, DISABLED or NOT YET AVAILABLE.

A reachable historical route does not become a formal FOUI page merely because React can render it.

## 1. Target information architecture

~~~
Home
Fields
Decisions
Operations
Evidence
Outcomes
Reports
Administration
~~~

Field Detail, Decision Detail and Action Case are drill-down product surfaces below that top-level information architecture.

## 2. Page responsibility matrix

| Surface | Primary product question | Current substrate | Required product projection / source | FOUI responsibility | Authority boundary | FOUI-0 disposition |
|---|---|---|---|---|---|---|
| Home | What needs attention now? | Operator workbench aggregation concepts; existing runtime status cards | AttentionQueueProjectionV1 + CapabilityAvailabilityProjectionV1 | Triage and navigation only | No product-owned priority, severity or risk score | NEW-REQUIRED; do not implement before projection runtime |
| Fields | What fields are in scope and which can I inspect? | /operator/fields + McftFieldRuntimeScopeNavigatorPage | MCFT canonical scope/read model | Scope navigation and capability state | No MCFT state calculation | REUSE / REFACTOR presentation |
| Field Detail | What is currently known about this field? | McftCanonicalFieldRuntimeRoutePage | MCFT canonical Field Runtime | Present current state, forecast, scenario, evidence trace and limitations | Current world only; no historical decision substitution | REUSE canonical route owner |
| Decisions | What decisions exist and what is their maturity? | No formal ADR product surface; dev flight-table is not a product source | GovernedActionCaseProjectionV1 + CapabilityAvailabilityProjectionV1, ADR refs when legitimate | List decision/action cases and release maturity | DecisionResult remains ADR authority; approval remains distinct | NEW-REQUIRED / PREVIEW |
| Decision Detail | Why was this decision made? | No canonical product detail | GovernedActionCaseProjectionV1 decision_time_basis | Show WHY / BASIS / DECISION with exact historical refs | CURRENT WORLD != DECISION-TIME WORLD | NEW-REQUIRED |
| Operations | What governed work is waiting, approved, dispatched or reported? | legacy workbench / approvals / dispatch / acceptance pages | GovernedActionCaseProjectionV1 + AttentionQueueProjectionV1 | Product workflow visibility and navigation | Approval/dispatch commands remain B-Line command APIs | NEW-REQUIRED / REFACTOR-CAPABILITY |
| Action Case | What happened across decision, authority, execution and proof? | fragmented Evidence Twin adapter + legacy operator pages | GovernedActionCaseProjectionV1 | WHY / BASIS / DECISION / AUTHORITY / EXECUTION / PROOF | Projection only; never persisted aggregate root | NEW-REQUIRED |
| Evidence | What execution evidence exists and what was accepted? | Field Runtime evidence-trace; OperatorEvidencePage; Evidence Twin adapter | GovernedActionCaseProjectionV1 exact evidence refs | Evidence browsing and exact provenance | Evidence acceptance != operation success != outcome | NEW-REQUIRED / REFACTOR-CAPABILITY |
| Outcomes | What qualified outcome is established? | ROI Ledger / Field Memory exist as historical/internal substrate only | Future OutcomeProjection / Outcome authority | No runtime product claim yet | No product-owned outcome or causal effect | HOLD |
| Reports | What customer-deliverable report can be read/exported? | Customer Portal field/operation/report/export routes | Existing customer report read models | Read-only delivery/reporting | Reports do not create authority facts | REUSE |
| Administration | What governance/readback state is visible? | Admin Console | Existing admin readbacks | Governance/admin shell | Do not collapse admin into operator workflow | REUSE |

## 3. Current code to product-chain mapping

### 3.1 Field State

Current canonical source:

~~~
apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx
apps/web/src/api/mcftFieldTwinRuntime.ts
~~~

Status:

~~~
formal current route owner = YES
read-only = YES
exact MCFT scope = YES
FOUI replacement required = NO
product presentation refinement = YES
~~~

### 3.2 Decision

Current repository evidence:

- Formal FOUI Decision page: not found.
- ADR DecisionResult rendering exists in development flight-table surfaces, not in a formal customer/operator FOUI surface.
- Wave-01 source binding registry recognizes ADR ApplicabilityAssessment, RuntimeEligibility, RuntimeBinding and DecisionResult as exact ADR authority refs.

Status:

~~~
formal product surface = MISSING
authority contract = EXISTS
product projection runtime = MISSING
release interpretation = PREVIEW / NOT YET AVAILABLE until capability projection proves otherwise
~~~

UI must not turn recommendation, scenario, forecast or current MCFT state into an ADR DecisionResult.

### 3.3 Approval

Current reusable substrate:

~~~
apps/web/src/views/operator/OperatorApprovalsPage.tsx
apps/web/src/viewmodels/operatorApprovalsVm.ts
apps/web/src/api/operatorApprovals.ts
~~~

The page already contains approval-request presentation, technical refs, write readiness and caller action gating.

FOUI rule:

~~~
button visible != authority granted
allowed intent != command authorization
Approve click -> B-Line command boundary -> reauth/authz -> authority object -> projection reread
~~~

### 3.4 Execution

Current reusable substrate includes OperatorDispatchPage and existing B-Line/AO-ACT frontend/view-model code.

FOUI may reuse presentation and interaction patterns only where semantics remain exact.

It must not derive:

~~~
approved -> executed
dispatched -> physically executed
receipt -> operation successful
~~~

### 3.5 Receipt

No formal FOUI receipt product surface was established by this audit.

Wave-01 source binding registry has an exact B-Line binding for ao_act_receipt_v1.

Therefore:

~~~
backend/source authority binding = REGISTERED
formal FOUI presentation = GAP
UI inference fallback = FORBIDDEN
~~~

### 3.6 AsExecuted

evidenceTwinAdapter.ts already recognizes as_executed_record_v1 as a distinct node.

This may be reused as evidence-chain presentation substrate, but it does not establish a canonical Action Case until exact projection linkage is built.

### 3.7 Evidence

Current substrate:

~~~
/operator/fields/:fieldId/evidence-trace
/operator/fields/:fieldId/evidence
legacy /operator/evidence capability
evidenceTwinAdapter.ts
~~~

Wave-01 source binding registry separately recognizes:

~~~
evidence_artifact_v1
acceptance_result_v1
~~~

FOUI must preserve that separation.

### 3.8 Outcome

Current repository contains ROI and Field Memory concepts, but FOUI-0 finds no Wave-01 OutcomeProjection and no authorization to promote those concepts into Outcome authority.

Therefore:

~~~
Outcome page target = retained
Outcome runtime = HOLD
Effect Attribution UI = HOLD
ROI / Field Memory = not Outcome authority
~~~

## 4. Legacy route treatment

### Preserve but do not promote

~~~
/operator/twin/fields/*
/operator/workbench
/operator/approvals
/operator/dispatch
/operator/acceptance
/operator/evidence
/operator/devices-alerts
/operator/roi-ledger
/operator/field-memory
~~~

Preservation is for compatibility and reusable capability extraction. It is not a release-surface decision.

### Remove later only after replacement acceptance

REMOVE-LATER is permitted only when:

~~~
replacement route/surface is accepted
required capability is preserved
no source-of-truth fallback depends on the legacy route
route compatibility policy explicitly allows retirement
machine acceptance covers the removal
~~~

FOUI-0 authorizes no deletion.

## 5. First future implementation slice

If separately authorized after FOUI-0, the narrow first product implementation should remain:

~~~
Home
Operations
Action Case
~~~

Reason:

~~~
Home       = attention / triage
Operations = governed workflow
Action Case = cross-authority explanation
~~~

These three surfaces test the core Field Operations product model without forcing premature redesign of every field, decision, report or admin page.

## 6. Product semantics for Action Case

Action Case must expose six distinct regions:

~~~
WHY
BASIS
DECISION
AUTHORITY
EXECUTION
PROOF
~~~

It must preserve null/unavailable states.

A missing authority object is shown as missing/unavailable. It is never synthesized from nearby timestamps, matching fields, matching action type or similar parameters.

## 7. Mobile direction is not part of FOUI-0 construction

Later mobile product work should optimize for:

~~~
attention
→ location
→ authorized instruction
→ constraints
→ evidence capture
~~~

FOUI-0 does not implement mobile layouts or high-fidelity responsive redesign.

## 8. Freeze conclusion

The current repository already has substantial frontend substrate. The correct strategy is controlled reconciliation and composition, not a clean-room rebuild.

The canonical Field Runtime is retained. Customer and Admin shells are retained. Legacy operator execution capabilities are mined selectively. New Home, Decisions, Operations, Action Case and Evidence product surfaces remain dependent on projection/runtime construction. Outcomes remain held.
