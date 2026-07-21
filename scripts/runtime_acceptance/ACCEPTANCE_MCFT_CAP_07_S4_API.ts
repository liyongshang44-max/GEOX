// Purpose: prove MCFT-CAP-07 S4 canonical GET-only API, physical route split, exact error mapping, OpenAPI, cursor, health, and zero-write boundaries.
// Boundary: in-memory transport/static evidence only; no database mutation, canonical write, recommendation, approval, AO-ACT, dispatch, or activation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import {
  buildCanonicalVisibilitySnapshotV1,
  buildEmptyCollectionFilterHashV1,
  buildScopeHashV1,
  canonicalUtcInstantV1,
  createCursorPayloadV1,
  signFieldTwinCursorV1,
  type FieldTwinRuntimeHealthRoleResolutionV1,
  type FieldTwinScopeV1,
  type SemanticHashTextV1,
} from "../../apps/server/src/domain/field_twin_read_model/index.js";
import type { FieldTwinComposerObjectV1 } from "../../apps/server/src/domain/field_twin_read_model/composer_contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import { MCFT_CAP_07_S4_SOURCE_NAMES_V1 } from "../../apps/server/src/domain/field_twin_read_model/s4_source_obligations_v1.js";
import { MCFT_COLLECTION_SOURCE_SPECS_V1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.js";
import {
  MCFT_FIELD_TWIN_CANONICAL_BASE_V1,
  mapMcftFieldTwinReadErrorV1,
  registerMcftFieldTwinReadRoutesV1,
} from "../../apps/server/src/routes/v1/mcft_field_twin_read_v1.js";
import { registerOperatorTwinReadLegacyRoutesV1 } from "../../apps/server/src/routes/v1/operator_twin_read_legacy_v1.js";
import { registerOperatorTwinWriteLegacyRoutesV1 } from "../../apps/server/src/routes/v1/operator_twin_write_legacy_v1.js";
import {
  installMcftFieldTwinReadOpenApiV1,
  MCFT_FIELD_TWIN_OPENAPI_PATHS_V1,
  MCFT_FIELD_TWIN_OPENAPI_SCHEMAS_V1,
} from "../../apps/server/src/routes/openapi_mcft_field_twin_read_v1.js";
import type { McftFieldTwinReadApiV1, McftFieldTwinReadRequestV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";
import { decodeUntrustedFieldTwinCursorEnvelopeV1 } from "../../apps/server/src/services/mcft_field_twin_cursor_transport_v1.js";
import { S4RuntimeHealthComposerV1 } from "../../apps/server/src/services/mcft_field_twin_s4_health_composer_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S4_API_RESULT.json");
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = async (name: string, action: () => void | Promise<void>) => { await action(); checks.push({ name, status: "PASS" }); };
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const hash = (value: unknown) => semanticHashV1(value) as SemanticHashTextV1;
const scope: FieldTwinScopeV1 = Object.freeze({ tenant_id: "tenant-a", project_id: "project-a", group_id: "group-a", field_id: "field-a", season_id: "season-a", zone_id: "zone-a" });
const query = "tenant_id=tenant-a&project_id=project-a&group_id=group-a&season_id=season-a&zone_id=zone-a";
const base = "/api/v1/operator/twin/fields/field-a/runtime";

const successBody = (suffix: string): Record<string, unknown> => ({
  schema_version: suffix.includes("health") ? "field_twin_runtime_health_read_model_v1" : suffix.includes("timeline") ? "field_twin_timeline_page_v1" : suffix.includes("trace") ? "field_twin_trace_graph_v1" : suffix === "runtime" ? "minimal_field_twin_runtime_read_model_v1" : "field_twin_collection_page_v1",
  response_instance_hash: hash({ suffix, instance: 1 }),
  ...(suffix === "runtime" ? { root_graph_content_hash: hash("root") } : {}),
  ...(suffix === "timeline" ? { timeline_page_content_hash: hash("timeline") } : {}),
  ...(suffix === "trace" ? { trace_graph_content_hash: hash("trace") } : {}),
  ...(["states", "forecasts", "scenarios", "residuals", "action-lifecycle", "model-governance"].includes(suffix) ? { collection_page_content_hash: hash(suffix), items: [], next_cursor: null } : {}),
  ...(suffix === "health" ? { health_content_hash: hash("health") } : {}),
});

class FakeReadApi implements McftFieldTwinReadApiV1 {
  readonly calls: Array<{ method: string; request: McftFieldTwinReadRequestV1 }> = [];
  private reply(method: string, request: McftFieldTwinReadRequestV1) { this.calls.push({ method, request }); return Promise.resolve(successBody(method)); }
  readRuntime(r: McftFieldTwinReadRequestV1) { return this.reply("runtime", r); }
  readTimeline(r: McftFieldTwinReadRequestV1) { return this.reply("timeline", r); }
  readTrace(r: McftFieldTwinReadRequestV1) { return this.reply("trace", r); }
  readStates(r: McftFieldTwinReadRequestV1) { return this.reply("states", r); }
  readForecasts(r: McftFieldTwinReadRequestV1) { return this.reply("forecasts", r); }
  readScenarios(r: McftFieldTwinReadRequestV1) { return this.reply("scenarios", r); }
  readResiduals(r: McftFieldTwinReadRequestV1) { return this.reply("residuals", r); }
  readActionLifecycle(r: McftFieldTwinReadRequestV1) { return this.reply("action-lifecycle", r); }
  readModelGovernance(r: McftFieldTwinReadRequestV1) { return this.reply("model-governance", r); }
  readHealth(r: McftFieldTwinReadRequestV1) { return this.reply("health", r); }
}

function composerObject(ref: string, logicalTime: string): FieldTwinComposerObjectV1 {
  return Object.freeze({ object_ref: ref, object_type: "twin_runtime_health_v1", object_hash: hash({ ref }), source_fact_ref: `fact-${ref}`, scope, lineage_id: "lineage-a", revision_id: "revision-a", logical_time: canonicalUtcInstantV1(logicalTime), source_refs: [], evidence_refs: [], validation_profile: "CANONICAL_TWIN_FACT_DIRECT", validation_status: "PASS", attachment_status: "ATTACHED_EXACT" });
}

function collectionCursorWire(kind: "STATE" | "MODEL_ACTIVATION"): string {
  const visibility = buildCanonicalVisibilitySnapshotV1({ database_visibility_epoch_id: "epoch-s4", pg_snapshot_token: "10:100:", snapshot_xmin: "10", snapshot_xmax: "100", snapshot_xip_values_for_hash: [] });
  const payload = createCursorPayloadV1({ cursor_kind: "OPTIONAL_COLLECTION", collection_kind: kind, sort_contract_id: "LOGICAL_TIME_DESC_OBJECT_REF_ASC_V1", scope_hash: buildScopeHashV1(scope), filter_hash: buildEmptyCollectionFilterHashV1(), canonical_visibility_snapshot: visibility, fixed_root_ref: `collection-${kind}`, fixed_root_graph_content_hash: hash({ kind }), sort_direction: "DESC", last_sort_tuple: { cursor_kind: "OPTIONAL_COLLECTION", logical_time: canonicalUtcInstantV1("2026-07-20T00:00:00.000Z"), object_ref: `${kind.toLowerCase()}-a` }, page_limit: 50, issued_at: canonicalUtcInstantV1("2026-07-20T00:00:00.000Z"), expires_at: canonicalUtcInstantV1("2026-07-20T00:15:00.000Z") });
  return signFieldTwinCursorV1(payload, "key-v1", "0123456789abcdef0123456789abcdef").wire;
}

async function main(): Promise<void> {
try {
  const routeSource = read("apps/server/src/routes/v1/mcft_field_twin_read_v1.ts");
  const readLegacySource = read("apps/server/src/routes/v1/operator_twin_read_legacy_v1.ts");
  const writeLegacySource = read("apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts");
  const moduleSource = read("apps/server/src/modules/operator/registerOperatorModule.ts");
  const serviceSource = read("apps/server/src/services/mcft_field_twin_read_api_v1.ts");
  const repositorySource = read("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.ts");

  await check("THREE_PHYSICAL_ROUTE_MODULES_AND_INDEPENDENT_REGISTRATION", () => {
    for (const file of ["mcft_field_twin_read_v1.ts", "operator_twin_read_legacy_v1.ts", "operator_twin_write_legacy_v1.ts"]) assert.ok(fs.existsSync(path.join(ROOT, "apps/server/src/routes/v1", file)));
    assert.match(moduleSource, /registerOperatorTwinReadLegacyRoutesV1/);
    assert.match(moduleSource, /registerOperatorTwinWriteLegacyRoutesV1/);
    assert.match(moduleSource, /registerMcftFieldTwinReadRoutesV1/);
    assert.doesNotMatch(readLegacySource + writeLegacySource, /new Proxy\s*\(/);
  });

  await check("CANONICAL_NAMESPACE_GET_ONLY_AND_EXACT_INVENTORY", () => {
    assert.equal((routeSource.match(/app\.get\(/g) ?? []).length, 10);
    assert.equal((routeSource.match(/app\.(?:post|put|patch|delete)\(/g) ?? []).length, 0);
    for (const suffix of ["timeline", "trace", "states", "forecasts", "scenarios", "residuals", "action-lifecycle", "model-governance", "health"]) assert.match(routeSource, new RegExp(`/${suffix.replace("-", "\\-")}`));
  });

  await check("STATIC_AND_TRANSITIVE_ZERO_WRITE_BOUNDARY", () => {
    assert.doesNotMatch(routeSource, /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/);
    assert.doesNotMatch(serviceSource + repositorySource, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/);
    const canonicalImports = [...(routeSource + serviceSource + repositorySource).matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((m) => m[1]);
    for (const imported of canonicalImports) assert.doesNotMatch(imported, /recommendation|approval|ao_act|dispatch|writer|persistence|activation_service/i);
  });

  await check("LEGACY_ROUTE_INVENTORY_AND_NO_DUPLICATE_REGISTRATION", async () => {
    const app = Fastify();
    registerOperatorTwinReadLegacyRoutesV1(app, {} as never);
    registerOperatorTwinWriteLegacyRoutesV1(app, {} as never);
    registerMcftFieldTwinReadRoutesV1(app, {} as never, { readApi: new FakeReadApi(), authorizeScope: () => ({}) as never });
    await app.ready();
    const exactRoutes = [
      "/api/v1/operator/twin",
      "/api/v1/operator/twin/source-indexes",
      "/api/v1/operator/twin/fields/:field_id",
      "/api/v1/operator/twin/fields/:field_id/post-irrigation",
      "/api/v1/operator/twin/fields/:field_id/calibration",
      "/api/v1/operator/twin/fields/:field_id/evidence",
      "/api/v1/operator/twin/fields/:field_id/forecast",
      "/api/v1/operator/twin/fields/:field_id/scenarios",
      MCFT_FIELD_TWIN_CANONICAL_BASE_V1,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/timeline`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/trace`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/states`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/forecasts`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/scenarios`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/residuals`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/action-lifecycle`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/model-governance`,
      `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/health`,
    ];
    for (const url of exactRoutes) assert.equal(app.hasRoute({ method: "GET", url }), true, url);
    for (const url of [
      "/api/v1/operator/twin/fields/:field_id/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
      "/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
    ]) assert.equal(app.hasRoute({ method: "POST", url }), true, url);
    await app.close();
  });

  await check("HTTP_SCOPE_QUERY_CURSOR_AND_ERROR_MATRIX", async () => {
    const api = new FakeReadApi();
    const app = Fastify();
    registerMcftFieldTwinReadRoutesV1(app, {} as never, { readApi: api, authorizeScope: () => ({}) as never });
    await app.ready();
    const endpoints = ["", "/timeline", "/trace", "/states", "/forecasts", "/scenarios", "/residuals", "/action-lifecycle", "/model-governance?collection_kind=MODEL_ACTIVATION&", "/health"];
    for (const suffix of endpoints) {
      const separator = suffix.includes("?") ? "" : "?";
      const response = await app.inject({ method: "GET", url: `${base}${suffix}${separator}${query}` });
      assert.equal(response.statusCode, 200, `${suffix}:${response.body}`);
      assert.match(String(response.headers["x-geox-mcft-response-instance-hash"]), /^sha256:/);
    }
    const missing = await app.inject({ method: "GET", url: `${base}?tenant_id=tenant-a` });
    assert.equal(missing.statusCode, 400);
    const historical = await app.inject({ method: "GET", url: `${base}?${query}&as_of=2026-07-20T00%3A00%3A00.000Z` });
    assert.equal(historical.statusCode, 400);
    assert.equal(JSON.parse(historical.body).error_code, "MCFT_HISTORICAL_RUNTIME_NOT_SUPPORTED");
    const tooLarge = await app.inject({ method: "GET", url: `${base}/states?${query}&limit=201` });
    assert.equal(tooLarge.statusCode, 400);
    const trace = await app.inject({ method: "GET", url: `${base}/trace?${query}&root_object_ref=checkpoint-historical-a` });
    assert.equal(trace.statusCode, 200);
    assert.equal(api.calls.at(-1)?.request.root_object_ref, "checkpoint-historical-a");

    const missingKind = await app.inject({ method: "GET", url: `${base}/model-governance?${query}` });
    assert.equal(missingKind.statusCode, 400);
    assert.equal(JSON.parse(missingKind.body).error_code, "MCFT_COLLECTION_KIND_INVALID");
    const invalidKind = await app.inject({ method: "GET", url: `${base}/model-governance?${query}&collection_kind=STATE` });
    assert.equal(invalidKind.statusCode, 400);
    assert.equal(JSON.parse(invalidKind.body).error_code, "MCFT_COLLECTION_KIND_INVALID");
    const continuationWire = collectionCursorWire("MODEL_ACTIVATION");
    const continuation = await app.inject({ method: "GET", url: `${base}/model-governance?${query}&cursor=${encodeURIComponent(continuationWire)}` });
    assert.equal(continuation.statusCode, 200, continuation.body);
    assert.equal(api.calls.at(-1)?.request.collection_kind, "MODEL_ACTIVATION");
    await app.close();

    const forbiddenApp = Fastify();
    registerMcftFieldTwinReadRoutesV1(forbiddenApp, {} as never, { readApi: api, authorizeScope: () => null });
    const forbidden = await forbiddenApp.inject({ method: "GET", url: `${base}?${query}` });
    assert.equal(forbidden.statusCode, 403);
    await forbiddenApp.close();

    assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_RUNTIME_NOT_ESTABLISHED")).statusCode, 404);
    assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_OPERATIONAL_POINTER_TARGET_MISSING")).statusCode, 409);
    assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_CURSOR_AUTH_INVALID")).statusCode, 400);
    assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_REQUIRED_READ_SCHEMA_UNAVAILABLE")).statusCode, 503);
  });

  await check("CURSOR_HMAC_FILTER_SCOPE_ROOT_AND_OBJECT_WIRE_REJECTION", () => {
    const signedWire = collectionCursorWire("STATE");
    assert.match(decodeUntrustedFieldTwinCursorEnvelopeV1(signedWire).payload.fixed_root_ref, /^collection-STATE$/);
    const visibility = buildCanonicalVisibilitySnapshotV1({ database_visibility_epoch_id: "epoch-s4", pg_snapshot_token: "10:100:", snapshot_xmin: "10", snapshot_xmax: "100", snapshot_xip_values_for_hash: [] });
    const payload = createCursorPayloadV1({ cursor_kind: "OPTIONAL_COLLECTION", collection_kind: "STATE", sort_contract_id: "LOGICAL_TIME_DESC_OBJECT_REF_ASC_V1", scope_hash: buildScopeHashV1(scope), filter_hash: buildEmptyCollectionFilterHashV1(), canonical_visibility_snapshot: visibility, fixed_root_ref: "checkpoint-a", fixed_root_graph_content_hash: hash("root-a"), sort_direction: "DESC", last_sort_tuple: { cursor_kind: "OPTIONAL_COLLECTION", logical_time: canonicalUtcInstantV1("2026-07-20T00:00:00.000Z"), object_ref: "state-a" }, page_limit: 50, issued_at: canonicalUtcInstantV1("2026-07-20T00:00:00.000Z"), expires_at: canonicalUtcInstantV1("2026-07-20T00:15:00.000Z") });
    assert.throws(() => decodeUntrustedFieldTwinCursorEnvelopeV1(Buffer.from(JSON.stringify({ cursor: payload })).toString("base64url")), /MCFT_CURSOR_(?:INVALID|WIRE_INVALID)/);
  });

  await check("S4_DUAL_HEALTH_FROZEN_FIVE_STATE_RELATIONSHIP", () => {
    const terminal = composerObject("health-terminal", "2026-07-20T00:00:00.000Z");
    const operational = composerObject("health-operational", "2026-07-20T01:00:00.000Z");
    const terminalResolution: FieldTwinRuntimeHealthRoleResolutionV1 = { health_object_ref: terminal.object_ref, transaction_family: "A_STATE_TICK_COMMIT", health_role: "TERMINAL_RECORD_SET_MEMBER", health_resolution_basis: "EXACT_RECORD_SET_MEMBERSHIP", health_resolution_evidence_refs: [{ ref_type: "RECORD_SET", ref_value: "record-set-a" }], atomic_group_ref: "record-set-a" };
    const operationalResolution: FieldTwinRuntimeHealthRoleResolutionV1 = { health_object_ref: operational.object_ref, transaction_family: "F_OPERATIONAL_ATTEMPT_HEALTH", health_role: "OPERATIONAL_ATTEMPT_AUDIT", health_resolution_basis: "EXACT_OPERATIONAL_ATTEMPT_RELATION", health_resolution_evidence_refs: [{ ref_type: "RUNTIME_ATTEMPT", ref_value: "attempt-a" }], atomic_group_ref: null };
    const composer = new S4RuntimeHealthComposerV1();
    const responseStartedAt = canonicalUtcInstantV1("2026-07-20T02:00:00.000Z");
    const same = composer.compose({ request_scope: scope, response_started_at: responseStartedAt, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution, latest_operational_runtime_health: terminal, operational_role_resolution: terminalResolution, health_pointer_validation_summary: [] });
    assert.equal(same.health_relationship, "SAME_OBJECT");
    const later = composer.compose({ request_scope: scope, response_started_at: responseStartedAt, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution, latest_operational_runtime_health: operational, operational_role_resolution: operationalResolution, health_pointer_validation_summary: [] });
    assert.equal(later.health_relationship, "LATEST_OPERATIONAL_IS_LATER");
    const terminalOnly = composer.compose({ request_scope: scope, response_started_at: responseStartedAt, terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution, latest_operational_runtime_health: null, operational_role_resolution: null, health_pointer_validation_summary: [] });
    assert.equal(terminalOnly.health_relationship, "TERMINAL_ONLY");
    const operationalOnly = composer.compose({ request_scope: scope, response_started_at: responseStartedAt, terminal_record_set_health: null, terminal_role_resolution: null, latest_operational_runtime_health: operational, operational_role_resolution: operationalResolution, health_pointer_validation_summary: [] });
    assert.equal(operationalOnly.health_relationship, "OPERATIONAL_ONLY");
    const bothAbsent = composer.compose({ request_scope: scope, response_started_at: responseStartedAt, terminal_record_set_health: null, terminal_role_resolution: null, latest_operational_runtime_health: null, operational_role_resolution: null, health_pointer_validation_summary: [] });
    assert.equal(bothAbsent.health_relationship, "BOTH_ABSENT");
  });

  await check("SOURCE_PROFILE_AND_COLLECTION_INVENTORY_EXACT", () => {
    assert.deepEqual([...MCFT_CAP_07_S4_SOURCE_NAMES_V1].sort(), Object.values(MCFT_COLLECTION_SOURCE_SPECS_V1).map((spec) => spec.source_name).sort());
    assert.equal(Object.keys(MCFT_COLLECTION_SOURCE_SPECS_V1).length, 8);
  });

  await check("OPENAPI_EXACT_PATH_METHOD_PARAMETER_AND_ERROR_SCHEMA", () => {
    installMcftFieldTwinReadOpenApiV1();
    assert.equal(Object.keys(MCFT_FIELD_TWIN_OPENAPI_PATHS_V1).length, 10);
    for (const [routePath, item] of Object.entries(MCFT_FIELD_TWIN_OPENAPI_PATHS_V1)) {
      assert.ok(routePath.startsWith("/api/v1/operator/twin/fields/{field_id}/runtime"));
      assert.deepEqual(Object.keys(item), ["get"]);
      const operation = item.get as Record<string, any>;
      for (const status of ["200", "400", "403", "404", "409", "503"]) assert.ok(operation.responses[status]);
    }
    assert.ok(MCFT_FIELD_TWIN_OPENAPI_SCHEMAS_V1.McftFieldTwinApiErrorV1);
    const collectionPath = MCFT_FIELD_TWIN_OPENAPI_PATHS_V1["/api/v1/operator/twin/fields/{field_id}/runtime/states"].get as Record<string, any>;
    const limit = collectionPath.parameters.find((parameter: Record<string, unknown>) => parameter.name === "limit");
    assert.equal(limit.schema.default, 50);
    assert.equal(limit.schema.maximum, 200);
    const governancePath = MCFT_FIELD_TWIN_OPENAPI_PATHS_V1["/api/v1/operator/twin/fields/{field_id}/runtime/model-governance"].get as Record<string, any>;
    const collectionKind = governancePath.parameters.find((parameter: Record<string, unknown>) => parameter.name === "collection_kind");
    assert.equal(collectionKind.required, false);
    const health = MCFT_FIELD_TWIN_OPENAPI_SCHEMAS_V1.McftFieldTwinHealthResponseV1 as Record<string, any>;
    assert.deepEqual(health.properties.health_relationship.enum, ["SAME_OBJECT", "LATEST_OPERATIONAL_IS_LATER", "TERMINAL_ONLY", "OPERATIONAL_ONLY", "BOTH_ABSENT"]);
    assert.ok(Array.isArray(health.properties.terminal_record_set_health.anyOf));
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_api_acceptance_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "PASS", check_count: checks.length, output: path.relative(ROOT, OUT) }));
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_api_acceptance_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
}
}

void main();
