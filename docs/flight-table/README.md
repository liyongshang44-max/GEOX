# GEOX Flight Table

Flight Table is an internal development and delivery acceptance rig for GEOX. It is not a customer-facing feature, not an operator production workflow, and not part of the default customer release path.

The rig exists to make the Decision-to-Execution chain repeatable and auditable during development:

- assemble field objects;
- attach real or simulated devices through the formal device flow;
- bind skills;
- run lane scenarios;
- verify sensing, recommendation, prescription, approval, AO-ACT, receipt, evidence, acceptance, report, ROI, Field Memory, and learning closure;
- export a reviewable acceptance package.

## Hard boundary

Flight Table must remain under:

```text
/dev/flight-table
/api/v1/dev/flight-table/*
```

It must not be added to customer or operator formal navigation.

## Default disabled

The backend API is disabled by default. It must return:

```json
{
  "ok": false,
  "error": "FLIGHT_TABLE_DISABLED"
}
```

until the server is explicitly started with:

```bash
ENABLE_FLIGHT_TABLE_API=true
```

PowerShell equivalent:

```powershell
$env:ENABLE_FLIGHT_TABLE_API="true"
```

The API also requires `security.admin`. A future `dev.flight_table.run` scope may be added, but until that scope exists, `security.admin` is the accepted gate.

## Release gate commands

Backend smoke:

```bash
pnpm --filter @geox/server run smoke:flight-table
pnpm --filter @geox/server run smoke:flight-table:success
pnpm --filter @geox/server run smoke:flight-table:all
```

Frontend boundary check:

```bash
pnpm --filter @geox/web run check:flight-table-boundary
```

Recommended frontend gate:

```bash
pnpm --filter @geox/web run typecheck
pnpm --filter @geox/web run build
```

## Smoke command behavior

`smoke:flight-table` is the default-disabled gate. It verifies the feature flag, disabled error, admin boundary, and sensitive-output boundary. When HTTP is not available in a static CI environment, run it with Bash:

```bash
FLIGHT_TABLE_SKIP_HTTP=true pnpm --filter @geox/server run smoke:flight-table
```

PowerShell:

```powershell
$env:FLIGHT_TABLE_SKIP_HTTP="true"
pnpm --filter @geox/server run smoke:flight-table
Remove-Item Env:FLIGHT_TABLE_SKIP_HTTP
```

`smoke:flight-table:success` and `smoke:flight-table:all` require a running server that was started after the latest pull, with Flight Table enabled in that server process, and with an admin auth value available to the smoke process.

Setting `$env:ENABLE_FLIGHT_TABLE_API="true"` only in the PowerShell window that runs the smoke client does not enable an already-running server. Restart or rebuild the server/container with the same setting first.

Example local PowerShell sequence:

```powershell
$env:ENABLE_FLIGHT_TABLE_API="true"
pnpm --filter @geox/server run dev
```

Then, in another PowerShell window:

```powershell
$env:FLIGHT_TABLE_AUTH_TOKEN="<admin-auth-value>"
pnpm --filter @geox/server run smoke:flight-table:success
pnpm --filter @geox/server run smoke:flight-table:all
Remove-Item Env:FLIGHT_TABLE_AUTH_TOKEN
```

Bash:

```bash
ENABLE_FLIGHT_TABLE_API=true pnpm --filter @geox/server run dev
```

Then in another shell:

```bash
FLIGHT_TABLE_AUTH_TOKEN=<admin-auth-value> pnpm --filter @geox/server run smoke:flight-table:success
FLIGHT_TABLE_AUTH_TOKEN=<admin-auth-value> pnpm --filter @geox/server run smoke:flight-table:all
```

If the smoke returns 404 for `/api/v1/dev/flight-table/runs`, the target server does not have the flight-table routes registered. Rebuild or restart the server after pulling main, and confirm the smoke is hitting the correct port through `FLIGHT_TABLE_BASE_URL`.

## Data and persistence

Flight Table V1 stores run artifacts under the temporary run store used by the flight-table services. This is a development rig persistence model, not a production persistence layer.

Every run must preserve a manifest and API snapshots. Credential payloads must be masked. Credential secrets, raw auth values, private keys, and raw credential payloads must never be returned to the frontend.

## Non-goals

Flight Table is not:

- a customer dashboard;
- an operator dispatch console;
- a production debugging endpoint;
- a raw SQL console;
- a way to bypass formal device, evidence, acceptance, or reporting paths.

## Related docs

- `FLIGHT_TABLE_RIG_V1.md`
- `FLIGHT_TABLE_API_CONTRACT_V1.md`
- `FLIGHT_TABLE_UI_ACCEPTANCE_V1.md`
- `FLIGHT_TABLE_SECURITY_BOUNDARY_V1.md`
