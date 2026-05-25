# Local Commercial v1 Runtime

Status: Local acceptance runtime guide

This guide explains how to start the GEOX `commercial_v1` runtime locally after the compose file moved critical runtime settings to required environment variables.

## Scope

This setup is for local acceptance, controlled runtime checks, and developer smoke validation only.

It is not a production secret-management model. The example credentials are intentionally weak local values and must not be reused in production, staging, customer environments, or shared infrastructure.

## Files

- `.env.commercial_v1.example` is the checked-in local template.
- `.env` is the local runtime file consumed by Docker Compose.
- `.env` must not be committed.

The repository `.gitignore` already excludes `.env`.

## PowerShell runtime determinism

PowerShell local acceptance must use Windows Node plus Windows pnpm.

Do not run local PowerShell acceptance through a WSL/Linux pnpm executable. In particular, this path pattern means the local acceptance result is invalid:

```text
/home/<user>/.cache/node/corepack/v1/pnpm/11.x/dist/pnpm.mjs
```

That runtime can trigger non-interactive pnpm module purge prompts such as:

```text
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
Command failed with exit code 1: pnpm install
```

Before running acceptance locally, verify runtime resolution:

```powershell
pnpm run doctor:local-runtime
pnpm run doctor:local-runtime:print

where.exe pnpm
Get-Command pnpm -All | Format-List Source,Version,CommandType
pnpm --version
node -p "process.execPath"
```

Expected outcome:

- `doctor:local-runtime` prints `LOCAL_PNPM_RUNTIME_OK`.
- `node -p "process.execPath"` points to a Windows Node executable when running from Windows PowerShell.
- `where.exe pnpm` and `Get-Command pnpm -All` do not resolve to `/home/...`, `\\wsl$`, or Corepack pnpm 11.x under a WSL cache.

If `doctor:local-runtime` fails with `LOCAL_PNPM_RUNTIME_MISMATCH`, fix the PowerShell `PATH` so Windows pnpm wins, reopen the shell, and run the doctor again. Do not trust local acceptance results produced by a mismatched WSL/Corepack pnpm runtime.

`pnpm run test:acceptance` runs this guard before the business acceptance steps, so a local runtime mismatch fails fast instead of surfacing midway through the acceptance suite.

## PowerShell quick start

From the repository root:

```powershell
Copy-Item .env.commercial_v1.example .env

docker compose -f docker-compose.commercial_v1.yml config

docker compose -f docker-compose.commercial_v1.yml up -d --build postgres minio mqtt minio-init server jobs executor

curl.exe http://127.0.0.1:3001/api/health
curl.exe http://127.0.0.1:3001/api/admin/healthz

pnpm run doctor:local-runtime
pnpm --filter @geox/server run test:p1:smoke
pnpm run test:acceptance
pnpm run ci:runtime:workers
pnpm run ci:base-contract:p0
pnpm acceptance:commercial:mvp0:release-gate
```

Expected result for the config step:

```text
docker compose -f docker-compose.commercial_v1.yml config
```

should not fail because of missing required environment variables such as:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `GEOX_EXECUTOR_TOKEN`

## Runtime expectations

After startup, the core runtime containers should be running:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.State}}"
```

Expected runtime signals:

- `geox-v1-server` is healthy or responds to `/api/health`.
- `geox-v1-jobs` is running and logs `INFO: jobs runtime started` or `JOBS_TRACE`.
- `geox-executor-1` is running and logs `INFO: executor runtime loop started` or `HEARTBEAT_TRACE`.

Useful diagnostics:

```powershell
docker inspect geox-v1-server --format "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{.State.Restarting}}"
docker inspect geox-v1-jobs --format "{{.State.Status}} {{.State.Restarting}} {{.State.ExitCode}}"
docker inspect geox-executor-1 --format "{{.State.Status}} {{.State.Restarting}} {{.State.ExitCode}}"

docker logs geox-v1-server --tail 120
docker logs geox-v1-jobs --tail 120
docker logs geox-executor-1 --tail 120
```

## Historical local fail-safe state

If the local database has historical OPEN fail-safe events for the P1 smoke device, update to PR #1842 or a later `main` before running `test:p1:smoke`.

That preflight validates the device heartbeat/status and resolves only stale smoke-device fail-safe events that match the narrow local smoke criteria. It does not bypass fail-safe globally and does not resolve unrelated fail-safe events.

## Production boundary

Do not use `.env.commercial_v1.example` as production configuration.

Production and customer environments must provide real secrets through a proper secret-management mechanism. In particular:

- Do not use local database passwords from the template.
- Do not use local MinIO credentials from the template.
- Do not use local acceptance tokens from the template.
- Do not change `docker-compose.commercial_v1.yml` back to silent fallback credentials.
- Do not restore an executor token fallback such as a hard-coded default.

`docker-compose.commercial_v1.yml` intentionally requires explicit runtime credentials so a missing credential fails fast instead of silently starting with a local test value.

## Cleanup

To stop the local runtime without deleting volumes:

```powershell
docker compose -f docker-compose.commercial_v1.yml down
```

To reset local acceptance state completely, including Postgres and MinIO volumes:

```powershell
docker compose -f docker-compose.commercial_v1.yml down -v
```

Use `down -v` only for disposable local test environments. It deletes local database and object-storage data.
