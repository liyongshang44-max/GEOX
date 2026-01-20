# GEOX Sensor Stream Simulator (per-sensor)

This script simulates a **single** CAF sensor (Location) pushing **1-minute** samples into Postgres as append-only `facts` (`raw_sample_v1`).

## Prereqs
- Extract `CAF_Sensor_Dataset_2.zip` somewhere (so you have `caf_sensors/Hourly/` and `QC/Flags/` folders).
- Node 18+
- `pg` npm dependency available (already used by GEOX server).

## Run (PowerShell)
```powershell
$env:DATABASE_URL="postgres://landos:landos_pwd@127.0.0.1:5432/landos"
node scripts/sim_sensor_stream.mjs --datasetDir "C:\path\CAF_Sensor_Dataset_2" --location CAF007 --group G_CAF --window-days 1 --speed 60
```

## Notes
- `quality` is **only**: `ok | suspect | bad`
- QC reasons/types are attached under `payload.qc` (e.g. RANGE/SPIKE) but do not change the enum.
- Inserts are idempotent (`fact_id` deterministic + `ON CONFLICT DO NOTHING`).
