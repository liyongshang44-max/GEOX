# Flight Table Security Boundary V1

## Security classification

Flight Table is an internal development and acceptance rig. It has elevated orchestration capability and must be treated as dev/admin tooling.

It must not be part of the default customer or operator production release path.

## Backend enablement

The backend API must be disabled by default.

Required explicit enablement:

```bash
ENABLE_FLIGHT_TABLE_API=true
```

When disabled, every Flight Table endpoint must return:

```json
{
  "ok": false,
  "error": "FLIGHT_TABLE_DISABLED"
}
```

## Permission boundary

V1 requires:

```text
security.admin
```

The future target scope is:

```text
dev.flight_table.run
```

Until that scope exists and is wired through the auth model, `security.admin` is the only accepted permission boundary.

## Route boundary

Allowed frontend route:

```text
/dev/flight-table
```

Allowed backend route family:

```text
/api/v1/dev/flight-table/*
```

Forbidden placements:

- customer formal navigation;
- operator formal navigation;
- customer-facing report pages;
- operator production workbench pages;
- public SaaS entry points.

## Data boundary

Flight Table must not expose:

- credential secret;
- raw secret;
- raw token;
- private key;
- raw credential payload;
- stack trace in customer UI;
- internal raw enum in customer UI.

Credential references returned to the frontend must be masked:

```json
{
  "credential_id": "cred_...",
  "status": "ACTIVE",
  "issued_at": "2026-05-11T00:00:00.000Z",
  "masked_secret": "****"
}
```

## API call boundary

Flight Table UI must call only the flight-table adapter family:

```text
apps/web/src/api/flightTable.ts
apps/web/src/api/flightTableTelemetry.ts
apps/web/src/api/flightTableDecision.ts
apps/web/src/api/flightTableOperation.ts
apps/web/src/api/flightTableEvidence.ts
apps/web/src/api/flightTableReportLearning.ts
```

The page and components must not directly call:

- `/api/v1/customer/*`
- `/api/v1/operator/*`
- `/api/v1/debug/*`
- `/api/v1/admin/*`
- legacy APIs
- raw SQL APIs

The backend orchestration layer may probe formal customer/operator APIs when verifying a run, but those probes must be captured as Flight Table snapshots and must not become page-level direct calls.

## Device boundary

Flight Table must not directly fake `device_status_index_v1` from the frontend.

Device onboarding must go through the formal or explicitly marked helper flow:

1. create device;
2. configure capabilities;
3. bind field;
4. issue credential;
5. send heartbeat;
6. publish telemetry;
7. verify observation / sensing.

HTTP heartbeat only validates status index behavior. MQTT heartbeat/fact behavior remains distinct.

## Evidence and acceptance boundary

Receipt success is not acceptance pass.

The UI and smoke tests must preserve this distinction:

```text
receipt success != acceptance pass
```

Acceptance pass must come from the formal acceptance route or recorded acceptance result.

Evidence-insufficient lane must not show PASS.

## Weather boundary

Flight Table must not fabricate real weather.

If weather provider or location is unavailable, the UI/API must show:

```text
status = unavailable or stub
source = provider/source identifier
```

Weather-interference lane must not learn rainfall as irrigation effect.

## Learning boundary

Trusted learning is allowed only when the chain is trusted.

- success lane may close learning when evidence and acceptance are sufficient;
- weather lane must record learning exclusion reason;
- skill failure lane must not write trusted learning;
- missing Field Memory must be shown as empty/diagnostic state, not fabricated.

## Release gate

Frontend boundary gate:

```bash
pnpm --filter @geox/web run check:flight-table-boundary
```

Backend default-disabled gate:

```bash
pnpm --filter @geox/server run smoke:flight-table
```

Enabled smoke gates require explicit admin token and enabled server:

```bash
ENABLE_FLIGHT_TABLE_API=true
FLIGHT_TABLE_AUTH_TOKEN=<admin-token>
pnpm --filter @geox/server run smoke:flight-table:success
pnpm --filter @geox/server run smoke:flight-table:all
```
