# GEOX Weather Contract (v1)

This document freezes the minimal weather facts in the Monitor layer.

## Source model

Weather is recorded in the same **append-only facts** stream as other sensors:

- Write: `POST /api/raw`
- Read: `GET /api/series`

Treat the weather station as a sensor.

## sensorId

- Weather station sensorId MUST use the prefix: `WX_`
  - Example: `WX_1`

## metrics and units

Minimum required metrics:

- `rain_mm` — rainfall amount in millimeters (mm)
- `air_temp_c` — air temperature in degrees Celsius (°C)

Optional metrics (allowed):

- `rh_pct` — relative humidity in percent (%)
- `wind_mps` — wind speed in meters per second (m/s)
- `solar_wm2` — solar irradiance in watts per square meter (W/m²)

## Query examples

Query rainfall and temperature:

- `GET /api/series?sensorId=WX_1&metrics=rain_mm,air_temp_c&startTs=(no further steps in this file)&endTs=(no further steps in this file)&maxPoints=2000`

Notes:

- No aggregation rules are defined here.
- No conclusions or explanations are produced by the API.
