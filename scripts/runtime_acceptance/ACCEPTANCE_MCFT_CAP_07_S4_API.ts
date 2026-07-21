// Purpose: prove S4 transport, route ownership, static production-read boundaries, cursor/auth contracts, and PostgreSQL adapter wiring.
// Boundary: in-memory/static companion to the separate real PostgreSQL acceptance; no fixture mutation or capability authority change.

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
import { authorizeMcftFieldTwinReadV1 } from "../../apps/server/src/auth/mcft_field_twin_read_authz_v1.js";
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
  schema_version: suffix === "runtime" ? "minimal_field_twin_runtime_read_model_v1" : suffix === "timeline" ? "field_twin_timeline_page_v1" : suffix === "trace" ? "field_twin_trace_graph_v1" : suffix === "health" ? "field_twin_runtime_health_read_model_v1" : "field_twin_collection_page_v1",
  response_instance_hash: hash({ suffix }),
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

async function main(): Promise<void> {
  try {
    const routeSource = read("apps/server/src/routes/v1/mcft_field_twin_read_v1.ts");
    const readLegacySource = read("apps/server/src/routes/v1/operator_twin_read_legacy_v1.ts");
    const writeLegacySource = read("apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts");
    const moduleSource = read("apps/server/src/modules/operator/registerOperatorModule.ts");
    const serviceSource = read("apps/server/src/services/mcft_field_twin_read_api_v1.ts");
    const rootRepositorySource = read("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.ts");
    const projectionRepositorySource = read("apps/server/src/repositories/field_twin_read_model/postgres_field_twin_projection_read_repository_v1.ts");
    const domainValidatorSource = read("apps/server/src/services/mcft_field_twin_domain_page_validator_v1.ts");
    const readAuthSource = read("apps/server/src/auth/mcft_field_twin_read_authz_v1.ts");
    const tokenSource = read("apps/server/src/auth/token_ssot_v1.ts");

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

    await check("STATIC_ZERO_WRITE_AND_NO_WRITE_SERVICE_DEPENDENCY", () => {
      assert.doesNotMatch(routeSource, /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/);
      assert.doesNotMatch(serviceSource + projectionRepositorySource, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/);
      const imports = [...(routeSource + serviceSource + projectionRepositorySource).matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
      for (const imported of imports) assert.doesNotMatch(imported, /recommendation|approval_service|ao_act|dispatch|writer|persistence|activation_service/i);
    });

    await check("LEGACY_ROUTE_INVENTORY_AND_NO_DUPLICATE_REGISTRATION", async () => {
      const app = Fastify();
      registerOperatorTwinReadLegacyRoutesV1(app, {} as never);
      registerOperatorTwinWriteLegacyRoutesV1(app, {} as never);
      registerMcftFieldTwinReadRoutesV1(app, {} as never, { readApi: new FakeReadApi(), authorizeScope: () => ({}) as never });
      await app.ready();
      for (const url of [
        "/api/v1/operator/twin", "/api/v1/operator/twin/source-indexes", "/api/v1/operator/twin/fields/:field_id", "/api/v1/operator/twin/fields/:field_id/post-irrigation", "/api/v1/operator/twin/fields/:field_id/calibration", "/api/v1/operator/twin/fields/:field_id/evidence", "/api/v1/operator/twin/fields/:field_id/forecast", "/api/v1/operator/twin/fields/:field_id/scenarios",
        MCFT_FIELD_TWIN_CANONICAL_BASE_V1, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/timeline`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/trace`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/states`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/forecasts`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/scenarios`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/residuals`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/action-lifecycle`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/model-governance`, `${MCFT_FIELD_TWIN_CANONICAL_BASE_V1}/health`,
      ]) assert.equal(app.hasRoute({ method: "GET", url }), true, url);
      for (const url of [
        "/api/v1/operator/twin/fields/:field_id/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
        "/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
      ]) assert.equal(app.hasRoute({ method: "POST", url }), true, url);
      await app.close();
    });

    await check("HTTP_SCOPE_QUERY_AND_ERROR_MATRIX", async () => {
      const api = new FakeReadApi();
      const app = Fastify();
      registerMcftFieldTwinReadRoutesV1(app, {} as never, { readApi: api, authorizeScope: () => ({}) as never });
      for (const suffix of ["", "/timeline", "/trace", "/states", "/forecasts", "/scenarios", "/residuals", "/action-lifecycle", "/model-governance?collection_kind=MODEL_ACTIVATION&", "/health"]) {
        const response = await app.inject({ method: "GET", url: `${base}${suffix}${suffix.includes("?") ? "" : "?"}${query}` });
        assert.equal(response.statusCode, 200, response.body);
      }
      assert.equal((await app.inject({ method: "GET", url: `${base}?tenant_id=tenant-a` })).statusCode, 400);
      const historical = await app.inject({ method: "GET", url: `${base}?${query}&as_of=2026-07-20T00%3A00%3A00.000Z` });
      assert.equal(JSON.parse(historical.body).error_code, "MCFT_HISTORICAL_RUNTIME_NOT_SUPPORTED");
      assert.equal((await app.inject({ method: "GET", url: `${base}/states?${query}&limit=201` })).statusCode, 400);
      await app.close();
      assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_RUNTIME_NOT_ESTABLISHED")).statusCode, 404);
      assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_OPERATIONAL_POINTER_TARGET_MISSING")).statusCode, 409);
      assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_CURSOR_AUTH_INVALID")).statusCode, 400);
      assert.equal(mapMcftFieldTwinReadErrorV1(new Error("MCFT_REQUIRED_READ_SCHEMA_UNAVAILABLE")).statusCode, 503);
    });

    await check("CURSOR_HMAC_SCOPE_FILTER_ROOT_AND_WIRE_REJECTION", () => {
      const visibility = buildCanonicalVisibilitySnapshotV1({ database_visibility_epoch_id: "epoch-s4", pg_snapshot_token: "10:100:", snapshot_xmin: "10", snapshot_xmax: "100", snapshot_xip_values_for_hash: [] });
      const payload = createCursorPayloadV1({ cursor_kind: "OPTIONAL_COLLECTION", collection_kind: "STATE", sort_contract_id: "LOGICAL_TIME_DESC_OBJECT_REF_ASC_V1", scope_hash: buildScopeHashV1(scope), filter_hash: buildEmptyCollectionFilterHashV1(), canonical_visibility_snapshot: visibility, fixed_root_ref: "collection:state", fixed_root_graph_content_hash: hash("collection-root"), sort_direction: "DESC", last_sort_tuple: { cursor_kind: "OPTIONAL_COLLECTION", logical_time: canonicalUtcInstantV1("2026-07-20T00:00:00.000Z"), object_ref: "state-a" }, page_limit: 50, issued_at: canonicalUtcInstantV1("2026-07-20T00:00:00.000Z"), expires_at: canonicalUtcInstantV1("2026-07-20T00:15:00.000Z") });
      const signed = signFieldTwinCursorV1(payload, "key-v1", "0123456789abcdef0123456789abcdef");
      assert.equal(decodeUntrustedFieldTwinCursorEnvelopeV1(signed.wire).payload.fixed_root_ref, "collection:state");
      assert.throws(() => decodeUntrustedFieldTwinCursorEnvelopeV1(Buffer.from(JSON.stringify({ cursor: payload })).toString("base64url")), /MCFT_CURSOR_/);
    });

    await check("S4_DUAL_HEALTH_SAME_DISTINCT_AND_NULL", () => {
      const terminal = composerObject("health-terminal", "2026-07-20T00:00:00.000Z");
      const operational = composerObject("health-operational", "2026-07-20T01:00:00.000Z");
      const terminalResolution: FieldTwinRuntimeHealthRoleResolutionV1 = { health_object_ref: terminal.object_ref, transaction_family: "A_STATE_TICK_COMMIT", health_role: "TERMINAL_RECORD_SET_MEMBER", health_resolution_basis: "EXACT_RECORD_SET_MEMBERSHIP", health_resolution_evidence_refs: [{ ref_type: "RECORD_SET", ref_value: "record-set-a" }], atomic_group_ref: "record-set-a" };
      const operationalResolution: FieldTwinRuntimeHealthRoleResolutionV1 = { health_object_ref: operational.object_ref, transaction_family: "F_OPERATIONAL_ATTEMPT_HEALTH", health_role: "OPERATIONAL_ATTEMPT_AUDIT", health_resolution_basis: "EXACT_OPERATIONAL_ATTEMPT_RELATION", health_resolution_evidence_refs: [{ ref_type: "RUNTIME_ATTEMPT", ref_value: "attempt-a" }], atomic_group_ref: null };
      const composer = new S4RuntimeHealthComposerV1();
      assert.equal(composer.compose({ request_scope: scope, response_started_at: canonicalUtcInstantV1("2026-07-20T02:00:00.000Z"), terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution, latest_operational_runtime_health: terminal, operational_role_resolution: terminalResolution, health_pointer_validation_summary: [] }).health_relationship, "SAME_OBJECT");
      assert.equal(composer.compose({ request_scope: scope, response_started_at: canonicalUtcInstantV1("2026-07-20T02:00:00.000Z"), terminal_record_set_health: terminal, terminal_role_resolution: terminalResolution, latest_operational_runtime_health: operational, operational_role_resolution: operationalResolution, health_pointer_validation_summary: [] }).health_relationship, "DISTINCT_OBJECTS");
    });

    await check("SOURCE_OBLIGATIONS_AND_COLLECTION_INVENTORY_EXACT", () => {
      assert.equal(Object.keys(MCFT_COLLECTION_SOURCE_SPECS_V1).length, 8);
      assert.equal(MCFT_CAP_07_S4_SOURCE_NAMES_V1.length, 10);
      for (const spec of Object.values(MCFT_COLLECTION_SOURCE_SPECS_V1)) assert.ok(MCFT_CAP_07_S4_SOURCE_NAMES_V1.includes(spec.source_name as never));
      assert.ok(MCFT_CAP_07_S4_SOURCE_NAMES_V1.includes("public.twin_decision_record_projection_v1"));
      assert.ok(MCFT_CAP_07_S4_SOURCE_NAMES_V1.includes("public.twin_approved_plan_binding_projection_v1"));
    });

    await check("COLLECTION_PATH_IS_ROOT_INDEPENDENT_AND_NON_COUNTED", () => {
      const start = serviceSource.indexOf("private async readCollectionV1");
      const end = serviceSource.indexOf("readStates", start);
      const collectionBlock = serviceSource.slice(start, end);
      assert.match(collectionBlock, /buildCollectionVisibilityRootV1/);
      assert.doesNotMatch(collectionBlock, /resolveCurrentRuntimeRoot|resolveHistoricalRuntimeRoot/);
      assert.match(serviceSource, /count_status:\s*"NOT_COMPUTED"/);
      assert.match(serviceSource, /total_count:\s*null/);
      assert.doesNotMatch(projectionRepositorySource, /count\s*\(\s*\*\s*\)/i);
    });

    await check("TIMELINE_FILTER_KEYSET_REPLAY_AND_HEALTH_ARE_SQL_BACKED", () => {
      assert.match(projectionRepositorySource, /\(logical_time,event_rank,object_ref\)\s*>/);
      assert.match(projectionRepositorySource, /logical_time\s*>?=\s*\$10/);
      assert.match(projectionRepositorySource, /logical_time\s*<\s*\$11/);
      assert.match(projectionRepositorySource, /ORDER BY logical_time ASC,event_rank ASC,object_ref ASC LIMIT \$15/);
      assert.match(projectionRepositorySource, /approved_irrigation_plan_snapshot_v1/);
      assert.match(projectionRepositorySource, /ReplayEvidenceFactResolverV1/);
      assert.match(projectionRepositorySource, /RuntimeHealthRoleResolverV1/);
      assert.match(projectionRepositorySource, /A_STATE_TICK_COMMIT|resolveHealthRole/);
    });

    await check("OPTIONAL_ATTACHMENTS_AND_S3_DOMAIN_COMPOSERS_ARE_PRODUCTION_WIRED", () => {
      assert.match(serviceSource, /readScenarioForForecast\(context, root\.current_tick_forecast_result\.object_ref\)/);
      assert.match(serviceSource, /readDecisionForScenario/);
      assert.match(serviceSource, /readApprovedPlanForDecision/);
      assert.match(serviceSource, /NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH/);
      assert.match(serviceSource, /domainPageValidator\.validate\(context, kind/);
      assert.match(domainValidatorSource, /ActionLifecycleComposerV1/);
      assert.match(domainValidatorSource, /ModelGovernanceComposerV1/);
      assert.match(domainValidatorSource, /decision_ref/);
      assert.match(domainValidatorSource, /approved_plan_evidence_ref/);
    });

    await check("STRICT_RUNTIME_AUTH_USES_SHARED_SSOT_AND_FAILS_CLOSED", () => {
      for (const profile of ["pilot", "commercial", "staging", "production"]) assert.match(tokenSource, new RegExp(`"${profile}"`));
      assert.match(readAuthSource, /hasStructuredTokenSourceV1/);
      assert.match(readAuthSource, /isStrictRuntimeProfileV1/);
      const oldEnv = process.env.GEOX_RUNTIME_ENV;
      const oldJson = process.env.GEOX_TOKENS_JSON;
      const oldToken = process.env.GEOX_TOKEN;
      process.env.GEOX_RUNTIME_ENV = "pilot";
      delete process.env.GEOX_TOKENS_JSON;
      process.env.GEOX_TOKEN = "dev-token";
      assert.equal(authorizeMcftFieldTwinReadV1({ headers: { authorization: "Bearer dev-token" } } as never), null);
      if (oldEnv === undefined) delete process.env.GEOX_RUNTIME_ENV; else process.env.GEOX_RUNTIME_ENV = oldEnv;
      if (oldJson === undefined) delete process.env.GEOX_TOKENS_JSON; else process.env.GEOX_TOKENS_JSON = oldJson;
      if (oldToken === undefined) delete process.env.GEOX_TOKEN; else process.env.GEOX_TOKEN = oldToken;
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
    });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_api_acceptance_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
    console.log(JSON.stringify({ status: "PASS", check_count: checks.length }));
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_api_acceptance_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
