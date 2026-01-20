# SMOKE_TEST_v1

This smoke test validates Web v1 against the Phase 1–5 backend.

## Preconditions

- Backend server running on `http://localhost:3000`
- A valid group exists (default seed `G_DEFAULT` is OK)

## Run Web

From `GEOX/apps/web`:

```bash
npm install
npm run dev
```

Open:

- `http://localhost:5173/`

## Expected

1. Group List loads and shows groups from `/api/groups`
2. Clicking a group opens `/group/:groupId`
3. Root tab shows a line chart with samples
4. Overlays show as:
   - points (vertical lines) for marker and step_candidate
   - bands for drift_candidate
5. No UI text makes conclusions or recommendations; tooltips list raw fields only.

## API trace

- `/` triggers `GET /api/groups?(no further steps in this file)`
- `/group/:id` triggers `GET /api/series?(no further steps in this file)`
- Add Marker triggers `POST /api/marker` and then refreshes series
