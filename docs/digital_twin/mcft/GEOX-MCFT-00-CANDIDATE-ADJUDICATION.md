<!-- docs/digital_twin/mcft/GEOX-MCFT-00-CANDIDATE-ADJUDICATION.md -->
# GEOX MCFT-00 Candidate Reality Adjudication

## 0. Baseline

```text
baseline main commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
predecessor PR: #2303
evidence method: repository definitions and checked-in fixtures only
database/live status: not inferred
```

Evidence grades:

```text
PROVEN
FIXTURE_ONLY
REFERENCE_ONLY
MISSING
REJECTED
```

## 1. Candidate summary

| Candidate | Evidence grade | Decision | Reusable boundary |
|---|---|---|---|
| P50 / CAF009 Demo | REFERENCE_ONLY | Reject as Reality identity | Replay clock, partition, no-future-leakage, trace organization |
| field_demo_001 | REJECTED | Reject as first MCFT scope | None beyond generic fixture examples |
| field_c8_demo | FIXTURE_ONLY | SELECT_AS_IDENTITY_PARENT_WITH_STRICT_ISOLATION | Stable scope/crop IDs and candidate source IDs only |

## 2. P50 / CAF009

Repository evidence:

```text
fixtures/twin_demo_runtime/P50_REPLAY_INPUT_MANIFEST.json
scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs
```

Proven reusable patterns:

```text
explicit_manifest_clock
manifest-pinned fixture lookup
historical/later Evidence partition
no-future-leakage organization
traceability snapshot organization
```

Rejected:

```text
T_DEMO/P_DEMO/G_CAF/FIELD_CAF009_DEMO Reality identity
demo crop and season as MCFT truth
P50 State math
P50 Forecast math
acceptance-output persistence
demo model activation
```

Reason: the P50 manifest explicitly identifies a time-shifted demo, a six-hour Forecast horizon, and multiple production/live nonclaims. It lacks governed geometry, authoritative area, irrigation execution source binding, complete rainfall/ET0 authority, root-zone configuration, and the MCFT-01 30-day package.

## 3. field_demo_001

Repository evidence:

```text
docker/postgres/init/002_demo_seed.sql
```

Evidence grade: `REJECTED`.

The seed proves only a tenant/field name and a demo polygon. It does not prove a season, stable crop, governed zone, root zone, weather/ET0 authority, irrigation execution source, or model/configuration authority. It is not selected.

## 4. field_c8_demo identity parent

Repository evidence:

```text
scripts/demo_seed/datasets/C8_FORMAL_IRRIGATION_FULL_CHAIN_V1.cjs
scripts/demo_seed/SEED_C8_SENSING_ONLY_V1.cjs
docker/postgres/init/002_demo_seed.sql
```

The builder contains:

```text
tenantA
projectA
groupA
field_c8_demo
season_2026_c8_corn
crop_code=corn
dev_soil_c8_001
dev_weather_station_c8_001
dev_valve_pump_c8_001
```

Evidence grade: `FIXTURE_ONLY`.

Selection reason:

```text
stable identifiers are already used across controlled-pilot fixtures
the scope can be isolated from legacy State/action/value chains
controlled synthetic Replay does not require a real-field claim
the dedicated MCFT zone, root zone, source authority, and config authority are newly governed
```

Not proven:

```text
device online status
real field installation
weather API availability
production device binding
30-day Replay dataset sufficiency
field-survey geometry
field calibration
execution closure
```

## 5. Identity and source evidence matrix

| Entity | Repository evidence | Grade | MCFT-00 use | Forbidden inference |
|---|---|---|---|---|
| tenantA | C8 builder/seed | FIXTURE_ONLY | identity parent | customer or production tenancy |
| projectA | C8 builder | FIXTURE_ONLY | identity parent | active production project |
| groupA | C8 builder | FIXTURE_ONLY | identity parent | live sensor group |
| field_c8_demo | C8 builder and seed | FIXTURE_ONLY | identity parent | surveyed/real field |
| season_2026_c8_corn | C8 builder | FIXTURE_ONLY | season identity | verified crop season |
| corn | C8 builder | FIXTURE_ONLY | crop identity | stage/phenology truth |
| dev_soil_c8_001 | C8 builder | FIXTURE_ONLY | origin source identity | online/calibrated sensor |
| dev_weather_station_c8_001 | C8 builder | FIXTURE_ONLY | origin source identity | live station or weather API |
| dev_valve_pump_c8_001 | C8 builder | FIXTURE_ONLY | origin source identity | connected actuator or execution proof |
| zone_mcft_c8_water_001 | MCFT-00 pinned fixture | PROVEN | governed synthetic zone | real field containment |
| mcft_weather_replay_provider_c8_v1 | MCFT-00 source matrix definition | PROVEN | provider authority definition | source data already packaged |
| mcft_et0_replay_source_v1 | MCFT-00 source matrix definition | PROVEN | historical ET0 authority | ET0 records already exist |
| mcft_et0_forecast_source_v1 | MCFT-00 source matrix definition | PROVEN | future ET0 authority | forecast ET0 records already exist |
| mcft_irrigation_plan_replay_source_c8_v1 | MCFT-00 source matrix definition | PROVEN | approved-plan authority | plan is executed |
| mcft_soil_hydraulic_config_c8_v1 | MCFT-00 config matrix definition | PROVEN | configuration authority | field calibration or activation |
| mcft_crop_water_use_corn_v1 | MCFT-00 config matrix definition | PROVEN | configuration authority | dynamic stage truth or activation |

## 6. Isolation register

The following C8 objects are expressly not inherited:

```text
water_state_estimate_v1
irrigation_scenario_set_v1
decision_recommendation_v1
approval_request_v1
approval_decision_v1
operation_plan_v1
ao_act_task_v0
ao_act_receipt_v1
acceptance_result_v1
value_record_v1
ROI
Field Memory
```

The MCFT source/config matrices define new governance authority. MCFT-01 must package actual Replay records against those bindings. MCFT-02/03 must compile and persist Runtime config later.
