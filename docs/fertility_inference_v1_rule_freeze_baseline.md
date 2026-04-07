# Fertility Inference V1 Rule Freeze Baseline

> Status: Frozen baseline for subsequent rule changes.  
> Scope: `packages/device-skills/src/fertility_inference_core_v1.ts` + server bridge `apps/server/src/domain/sensing/fertility_inference_v1.ts`.

## 1) Input and output boundary

- Canonical inference implementation: `inferFertilityFromObservationAggregateV1` and `inferFertilityFromDeviceObservationV1` in device-skills core.
- Server boundary policy: server only delegates to device-skills core, no duplicated local rule branch.
- Supported aggregate fields:
  - `soil_moisture_pct?: number | null`
  - `ec_ds_m?: number | null`
  - `canopy_temp_c?: number | null`

## 2) Thresholds (frozen)

### 2.1 Fertility level by moisture (`soil_moisture_pct`)

- `null` → `fertility_level = "unknown"`
- `< 22` → `"low"`
- `>= 22 && < 35` → `"medium"`
- `>= 35` → `"high"`

### 2.2 Salinity risk by EC (`ec_ds_m`)

- `null` → `salinity_risk = "unknown"`
- `< 2.0` → `"low"`
- `>= 2.0 && < 2.8` → `"medium"`
- `>= 2.8` → `"high"`

### 2.3 Temperature signal (`canopy_temp_c`)

- `>= 32` → heat-stress signal
- `>= 30 && < 32` → elevated canopy temperature
- `< 30` → no temp-stress explanation code

### 2.4 Fertilize favorable zone

All must be true:
- `ec_ds_m` available and in `[1.2, 2.2]`
- `canopy_temp_c` available and in `[16, 30]`

## 3) Rule priority (frozen decision order)

Given at least one sensor value is present, recommendation decision is ordered as:

1. **Dry-first irrigation**: if `soil_moisture_pct < 22` → `recommendation_bias = "irrigate_first"`
2. **High salinity inspect**: else if `salinity_risk === "high"` → `recommendation_bias = "inspect"`
3. **Fertilize when both EC/temp available and favorable**: else if favorable zone satisfied → `"fertilize"`
4. **Fallback wait**: otherwise → `"wait"`

Special no-data branch:
- If moisture/EC/canopy temp are all missing, output fixed:
  - `fertility_level = "unknown"`
  - `recommendation_bias = "inspect"`
  - `salinity_risk = "unknown"`
  - `confidence = 0.2`

## 4) Confidence calculation (frozen)

- `availabilityScore = count(non-null of moisture, ec, canopyTemp) / 3`
- `baseConfidence = 0.45 + availabilityScore * 0.4`
- `confidenceBoost = 0.1` only when recommendation is `"irrigate_first"` or `"inspect"`; otherwise `0`
- `confidence = clamp(baseConfidence + confidenceBoost, 0.2, 0.95)` and round to 3 decimals

## 5) explanation_codes dictionary (frozen)

### 5.1 Always/base codes
- `SENSING_SKILL_FERTILITY_INFERENCE_V1`: core skill marker.

### 5.2 Missing-data codes
- `NO_DEVICE_OBSERVATION`: all three key signals missing.
- `MISSING_SOIL_MOISTURE`
- `MISSING_EC`
- `MISSING_CANOPY_TEMP`

### 5.3 Moisture/EC state codes
- `LOW_SOIL_MOISTURE`
- `ADEQUATE_SOIL_MOISTURE`
- `HIGH_EC`
- `MODERATE_EC`
- `LOW_EC`

### 5.4 Temperature state codes
- `HEAT_STRESS_SIGNAL`
- `ELEVATED_CANOPY_TEMP`

### 5.5 Rule-hit codes
- `RULE_MOISTURE_LOW_IRRIGATE_FIRST`
- `RULE_SALINITY_HIGH_INSPECT`
- `RULE_EC_TEMP_AVAILABLE_FERTILIZE`
- `RULE_EC_TEMP_AVAILABILITY_WAIT`

## 6) Consistency DoD mapping

DoD requirement: identical output across server route entry and device-skill entry for the same semantic input.

Core scenarios that must remain covered:
- dry
- high salinity
- normal/favorable

Current consistency tests assert deep equality between two entries and check scenario-specific decisions.
