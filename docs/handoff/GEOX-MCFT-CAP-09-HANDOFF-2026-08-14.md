# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-14

更新时间：2026-08-14 17:45（UTC+8）

> 本 handoff 只恢复工程上下文，不制造新的 authority、effectiveness、activation、crop-stage、season、Formal write 或 operational GO 权限。若本文与 current Master Task Line、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、immutable artifact 或后续 merged evidence 冲突，以更高权威事实为准。

## 0. 当前快照

```text
repository:
liyongshang44-max/GEOX

protected_main:
839d320b118d37a51b659730d0a9e2a1058e433b

latest_controlled_merges:
PR #3128 -> e1952de27773fad50b3430b52f2dafb912d9003b
  MCFT-CAP-09: authorize signed ET0 model-consumption projection

PR #3129 -> 839d320b118d37a51b659730d0a9e2a1058e433b
  MCFT-CAP-09: adapt signed ET0 at model-consumption seam

docs_handoff_pr:
#3127 — DRAFT / UNMERGED

last_pre_fix_exact_main_live_witness:
workflow = mcft-cap-09-cap04-amendment11-real-five-family-consumption
run      = 31776769088
subject  = 353f642019c5f581d0b578847ee586dffba1f22c
result   = FAILURE

first_substantive_failure_of_31776769088:
EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED:
MALFORMED_FORCING_RECORD:FORCING_POINTS_NOT_EXACT_72_HOURLY

root_cause_after_code/evidence adjudication:
SIGNED CANONICAL ET0 VS NONNEGATIVE SOIL-WATER MODEL-CONSUMPTION CONTRACT

signed_et0_authority:
MERGED / EFFECTIVE AS AMENDMENT-12

signed_et0_consumption_adapter:
MERGED TO PROTECTED MAIN

current_engineering_frontier:
ONE NEW EXACT-PROTECTED-MAIN REAL FIVE-FAMILY CAP04 WITNESS

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
NOT YET — REQUIRES NEW EXACT-MAIN LIVE WITNESS

ea5e2_operational_activation_qualified:
false

formal O00-O23:
0/24

full_operational_go:
false
```

---

## 1. Authority order already re-verified

Use this order on takeover:

```text
1. docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
2. docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
3. effective Amendments + protected main
4. exact workflow run / immutable artifact / exact code blob
5. handoff
```

Master V2 self-declares current authority. MCFT-CAP-09 remains Stage-1B / Shadow-online authority. Formal O00-O23 has not started.

---

## 2. What remains closed and must not be re-audited without new contradictory evidence

### 2.1 KBS semantics

```text
observation resolution = HOURLY
publication cadence     = DAILY_BATCH
raw retention before canonicalization = required
same-source exact record identity      = required
no source substitution
no event-time rewrite
no future leakage
```

Amendment-11 remains temporal authority for delayed exact rainfall / historical-ET0 admission through `PROVIDER_AVAILABILITY_WATERMARK_V1`.

### 2.2 Rolling producer / intersection / rehydration

Run `31776769088` already proved the real pre-boundary producer and cross-head rehydration chain:

```text
producer-SHA-bound candidate accepted
raw R2 reverification succeeded
producer dataset identity preserved
producer decoder identity preserved
semantic manifest exact match = true
provider refetch count = 0
rehydrated types = 3
```

The current live witness is designed to reuse the latest successful rolling-KBS intersection and immutable producer artifact, then rehydrate them under the current consumer SHA.

Latest successful rolling-KBS intersection observed before this handoff refresh:

```text
run = 31784847954
status = PASS
head branch = main
```

Do not reopen rolling capture merely because its producer SHA predates the current consumer SHA; cross-head rehydration exists specifically to prove semantic identity.

### 2.3 Five-family data path

The real isolated DB path already proved the exact five families:

```text
future_weather_assumption_v1
future_et0_assumption_v1
soil_moisture_observation_v1
observed_rainfall_v1
historical_et0_estimate_v1
```

The KBS exact-T pair and retained pre-T three-family package both succeeded before CAP04 consumer execution.

### 2.4 Crop context

The old `CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE` qualification-harness wiring defect was closed by #3126.

Preserve:

```text
qualification-only crop context
crop_authority_effect = NONE
```

Do not reinterpret the qualification context as operational crop authority.

---

## 3. Correct interpretation of run 31776769088

The complete Actions job log superseded the earlier handoff classification `EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1`.

Successful layers before the real failure:

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

The error string was broader than the actual defect. The live decoder already produced exact 72-point weather and ET0 horizons; negative signed ET0 values caused the old selector to reject the future ET0 snapshot as malformed.

---

## 4. Signed-ET0 evidence and Amendment-12 ruling

Existing EA4 Recovery Authority had already recorded:

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

Therefore source/canonical clipping was not authorized.

Amendment-12, merged by PR #3128, authorizes only the model-consumption projection:

```text
canonical signed ET0 remains unchanged

policy:
MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1

model_water_loss_demand_mm = max(canonical_signed_et0_mm, 0)
```

When a negative canonical ET0 is projected to zero, the consumption trace carries:

```text
NEGATIVE_REFERENCE_ET0_CONDENSATION_NOT_MODELED
```

This is not a claim that negative ET0 is invalid and does not model condensation/dew water gain.

---

## 5. Implementation now merged

PR #3129 implements Amendment-12 at the consumption seam only.

Important compatibility invariant discovered during full CI:

```text
positive/nonnegative ET0 path must remain provenance/hash stable
only actually transformed negative ET0 points may carry Amendment-12 policy/limitation
```

An earlier implementation version attached the new policy ref to all future ET0 points. Although positive numeric values were unchanged, this changed CAP04 forcing/scenario determinism hashes and caused downstream CAP05 to fail with:

```text
CAP05_DECISION_REQUEST_NON_CURRENT_SCENARIO
```

That defect was fixed before merge. Positive points now remain semantic/hash no-ops; negative points alone carry the projection provenance.

### 5.1 Final implementation exact-head proof before merge

Implementation head:

```text
7d581f14e144a7b72440c27dfedc629f5d6f3157
```

Focused proof after the final fix:

```text
run 31787547458 = PASS

positive_historical_et0_preserved = true
positive_future_et0_noop_provenance_stable = true
negative_historical_et0_canonical_preserved = true
negative_historical_et0_model_demand_zero = true
signed_future_et0_canonical_preserved = true
signed_future_et0_projection_count = 2
signed_future_et0_full_72h_completed = true
external_cap04_operation_variant = A1
external_cap04_forecast_status = COMPLETED
external_cap04_forecast_point_count = 72
source_binding_mismatch_fail_closed = true
forcing_cycle_mismatch_fail_closed = true
forcing_time_mismatch_fail_closed = true
canonical_persistence_authorized = false
database_write_count = 0
provider_request_count = 0
```

Other exact-head gates:

```text
runtime dependency graph       31787547419 PASS
successor-runner qualification 31787547564 PASS
live-window preflight          31787547512 PASS
repository CI                  31787547461 PASS
```

The first full repository CI initially exposed the CAP05 currentness regression above. After the positive-path provenance fix, full acceptance, CAP05 G/H, Commercial MVP0 release gate and final hygiene all passed.

### 5.2 Revalidation after authority was merged to main

After PR #3128 moved protected main to `e1952de27773fad50b3430b52f2dafb912d9003b`, #3129 was retargeted from the stacked authority branch to `main`.

Retarget diff remained exactly five files; all MCFT-9 gates were green again, and new-base repository CI also passed:

```text
runtime dependency graph       31788232256 PASS
focused DB -> External CAP04    31788232296 PASS
successor-runner qualification 31788232289 PASS
live-window preflight          31788232346 PASS
repository CI                  31788232288 PASS
```

PR #3129 then merged to protected main as:

```text
839d320b118d37a51b659730d0a9e2a1058e433b
```

---

## 6. Current only correct frontier

Do not do more static signed-ET0 testing. Do not reopen timing cadence. Do not reopen KBS provider semantics. Do not start Formal O00-O23.

Run exactly one new protected-main witness:

```text
workflow:
mcft-cap-09-cap04-amendment11-real-five-family-consumption

ref:
main

required exact subject at dispatch time:
839d320b118d37a51b659730d0a9e2a1058e433b
```

Expected pass target:

```text
five-family selected = 5
operation variant = A1
Future Forcing = SELECTED
Forecast = COMPLETED
Forecast points = 72
provider request count inside CAP04 = 0
CAP04 database writes = 0
canonical persistence authorized = false
crop_authority_effect = NONE
Formal effect = false
```

The workflow itself must continue to enforce exact protected-main, private transient R2 bindings, latest successful rolling intersection, cross-head immutable producer rehydration, exact-T KBS pair, and isolated DB consumption.

### Tooling note

At this handoff refresh, the connected GitHub tool available to the agent exposes Actions reads and reruns but does **not** expose the REST `workflow_dispatch` write operation. Do not rerun `31776769088` as a substitute: GitHub rerun preserves the old subject SHA `353f642...` and would not qualify the new main.

If working through a UI/CLI that has dispatch permission, trigger the workflow above on `main`; no inputs are required.

---

## 7. After the new exact-main witness

If it passes the target above:

```text
1. immediately reread the exact-head full readiness blocker set;
2. do not broaden audit scope;
3. if hard blockers = 0, make the next GO/NO-GO decision;
4. only after GO may the next operational/Formal transition be considered under its own authority.
```

If it fails, classify only the first substantive failure from the complete job log. Do not infer the blocker from the workflow summary or from an old handoff.

---

## 8. Hard nonclaims / state still false

Until the new live witness and readiness adjudication prove otherwise:

```text
CAP04_RUNTIME_SUCCESSOR_QUALIFIED = false
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
FORMAL_WINDOW_STARTED = false
FORMAL_EXECUTION_COUNT = 0/24
FULL_OPERATIONAL_GO = false
MCFT-CAP-09 completed = false
```

The merged Amendment-12 authority and adapter do not establish any of these by themselves.

---

## 9. Takeover warning

Do not resume from either obsolete frontier:

```text
obsolete #1:
canonical chronology / caller snapshot alignment
EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT

obsolete #2:
signed-ET0 authority/adapter implementation still pending
```

Resume from:

```text
real five-family upstream path = proven
signed ET0 authority = merged
signed ET0 model-consumption adapter = merged
protected main = 839d320b118d37a51b659730d0a9e2a1058e433b
current frontier = one new exact-main real-five-family CAP04 witness
then = exact-head full readiness blocker set -> GO/NO-GO
```
