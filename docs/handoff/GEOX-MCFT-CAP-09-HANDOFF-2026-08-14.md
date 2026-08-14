# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-14

更新时间：2026-08-14 16:02（UTC+8）

> 本 handoff 只用于恢复工程上下文，不制造新的 authority、effectiveness、activation、crop-stage、season、Formal write 或 operational GO 权限。若本文与 current Master Task Line、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、immutable artifact 或后续 merged evidence 冲突，以更高权威事实为准。

## 0. 当前快照

```text
repository:
liyongshang44-max/GEOX

protected_main:
353f642019c5f581d0b578847ee586dffba1f22c

protected_main_latest_merge:
PR #3126 — MCFT-CAP-09: bind qualification crop context before final CAP04 live

protected_main_drift_since_handoff_branch_created:
NONE OBSERVED

docs_handoff_pr:
#3127 — DRAFT / UNMERGED

current_exact_main_witness:
workflow = mcft-cap-09-cap04-amendment11-real-five-family-consumption
run      = 31776769088
job      = 94693921170

actual_first_substantive_live_failure:
EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED:
MALFORMED_FORCING_RECORD:FORCING_POINTS_NOT_EXACT_72_HOURLY

previous_handoff_failure_classification:
EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1

previous_handoff_failure_classification_status:
SUPERSEDED_BY_COMPLETE_ACTIONS_JOB_LOG

current_engineering_frontier:
SIGNED CANONICAL ET0 -> NONNEGATIVE SOIL-WATER MODEL CONSUMPTION AUTHORITY/ADAPTER

kbs provider/cadence:
CLOSED FOR CURRENT FRONTIER — DO NOT REOPEN

rolling capture/intersection:
CLOSED FOR CURRENT FRONTIER — DO NOT REOPEN

cross-head rehydration:
CLOSED FOR CURRENT FRONTIER — DO NOT REOPEN

five-family isolated DB package:
PROVEN PASS

qualification-only crop-context binding:
PROVEN / OLD CROP COVERAGE BLOCKER CLOSED

cap04_runtime_successor_qualified:
false

ea5e2_operational_activation_qualified:
false

formal O00-O23:
0/24

full_operational_go:
false
```

---

## 1. Authority order already re-verified

Current takeover must use this order:

```text
1. docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
   → current master authority

2. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
   → MCFT-CAP-09 design / Stage-1B authority

3. effective Amendments + protected main

4. exact workflow run / immutable artifact / exact code blob

5. handoff
```

This handoff was corrected precisely because exact run evidence outranks the earlier handoff interpretation.

---

## 2. What remains closed

### 2.1 KBS provider semantics

Do not reopen:

```text
KBS Raw Hourly observation resolution = HOURLY
provider publication cadence = DAILY_BATCH
raw retention before canonicalization = required
same-source exact record identity = required
no source substitution
no event-time rewrite
no future leakage
```

Amendment-11 remains the temporal authority for delayed exact rainfall/historical-ET0 admission through `PROVIDER_AVAILABILITY_WATERMARK_V1`.

### 2.2 Rolling pre-boundary capture / intersection

The real causal producer candidate already exists and has been selected successfully. The current failure does not invalidate that producer proof.

### 2.3 Cross-head rehydration

Run `31776769088` proved:

```text
producer-SHA-bound candidate accepted
raw R2 reverification succeeded
producer dataset identity preserved
producer decoder identity preserved
semantic manifest exact match = true
provider refetch count = 0
rehydrated types = 3
```

Therefore current consumer-head decoding reproduced the producer candidate semantics; this is not an old-producer/new-decoder schema-drift hypothesis.

### 2.4 Five-family real data path

The same run proved the isolated DB contained exactly:

```text
future_weather_assumption_v1
future_et0_assumption_v1
soil_moisture_observation_v1
observed_rainfall_v1
historical_et0_estimate_v1
```

The KBS exact-T pair and retained pre-T three-family package both succeeded before CAP04 consumer execution.

### 2.5 Crop coverage

The old `CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE` failure exposed by #3125 was a qualification-harness wiring defect and was closed by #3126.

Continue to preserve:

```text
qualification-only crop context
crop_authority_effect = NONE
```

Do not reinterpret that context as operational crop authority.

---

## 3. Correct interpretation of run 31776769088

The complete job log, not the prior handoff summary, is decisive.

Successful layers before the failure:

```text
static contract                           PASS
qualification harness                    PASS
exact protected-main binding             PASS
private transient R2 binding             PASS
rolling producer candidate               PASS
KBS candidate intersection               PASS
three-family rehydration                 PASS
exact-T rainfall + historical ET0        PASS
five-family isolated DB load             PASS
qualification crop context               PASS
CAP04 invocation                         ENTERED
```

First substantive failure:

```text
EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED:
MALFORMED_FORCING_RECORD:FORCING_POINTS_NOT_EXACT_72_HOURLY
```

The stack reaches:

```text
external_formal_cap04_amendment11_candidate_execution_internal_v1.ts
→ selectCap04FutureForcingOutcomeV1
→ future_forcing_selector_v1.ts
```

There is no later exact-main run that supersedes `31776769088` at the time of this correction.

Therefore the old handoff plan to reproduce `EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT` is no longer the current frontier.

---

## 4. Why this is not actually a 72-point shape problem

The governed GFS live decoder already constructs:

```text
future weather points = exactly 72
future ET0 points      = exactly 72
horizon                = 1..72
valid_from/valid_to    = exact T+0..T+72 hourly intervals
weather snapshot kind  = FUTURE_WEATHER_ASSUMPTION
ET0 snapshot kind      = FUTURE_ET0_ASSUMPTION
precipitation          = finite and nonnegative
future ET0             = finite, signed value retained
```

Cross-head rehydration performs an exact semantic-manifest match after decoding under current consumer code. Thus the producer candidate and current decoder agree semantically.

The CAP04 Future Forcing selector, however, currently treats the selected point value as requiring:

```text
finite AND >= 0
```

for both rainfall and ET0. Any negative ET0 point is collapsed into the generic exclusion code:

```text
FORCING_POINTS_NOT_EXACT_72_HOURLY
```

So the error code is broader than the actual failing condition.

---

## 5. Existing authority proves signed ET0 is real

The decisive predecessor is:

```text
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json
```

It already records from qualified live evidence:

```text
historical_et0_complete_distinct_hours = 37
historical_et0_negative_count = 12

future_et0_point_count = 72
future_et0_finite_count = 72
future_et0_negative_count = 25
future_et0_negative_clipping_performed = false

negative_future_et0_values_retained = true
negative_clipping_authorized = false
```

The Formal Source Binding Matrix also freezes source/canonical negative clipping as unauthorized.

Therefore the correct fix is NOT:

```text
change raw/source ET0
clip canonical ET0
rewrite negative values to zero during canonicalization
relax provenance
change event time
change availability chronology
pretend negative values are malformed source records
```

---

## 6. The actual cross-capability seam

The source/Evidence side is signed:

```text
historical_et0_estimate_v1 canonical value: signed finite
future_et0_assumption_v1 canonical points: signed finite
```

The current soil-water Runtime side is nonnegative-demand math:

```text
CAP04 Future Forcing DTO requires et0_assumption_mm >= 0
CAP04 72h Forecast math consumes nonnegative ET-loss amount
CAP02/CAP03 hourly water-balance path likewise expects ET-loss demand, not a condensation/dew state
```

Amendment-11 explicitly preserves CAP-02/CAP-03/CAP-04 math. It does not authorize a hidden sign transformation.

Therefore this seam requires an explicit authority before Runtime code is changed.

---

## 7. Current candidate authority: Amendment-12

A new authority-only branch was created from exact protected main:

```text
branch:
agent/mcft-cap09-et0-consumption-sign-authority

base:
353f642019c5f581d0b578847ee586dffba1f22c

Draft PR:
#3128 — MCFT-CAP-09: authorize signed ET0 model-consumption projection

protected-main effect:
NONE — DRAFT / UNMERGED
```

The candidate ruling is:

```text
canonical signed ET0 remains unchanged

model-consumption policy:
MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1

model_water_loss_demand_mm = max(canonical_signed_et0_mm, 0)
```

When a negative canonical ET0 is projected to zero, the Runtime/model-consumption trace must explicitly carry:

```text
NEGATIVE_REFERENCE_ET0_CONDENSATION_NOT_MODELED
```

This is a bounded model-consumption projection, not source/canonical clipping and not a claim that physical negative ET0 is invalid.

Amendment-12 intentionally covers BOTH:

```text
historical ET0 consumption
future ET0 / CAP04 forcing consumption
```

because the existing live evidence already proves negatives on both paths. Fixing only the current future-forcing failure would likely move the next blocker to a later nighttime historical-ET0 Runtime tick during the required 24-hour Stage-1B proof.

---

## 8. Frozen boundaries for Amendment-12 and its implementation successor

Must preserve:

```text
canonical signed ET0
raw/source/canonical identity
raw retention
actual chronology
no source substitution
no canonical negative clipping
no silent imputation
no time rewrite
no future leakage
same-cycle forcing authority
crop_authority_effect = NONE
```

Must NOT change scientific equations inside:

```text
CAP-02 hourly water balance
CAP-03 continuation/assimilation
CAP-04 72-hour Forecast propagation
Scenario math
uncertainty propagation
```

The only authorized candidate change is the explicit External Formal model-consumption adapter before signed ET0 reaches a nonnegative ET-loss-demand input seam.

---

## 9. Next engineering sequence

### Step 1 — keep protected main fixed

Do NOT merge #3127 merely to refresh documentation.

Do NOT merge #3128 while protected-main exact-head debugging still requires a stable base.

Both can remain Draft.

### Step 2 — exact-head governance proof for #3128

Require:

```text
exact base = 353f642019c5f581d0b578847ee586dffba1f22c
exact three-file authority boundary
predecessor blob pins unchanged
EA4 negative-count facts pinned
no Runtime/DB/R2/Formal side-effect capability
```

### Step 3 — stacked implementation branch, no main merge

After the authority candidate itself is internally green, develop the implementation successor stacked on #3128 rather than merging authority to `main` early.

Implementation frontier:

```text
S6-EA5E2-ET0-CONSUMPTION-SIGN-ADAPTER
```

It must cover the complete consumer path in one branch before protected-main changes.

### Step 4 — historical + future regression together

Required cases:

```text
positive historical ET0 -> unchanged model demand
negative historical ET0 -> canonical value preserved, model demand 0
72-point future ET0 with negatives -> SELECTED -> COMPLETED -> exactly 72 points
nonfinite ET0 -> fail closed
source/cycle/time mismatch -> fail closed
chronology/snapshot fail-closed tests remain intact
```

Do not fix only the current future point and defer the historical path.

### Step 5 — one controlled merge sequence only after full stacked proof

Do not return to:

```text
one seam -> one merge -> exact main -> discover next seam
```

The stacked implementation branch should expose the complete five-family consumer chain before protected-main mutation.

### Step 6 — one new exact-main real five-family witness

Only after authority + implementation are ready for the controlled protected-main sequence should a new real witness be run.

Pass target remains:

```text
five-family selected = 5
A1
Future Forcing = SELECTED
Forecast = COMPLETED
Forecast points = 72
provider request count inside CAP04 = 0
CAP04 database writes = 0
canonical persistence authorized = false
crop_authority_effect = NONE
Formal effect = false
```

### Step 7 — then reread readiness blockers

Only after CAP04 real witness PASS:

```text
re-read exact-head full readiness blocker set
```

If hard blockers = 0, stop expanding audit scope and make the next GO/NO-GO decision.

---

## 10. Hard nonclaims / state that remains false

```text
CAP04_RUNTIME_SUCCESSOR_QUALIFIED = false
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
FORMAL_WINDOW_STARTED = false
FORMAL_EXECUTION_COUNT = 0/24
FULL_OPERATIONAL_GO = false
MCFT-CAP-09 completed = false
```

Amendment-12 candidate does not establish any of these.

---

## 11. Takeover warning

Do not resume from the earlier statement:

```text
current frontier = canonical chronology / caller snapshot alignment
failure = EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1
```

That statement was superseded by the complete exact-main Actions log for run `31776769088`.

Resume from:

```text
real five-family input path = proven
current blocker = signed ET0 Evidence vs nonnegative soil-water model-consumption seam
current protected main = 353f642019c5f581d0b578847ee586dffba1f22c
current authority candidate = Amendment-12 / Draft PR #3128
next implementation = stacked signed-ET0 consumption adapter, before any new exact-main witness
```