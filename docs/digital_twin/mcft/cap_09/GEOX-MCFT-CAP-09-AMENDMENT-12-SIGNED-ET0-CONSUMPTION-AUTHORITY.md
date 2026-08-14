# GEOX MCFT-CAP-09 Amendment-12 — Signed ET0 Consumption Authority

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Base protected main at candidate start: `353f642019c5f581d0b578847ee586dffba1f22c`

## 1. Decisive ruling

MCFT-CAP-09 External Formal Evidence SHALL preserve the signed hourly ASCE short-reference ET0 value exactly as qualified by the governed source chain.

A negative canonical ET0 value is not malformed Evidence and MUST NOT be rewritten, clipped, thresholded, relabeled, silently imputed, or replaced inside the source-binding / raw-retention / canonicalization chain.

The Stage-1B soil-water Runtime, however, uses ET0 only as a **nonnegative water-loss demand input** to the already-frozen CAP-02/CAP-03/CAP-04 water-balance and Forecast kernels. Those kernels do not contain a condensation/dew state term and already reject negative ET-loss amounts.

Therefore Amendment-12 authorizes one explicit External Formal model-consumption projection:

```text
policy_id:
MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1

canonical_signed_et0_mm = exact canonical Evidence value

model_water_loss_demand_mm =
max(canonical_signed_et0_mm, 0)
```

This projection is a declared Runtime model assumption. It is **not** a correction of provider truth, not a canonical Evidence rewrite, and not authority to claim that physical reference ET0 is intrinsically nonnegative.

## 2. Why an amendment is required

The effective predecessor authority already proves that signed ET0 is real in the qualified source path.

`GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json` records:

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

The protected-main real five-family CAP04 witness at:

```text
main = 353f642019c5f581d0b578847ee586dffba1f22c
run  = 31776769088
```

reaches the real five-family consumer and fails at Future Forcing normalization with:

```text
EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED:
MALFORMED_FORCING_RECORD:FORCING_POINTS_NOT_EXACT_72_HOURLY
```

The current GFS decoder already freezes:

```text
weather point count = 72
future ET0 point count = 72
snapshot kind identity
horizon 1..72
valid_from / valid_to alignment
finite precipitation with precipitation >= 0
finite future ET0 with signed values retained
```

The current CAP04 forcing selector and Forecast contract independently require `et0_assumption_mm >= 0`.

Therefore the remaining seam is not KBS cadence, chronology, crop coverage, rehydration, or a 72-point-count failure. It is the missing authority for mapping signed canonical ET0 Evidence into the nonnegative ET-loss input required by the frozen soil-water kernels.

## 3. Preserved source and Evidence authority

The following remain unchanged and hard:

```text
raw retention before canonicalization
source identity and source-record identity
exact event / interval time
available_to_runtime_at actual chronology
ingested_at actual chronology
no future leakage
no interpolation
no persistence fill
no source substitution
no canonical negative clipping
no canonical zero thresholding
no silent imputation
no cross-cycle substitution
```

The source-binding rule:

```text
negative_clipping_authorized = false
```

remains authoritative for source qualification and canonical Evidence.

Amendment-12 does not mutate the Formal Source Binding Matrix and does not reinterpret any negative ET0 source value as zero at the Evidence layer.

## 4. Distinguish Evidence quantity from model-consumption quantity

Two quantities MUST remain distinguishable:

```text
canonical_signed_reference_et0_mm
model_water_loss_demand_mm
```

For a canonical value `e`:

```text
if e >= 0:
  model_water_loss_demand_mm = e

if e < 0:
  model_water_loss_demand_mm = 0
```

The original signed value remains recoverable from the canonical Evidence ref/hash and MUST remain the value used for canonical Evidence identity.

The model-consumption value MUST NOT be written back into:

```text
historical_et0_estimate_v1 canonical_payload
future_et0_assumption_v1 canonical_payload
source_payload
source_record_hash
raw provenance
```

## 5. Historical ET0 consumption rule

For exact historical ET0 at logical boundary `T`:

```text
historical_et0_estimate_v1
→ preserve signed canonical value
→ apply MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1
→ pass model_water_loss_demand_mm into the existing hourly water-balance kernel
```

This is required because the governed EA4 evidence already proves negative historical hourly reference ET0 values occur in the qualified KBS path.

The External Formal adapter MUST make the transformation auditable through the resulting Runtime/state transition authority using an explicit policy/transformation ref and limitation.

Minimum limitation when any negative canonical ET0 is projected to zero:

```text
NEGATIVE_REFERENCE_ET0_CONDENSATION_NOT_MODELED
```

The Runtime MUST NOT convert the negative amount into precipitation, soil-water gain, irrigation, drainage, or any other hidden positive-water term.

## 6. Future ET0 consumption rule

For the selected same-cycle 72-hour Future ET0 Evidence:

```text
future_et0_assumption_v1
→ preserve signed 72-point canonical series
→ apply MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1 point-by-point
→ build the CAP04 Future Forcing DTO from nonnegative model-consumption ET-loss values
```

The CAP04 forcing window continues to require exactly:

```text
72 points
horizon 1..72
T+1h .. T+72h
same-cycle weather + ET0
no future leakage
nonnegative et0_assumption_mm at the model-consumption DTO seam
```

When a canonical future ET0 point is negative, its CAP04 `et0_assumption_mm` model-consumption value may be zero only if all of the following remain true:

```text
canonical future_et0 source ref/hash preserved
signed canonical point not mutated
transformation ref includes MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1
limitations include NEGATIVE_REFERENCE_ET0_CONDENSATION_NOT_MODELED
no source/cycle/time rewrite
```

The Future Forcing selector MUST NOT classify an otherwise structurally valid signed ET0 series as `FORCING_POINTS_NOT_EXACT_72_HOURLY` merely because one or more ET0 values are negative.

## 7. Kernel and contract boundary

Amendment-12 does not authorize changes to the scientific equations inside:

```text
CAP-02 hourly water-balance kernel
CAP-03 continuation/assimilation math
CAP-04 72-hour Forecast propagation math
Scenario math
uncertainty propagation math
```

The authorized change is confined to the External Formal adapter/model-consumption seam before those kernels receive ET-loss demand.

Existing CAP04 nonnegative forcing DTO validation remains valid.

The canonical Evidence contracts remain signed-source authority and are not narrowed to nonnegative values.

## 8. Epistemic interpretation

A negative hourly ASCE reference ET0 may encode conditions in which the reference formulation does not represent positive evaporative demand for that interval.

Stage-1B does not currently model condensation/dew deposition as a separate water-gain process. Therefore zero water-loss demand is an explicit bounded model assumption for negative signed ET0 intervals.

Amendment-12 MUST NOT be represented as proving:

```text
negative ET0 is measurement error
negative ET0 is impossible
negative ET0 equals physical zero flux
negative ET0 should be erased from Evidence
condensation/dew has zero agronomic effect
```

It only states what the current bounded water-loss model consumes.

## 9. Required implementation proof after this amendment becomes effective

The first legal implementation successor is:

```text
S6-EA5E2-ET0-CONSUMPTION-SIGN-ADAPTER
```

The implementation proof MUST cover both historical and future paths before a protected-main real witness is attempted.

Required deterministic cases:

```text
A. positive historical ET0
   canonical value unchanged
   model demand unchanged

B. negative historical ET0
   canonical value preserved
   model demand = 0
   explicit transformation ref + limitation

C. 72-point future ET0 with one or more negative points
   canonical signed series preserved
   CAP04 forcing status = SELECTED
   Forecast status = COMPLETED
   Forecast point count = 72
   transformed points = 0 only where canonical ET0 < 0

D. malformed / nonfinite ET0
   still fails closed

E. source/cycle/time mismatch
   still fails closed
```

The implementation proof MUST also retain the existing five-family and chronology fail-closed regressions.

## 10. Effect if exact-head proof passes and this amendment merges to protected main

Only after exact-head governance proof passes and this candidate merges to protected `main`:

```text
amendment_12_effective = true
signed_canonical_et0_preserved = true
canonical_negative_clipping_authorized = false
model_consumption_projection_authorized = true
model_consumption_policy_id = MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1
historical_et0_model_demand_projection_authorized = true
future_et0_model_demand_projection_authorized = true
negative_et0_condensation_credit_authorized = false
cap02_equations_changed = false
cap03_assimilation_math_changed = false
cap04_forecast_equations_changed = false
source_binding_changed = false
crop_authority_effect = NONE
formal_window_started = false
formal_execution_count = 0/24
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
MCFT-CAP-09 completed = false
```

## 11. Hard nonclaims

This amendment does not authorize:

```text
canonical ET0 clipping
source-value rewriting
raw-value rewriting
time rewriting
source substitution
future forcing post-T acquisition
condensation/dew water-gain modeling
crop authority changes
Formal canonical writes
Formal O00-O23 start
operational activation
full operational GO
```

It does not declare the current exact-main CAP04 witness passed. The witness must be repeated only after the authorized implementation successor passes full isolated positive and fail-closed regression coverage.