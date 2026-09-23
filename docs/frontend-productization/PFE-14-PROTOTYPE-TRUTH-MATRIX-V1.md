# PFE-14 Prototype Truth Matrix v1

Status: DESIGN-ONLY / NON-EFFECTIVE  
Repo basis: protected `main` `6df2241f1470e1df930498782b42c6ba9e813b41`  
Target: PFE-14 parallel prototype line before S4 runtime dependency unlock  
Write impact: NONE  
Backend impact: NONE  
Runtime authority impact: NONE

## 1. Purpose

This document freezes a no-fabrication rule for all PFE-14 target-state product prototypes.

A prototype may reorganize already-existing read-only capability into a clearer product experience, but it may not invent a Runtime fact, a server verdict, a route, a write action, a device state, a scheduler state, an Evidence freshness verdict, or a numeric operational value that the repository does not currently own.

The prototype must distinguish two artifact classes:

1. `CURRENT_IMPLEMENTATION_REFERENCE`
   - may show only values actually returned by the current repository/API during the referenced capture or by an accepted immutable evidence artifact;
   - must identify the source route/API or artifact;
   - must preserve current Replay-backed / nonclaim semantics.

2. `TARGET_STATE_STRUCTURE_ONLY`
   - may define product layout, labels, navigation, information hierarchy and state containers;
   - may show field names required by an already-frozen PFE-14 read contract;
   - must not populate unavailable fields with sample IDs, sample timestamps, sample counts, sample weather values, sample scheduler slots or sample verdicts;
   - unavailable values must render as `未建立`, `等待权威读合同`, `不可用` or an equivalent explicit non-data state.

The old design-only identifiers such as `tenant_sample`, `field_sample` and `SHADOW_ONLINE_SAMPLE` are not allowed in reviewed product prototypes after this matrix. They are design tokens, not repository facts.

## 2. Current authority boundary

Protected main currently records PFE-14 at:

`S4_BLOCKED_WAITING_MCFT09_SCHEDULER_AND_EVIDENCE_READ_CONTRACT`.

Therefore the frontend may not currently claim or infer:

- `runtime_mode = SHADOW_ONLINE`;
- current scheduler status;
- latest completed scheduler slot;
- next target slot;
- scheduler lag;
- Evidence freshness verdict;
- missed-slot count;
- backfill state;
- restart/recovery state;
- MCFT-9 degradation verdict.

The frozen S1 read contract exists, but these read models are marked `CONTRACT_REQUIRED_NOT_IMPLEMENTED` or otherwise not yet promoted by MCFT-CAP-09.

## 3. Repository-backed visible facts that may be used now

The Operator shell currently owns these governed static nonclaims and may show them exactly as current product boundaries:

- Runtime context default: `Replay-backed Demo`;
- `Read-only`;
- Live Device: `Not connected`;
- Production Gateway: `Not online`;
- Field Pilot: `Not started`;
- Controlled Execution: `Disabled`.

The shell also already owns a visible locale switch through `LocaleToggle` and primary navigation limited to:

- `/operator/twin` — Runtime Overview;
- `/operator/fields` — Fields / exact Runtime scope entry.

These are current repository capabilities, not target-state inventions.

## 4. Canonical GET-only capability baseline

Current canonical field-runtime routing is owned by:

- `apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx`;
- `apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx`;
- `apps/web/src/api/mcftFieldTwinRuntime.ts`.

The API client is GET-only and requires the exact six-key scope:

`tenant_id / project_id / group_id / field_id / season_id / zone_id`.

It currently exposes read functions for Runtime root graph, State, Forecast, Scenario, Action Lifecycle, Residual, Trace, Timeline, Runtime Health and Model Governance collections.

It does not currently expose the PFE-14 S4 Scheduler Summary or Evidence Availability Summary contract.

## 5. Prototype surface matrix

The target prototype is limited to 12 product surfaces. P13/P14 from the stale v0.3 draft are not separate pages; error/recovery states are cross-surface states and technical detail is progressive disclosure inside existing surfaces.

### P01 Runtime Overview — `/operator/twin`

Current source:

- `OperatorTwinOverviewPage`;
- `fetchOperatorTwinOverview`;
- `fetchOperatorTwinSourceIndexInventory`.

May show now:

- current read-only / Replay-backed boundary;
- current Operator overview fields and source-index inventory when actually returned by the API;
- current data-gap and boundary-rule rows when actually returned.

Must not show as current truth:

- Shadow-online mode;
- latest/next scheduler slot;
- Evidence freshness verdict;
- scheduler/backfill/recovery summary.

Target-state layout may reserve these areas, but values must say `等待 MCFT-9 权威读合同` until S4 unlock.

### P02 Exact Scope Navigator — `/operator/fields`

Current source:

- `McftFieldRuntimeScopeNavigatorPage`;
- field/season discovery plus explicit `zone_id` entry when no authoritative zone-list API exists.

Prototype rule:

- use empty/unselected controls or an actual captured governed scope;
- do not invent a sample field, season or zone.

### P03 Field Runtime Overview — `/operator/fields/:fieldId`

Current source:

- `readMcftRuntime`;
- `minimal_field_twin_runtime_read_model_v1`.

May show when returned:

- Active Lineage;
- Checkpoint;
- Runtime Tick;
- Evidence Window;
- State Transition;
- Assimilation Update;
- Posterior State;
- Terminal Record-Set Health;
- Runtime Config;
- current/latest Forecast attachment semantics;
- current/latest Scenario attachment semantics;
- Human Decision / Approved Plan attachments;
- Action Feedback / Residual / Calibration / Shadow Evaluation / Model Activation collection summaries;
- limitations, validation summary and hashes under technical disclosure.

Must not convert object presence into scheduler freshness or Shadow-online claims.

### P04 Evidence — `/operator/fields/:fieldId/evidence`

Current route semantics:

- alias to canonical `evidence-trace` tab;
- current client reads Trace + Timeline.

May show:

- existing Trace nodes/edges;
- Timeline events;
- source/canonical references that are actually returned.

Must not show as current truth:

- PFE-14 Evidence Availability fields such as `evidence_age_ms`, `freshness_status`, `coverage_ratio`, `maximum_gap_ms`, `late_evidence_count` or `out_of_order_count` unless a future authorized read contract returns them.

### P05 State — `/operator/fields/:fieldId/state`

Current source:

- `readMcftStates` collection.

Prototype may productize fields actually returned in State collection items. It must not invent numeric confidence, trend, agronomic label, unit or Evidence count when those fields are absent from the returned object.

### P06 Forecast — `/operator/fields/:fieldId/forecast`

Current source:

- `readMcftRuntime`;
- `readMcftForecasts`.

May show actual current-tick forecast pointer, latest successful forecast, scenario-source forecast and returned Forecast collection items.

Fixed boundary:

- Forecast is not Fact;
- Forecast is not Recommendation;
- Forecast is not Action.

Scenario eligibility may only come from an authoritative server verdict; frontend presence checks are not sufficient.

### P07 Runtime Health — `/operator/fields/:fieldId/health`

Current source:

- `readMcftHealth`;
- `field_twin_runtime_health_read_model_v1`.

May show now when returned:

- Terminal Record-Set Health ref;
- Latest Operational Runtime Health ref;
- `health_relationship`;
- returned health role resolutions / pointer validation summary;
- technical hashes.

Must not invent scheduler lag, missed slots, backfill, restart, recovery, Evidence freshness or degradation reason codes. Those belong to the blocked PFE-14/MCFT-9 product read contract.

### P08 Audit — `/operator/fields/:fieldId/audit`

Current route semantics:

- alias to canonical `evidence-trace` tab.

May show Trace, Timeline, canonical refs, hashes, limitations and validation summaries that exist in the canonical GET responses. Raw payload remains progressive disclosure and must not be fabricated.

### P09 Scenario — `/operator/fields/:fieldId/scenario`

Current source:

- `readMcftRuntime`;
- `readMcftScenarios`.

May show only scenarios actually returned by the canonical Runtime API and their exact attachment/reason semantics.

Forbidden:

- recommendation ranking;
- default preferred scenario;
- approval or execution action.

### P10 Action Lifecycle — `/operator/fields/:fieldId/action-lifecycle`

Current source:

- `readMcftRuntime`;
- `readMcftActionLifecycle`.

May show current Human Decision, Approved Plan and Action Feedback objects/collections when returned.

Forbidden:

- Create Decision;
- Approve;
- Retry task;
- Dispatch;
- AO-ACT creation.

### P11 Residual — `/operator/fields/:fieldId/residual`

Current source:

- `readMcftResiduals`.

May display only fields actually returned in `FORECAST_RESIDUAL` collection items. The product may call the surface Residual / Verification, but it may not invent predicted value, observed value, numeric delta, causal attribution or ROI impact unless present in canonical returned data.

### P12 Calibration — `/operator/fields/:fieldId/calibration`

Current source:

- `readMcftModelGovernance(... CALIBRATION_CANDIDATE)`;
- `readMcftModelGovernance(... SHADOW_EVALUATION)`;
- `readMcftModelGovernance(... MODEL_ACTIVATION)`.

May show returned governance objects and their statuses.

Fixed boundary:

- Candidate is not Active Model;
- visibility does not authorize activation;
- no Model Activate button.

## 6. Cross-surface state prototypes

These are state treatments, not additional product pages:

- `LOADING`;
- `NO_SCOPE`;
- `RUNTIME_NOT_ESTABLISHED`;
- `SHADOW_NOT_AUTHORIZED`;
- `WAITING_FOR_FIRST_SLOT`;
- `RUNNING`;
- `COMPLETED`;
- `DEGRADED_STALE_EVIDENCE`;
- `DEGRADED_MISSING_DATA`;
- `BACKFILLING`;
- `RECOVERED`;
- `BLOCKED`;
- `FORBIDDEN`;
- `API_ERROR`;
- `CONTRACT_INCOMPLETE`.

For states whose authoritative fields are not implemented, a target-state prototype may show the state label only as a documented state design, with a permanent `目标态结构 / 当前无权威运行值` badge. It must not show invented timestamps, counts or reason codes.

## 7. Data rendering policy for future visual mockups

Every visible value in a reviewed prototype must be classified as exactly one of:

- `CURRENT_STATIC_NONCLAIM` — value frozen in current repository product boundary;
- `CURRENT_API_VALUE` — captured from a named current GET endpoint/API response;
- `ACCEPTED_ARTIFACT_VALUE` — copied from a named immutable acceptance artifact with run/artifact identity;
- `UNAVAILABLE_AUTHORITY` — no value; render explicit not-established/waiting text;
- `LABEL_ONLY` — product label or explanation, not data.

The following classifications are forbidden:

- `DESIGN_SAMPLE_VALUE`;
- invented IDs;
- invented dates/times;
- invented percentages;
- invented health/freshness verdicts;
- invented weather, agronomic, State or Forecast numbers;
- invented scheduler slots;
- invented counts;
- invented device/gateway/pilot states.

## 8. Supersession ruling for Draft PR #2863

PR #2863 is useful as an earlier product-definition draft, but it must not be merged as-is because:

1. it embeds sample six-key Scope values that are not repository facts;
2. its 12-panel matrix conflicts with P13/P14 page numbering in the taskbook body;
3. it describes several S4 scheduler/freshness/recovery fields as product content before their authoritative read contract exists;
4. its base predates the current MCFT-9 implementation and KBS cadence work.

A later PFE-14 product taskbook refresh should consume this Truth Matrix and keep S4 blocked until the explicit MCFT-9 dependency re-adjudication unlocks it.

## 9. Next prototype action

After this Truth Matrix is accepted, the first visual prototype should be a structure-only Chinese primary layout for the 12 surfaces, with:

- `中文 / English` visible;
- no sample IDs or sample values;
- current static nonclaims shown exactly;
- current GET-backed areas marked with their source contract;
- S4-only scheduler/evidence fields rendered as `等待权威读合同`;
- all technical refs/hashes behind progressive disclosure.

This preserves product-design progress without turning design into a false Runtime claim.
