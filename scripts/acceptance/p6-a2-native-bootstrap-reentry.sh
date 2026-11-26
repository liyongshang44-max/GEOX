#!/usr/bin/env bash
# GitHub-hosted disposable PostgreSQL only. No real GEOX deployment credentials.
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
test "${RUNNER_ENVIRONMENT:-}" = github-hosted
test "${GITHUB_EVENT_NAME:-}" = pull_request
test -z "${DATABASE_URL:-}${GEOX_RUNTIME_DATABASE_URL:-}${GEOX_MIGRATION_DATABASE_URL:-}${GEOX_DB_PLATFORM_ADMIN_DATABASE_URL:-}${GEOX_PRODUCT_MIGRATION_DATABASE_URL:-}"
subject="$(git rev-parse HEAD)"
name="geox-p6-a2-native-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
db=geox_p6_native_test
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
port="$(docker port "$cid" 5432/tcp | sed -n 's/^127\.0\.0\.1://p')"
[[ "$port" =~ ^[0-9]+$ ]]
base="127.0.0.1:$port/$db"
admin_url="postgres://landos:$admin_pw@$base"
mcft_url="postgres://geox_mcft_migrator_v1:$mcft_pw@$base"
runtime_url="postgres://geox_runtime_v1:$runtime_pw@$base"
product_url="postgres://geox_product_migrator_v1:$product_pw@$base"
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
# Synthetic product review referencing an existing native demo field; no science or fact mutation.
runtime <<'SQL'
INSERT INTO geox_manager_v1.field_crop_review_p3_v1
(tenant_id,project_id,group_id,field_id,review_id,actor_id,intent_sha256,basis,result,result_sha256,created_at)
SELECT tenant_id,'P6_TEST_ONLY','P6_TEST_ONLY',field_id,'p6_fixture_review','p6_fixture_actor',repeat('1',64),'{}','{"qualification":"TEST_ONLY"}',repeat('2',64),now()
FROM public.field_index_v1 ORDER BY tenant_id,field_id LIMIT 1;
SQL
test "$(runtime -c "SELECT count(*) FROM geox_manager_v1.field_crop_review_p3_v1 WHERE review_id='p6_fixture_review'")" = 1
# Exercise actual native one-shots, not a simplified GRANT imitation.
bootstrap
cap07
workloads
again="$(product)"
echo "$again"
node -e 'const a=JSON.parse(process.argv[1]),b=JSON.parse(process.argv[2]);if(b.action!=="ALREADY_APPLIED_EXACT"||a.physical_sha256!==b.physical_sha256||a.source_sha256!==b.source_sha256)process.exit(1)' "$first" "$again"
test "$(snapshot)" = "$before"
echo PASS EXACT_NATIVE_BOOTSTRAP_REENTRY
# Catalog inventory and actual separate login negative proofs.
for pair in "geox_telemetry_ingest_v1:$telemetry_pw" "geox_jobs_v1:$jobs_pw" "geox_executor_runtime_v1:$executor_pw" "geox_mcft_migrator_v1:$mcft_pw"; do
  who="${pair%%:*}"; pw="${pair#*:}"
  test "$(sql "$who" "$pw" -c 'SELECT current_user')" = "$who"
  test "$(sql "$who" "$pw" -c "SELECT has_schema_privilege(current_user,'geox_manager_v1','USAGE') OR has_schema_privilege(current_user,'geox_manager_v1','CREATE') OR pg_has_role(current_user,'geox_product_migration_owner_v1','MEMBER') OR pg_has_role(current_user,'geox_product_migrator_v1','MEMBER')")" = f
  if sql "$who" "$pw" -c 'SELECT * FROM geox_manager_v1.field_crop_review_p3_v1 LIMIT 0' >/dev/null 2>&1; then echo "P6_WORKLOAD_READ_UNEXPECTED:$who" >&2; exit 1; fi
  echo "PASS PRODUCT_SCHEMA_DENIED_$who"
done
for table in field_soil_document_revision_p2_v1 field_soil_document_confirmation_p2_v1 field_crop_review_p3_v1 field_native_assessment_p3p_v1 field_context_followup_p4_v1; do
  for verb in "UPDATE geox_manager_v1.$table SET field_id=field_id WHERE false" "DELETE FROM geox_manager_v1.$table WHERE false" "TRUNCATE geox_manager_v1.$table"; do
    if runtime -c "$verb" >/dev/null 2>&1; then echo "P6_RUNTIME_MUTATION_UNEXPECTED:$table" >&2; exit 1; fi
  done
done
echo PASS RUNTIME_APPEND_ONLY_AFTER_ACTUAL_BOOTSTRAP
# Actual PostgreSQL container process restart, retaining the same data volume.
docker restart "$cid" >/dev/null
wait_ready
test "$(snapshot)" = "$before"
test "$(runtime -c "SELECT count(*) FROM geox_manager_v1.field_crop_review_p3_v1 WHERE review_id='p6_fixture_review' AND result->>'qualification'='TEST_ONLY'")" = 1
last="$(product)"
node -e 'const a=JSON.parse(process.argv[1]),b=JSON.parse(process.argv[2]);if(b.action!=="ALREADY_APPLIED_EXACT"||a.physical_sha256!==b.physical_sha256)process.exit(1)' "$first" "$last"
echo PASS POSTGRES_RESTART_PERSISTENCE
echo P6_A2_NATIVE_BOOTSTRAP_REENTRY=PASS
