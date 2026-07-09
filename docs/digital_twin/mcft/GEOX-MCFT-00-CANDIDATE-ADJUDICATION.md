<!-- docs/digital_twin/mcft/GEOX-MCFT-00-CANDIDATE-ADJUDICATION.md -->
# GEOX MCFT-00 Candidate Adjudication

## Baseline

```text
main: 7fd848ae00680480fc864990b9d03b37bc61fdff
predecessor: DT02-AMENDMENT-01 COMPLETE
```

Evidence levels:

```text
PROVEN
FIXTURE_ONLY
REFERENCE_ONLY
MISSING
REJECTED
```

## Decision matrix

| candidate | evidence | status | allowed reuse | prohibited promotion |
|---|---|---|---|---|
| `P50 / FIELD_CAF009_DEMO` | `fixtures/twin_demo_runtime/P50_REPLAY_INPUT_MANIFEST.json` pins explicit replay clock, fixture lookup, field/season, and no-production nonclaims | REFERENCE_ONLY | replay clock, partition, no-future-leakage, trace organization | Reality identity, State, Forecast, persistence, model activation |
| `field_demo_001` | `docker/postgres/init/002_demo_seed.sql` defines a display/demo field and polygon but no season, crop, governed zone, root zone, weather, ET0, or execution binding | REJECTED | none for first MCFT scope | first MCFT Reality identity |
| `tenantA` | C8 sensing seed permits and defaults to `tenantA`; demo SQL contains the tenant | PROVEN | tenant identity | production tenant claim |
| `projectA` | C8 pure builder constant | PROVEN | project identity | production project claim |
| `groupA` | C8 pure builder constant | PROVEN | group identity | production group claim |
| `field_c8_demo` | C8 builder and demo SQL both contain stable ID | PROVEN | field identity | geometry, area, State, or live-field truth |
| `season_2026_c8_corn` | C8 builder constant and crop-season payload | PROVEN | season identity | dynamic crop stage |
| `crop_code=corn` | C8 builder identity payload | PROVEN | crop identity | Kc schedule or dynamic stage truth |
| `dev_soil_c8_001` | C8 builder device/observation fixture | FIXTURE_ONLY | candidate soil source identity | online, calibrated, zone-average, or direct-State claim |
| `dev_weather_station_c8_001` | C8 builder device/weather fixture | FIXTURE_ONLY | candidate rainfall source identity | live provider or observed/future conflation |
| `dev_valve_pump_c8_001` | C8 builder device/action fixture | FIXTURE_ONLY | candidate execution source identity | production connection, execution, or receipt claim |
| legacy C8 polygons | demo SQL and builder contain different polygon/area expressions | REJECTED | comparison evidence only | MCFT geometry authority |
| C8 legacy area `20000 m2` | builder constant | REFERENCE_ONLY | non-authoritative comparison | independently mutable authoritative area |
| new MCFT governed zone | dedicated checked-in GeoJSON and canonicalization contract | PROVEN | only MCFT-00 geometry authority | surveyed/field-verified claim |
| governed Replay provider/ET0/plan identities | defined and versioned in MCFT source matrix | PROVEN | source authority for MCFT-01 dataset construction | claim that time-series data already exists |
| governed soil/crop config identities | defined, versioned, and provenance-labelled in configuration matrix | PROVEN | configuration authority | field-calibrated or production-authoritative claim |

## Selected parent

```text
SELECT_AS_IDENTITY_PARENT_WITH_STRICT_ISOLATION:
  tenantA/projectA/groupA/field_c8_demo/season_2026_c8_corn/corn
```

This selection does not inherit legacy State, Forecast, Scenario, Recommendation, Approval, AO-ACT, ROI, Field Memory, geometry, execution closure, or production status.

## Source evidence ruling

Existing device IDs are seed-level evidence only. New Replay provider, ET0, plan, and configuration IDs become valid because MCFT-00 itself defines their immutable governance identity, version, provenance, limitations, and successor ownership. Their existence does not claim a canonical Replay dataset; MCFT-01 must supply and validate the time-series content.
