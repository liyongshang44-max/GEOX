#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_FACT_ENVELOPE_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}
function includesAll(text, xs, label) {
  for (const x of xs) assert(text.includes(x), `${label} missing ${x}`);
}

const migration = read('apps/server/db/migrations/2026_05_15_fact_envelope_v1.sql');
const service = read('apps/server/src/domain/sensing/raw_sample_fact_envelope_v1.ts');
const routes = read('apps/server/src/routes/sensing_fact_envelope_v1.ts');
const register = read('apps/server/src/modules/sensing/registerSensingModule.ts');
const auth = read('apps/server/src/auth/ao_act_authz_v0.ts');
const roles = read('apps/server/src/domain/auth/roles.ts');
const contracts = read('packages/contracts/src/schema/fact_envelope_v1.ts');
const contractsIndex = read('packages/contracts/src/index.ts');
const seriesRouteStart = routes.indexOf('app.get("/api/v1/sensing/series"');
const seriesRouteBody = seriesRouteStart >= 0 ? routes.slice(seriesRouteStart) : '';

includesAll(migration, [
  'prevent_raw_samples_mutation_v1',
  'trg_raw_samples_no_update_v1',
  'trg_raw_samples_no_delete_v1',
  'RAISE EXCEPTION',
  'RAW_SAMPLE_APPEND_ONLY',
  'raw_samples_no_interpolated_or_synthetic_v1_check',
  "payload_json ->> 'interpolated'",
  "payload_json ->> 'synthetic'",
  "payload_json ->> 'fake_sample'",
  'raw_samples_ec_unit_ds_m_v1_check',
  "payload_json ->> 'unit' = 'dS/m'",
  'NOT VALID',
], 'migration');

includesAll(service, [
  'appendRawSampleV1',
  'readRawSamplesV1',
  'buildSeriesResponseV1',
  'computeGapsForSeriesV1',
  'readSeriesOverlaysV1',
  'samples',
  'gaps',
  'overlays',
  'INTERPOLATED_SAMPLE_REJECTED',
  'NON_RAW_SAMPLE_KIND_REJECTED',
  'EC_UNIT_DS_M_REQUIRED',
  'RAW_SAMPLE_ALREADY_EXISTS_APPEND_ONLY',
  'ON CONFLICT (sample_id) DO NOTHING',
  'OFFICIAL_SERIES_OVERLAY_KIND_ALLOWLIST_V1 = ["marker", "candidate", "annotation"]',
  'FORBIDDEN_OVERLAY_TERMS_V1 = ["recommendation", "prescription", "acceptance", "conclusion"]',
  'containsForbiddenOverlayConclusionV1',
  'if (containsForbiddenOverlayConclusionV1(row.kind, payload)) continue',
], 'service');

assert(!service.includes('interpolated: true'), 'service must not emit interpolated samples');
assert(!service.includes('synthetic: true'), 'service must not emit synthetic samples');
assert(!service.includes('fake_sample: true'), 'service must not emit fake samples');
assert(!service.includes('last known'), 'service must not describe or implement last-known-value filling');
assert(!service.includes('lastKnown'), 'service must not implement last-known-value filling');
assert(!service.includes('interpolation'), 'service must not implement interpolation');
assert(service.includes('return [{ startTs, endTs, reason: "no_data"'), 'no-data windows must produce a gap instead of a stable state');
assert(service.includes('const gaps = computeGapsForSeriesV1(samples'), 'SeriesResponse must always compute gaps');
assert(service.includes('const overlays = await readSeriesOverlaysV1(pool, filter)'), 'SeriesResponse must always compute overlays');
assert(service.includes('samples,\n    gaps,\n    overlays'), 'SeriesResponse must always return samples/gaps/overlays');

includesAll(routes, [
  'app.post("/api/v1/sensing/raw-samples"',
  'app.get("/api/v1/sensing/raw-samples"',
  'app.get("/api/v1/sensing/series"',
  'requireAoActScopeV0(req, reply, "telemetry.write")',
  'requireAoActScopeV0(req, reply, "telemetry.read")',
  'SCOPE_FILTER_REQUIRED',
  'return reply.send({ ok: true, ...item, item })',
], 'routes');
assert(!routes.includes('requireAoActAnyScopeV0(req, reply, ["telemetry.write", "telemetry.read"]'), 'read scope must not allow raw sample writes');
assert(seriesRouteBody.includes('return reply.send({ ok: true, ...item, item })'), 'series route must expose samples/gaps/overlays at the top level');
assert(!seriesRouteBody.includes('return reply.send({ ok: true, item })'), 'series route must not hide samples/gaps/overlays only under item');

includesAll(register, [
  'registerSensingFactEnvelopeV1Routes',
  'registerSensingFactEnvelopeV1Routes(app, pool)',
], 'sensing module registration');

includesAll(auth, ['| "telemetry.write"', '"telemetry.write"'], 'auth scope');
includesAll(roles, ['"telemetry.write"', '"telemetry.read"'], 'role matrix');

includesAll(contracts, [
  'RawSampleFactEnvelopeV1Schema',
  'SeriesResponseFactEnvelopeV1Schema',
  'SeriesGapV1Schema',
  'SeriesOverlayKindV1Schema = z.enum(["marker", "candidate", "annotation"])',
  'interpolated: z.literal(false)',
  'synthetic: z.literal(false)',
  'EC metric unit must be dS/m',
  'samples: z.array(RawSampleFactEnvelopeV1Schema)',
  'gaps: z.array(SeriesGapV1Schema)',
  'overlays: z.array(SeriesOverlayV1Schema)',
], 'contracts');
includesAll(contractsIndex, ['export * from "./schema/fact_envelope_v1.js"'], 'contracts index');

console.log('[ACCEPTANCE_FACT_ENVELOPE_V1] PASSED');
