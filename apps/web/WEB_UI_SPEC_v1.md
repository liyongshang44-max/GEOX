# WEB_UI_SPEC_v1

Web v1 provides a replay UI for time series samples with overlay display.

## Scope (fixed)

- Fetch and display groups via `GET /api/groups?projectId=(no further steps in this file)` or `?sensorId=(no further steps in this file)`
- Fetch and display series via `GET /api/series`
- Display `samples` as lines
- Display `overlays` (marker + candidate) with shape rules:
  - `device_fault`, `local_anomaly`: point overlay (vertical line + dot)
  - `step_candidate`: point overlay
  - `drift_candidate`: time band overlay (startTs..endTs)
- UI-only interactions: tabs, range presets, hover, zoom

## Prohibited (P0)

- No frontend generation of overlays
- No anomaly / risk / conclusion / recommendation language
- No aggregation or smoothing across sensors
- No modification or merging of backend data

## Pages

### `/` Group List

- Attempts `GET /api/groups?projectId=P_DEFAULT` on load
- If API returns 400 (missing parameter), shows input fields for `projectId` and `sensorId`
- Lists groups with `groupId`, `subjectRef`, and sensor count
- Clicking a group navigates to `/group/:groupId`

### `/group/:groupId` Group Timeline

- Tabs: Root (real data), Canopy (placeholder), Weather (placeholder)
- Range presets: 24h / 7d / Full Season (placeholder window)
- Metrics: default `moisture`, multi-select UI
- Main chart: uPlot line series per (sensorId, metric)
- Overlays rendered on top of chart using canvas draw hook
- Right panel (Match State): facts only (gaps count, recent overlays tail)

## Add Marker modal

- POSTs to `/api/marker`
- Fields: `sensorId`, `type`, `note`, `ts`
- On success, refreshes series
