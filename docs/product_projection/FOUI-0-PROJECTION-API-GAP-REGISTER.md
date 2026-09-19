# GEOX FOUI-0 — Projection / API Gap Register

Status: GAP REGISTER / NO IMPLEMENTATION AUTHORIZATION
Audit base: d054b334b3e74f3356b5d02498da9ba845eccdfb

## 0. Rule

A missing product field is a projection/API gap. It is not permission for the UI to infer domain truth.

~~~
missing source
→ show unavailable / partial / not yet available

NOT

missing source
→ infer from nearby objects
~~~

## 1. Wave-01 operational status

Wave-01 contract types are present on current main:

~~~
ProductProjectionEnvelopeV1
GovernedActionCaseProjectionV1
CapabilityAvailabilityProjectionV1
AttentionQueueProjectionV1
~~~

The source binding registry is also present and constrains exact MCFT / ADR / B-Line source objects by product role.

Current code search establishes contracts, schema, source binding registry, governance acceptance, negative qualification and freeze documentation.

Current code search does not establish runtime projection builders, GET product-projection routes, a frontend product-projection API client, frontend projection adapters, or formal Home / Action Case projection consumers.

Therefore Wave-01 is a contract/source-binding foundation, not an operational Product Projection runtime.

## 2. Gap status vocabulary

~~~
CONTRACT_PRESENT_RUNTIME_MISSING
SOURCE_PRESENT_PROJECTION_MISSING
SOURCE_NOT_FORMALLY_BOUND
FRONTEND_ADAPTER_MISSING
PRODUCT_SURFACE_MISSING
HOLD_BY_AUTHORITY
~~~

## 3. GovernedActionCaseProjectionV1 gaps

| Gap | Status | Current evidence | Required future construction | UI fallback |
|---|---|---|---|---|
| Projection builder | CONTRACT_PRESENT_RUNTIME_MISSING | contract + source registry exist | read-only builder | none |
| Exact cross-source reader set | SOURCE_PRESENT_PROJECTION_MISSING | MCFT / ADR / B-Line bindings registered | read-only exact-ref readers | none |
| GET route | CONTRACT_PRESENT_RUNTIME_MISSING | no formal projection route found | GET-only route | none |
| Frontend API client | FRONTEND_ADAPTER_MISSING | no product projection client found | typed read-only client | none |
| Action Case adapter | FRONTEND_ADAPTER_MISSING | legacy Evidence Twin adapter is not Wave-01 projection adapter | projection-to-view adapter | do not heuristic-join |
| Decision-time basis | SOURCE_PRESENT_PROJECTION_MISSING | contract and registry roles exist | exact historical basis composition | show unavailable/partial |
| DecisionTimeAuthorityManifest current source | SOURCE_NOT_FORMALLY_BOUND | registry marks target-contract-v1 non-authority composition manifest | formal exact-ref source/capture contract | no current-state substitution |
| ADR DecisionResult product composition | SOURCE_PRESENT_PROJECTION_MISSING | exact ADR binding registered | projection reader/builder | no recommendation/scenario substitution |
| Approval chain composition | SOURCE_PRESENT_PROJECTION_MISSING | approval_request and approval_decision bindings registered | exact linked composition | show chain gap |
| Operation/task/dispatch composition | SOURCE_PRESENT_PROJECTION_MISSING | exact B-Line bindings registered | exact linked composition | show chain gap |
| Execution receipt presentation | PRODUCT_SURFACE_MISSING | ao_act_receipt_v1 binding registered | Action Case / Evidence presentation | no execution-success inference |
| AsExecuted presentation | SOURCE_PRESENT_PROJECTION_MISSING | registry + Evidence Twin substrate | exact linked presentation | no receipt substitution |
| Evidence artifact / acceptance composition | SOURCE_PRESENT_PROJECTION_MISSING | distinct exact bindings registered | projection composition | acceptance != outcome |
| Outcome / attribution slots | HOLD_BY_AUTHORITY | no OutcomeProjection runtime authorized | separate Outcome authority work | null / not yet available |

## 4. CapabilityAvailabilityProjectionV1 gaps

The frozen axes are product_implementation, authority_maturity and operational_eligibility.

| Gap | Status | Required behavior |
|---|---|---|
| Capability builder | CONTRACT_PRESENT_RUNTIME_MISSING | derive only from registered basis refs |
| Product release basis reader | SOURCE_NOT_FORMALLY_BOUND | explicit FOUI product-governance basis; route/code existence is insufficient |
| ADR maturity projection | SOURCE_PRESENT_PROJECTION_MISSING | remain PREVIEW until authoritative cutover basis proves AUTHORIZED |
| MCFT operational eligibility projection | SOURCE_PRESENT_PROJECTION_MISSING | consume source eligibility/validity; never rerun MCFT qualification |
| B-Line capability maturity | SOURCE_PRESENT_PROJECTION_MISSING | preserve exact B-Line authority refs and release governance |
| Frontend release-surface adapter | FRONTEND_ADAPTER_MISSING | map canonical capability state to active/limited/preview/disabled UI |
| Outcome capability | HOLD_BY_AUTHORITY | NOT YET AVAILABLE until separate authority contract |

Forbidden shortcut:

~~~
route exists OR component exists OR API exists
→ AVAILABLE
~~~

## 5. AttentionQueueProjectionV1 gaps

Current operator workbench contains useful aggregation concepts, but it is not the frozen AttentionQueue projection.

Future construction must read exact blocking/source refs and derive triage_bucket, attention_reason_code, presentation_rank and source-declared severity only when backed by an exact authority ref.

Product-owned priority, severity and risk_score remain forbidden.

| Gap | Status | UI rule |
|---|---|---|
| Attention builder | CONTRACT_PRESENT_RUNTIME_MISSING | no Home queue until builder exists |
| Exact source readers | SOURCE_PRESENT_PROJECTION_MISSING | no synthetic queue item |
| Product SLA basis | SOURCE_NOT_FORMALLY_BOUND | no invented due date |
| Home adapter | FRONTEND_ADAPTER_MISSING | no legacy workbench priority reuse |
| Home page | PRODUCT_SURFACE_MISSING | blocked on projection runtime |

## 6. Current world versus decision-time world

Existing canonical Field Runtime is strong current-world substrate. It is not sufficient for historical decision explanation.

~~~
CURRENT FIELD CONDITION
= canonical current MCFT references

WHY THIS DECISION WAS MADE
= exact decision-time basis references
~~~

Formal decision-time composition surface is currently missing.

Current posterior state must never be displayed as historical state at decision time. Missing history must remain PARTIAL_RECONSTRUCTION or UNAVAILABLE.

## 7. Field Operations page-to-gap mapping

| Surface | Blocking gap |
|---|---|
| Home | AttentionQueueProjection runtime + capability adapter |
| Fields | no projection blocker for existing canonical runtime; product presentation can be refined later |
| Decisions | GovernedActionCaseProjection runtime + ADR capability maturity |
| Decision Detail | decision-time basis composition |
| Operations | GovernedActionCaseProjection runtime + attention/capability composition |
| Action Case | GovernedActionCaseProjection runtime and exact linkage |
| Evidence | exact receipt → AsExecuted → evidence → acceptance composition |
| Outcomes | Outcome authority / OutcomeProjection HOLD |
| Reports | existing report read models can continue independently |
| Administration | existing admin readback can continue independently |

## 8. Interaction gap

Wave-01 interaction hints require requires_command_reauthorization = true.

Future FOUI may reuse existing interaction presentation, but authority-changing actions must go to the existing authority-owner command API. FOUI projection routes remain GET/HEAD only.

## 9. No-silent-inference register

~~~
forecast != decision
scenario != recommendation
DecisionResult != approval
approval != execution authorization
dispatch != execution
receipt != physical truth
AsExecuted != evidence acceptance
evidence acceptance != agronomic success
customer report != source authority
ROI row != Outcome authority
Field Memory != causal attribution
current MCFT state != decision-time state
route visibility != capability availability
button visibility != caller authorization
~~~

## 10. Construction handoff

If separately authorized, the next projection construction should be limited to three builders: GovernedActionCaseProjection, CapabilityAvailabilityProjection and AttentionQueueProjection, plus read-only source readers, GET-only routes, fixtures, negative tests and typed frontend clients/adapters after server qualification.

No authority semantics change is required or permitted.

## 11. Conclusion

The current repository has enough frontend substrate to avoid a clean-room rebuild. The principal missing layer is not more page code; it is the operational Product Projection Layer between existing authority sources and future Field Operations surfaces.