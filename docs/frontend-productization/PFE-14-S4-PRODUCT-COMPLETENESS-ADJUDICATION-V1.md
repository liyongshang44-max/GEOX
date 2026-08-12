# PFE-14 S4 Product Completeness Adjudication v1

Status: GOVERNANCE / PRODUCT READ-BOUNDARY ADJUDICATION / NON-EFFECTIVE S4  
Stacked predecessor: PFE-14 S4 single-scope Scheduler + Evidence readback candidate `6b99afb119bb012246ab7c43c7a37ab47beb22ed`  
Protected-main observation basis: `edd8a005702dee309e72b21384c8de5f8f3bd4fa`  
Runtime writes: NONE  
Database writes: NONE  
Formal effect: NONE

## 1. Decision

PFE-14 does **not** need to wait for MCFT-CAP-09 to complete before continuing product work.

The current S4 minimum product contract is split into three classes:

- **A — CURRENT_PRODUCT_CONSUMABLE**: already returned by a current qualified GET-only surface, or safely represented as an existing canonical read object without browser inference.
- **B — EXISTING_BACKEND_FACTS_NEED_PRODUCT_CONTRACT**: the repository already owns enough server-side state/semantics to build a read-only product projection, but PFE-14 does not yet have an authorized product field for it.
- **C — NO_AUTHORITATIVE_CURRENT_SOURCE**: the repository does not currently own an unambiguous fact/source for the requested product value. These fields must remain unavailable until an upstream authority/data-model change exists.

KBS publication cadence is **not** a reason to stop PFE-14. The frontend consumes server verdicts. If MCFT-CAP-09 later changes the upstream freshness policy from the currently frozen rule to a governed publication-profile rule, PFE-14 continues to display the returned `freshness_status`; the browser must not know or reproduce the upstream threshold algorithm.

## 2. Exact-head proof already available for the partial S4 readback

The current stacked frontend candidate is `6b99afb119bb012246ab7c43c7a37ab47beb22ed`.

Exact-head proof:

- PFE-14 focused run `31565598839` — PASS;
- CAP07 lifecycle-aware integration run `31565598738` — PASS;
- standard CI run `31565598703` — PASS, including build/typecheck, frontend runtime audit, full acceptance and Commercial MVP0 release gate.

This proves the **partial** Scheduler + Evidence readback candidate. It does not make S4 effective and it does not claim protected-main merge.

## 3. Class A — safe to use now

The current qualified operational projection already returns these taskbook fields from exact six-key server scope:

- `request_scope`
- `latest_completed_slot`
- `latest_tick_status`
- `latest_tick_completed_at`
- `next_target_slot`
- `next_target_at`
- `scheduler_lag_ms`
- `latest_evidence_observed_at`
- `latest_evidence_ingested_at`
- `evidence_age_ms`
- `freshness_status`
- `coverage_ratio`
- `maximum_gap_ms`
- `future_excluded_count`
- `late_evidence_count`
- `out_of_order_count`
- `response_started_at`

Rules:

1. no browser clock comparison;
2. no browser freshness threshold;
3. no browser slot completion inference;
4. no Replay/sample fallback for unavailable operational values;
5. later KBS publication-profile changes are upstream server semantics, not PFE logic.

Current canonical CAP07 GET surfaces also allow **productization of existing State and Forecast object visibility** without inventing new data fields. The current collections expose canonical identity, logical time and attachment status; Runtime root exposes exact forecast attachments/reason codes. PFE may reorganize these existing values into clearer product UI, but may not invent State value/unit/confidence or Forecast horizon/status payload fields that the API does not return.

## 4. Class B — repository capability exists; product read contract is missing

These fields can be pursued before MCFT-9 Formal/KBS completion, but require a separate server-owned read-contract candidate:

### `runtime_mode`

The immutable MCFT-9 Shadow-online adapter config owns `runtime_mode = SHADOW_ONLINE`, but current PFE authority explicitly forbids binding that label to the active exact Scope. A product binding authority is required; the browser may not switch from Replay-backed context merely because the config file exists.

### `missed_slot_count`

`SchedulerPortV1.listMissedSlots()` is already a read semantic and S4 `inspectAvailability()` already reads oldest missed work. The count is server-computable without new canonical truth, but it is not yet an authorized product field.

### `backfill_status`

The scheduler already owns missed-slot ordering and active-slot state. A current-state backfill status can be defined server-side, but the vocabulary and exact mapping must be frozen before PFE consumes it.

### `runtime_degradation_status` and `degradation_reason_codes`

S4 already owns Runtime Health semantics: missing checkpoint -> unavailable; stale/missing Evidence or scheduler lag -> degraded. PFE may consume an explicit server projection after a narrow contract freezes the status/reason vocabulary. The browser must not reconstruct these reasons.

### `state_status`

The current canonical Runtime graph owns `posterior_state` and the State collection, but no normalized product `state_status` field exists. A read projection may summarize the existing canonical state relationship; it must not fabricate State values or confidence.

### `forecast_status`

The server already validates the exact current forecast payload and distinguishes blocked/completed semantics internally, while the public canonical surface currently returns refs/attachments rather than a normalized status field. A server projection can expose the exact validated status.

### `scenario_source_eligible`

The server already validates scenario-source forecast lineage and completed-72 forecast requirements. A product boolean/verdict can be exposed only by the server; attachment presence in the browser is not a substitute.

### `refresh_after_seconds`

The product currently has no server refresh recommendation. A server recommendation or an explicit `null = manual refresh only` contract can be added without KBS completion; the frontend must not invent a polling cadence.

### O00–O23 product slot state

The persistent scheduler stores exact slot states, but #3064 intentionally uses the O00–O23 strip as structure only and highlights only the server-returned eligibility boundary. A future product slot-window read model may expose actual persisted slot state. Until then, no per-slot color/status is allowed.

## 5. Class C — do not implement from current repository state

### `runtime_stage`

No authoritative `runtime_stage` product field or stable source with this semantic exists in the current repository. PFE must not map implementation slice names, crop stages, Formal stages or workflow phases into this field.

### `latest_tick_started_at`

The current scheduler has claim/wall-clock information, but the repository does not own an authoritative Runtime tick-start timestamp with the required meaning. #3064 correctly preserves this value as unavailable instead of substituting scheduler claim time.

### `restart_detected`

Current persisted cursor/lease state is insufficient to prove that a process restart occurred. No durable restart event/flag is currently exposed for product consumption.

### `recovery_status`

The recovery implementation can rebind an expired active slot using a new fence, but current persisted state does not unambiguously preserve a product recovery-history verdict. `fencing_token > 1`, lease owner changes, or current active state are not accepted as proof of recovery history.

These fields require a separate upstream authority/data-model change or an explicit taskbook amendment accepting `UNAVAILABLE_AUTHORITY` as the final product treatment.

## 6. Immediate authorized product work

The next PFE work is intentionally split:

1. **State + Forecast productization from current canonical GET responses only.**
   - no new route;
   - no new backend field;
   - no payload inference;
   - no synthetic values;
   - technical IDs/hashes move behind progressive disclosure;
   - existing canonical status/reason/time/ref values remain exact.

2. **A later narrow operational-summary extension candidate for Class B fields.**
   - GET-only;
   - server clock / existing PostgreSQL state only;
   - no KBS source substitution;
   - no freshness-policy change;
   - no new canonical write;
   - no restart/recovery history inference.

Class C remains blocked.

## 7. S4 completion ruling

`PFE-14.S4` remains **NOT EFFECTIVE**.

A successful State/Forecast productization does not complete S4. A successful Class-B provider extension also does not complete S4 while Class-C obligations remain unresolved or explicitly amended.

The final S4 completion adjudication must use repository-backed values only and must separately resolve:

- Runtime Context binding;
- missing product status fields;
- tick-start semantics;
- restart/recovery authority;
- O00–O23 real product status or accepted nondata treatment;
- exact-head frontend acceptance.
