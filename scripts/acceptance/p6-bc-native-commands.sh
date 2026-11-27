#!/usr/bin/env bash
# GitHub-hosted disposable PostgreSQL only. No real GEOX deployment credentials.
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
test "${RUNNER_ENVIRONMENT:-}" = github-hosted
test "${GITHUB_EVENT_NAME:-}" = pull_request
test -z "${DATABASE_URL:-}${GEOX_RUNTIME_DATABASE_URL:-}${GEOX_MIGRATION_DATABASE_URL:-}${GEOX_DB_PLATFORM_ADMIN_DATABASE_URL:-}${GEOX_PRODUCT_MIGRATION_DATABASE_URL:-}"
subject="$(git rev-parse HEAD)"
name="geox-p6-bc-native-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
db=geox_p6_bc_native_test
admin_pw=p6_native_fixture_admin_only
runtime_pw=p6_native_fixture_runtime_only
mcft_pw=p6_native_fixture_mcft_only
product_pw=p6_native_fixture_product_only
telemetry_pw=p6_native_fixture_telemetry_only
jobs_pw=p6_native_fixture_jobs_only
executor_pw=p6_native_fixture_executor_only
cid="$(docker run -d --name "$name" -e POSTGRES_USER=landos -e POSTGRES_PASSWORD="$admin_pw" -e POSTGRES_DB="$db" -p 127.0.0.1::5432 -v "$PWD/docker/postgres/init:/docker-entrypoint-initdb.d:ro" postgres:16)"
trap 'docker rm -f -v "$cid" >/dev/null' EXIT
wait_ready() {
  for i in $(seq 1 90); do
    if docker exec "$cid" pg_isready -h 127.0.0.1 -U landos -d "$db" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo P6_NATIVE_PG_NOT_READY >&2
  return 1
}
wait_ready
resolve_binding() {
  port="$(docker port "$cid" 5432/tcp | sed -n 's/^127\.0\.0\.1://p')"
  [[ "$port" =~ ^[0-9]+$ ]]
  base="127.0.0.1:$port/$db"
  admin_url="postgres://landos:$admin_pw@$base"
  mcft_url="postgres://geox_mcft_migrator_v1:$mcft_pw@$base"
  runtime_url="postgres://geox_runtime_v1:$runtime_pw@$base"
  product_url="postgres://geox_product_migrator_v1:$product_pw@$base"
}
resolve_binding
sql() {
  local who="$1" pw="$2"; shift 2
  docker exec -i -e PGPASSWORD="$pw" "$cid" psql -h 127.0.0.1 -U "$who" -d "$db" -X -qAt -v ON_ERROR_STOP=1 "$@"
}
admin() { sql landos "$admin_pw" "$@"; }
runtime() { sql geox_runtime_v1 "$runtime_pw" "$@"; }
bootstrap() {
  env GEOX_DB_PLATFORM_ADMIN_DATABASE_URL="$admin_url" GEOX_MIGRATION_DATABASE_URL="$mcft_url" GEOX_RUNTIME_DATABASE_URL="$runtime_url" GEOX_MCFT_MIGRATOR_PASSWORD="$mcft_pw" GEOX_RUNTIME_DATABASE_PASSWORD="$runtime_pw" node apps/server/dist/database/platform_bootstrap.js
}
cap07() {
  env GEOX_MIGRATION_DATABASE_URL="$mcft_url" GEOX_DEPLOYMENT_SUBJECT_COMMIT="$subject" node apps/server/dist/database/mcft_cap07_migration.js
}
workloads() {
  env GEOX_DB_PLATFORM_ADMIN_DATABASE_URL="$admin_url" GEOX_TELEMETRY_DATABASE_PASSWORD="$telemetry_pw" GEOX_JOBS_DATABASE_PASSWORD="$jobs_pw" GEOX_EXECUTOR_DATABASE_PASSWORD="$executor_pw" node apps/server/dist/database/bline_commercial_principal_bootstrap.js
}
product() {
  env GEOX_PRODUCT_MIGRATION_DATABASE_URL="$product_url" GEOX_DEPLOYMENT_SUBJECT_COMMIT="$subject" node apps/server/dist/apps/server/src/product_manager_migration_v1.js
}
snapshot() {
  admin -c "SELECT encode(sha256(convert_to(coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY fact_id)::text FROM public.facts f),'[]') || '|' || coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY tenant_id,field_id)::text FROM public.field_index_v1 f),'[]'),'UTF8')),'hex')"
}
bootstrap
cap07
workloads
echo PASS EXISTING_NATIVE_BOOTSTRAP_AND_WORKLOAD_PRINCIPALS
before="$(snapshot)"
[[ "$before" =~ ^[0-9a-f]{64}$ ]]
admin -c "CREATE ROLE geox_product_migrator_v1 LOGIN NOINHERIT PASSWORD '$product_pw' NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS"
admin < apps/server/db/migrations/product/provision_manager_schema_v1.sql
first="$(product)"
echo "$first"
node -e 'const r=JSON.parse(process.argv[1]);if(r.status!=="PASS"||r.action!=="APPLIED")process.exit(1)' "$first"
test "$(snapshot)" = "$before"
echo PASS NATIVE_ROWS_PRESERVED_ON_PRODUCT_UPGRADE
# Run actual P1/P2 HTTP command flow on the unmodified native bootstrap schema.
case "${1:-}" in
  "") fixture=apps/server/test/manager_native_commands_v1.fixture.ts ;;
  --a07-joint-test-only) fixture=apps/server/test/manager_a07_native_joint_v1.fixture.ts ;;
  *) exit 2 ;;
esac
P6_TEST_ONLY=1 P6_TEST_DATABASE_URL="$admin_url" P6_TEST_RUNTIME_URL="$runtime_url" pnpm exec tsx "$fixture"
echo P6_B_C_NATIVE_COMMANDS=PASS
