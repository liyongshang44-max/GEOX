/**
 * Mainline Contract:
 * - fields_v1 负责字段/地块主读写路由；operation 详情与 action 执行应分别走 `/api/v1/operations/*` 与 `/api/v1/actions/*` 主口径。
 * - 涉及 field 关联的新流需先评估与 operation_state_v1、action v1 的主链协同。
 *
 * Stable Product Fields:
 * - tenant_id / project_id / group_id 为稳定隔离字段。
 * - field_id / device_id / season_id / geometry 等核心字段语义需保持兼容。
 *
 * Forbidden New Dependencies:
 * - 禁止新代码依赖 legacy/deprecated route。
 * - 禁止通过历史兼容路由旁路 field 主链路鉴权与隔离策略。
 *
 * Successor:
 * - 若后续拆分 fields 子域版本，需明确 successor，并保证核心字段向后兼容。
 */
// GEOX/apps/server/src/routes/fields_v1.ts
//
// Sprint C1 + Sprint F1: Field/GIS routes, device binding, season projection, and field detail summary.
//
// Design notes:
// - All writes emit append-only facts into facts(record_json).
// - Projections are mutable read models rebuilt from facts when needed.
// - Tenant isolation is enforced by AoActAuthContextV0 (tenant_id from token is authoritative).
// - Missing or cross-tenant resources always return 404 to avoid enumeration leaks.

import crypto from "node:crypto"; // Node crypto for deterministic hashes used in fact ids.
import type { FastifyInstance } from "fastify"; // Fastify app instance type.
import type { Pool } from "pg"; // Postgres pool type.

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js"; // Token/scope auth helper.
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js"; // Auth context type.
import { STAGE1_REFRESH_SEMANTICS, STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY } from "../domain/sensing/stage1_sensing_contract_v1.js";
import { ensureDeviceSkillBindings } from "../services/device_skill_bindings.js";
import { refreshFieldReadModelsWithObservabilityV1 } from "../services/field_read_model_refresh_v1.js";
import { ingestTelemetryV1 } from "../services/telemetry_ingest_service_v1.js";
import { reconcileDeviceTemplateSkillBindingsV1 } from "../services/skill_binding_validation_service_v1.js";

function isNonEmptyString(v: any): v is string { // Helper: check for non-empty strings.
  return typeof v === "string" && v.trim().length > 0; // True only when string has visible content.
} // End helper.

function normalizeId(v: any): string | null { // Helper: normalize id-like strings.
  if (!isNonEmptyString(v)) return null; // Missing => invalid.
  const s = String(v).trim(); // Trim whitespace.
  if (s.length < 1 || s.length > 128) return null; // Enforce a conservative length bound.
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null; // Allow only a safe id character set.
  return s; // Normalized id.
} // End helper.

function normalizeName(v: any, maxLen: number): string | null { // Helper: normalize human-readable names.
  if (!isNonEmptyString(v)) return null; // Missing => null.
  return String(v).trim().slice(0, maxLen); // Trim and cap length.
} // End helper.

function sha256Hex(s: string): string { // Helper: sha256 hex digest.
  return crypto.createHash("sha256").update(s, "utf8").digest("hex"); // Hash and return hex.
} // End helper.

function badRequest(reply: any, error: string) { // Helper: standardized 400 response.
  return reply.status(400).send({ ok: false, error }); // Standard envelope.
} // End helper.

function notFound(reply: any) { // Helper: standardized 404 response.
  return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Non-enumerable response.
} // End helper.

function emptyGeometry(reply: any) { // Helper: explicit empty geometry response.
  return reply.status(422).send({ ok: false, error: "EMPTY_GEOMETRY" });
}

function hasRealDeviceMode(input: any): boolean { // Detect any caller intent to create real devices in demo flow.
  if (!input || typeof input !== "object") return false; // Non-object bodies cannot carry mode flags.
  if (String((input as any).device_mode ?? "").trim().toLowerCase() === "real") return true; // Top-level mode.
  if (String((input as any).mode ?? "").trim().toLowerCase() === "real") return true; // Common alias.
  if (String((input as any).environment_type ?? "").trim().toLowerCase() === "real") return true; // Environment alias.
  const devices = Array.isArray((input as any).devices) ? (input as any).devices : []; // Optional per-device list.
  for (const dev of devices) {
    if (!dev || typeof dev !== "object") continue; // Skip invalid entries.
    if (String((dev as any).device_mode ?? "").trim().toLowerCase() === "real") return true; // Per-device mode.
    if (String((dev as any).mode ?? "").trim().toLowerCase() === "real") return true; // Per-device alias.
    if (String((dev as any).device_type ?? "").trim().toLowerCase() === "real") return true; // Defensive type misuse.
  }
  return false; // No real mode found.
}

async function emitDemoBootstrapTelemetry(pool: Pool, tenant_id: string, device_id: string): Promise<void> {
  const now = Date.now();
  await ingestTelemetryV1(
    pool,
    {
      tenant_id,
      device_id,
      metric: "sim_runner_alive",
      value: 1,
      unit: "unitless",
      ts_ms: now - 1000,
    },
    { source: "dev_lab_create_demo_field_v1", quality_flags: ["OK"], confidence: 1 }
  );
  await ingestTelemetryV1(
    pool,
    {
      tenant_id,
      device_id,
      metric: "demo_bootstrap_signal",
      value: 1,
      unit: "unitless",
      ts_ms: now,
    },
    { source: "dev_lab_create_demo_field_v1", quality_flags: ["OK"], confidence: 1 }
  );
}

function normalizeGeoJsonText(v: any): string | null { // Helper: validate and normalize GeoJSON input.
  if (v == null) return null; // Missing => invalid.
  let obj: any = null; // Parsed object placeholder.
  if (typeof v === "string") { // If input is a JSON string.
    const s = v.trim(); // Trim.
    if (!s) return null; // Empty string => invalid.
    try { obj = JSON.parse(s); } catch { return null; } // Must parse successfully.
  } else if (typeof v === "object") { // If input is already an object.
    obj = v; // Use object as-is.
  } else { // Unsupported type.
    return null; // Invalid.
  } // End type branch.

  if (!obj || typeof obj !== "object") return null; // Must be a JSON object.
  const t = String((obj as any).type ?? ""); // Read GeoJSON type.
  if (t !== "Polygon" && t !== "MultiPolygon" && t !== "Feature" && t !== "FeatureCollection") return null; // Conservative allowlist.
  return JSON.stringify(obj); // Canonicalize to a JSON string.
} // End helper.

function normalizeSeasonStatus(v: any): "PLANNED" | "ACTIVE" | "CLOSED" | null { // Helper: normalize season lifecycle.
  const s = String(v ?? "PLANNED").trim().toUpperCase(); // Normalize to upper-case.
  if (s === "PLANNED" || s === "ACTIVE" || s === "CLOSED") return s as "PLANNED" | "ACTIVE" | "CLOSED"; // Allowlist.
  return null; // Invalid status.
} // End helper.

function normalizeDateOnly(v: any): string | null { // Helper: normalize YYYY-MM-DD dates.
  if (v == null || v === "") return null; // Empty => null.
  if (!isNonEmptyString(v)) return null; // Must be a string.
  const s = String(v).trim(); // Trim.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; // Require date-only format.
  return s; // Normalized date string.
} // End helper.

function parseJsonOrNull(v: any): any | null { // Helper: parse a JSON string when possible.
  if (!isNonEmptyString(v)) return null; // Empty => null.
  try { return JSON.parse(String(v)); } catch { return null; } // Best-effort parse.
} // End helper.

type FieldMapMarkerV1 = { device_id: string; lat: number; lon: number; source: string; ts_ms: number | null; }; // Latest resolved device marker for map tab.
type FieldMapHeatPointV1 = { object_id: string; object_type: "FIELD" | "DEVICE"; metric: string; count: number; last_raised_ts_ms: number; }; // Aggregated recent alert heat row.
type FieldTrajectoryPointV1 = { lat: number; lon: number; ts_ms: number; }; // Ordered trajectory point.
type FieldDeviceTrajectoryV1 = { device_id: string; points: FieldTrajectoryPointV1[]; geojson: any; }; // Device trajectory payload.

type GeoPointV1 = { lat: number; lon: number; }; // Generic geographic point.
type GeoJsonGeometryV1 = { type: "Polygon" | "MultiPolygon"; coordinates: any[]; }; // Stable field geometry type.

type TaskTimingV1 = { anchor_ts_ms: number | null; start_ts_ms: number | null; end_ts_ms: number | null; source: string; }; // Best-effort task timing metadata.

function toGeoJsonTrajectory(device_id: string, points: FieldTrajectoryPointV1[]): any { // Build GeoJSON feature from device trajectory points.
  return {
    type: "Feature",
    properties: { device_id, point_count: points.length },
    geometry: {
      type: "LineString",
      coordinates: points.map((pt) => [pt.lon, pt.lat]),
    },
  };
} // End helper.

function collectCoordinatePairs(raw: any, out: Array<[number, number]>): void { // Recursively collect [lon,lat] pairs from GeoJSON coordinates.
  if (!Array.isArray(raw)) return; // Ignore non-arrays.
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) { // Detect a coordinate pair.
    out.push([Number(raw[0]), Number(raw[1])]); // Store normalized pair.
    return; // Stop descending at the pair level.
  }
  for (const item of raw) collectCoordinatePairs(item, out); // Recurse through nested coordinate arrays.
} // End helper.

function extractGeoPoints(geo: any): GeoPointV1[] { // Flatten supported GeoJSON shapes into lat/lon points.
  if (!geo || typeof geo !== "object") return []; // Missing => empty.
  const type = String((geo as any).type ?? ""); // GeoJSON discriminator.
  if (type === "Feature") return extractGeoPoints((geo as any).geometry); // Unwrap feature.
  if (type === "FeatureCollection") return Array.isArray((geo as any).features) ? (geo as any).features.flatMap((f: any) => extractGeoPoints(f)) : []; // Flatten collection.
  const pairs: Array<[number, number]> = []; // Coordinate pairs accumulator.
  if (type === "Point") {
    const coordinates = (geo as any).coordinates; // Point coordinates.
    if (Array.isArray(coordinates) && coordinates.length >= 2) pairs.push([Number(coordinates[0]), Number(coordinates[1])]); // Add point when valid.
  } else if (type === "Polygon" || type === "MultiPolygon" || type === "LineString" || type === "MultiLineString") {
    collectCoordinatePairs((geo as any).coordinates, pairs); // Flatten supported coordinate containers.
  }
  return pairs.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180).map(([lon, lat]) => ({ lat, lon })); // Return normalized valid points.
} // End helper.

function computeCentroid(geo: any): GeoPointV1 | null { // Compute a simple centroid from flattened GeoJSON coordinates.
  const points = extractGeoPoints(geo); // Flatten available coordinates.
  if (points.length === 0) return null; // No geometry => no centroid.
  const totals = points.reduce((acc, pt) => ({ lat: acc.lat + pt.lat, lon: acc.lon + pt.lon }), { lat: 0, lon: 0 }); // Sum coordinates.
  return { lat: totals.lat / points.length, lon: totals.lon / points.length }; // Arithmetic centroid is sufficient for field-scale maps.
} // End helper.

function toHeatGeoJson(points: FieldMapHeatPointV1[], markerByDevice: Map<string, FieldMapMarkerV1>, fieldPoint: GeoPointV1 | null): any { // Convert aggregated heat rows into GeoJSON points.
  const features = points.map((p) => {
    const geo = p.object_type === "DEVICE" ? markerByDevice.get(p.object_id) ?? null : fieldPoint; // DEVICE alerts require a real device marker; FIELD alerts use field centroid.
    if (!geo) return null; // Skip unresolved positions instead of fabricating a point.
    return {
      type: "Feature",
      properties: { object_id: p.object_id, object_type: p.object_type, metric: p.metric, count: p.count, intensity: p.count, last_raised_ts_ms: p.last_raised_ts_ms },
      geometry: { type: "Point", coordinates: [geo.lon, geo.lat] },
    };
  }).filter(Boolean);
  return { type: "FeatureCollection", features };
} // End helper.

function buildTaskTiming(task: any, receipt: any, fallback_ts_ms: number | null): TaskTimingV1 { // Build a best-effort task timing window using task and receipt payloads.
  const taskPayload = task?.payload ?? {}; // Task payload envelope.
  const receiptPayload = receipt?.payload ?? {}; // Receipt payload envelope.
  const taskWindowStart = Number(taskPayload?.time_window?.start_ts ?? 0); // Planned window start.
  const taskWindowEnd = Number(taskPayload?.time_window?.end_ts ?? 0); // Planned window end.
  const receiptStart = Number(receiptPayload?.execution_time?.start_ts ?? 0); // Actual execution start.
  const receiptEnd = Number(receiptPayload?.execution_time?.end_ts ?? 0); // Actual execution end.
  const start_ts_ms = Number.isFinite(receiptStart) && receiptStart > 0 ? receiptStart : (Number.isFinite(taskWindowStart) && taskWindowStart > 0 ? taskWindowStart : null); // Prefer actual execution start.
  const end_ts_ms = Number.isFinite(receiptEnd) && receiptEnd > 0 ? receiptEnd : (Number.isFinite(taskWindowEnd) && taskWindowEnd > 0 ? taskWindowEnd : null); // Prefer actual execution end.
  const anchor_ts_ms = end_ts_ms ?? start_ts_ms ?? fallback_ts_ms ?? null; // Anchor at task end, then start, then fact time.
  const source = end_ts_ms != null ? (receiptEnd > 0 ? "receipt.execution_time.end_ts" : "task.time_window.end_ts") : (start_ts_ms != null ? (receiptStart > 0 ? "receipt.execution_time.start_ts" : "task.time_window.start_ts") : (fallback_ts_ms != null ? "fact.occurred_at" : "none")); // Audit source of timing.
  return { anchor_ts_ms, start_ts_ms, end_ts_ms, source };
} // End helper.

function findNearestPoint(points: FieldTrajectoryPointV1[], anchor_ts_ms: number | null, maxDistanceMs: number): FieldTrajectoryPointV1 | null { // Find the nearest point to a timestamp within a conservative tolerance.
  if (!points.length || anchor_ts_ms == null || !Number.isFinite(anchor_ts_ms)) return null; // Require data and anchor.
  let best: FieldTrajectoryPointV1 | null = null; // Best candidate so far.
  let bestDelta = Number.POSITIVE_INFINITY; // Smallest distance so far.
  for (const pt of points) {
    const delta = Math.abs(pt.ts_ms - anchor_ts_ms); // Absolute time delta.
    if (delta <= maxDistanceMs && delta < bestDelta) { best = pt; bestDelta = delta; } // Keep closer point within tolerance.
  }
  return best; // Null when no point is close enough.
} // End helper.

function filterTrajectoryPointsForWindow(points: FieldTrajectoryPointV1[], start_ts_ms: number | null, end_ts_ms: number | null, anchor_ts_ms: number | null): FieldTrajectoryPointV1[] { // Filter trajectory points to the best available task window.
  if (!points.length) return []; // Empty device trajectory => empty result.
  if (start_ts_ms != null && end_ts_ms != null && end_ts_ms >= start_ts_ms) { // Use the explicit task window when valid.
    const paddedStart = start_ts_ms - (10 * 60 * 1000); // Pad slightly to capture pre/post motion around the task.
    const paddedEnd = end_ts_ms + (10 * 60 * 1000); // Symmetric end padding.
    return points.filter((pt) => pt.ts_ms >= paddedStart && pt.ts_ms <= paddedEnd); // Window-filtered points.
  }
  if (anchor_ts_ms != null) { // Fall back to an anchor-centered window when only a single timestamp is known.
    const span = 2 * 60 * 60 * 1000; // 2h centered fallback window.
    return points.filter((pt) => Math.abs(pt.ts_ms - anchor_ts_ms) <= span); // Keep nearby points.
  }
  return []; // No usable timing metadata.
} // End helper.
function normalizeGeoPoint(raw: any): { lat: number; lon: number } | null { // Normalize several geo payload shapes from device uplinks.
  if (!raw || typeof raw !== "object") return null; // Missing object.
  const latCandidates = [raw.lat, raw.latitude, raw?.location?.lat, raw?.location?.latitude]; // Supported lat aliases.
  const lonCandidates = [raw.lon, raw.lng, raw.longitude, raw?.location?.lon, raw?.location?.lng, raw?.location?.longitude]; // Supported lon aliases.
  let lat: number | null = null; // Selected latitude.
  let lon: number | null = null; // Selected longitude.
  for (const v of latCandidates) { const n = Number(v); if (Number.isFinite(n)) { lat = n; break; } } // Pick first finite latitude.
  for (const v of lonCandidates) { const n = Number(v); if (Number.isFinite(n)) { lon = n; break; } } // Pick first finite longitude.
  if (lat == null || lon == null) return null; // Require both coordinates.
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null; // Reject invalid coordinates.
  return { lat, lon }; // Normalized point.
} // End helper.

function normalizeGeometryObject(geo: any): GeoJsonGeometryV1 | null { // Normalize any supported GeoJSON wrapper into Polygon/MultiPolygon only.
  if (!geo || typeof geo !== "object") return null;
  const type = String((geo as any).type ?? "");
  if (type === "Feature") return normalizeGeometryObject((geo as any).geometry);
  if (type === "FeatureCollection") {
    const features = Array.isArray((geo as any).features) ? (geo as any).features : [];
    for (const f of features) {
      const normalized = normalizeGeometryObject(f);
      if (normalized) return normalized;
    }
    return null;
  }
  if (type === "Polygon") {
    const coordinates = Array.isArray((geo as any).coordinates) ? (geo as any).coordinates : null;
    if (!coordinates) return null;
    return { type: "Polygon", coordinates };
  }
  if (type === "MultiPolygon") {
    const coordinates = Array.isArray((geo as any).coordinates) ? (geo as any).coordinates : null;
    if (!coordinates) return null;
    return { type: "MultiPolygon", coordinates };
  }
  return null;
}

function computeBBox(geo: any): [number, number, number, number] | null { // Compute [minLon,minLat,maxLon,maxLat] for geometry.
  const points = extractGeoPoints(geo);
  if (!points.length) return null;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

async function ensureFieldSeasonProjectionV1(pool: Pool): Promise<void> { // Startup helper: create season projection table for upgraded repos.
  await pool.query( // Create field season projection table.
    `CREATE TABLE IF NOT EXISTS field_season_index_v1 (
       tenant_id text NOT NULL,
       field_id text NOT NULL,
       season_id text NOT NULL,
       name text NOT NULL,
       crop text NULL,
       start_date text NULL,
       end_date text NULL,
       status text NOT NULL,
       created_ts_ms bigint NOT NULL,
       updated_ts_ms bigint NOT NULL,
       PRIMARY KEY (tenant_id, field_id, season_id)
     )`
  ); // End create table.

  await pool.query( // Create list index for tenant/field season lookups.
    `CREATE INDEX IF NOT EXISTS field_season_index_v1_lookup_idx
       ON field_season_index_v1 (tenant_id, field_id, updated_ts_ms DESC)`
  ); // End create index.
} // End helper.

/**
 * Register Field/GIS + Device Binding + Season routes.
 */
// 新流必须走本路由（fields 子域）；同时禁止新代码依赖 legacy/deprecated route。
export function registerFieldsV1Routes(app: FastifyInstance, pool: Pool) { // Route registration entry.
  const refreshFieldReadModels =
    ((app as any).refreshFieldReadModelsWithObservabilityV1 as typeof refreshFieldReadModelsWithObservabilityV1 | undefined)
    ?? refreshFieldReadModelsWithObservabilityV1;

  void ensureFieldSeasonProjectionV1(pool).catch((e: any) => { // Ensure upgraded repos also have the season table.
    app.log.error({ err: e }, "failed_to_ensure_field_season_projection_v1"); // Log startup issue instead of crashing boot.
  }); // End ensure table.

  app.post("/api/v1/fields", async (req, reply) => { // Create a new field in the caller's tenant.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.write"); // Require fields.write scope.
    if (!auth) return; // Auth helper already responded.

    const body: any = (req as any).body ?? {}; // Read JSON body.
    const field_id = normalizeId(body.field_id); // Required field id.
    if (!field_id) return badRequest(reply, "MISSING_OR_INVALID:field_id"); // Validate field id.

    const name = normalizeName(body.name, 256); // Required display name.
    if (!name) return badRequest(reply, "MISSING_OR_INVALID:name"); // Validate name.

    const area_ha = (typeof body.area_ha === "number" && Number.isFinite(body.area_ha)) ? body.area_ha : null; // Optional field area.

    const now_ms = Date.now(); // Server time for auditing.
    const occurredAtIso = new Date(now_ms).toISOString(); // ISO timestamp for facts.occurred_at.

    const stable_id = sha256Hex(`field_created_v1|${auth.tenant_id}|${field_id}`); // Deterministic id for idempotent create.
    const fact_id = `field_${stable_id}`; // Fact id prefix.

    const record = { // Append-only fact payload.
      type: "field_created_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, field_id }, // Entity envelope.
      payload: { // Fact payload.
        name, // Human-readable field name.
        area_ha, // Optional area.
        status: "ACTIVE", // v1 default lifecycle state.
        created_ts_ms: now_ms, // Creation timestamp.
        actor_id: auth.actor_id, // Audit actor.
        token_id: auth.token_id, // Audit token id.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire DB connection.
    try { // Transaction boundary.
      await clientConn.query("BEGIN"); // Start transaction.

      await clientConn.query( // Insert append-only fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert field projection.
        `INSERT INTO field_index_v1 (tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (tenant_id, field_id) DO UPDATE SET
           name = EXCLUDED.name,
           area_ha = EXCLUDED.area_ha,
           status = EXCLUDED.status,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, field_id, name, area_ha, "ACTIVE", now_ms]
      ); // End upsert.

      await clientConn.query("COMMIT"); // Commit transaction.
      return reply.send({ ok: true, field_id }); // Return created field.
    } catch (e: any) { // Error path.
      await clientConn.query("ROLLBACK"); // Roll back changes.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // Return 500.
    } finally { // Always release.
      clientConn.release(); // Release connection.
    } // End try/finally.
  }); // End POST /api/v1/fields.

  app.post("/api/v1/dev-lab/create-demo-field", async (req, reply) => { // Create demo field with simulator-only templated devices.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.write"); // Require write access to create field + bindings.
    if (!auth) return; // Auth helper already replied.

    const body: any = (req as any).body ?? {}; // Read request body.
    if (hasRealDeviceMode(body)) { // Explicitly reject real-device input in demo environment.
      return reply.status(400).send({ ok: false, error: "DEMO_FIELD_REAL_DEVICE_NOT_ALLOWED" });
    }

    const now_ms = Date.now(); // Shared server timestamp for deterministic audit writes.
    const occurredAtIso = new Date(now_ms).toISOString(); // Fact occurred_at.

    const field_id = normalizeId(body.field_id) ?? `demo_field_${sha256Hex(`${auth.tenant_id}|${now_ms}|${Math.random()}`).slice(0, 12)}`; // Caller may pass id; otherwise generate one.
    const field_name = normalizeName(body.name, 256) ?? "Demo Simulator Field"; // Stable default field display name.
    const area_ha = (typeof body.area_ha === "number" && Number.isFinite(body.area_ha)) ? body.area_ha : 1; // Conservative demo area.

    const templateDevices = [
      { key: "soil", suffix: "soil", display_name: "Demo Soil Sensor (Simulator)" },
      { key: "environment", suffix: "env", display_name: "Demo Environment Sensor (Simulator)" },
      { key: "image", suffix: "img", display_name: "Demo Image Sensor (Simulator)" },
    ] as const; // Fixed template set: soil / environment / image.
    const deviceRows = templateDevices.map((tpl) => ({ // Build deterministic device ids under the created demo field.
      key: tpl.key,
      device_id: `demo_${field_id}_${tpl.suffix}`,
      display_name: tpl.display_name,
    }));

    const clientConn = await pool.connect(); // Acquire DB connection.
    try {
      await clientConn.query("BEGIN"); // Start atomic write.

      const fieldFactId = `field_${sha256Hex(`field_created_v1|${auth.tenant_id}|${field_id}`)}`; // Deterministic field fact id.
      const fieldRecord = {
        type: "field_created_v1",
        entity: { tenant_id: auth.tenant_id, field_id },
        payload: {
          name: field_name,
          area_ha,
          status: "ACTIVE",
          created_ts_ms: now_ms,
          actor_id: auth.actor_id,
          token_id: auth.token_id,
        },
      };
      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fieldFactId, occurredAtIso, "control", JSON.stringify(fieldRecord)]
      );
      await clientConn.query(
        `INSERT INTO field_index_v1 (tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (tenant_id, field_id) DO UPDATE SET
           name = EXCLUDED.name,
           area_ha = EXCLUDED.area_ha,
           status = EXCLUDED.status,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, field_id, field_name, area_ha, "ACTIVE", now_ms]
      );

      for (const row of deviceRows) { // Create each simulator template device and bind it to the demo field.
        const deviceFactId = `device_${sha256Hex(`device_registered_v1|${auth.tenant_id}|${row.device_id}`)}`; // Deterministic fact id.
        const deviceRecord = {
          type: "device_registered_v1",
          entity: { tenant_id: auth.tenant_id, device_id: row.device_id },
          payload: {
            display_name: row.display_name,
            device_mode: "simulator",
            device_role: row.key,
            created_ts_ms: now_ms,
            actor_id: auth.actor_id,
            token_id: auth.token_id,
          },
        };
        await clientConn.query(
          `INSERT INTO facts (fact_id, occurred_at, source, record_json)
           VALUES ($1, $2::timestamptz, $3, $4)
           ON CONFLICT (fact_id) DO NOTHING`,
          [deviceFactId, occurredAtIso, "control", JSON.stringify(deviceRecord)]
        );
        await clientConn.query(
          `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, created_ts_ms, last_credential_id, last_credential_status)
           VALUES ($1, $2, $3, $4, NULL, NULL)
           ON CONFLICT (tenant_id, device_id) DO UPDATE SET
             display_name = EXCLUDED.display_name`,
          [auth.tenant_id, row.device_id, row.display_name, now_ms]
        );

        const bindFactId = `bind_${sha256Hex(`device_bound_to_field_v1|${auth.tenant_id}|${row.device_id}|${field_id}`)}`;
        const bindRecord = {
          type: "device_bound_to_field_v1",
          entity: { tenant_id: auth.tenant_id, device_id: row.device_id, field_id },
          payload: { bound_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id, device_mode: "simulator" },
        };
        await clientConn.query(
          `INSERT INTO facts (fact_id, occurred_at, source, record_json)
           VALUES ($1, $2::timestamptz, $3, $4)
           ON CONFLICT (fact_id) DO NOTHING`,
          [bindFactId, occurredAtIso, "control", JSON.stringify(bindRecord)]
        );
        await clientConn.query(
          `INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, device_id) DO UPDATE SET
             field_id = EXCLUDED.field_id,
             bound_ts_ms = EXCLUDED.bound_ts_ms`,
          [auth.tenant_id, row.device_id, field_id, now_ms]
        );
      }

      await clientConn.query("COMMIT");
      const simulator_bootstrap: Array<{ device_id: string; simulator_started: boolean; telemetry_seeded: boolean; error?: string }> = [];
      const authHeader = String((req.headers as any)?.authorization ?? "");
      const internalBaseUrl = process.env.GEOX_INTERNAL_BASE_URL || process.env.INTERNAL_BASE_URL || "http://127.0.0.1:3000";
      for (const row of deviceRows) {
        let simulator_started = false;
        let telemetry_seeded = false;
        let error: string | undefined;
        try {
          const started = await fetch(`${internalBaseUrl}/api/v1/devices/${encodeURIComponent(row.device_id)}/simulator/start`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: authHeader,
            },
            body: JSON.stringify({ interval_ms: 3000 }),
          });
          simulator_started = started.ok;
          await emitDemoBootstrapTelemetry(pool, auth.tenant_id, row.device_id);
          telemetry_seeded = true;
        } catch (e: any) {
          error = String(e?.message ?? e);
        }
        simulator_bootstrap.push({ device_id: row.device_id, simulator_started, telemetry_seeded, ...(error ? { error } : {}) });
      }
      let read_model_refresh: any = null;
      try {
        const refreshed = await refreshFieldReadModels(pool, {
          tenant_id: auth.tenant_id,
          project_id: auth.project_id,
          group_id: auth.group_id,
          field_id,
        });
        read_model_refresh = {
          sensing_overview_status: refreshed.sensing_overview.status,
          sensing_summary_stage1_status: refreshed.sensing_summary_stage1.status,
          fertility_state_status: refreshed.fertility_state.status,
          sensing_overview_refresh_tracking: refreshed.sensing_overview.refresh_tracking,
          sensing_summary_stage1_refresh_tracking: refreshed.sensing_summary_stage1.refresh_tracking,
          fertility_state_refresh_tracking: refreshed.fertility_state.refresh_tracking,
        };
      } catch (e: any) {
        read_model_refresh = { error: String(e?.message ?? e) };
      }
      return reply.send({
        ok: true,
        field_id,
        field_name,
        device_mode: "simulator",
        environment_type: "demo_simulator_only",
        devices: deviceRows.map((row) => ({
          device_id: row.device_id,
          display_name: row.display_name,
          template_type: row.key,
          device_mode: "simulator",
        })),
        simulator_bootstrap,
        read_model_refresh,
      });
    } catch (e: any) {
      await clientConn.query("ROLLBACK");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) });
    } finally {
      clientConn.release();
    }
  }); // End demo field creation route.

  app.put("/api/v1/fields/:field_id", async (req, reply) => { // Update field base info (name/area/status) and optional polygon.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.write");
    if (!auth) return;

    const field_id = normalizeId((req.params as any)?.field_id);
    if (!field_id) return notFound(reply);

    const body: any = (req as any).body ?? {};
    const nextName = body.name === undefined ? undefined : normalizeName(body.name, 256);
    const nextArea = body.area_ha === undefined ? undefined : ((typeof body.area_ha === "number" && Number.isFinite(body.area_ha)) ? body.area_ha : null);
    const nextStatus = body.status === undefined ? undefined : (isNonEmptyString(body.status) ? String(body.status).trim().toUpperCase().slice(0, 32) : null);
    const polygonGeojson = body.geojson === undefined && body.polygon_geojson === undefined
      ? undefined
      : normalizeGeoJsonText(body.polygon_geojson ?? body.geojson);

    if (body.name !== undefined && !nextName) return badRequest(reply, "MISSING_OR_INVALID:name");
    if (body.status !== undefined && !nextStatus) return badRequest(reply, "MISSING_OR_INVALID:status");
    if ((body.geojson !== undefined || body.polygon_geojson !== undefined) && !polygonGeojson) return badRequest(reply, "MISSING_OR_INVALID:geojson");
    if (nextName === undefined && nextArea === undefined && nextStatus === undefined && polygonGeojson === undefined) {
      return badRequest(reply, "MISSING_OR_INVALID:update_body");
    }

    const now_ms = Date.now();
    const occurredAtIso = new Date(now_ms).toISOString();

    const clientConn = await pool.connect();
    try {
      await clientConn.query("BEGIN");

      const existsQ = await clientConn.query(
        `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`,
        [auth.tenant_id, field_id]
      );
      if ((existsQ.rowCount ?? 0) === 0) {
        await clientConn.query("ROLLBACK");
        return notFound(reply);
      }

      const fact_id = `field_update_${sha256Hex(`field_updated_v1|${auth.tenant_id}|${field_id}|${now_ms}|${Math.random()}`)}`;
      const record = {
        type: "field_updated_v1",
        entity: { tenant_id: auth.tenant_id, field_id },
        payload: {
          name: nextName ?? null,
          area_ha: nextArea ?? null,
          status: nextStatus ?? null,
          polygon_geojson: polygonGeojson ?? null,
          updated_ts_ms: now_ms,
          actor_id: auth.actor_id,
          token_id: auth.token_id,
        },
      };

      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      );

      await clientConn.query(
        `UPDATE field_index_v1
            SET name = COALESCE($3, name),
                area_ha = CASE WHEN $4::boolean THEN $5 ELSE area_ha END,
                status = COALESCE($6, status),
                updated_ts_ms = $7
          WHERE tenant_id = $1 AND field_id = $2`,
        [auth.tenant_id, field_id, nextName ?? null, nextArea !== undefined, nextArea ?? null, nextStatus ?? null, now_ms]
      );

      if (polygonGeojson !== undefined) {
        await clientConn.query(
          `INSERT INTO field_polygon_v1 (tenant_id, field_id, geojson, updated_ts_ms)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (tenant_id, field_id) DO UPDATE SET geojson = EXCLUDED.geojson, updated_ts_ms = EXCLUDED.updated_ts_ms`,
          [auth.tenant_id, field_id, polygonGeojson, now_ms]
        );
      }

      await clientConn.query("COMMIT");
      return reply.send({ ok: true, field_id, updated_ts_ms: now_ms });
    } catch (e: any) {
      await clientConn.query("ROLLBACK");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) });
    } finally {
      clientConn.release();
    }
  }); // End PUT /api/v1/fields/:field_id.

  app.get("/api/v1/fields", async (req, reply) => { // List fields within the caller's tenant.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read"); // Require fields.read.
    if (!auth) return; // Auth helper responded.

    const limitRaw = Number((req.query as any)?.limit ?? 50); // Optional list limit.
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 50; // Clamp limit.

    const q = await pool.query( // Query field projection.
      `SELECT tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms
         FROM field_index_v1
        WHERE tenant_id = $1
        ORDER BY updated_ts_ms DESC
        LIMIT $2`,
      [auth.tenant_id, limit]
    ); // End query.

    return reply.send({ ok: true, fields: q.rows }); // Return list.
  }); // End GET /api/v1/fields.

  app.get("/api/v1/fields/:field_id/geometry", async (req, reply) => { // Return stable field geometry payload for GIS clients.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;

    const field_id = normalizeId((req.params as any)?.field_id);
    if (!field_id) return notFound(reply);

    const fieldQ = await pool.query(
      `SELECT field_id FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    );
    if (fieldQ.rowCount === 0) return notFound(reply);

    const polyQ = await pool.query(
      `SELECT geojson, updated_ts_ms
         FROM field_polygon_v1
        WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    );
    const rawGeo = parseJsonOrNull(polyQ.rows?.[0]?.geojson) ?? polyQ.rows?.[0]?.geojson ?? null;
    const geometry = normalizeGeometryObject(rawGeo);
    if (!geometry) return emptyGeometry(reply);
    const centroid = computeCentroid(geometry);
    const bbox = computeBBox(geometry);

    return reply.send({
      ok: true,
      field_id,
      geometry,
      centroid: centroid ? { type: "Point", coordinates: [centroid.lon, centroid.lat] } : null,
      bbox,
      geometry_updated_ts_ms: Number(polyQ.rows?.[0]?.updated_ts_ms ?? 0) || null,
    });
  });

  app.get("/api/v1/fields/:field_id", async (req, reply) => { // Get field detail including polygon, devices, seasons, and summary.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read"); // Require fields.read.
    if (!auth) return; // Auth helper responded.

    const field_id = normalizeId((req.params as any)?.field_id); // Parse field id.
    if (!field_id) return notFound(reply); // Invalid id => 404.

    const fieldQ = await pool.query( // Load field record.
      `SELECT tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms
         FROM field_index_v1
        WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    ); // End query.
    if (fieldQ.rowCount === 0) return notFound(reply); // Missing field => 404.

    const polyQ = await pool.query( // Load polygon if present.
      `SELECT geojson, updated_ts_ms
         FROM field_polygon_v1
        WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    ); // End query.

    const devQ = await pool.query( // Load bound devices with latest status projection.
      `SELECT b.device_id,
              b.bound_ts_ms,
              s.last_telemetry_ts_ms,
              s.last_heartbeat_ts_ms,
              s.battery_percent,
              s.rssi_dbm,
              s.fw_ver,
              s.updated_ts_ms,
              CASE
                WHEN s.last_heartbeat_ts_ms IS NOT NULL AND s.last_heartbeat_ts_ms >= $3 THEN 'ONLINE'
                ELSE 'STALE'
              END AS connection_status
         FROM device_binding_index_v1 b
         LEFT JOIN device_status_index_v1 s
           ON s.tenant_id = b.tenant_id AND s.device_id = b.device_id
        WHERE b.tenant_id = $1 AND b.field_id = $2
        ORDER BY b.bound_ts_ms DESC`,
      [auth.tenant_id, field_id, Date.now() - 15 * 60 * 1000]
    ); // End query.

    const seasonsQ = await pool.query( // Load field seasons.
      `SELECT season_id, name, crop, start_date, end_date, status, created_ts_ms, updated_ts_ms
         FROM field_season_index_v1
        WHERE tenant_id = $1 AND field_id = $2
        ORDER BY updated_ts_ms DESC`,
      [auth.tenant_id, field_id]
    ); // End query.

    const bound_devices = devQ.rows; // Alias detail rows for readability.
    const boundDeviceIds = bound_devices.map((row: any) => String(row.device_id ?? "")).filter(Boolean); // Field-bound device ids for downstream tabs.

    const alertQ = await pool.query( // Count active alert events targeting this field or its bound devices.
      `SELECT COUNT(*)::bigint AS active_alerts
         FROM alert_event_index_v1
        WHERE tenant_id = $1
          AND status IN ('OPEN', 'ACKED')
          AND (
            (object_type = 'FIELD' AND object_id = $2)
            OR (object_type = 'DEVICE' AND object_id = ANY($3::text[]))
          )`,
      [auth.tenant_id, field_id, boundDeviceIds.length ? boundDeviceIds : ["__none__"]]
    ); // End query.

    const seasons = seasonsQ.rows; // Alias season rows for readability.
    const latest_telemetry_ts_ms = bound_devices.reduce((max: number | null, row: any) => { // Compute latest telemetry across bound devices.
      const candidate = (typeof row.last_telemetry_ts_ms === "number" && Number.isFinite(row.last_telemetry_ts_ms)) ? row.last_telemetry_ts_ms : null; // Candidate ts.
      if (candidate == null) return max; // Ignore missing values.
      if (max == null) return candidate; // First value.
      return Math.max(max, candidate); // Keep latest value.
    }, null as number | null); // End reduce.
    const online_device_count = bound_devices.filter((row: any) => row.connection_status === "ONLINE").length; // Count online devices.

    const trendProjectionQ = boundDeviceIds.length > 0 ? await pool.query( // Prefer telemetry projection when available.
      `SELECT metric,
              (EXTRACT(EPOCH FROM date_trunc('hour', ts)) * 1000)::bigint AS bucket_ts_ms,
              AVG(value_num) AS avg_value_num
         FROM telemetry_index_v1
        WHERE tenant_id = $1
          AND device_id = ANY($2::text[])
          AND metric = ANY($3::text[])
          AND value_num IS NOT NULL
          AND ts >= NOW() - INTERVAL '24 hours'
        GROUP BY metric, date_trunc('hour', ts)
        ORDER BY bucket_ts_ms ASC`,
      [auth.tenant_id, boundDeviceIds, ["soil_moisture", "soil_temperature", "soil_temp", "soil_temp_c"]]
    ) : { rows: [] as any[] }; // End projection query.

    const trendFactQ = trendProjectionQ.rows.length > 0 || boundDeviceIds.length === 0 ? { rows: [] as any[] } : await pool.query( // Fallback to raw facts when projection has not materialized yet.
      `SELECT
          (record_json::jsonb #>> '{payload,metric}') AS metric,
          (((record_json::jsonb #>> '{payload,ts_ms}')::bigint / 3600000) * 3600000) AS bucket_ts_ms,
          AVG(((record_json::jsonb #>> '{payload,value}')::double precision)) AS avg_value_num
         FROM facts
        WHERE (record_json::jsonb ->> 'type') = 'raw_telemetry_v1'
          AND (record_json::jsonb #>> '{entity,tenant_id}') = $1
          AND (record_json::jsonb #>> '{entity,device_id}') = ANY($2::text[])
          AND (record_json::jsonb #>> '{payload,metric}') = ANY($3::text[])
          AND ((record_json::jsonb #>> '{payload,ts_ms}')::bigint) >= $4
        GROUP BY (record_json::jsonb #>> '{payload,metric}'), (((record_json::jsonb #>> '{payload,ts_ms}')::bigint / 3600000) * 3600000)
        ORDER BY bucket_ts_ms ASC`,
      [auth.tenant_id, boundDeviceIds, ["soil_moisture", "soil_temperature", "soil_temp", "soil_temp_c"], Date.now() - 24 * 60 * 60 * 1000]
    ); // End fallback query.

    const trendRows = trendProjectionQ.rows.length > 0 ? trendProjectionQ.rows : trendFactQ.rows; // Pick projection first, facts second.
    const normalizeMetric = (metric: string): string => (metric === "soil_temp_c" || metric === "soil_temp") ? "soil_temperature" : metric; // Merge temp aliases into canonical soil_temperature.
    const sensor_trends = { // Minimal field sensor tab payload.
      soil_moisture: trendRows.filter((row: any) => String(row.metric) === 'soil_moisture').map((row: any) => ({ ts_ms: Number(row.bucket_ts_ms), value_num: row.avg_value_num == null ? null : Number(row.avg_value_num) })),
      soil_temp: trendRows.filter((row: any) => normalizeMetric(String(row.metric)) === 'soil_temperature').map((row: any) => ({ ts_ms: Number(row.bucket_ts_ms), value_num: row.avg_value_num == null ? null : Number(row.avg_value_num) })),
    }; // End sensor trends.

    const recentAlertsQ = await pool.query( // Show field alerts plus alerts raised on bound devices.
      `SELECT event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms, acked_ts_ms, closed_ts_ms, last_value_json
         FROM alert_event_index_v1
        WHERE tenant_id = $1
          AND (
            (object_type = 'FIELD' AND object_id = $2)
            OR (object_type = 'DEVICE' AND object_id = ANY($3::text[]))
          )
        ORDER BY raised_ts_ms DESC
        LIMIT 10`,
      [auth.tenant_id, field_id, boundDeviceIds.length ? boundDeviceIds : ["__none__"]]
    ); // End alerts query.

    const recentTasksQ = boundDeviceIds.length > 0 ? await pool.query( // Load recent AO-ACT tasks targeting field-bound devices.
      `SELECT fact_id, occurred_at, (record_json::jsonb) AS task_json
         FROM facts
        WHERE (record_json::jsonb ->> 'type') = 'ao_act_task_v0'
          AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
          AND (record_json::jsonb #>> '{payload,project_id}') = $2
          AND (record_json::jsonb #>> '{payload,group_id}') = $3
          AND COALESCE((record_json::jsonb #>> '{payload,meta,device_id}'), '') = ANY($4::text[])
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 10`,
      [auth.tenant_id, auth.project_id, auth.group_id, boundDeviceIds]
    ) : { rows: [] as any[] }; // End task query.

    const mapMarkerFactsQ = boundDeviceIds.length > 0 ? await pool.query( // Best-effort latest geo markers from telemetry / heartbeat facts.
      `SELECT DISTINCT ON ((record_json::jsonb #>> '{entity,device_id}'))
          (record_json::jsonb #>> '{entity,device_id}') AS device_id,
          (record_json::jsonb ->> 'type') AS fact_type,
          COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
          (record_json::jsonb #> '{payload,geo}') AS geo_json,
          occurred_at
         FROM facts
        WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
          AND (record_json::jsonb #>> '{entity,device_id}') = ANY($2::text[])
          AND (
            (record_json::jsonb ->> 'type') = 'raw_telemetry_v1'
            OR (record_json::jsonb ->> 'type') = 'device_heartbeat_v1'
          )
          AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
        ORDER BY (record_json::jsonb #>> '{entity,device_id}'), COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) DESC, occurred_at DESC
        LIMIT 100`,
      [auth.tenant_id, boundDeviceIds]
    ) : { rows: [] as any[] }; // End geo marker query.

    const trajectoryFactsQ = boundDeviceIds.length > 0 ? await pool.query( // Build recent per-device trajectory from raw telemetry.
      `SELECT device_id, ts_ms, geo_json
         FROM (
           SELECT (record_json::jsonb #>> '{entity,device_id}') AS device_id,
                  COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
                  (record_json::jsonb #> '{payload,geo}') AS geo_json,
                  ROW_NUMBER() OVER (
                    PARTITION BY (record_json::jsonb #>> '{entity,device_id}')
                    ORDER BY COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) DESC, occurred_at DESC
                  ) AS rn
             FROM facts
            WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
              AND (record_json::jsonb #>> '{entity,device_id}') = ANY($2::text[])
              AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
              AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
              AND COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) >= $3
         ) ranked
        WHERE rn <= 1500
        ORDER BY device_id ASC, ts_ms ASC`,
      [auth.tenant_id, boundDeviceIds, Date.now() - 7 * 24 * 60 * 60 * 1000]
    ) : { rows: [] as any[] }; // End trajectory query.

    const heatRowsQ = await pool.query( // Aggregate recent alert density for the field map tab.
      `SELECT object_type, object_id, metric, COUNT(*)::int AS count, MAX(raised_ts_ms)::bigint AS last_raised_ts_ms
         FROM alert_event_index_v1
        WHERE tenant_id = $1
          AND raised_ts_ms >= $2
          AND (
            (object_type = 'FIELD' AND object_id = $3)
            OR (object_type = 'DEVICE' AND object_id = ANY($4::text[]))
          )
        GROUP BY object_type, object_id, metric
        ORDER BY count DESC, last_raised_ts_ms DESC
        LIMIT 20`,
      [auth.tenant_id, Date.now() - 7 * 24 * 60 * 60 * 1000, field_id, boundDeviceIds.length ? boundDeviceIds : ["__none__"]]
    ); // End heat query.

    const recentReceiptsQ = boundDeviceIds.length > 0 ? await pool.query( // Load recent AO-ACT receipts targeting field-bound devices.
      `SELECT fact_id, occurred_at, (record_json::jsonb) AS receipt_json
         FROM facts
        WHERE (record_json::jsonb ->> 'type') = 'ao_act_receipt_v0'
          AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
          AND (record_json::jsonb #>> '{payload,project_id}') = $2
          AND (record_json::jsonb #>> '{payload,group_id}') = $3
          AND COALESCE((record_json::jsonb #>> '{payload,meta,device_id}'), '') = ANY($4::text[])
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 10`,
      [auth.tenant_id, auth.project_id, auth.group_id, boundDeviceIds]
    ) : { rows: [] as any[] }; // End receipt query.

    const map_markers: FieldMapMarkerV1[] = (mapMarkerFactsQ.rows ?? []).map((row: any) => { // Normalize latest device markers.
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json); // Parse geo object.
      if (!geo) return null; // Skip malformed payloads.
      return { device_id: String(row.device_id ?? ''), lat: geo.lat, lon: geo.lon, source: String(row.fact_type ?? ''), ts_ms: Number(row.ts_ms ?? 0) || null }; // Normalized marker.
    }).filter(Boolean) as FieldMapMarkerV1[]; // Remove nulls.

    const heat_points: FieldMapHeatPointV1[] = (heatRowsQ.rows ?? []).map((row: any) => ({ // Normalize alert heat rows.
      object_id: String(row.object_id ?? ''),
      object_type: String(row.object_type ?? '').toUpperCase() === 'FIELD' ? 'FIELD' : 'DEVICE',
      metric: String(row.metric ?? ''),
      count: Number(row.count ?? 0),
      last_raised_ts_ms: Number(row.last_raised_ts_ms ?? 0),
    })); // End map heat points.

    const trajectoryByDevice = new Map<string, FieldTrajectoryPointV1[]>(); // Group trajectory points by device id.
    for (const row of trajectoryFactsQ.rows ?? []) {
      const device_id = String(row.device_id ?? '');
      if (!device_id) continue;
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
      const ts_ms = Number(row.ts_ms ?? 0);
      if (!geo || !Number.isFinite(ts_ms) || ts_ms <= 0) continue;
      const points = trajectoryByDevice.get(device_id) || [];
      points.push({ lat: geo.lat, lon: geo.lon, ts_ms });
      trajectoryByDevice.set(device_id, points);
    }

    const trajectories: FieldDeviceTrajectoryV1[] = Array.from(trajectoryByDevice.entries()).map(([device_id, points]) => ({
      device_id,
      points,
      geojson: toGeoJsonTrajectory(device_id, points),
    }));
    const trajectory_geojson = { type: "FeatureCollection", features: trajectories.map((t) => t.geojson) };

    const markerByDevice = new Map<string, FieldMapMarkerV1>();
    for (const marker of map_markers) markerByDevice.set(marker.device_id, marker);
    const fieldCentroid = computeCentroid(parseJsonOrNull(polyQ.rows?.[0]?.geojson) ?? polyQ.rows?.[0]?.geojson ?? null); // Derive a stable field-level fallback point from the polygon.
    const alert_heat_geojson = toHeatGeoJson(heat_points, markerByDevice, fieldCentroid);

    const trajectoryLookup = new Map<string, FieldDeviceTrajectoryV1>(); // Fast lookup for per-device trajectories.
    for (const trajectory of trajectories) trajectoryLookup.set(trajectory.device_id, trajectory);

    const recentReceipts = recentReceiptsQ.rows.map((row: any) => ({ // Normalize receipts for task association.
      fact_id: String(row.fact_id ?? ''),
      occurred_at_ms: Number(Date.parse(String(row.occurred_at ?? ''))) || null,
      receipt: parseJsonOrNull(row.receipt_json) ?? row.receipt_json,
    }));
    const latestReceiptByTaskId = new Map<string, { receipt: any; occurred_at_ms: number | null }>(); // Latest receipt keyed by act_task_id.
    for (const item of recentReceipts) {
      const act_task_id = String(item.receipt?.payload?.act_task_id ?? '').trim();
      if (!act_task_id) continue;
      if (!latestReceiptByTaskId.has(act_task_id)) latestReceiptByTaskId.set(act_task_id, { receipt: item.receipt, occurred_at_ms: item.occurred_at_ms });
    }

    const job_history = (recentTasksQ.rows ?? []).map((row: any, idx: number) => {
      const task = parseJsonOrNull(row.task_json) ?? row.task_json;
      const payload = task?.payload ?? {};
      const device_id = String(payload?.meta?.device_id ?? '');
      const act_task_id = String(payload?.act_task_id ?? '').trim();
      const taskOccurredAtMs = Number(Date.parse(String(row.occurred_at ?? ''))) || null;
      const receiptEntry = act_task_id ? latestReceiptByTaskId.get(act_task_id) ?? null : null;
      const timing = buildTaskTiming(task, receiptEntry?.receipt ?? null, taskOccurredAtMs);
      const trajectory = device_id ? trajectoryLookup.get(device_id) ?? null : null;
      const filteredPoints = trajectory ? filterTrajectoryPointsForWindow(trajectory.points, timing.start_ts_ms, timing.end_ts_ms, timing.anchor_ts_ms) : [];
      const nearestPoint = trajectory ? findNearestPoint(trajectory.points, timing.anchor_ts_ms, 6 * 60 * 60 * 1000) : null;
      return {
        id: String(row.fact_id ?? idx),
        act_task_id: act_task_id || null,
        task_type: payload?.task_type || payload?.action_type || 'AO-ACT',
        device_id: device_id || null,
        ts_ms: timing.anchor_ts_ms,
        start_ts_ms: timing.start_ts_ms,
        end_ts_ms: timing.end_ts_ms,
        timing_source: timing.source,
        location: nearestPoint ? { lat: nearestPoint.lat, lon: nearestPoint.lon, ts_ms: nearestPoint.ts_ms } : null,
        trajectory_points: filteredPoints.length,
        trajectory_window_start_ts_ms: filteredPoints.length > 0 ? filteredPoints[0].ts_ms : null,
        trajectory_window_end_ts_ms: filteredPoints.length > 0 ? filteredPoints[filteredPoints.length - 1].ts_ms : null,
      };
    });

    const rawGeo = parseJsonOrNull(polyQ.rows?.[0]?.geojson) ?? polyQ.rows?.[0]?.geojson ?? null;
    const geometry = normalizeGeometryObject(rawGeo);
    const geometryCentroid = geometry ? computeCentroid(geometry) : null;
    const geometryBbox = geometry ? computeBBox(geometry) : null;
    const refreshed = await refreshFieldReadModels(pool, {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      field_id,
    });

    return reply.send({ // Return detail payload.
      ok: true, // Success flag.
      field: fieldQ.rows[0], // Field projection.
      stage1_sensing_summary: refreshed.sensing_summary_stage1.payload, // Official customer-facing Stage-1 sensing summary for this field.
      stage1_sensing_contract: "stage1_sensing_summary_v1", // Stable contract identifier for client routing and schema checks.
      stage1_sensing_contract_scope: "customer-facing Stage-1 sensing source-of-truth", // Explicitly marks the authoritative Stage-1 sensing contract scope.
      stage1_sensing_refresh: { // Stage-1 refresh metadata kept separate from internal mixed read models.
        freshness: refreshed.sensing_summary_stage1.freshness,
        status: refreshed.sensing_summary_stage1.status,
        refreshed_ts_ms: refreshed.sensing_summary_stage1.refreshed_ts_ms,
      },
      stage1_sensing_non_contract_aggregates: [
        "summary",
        "sensor_trends",
        "recent_alerts",
        "map_layers",
      ], // Field-detail aggregates for UI tabs only; not part of Stage-1 sensing source-of-truth contract.
      stage1_sensing_non_contract_note:
        "summary, sensor_trends, recent_alerts, and map_layers are field-detail aggregates and not Stage-1 sensing source-of-truth.",
      polygon: polyQ.rowCount ? { ...polyQ.rows[0], geojson_json: parseJsonOrNull(polyQ.rows[0].geojson) } : null, // Polygon detail with parsed JSON convenience field.
      geometry: geometry ? {
        type: geometry.type,
        coordinates: geometry.coordinates,
        centroid: geometryCentroid ? { type: "Point", coordinates: [geometryCentroid.lon, geometryCentroid.lat] } : null,
        bbox: geometryBbox,
      } : null,
      bound_devices, // Device rows.
      seasons, // Field seasons.
      sensor_trends, // Sensor tab payload.
      recent_alerts: recentAlertsQ.rows, // Alert tab payload.
      recent_tasks: recentTasksQ.rows.map((row: any) => ({ fact_id: String(row.fact_id), occurred_at: String(row.occurred_at), task: parseJsonOrNull(row.task_json) ?? row.task_json })), // Job tab tasks.
      recent_receipts: recentReceiptsQ.rows.map((row: any) => ({ fact_id: String(row.fact_id), occurred_at: String(row.occurred_at), receipt: parseJsonOrNull(row.receipt_json) ?? row.receipt_json, device_id: ((parseJsonOrNull(row.receipt_json) ?? row.receipt_json)?.payload?.meta?.device_id ?? null) })), // Job tab receipts.
      map_layers: { markers: map_markers, heat_points, telemetry_geo_enabled: map_markers.length > 0, trajectories, trajectory_geojson, alert_heat_geojson, job_history }, // Map tab payload from latest geo + recent alert density + trajectories/history.
      summary: { // Aggregated summary for commercial UI.
        device_count: bound_devices.length, // Total bound devices.
        online_device_count, // Online device count.
        active_alerts: Number(alertQ.rows?.[0]?.active_alerts ?? 0), // Open or acked alerts.
        latest_telemetry_ts_ms, // Latest telemetry ts across devices.
      }, // End summary.
    }); // End response.
  }); // End GET /api/v1/fields/:field_id.

  // Official Stage-1 customer-facing sensing contract for fields 子域。
  // Field detail/product/sales integrations should consume this endpoint instead of mixed read-model payloads.
  app.get("/api/v1/fields/:field_id/sensing-summary", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;

    const field_id = normalizeId((req.params as any)?.field_id);
    if (!field_id) return notFound(reply);

    const fieldQ = await pool.query(
      `SELECT 1
         FROM field_index_v1
        WHERE tenant_id = $1
          AND field_id = $2`,
      [auth.tenant_id, field_id]
    );
    if (fieldQ.rowCount === 0) return notFound(reply);

    const refreshed = await refreshFieldReadModels(pool, {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      field_id,
    });

    return reply.send({
      ok: true,
      field_id,
      endpoint_contract: "stage1_sensing_summary_v1",
      contract_scope: "customer-facing Stage-1 sensing source-of-truth",
      customer_facing_stage1_contract: true,
      stage1_sensing_summary: refreshed.sensing_summary_stage1.payload,
      stage1_refresh: {
        freshness: refreshed.sensing_summary_stage1.freshness,
        status: refreshed.sensing_summary_stage1.status,
        refreshed_ts_ms: refreshed.sensing_summary_stage1.refreshed_ts_ms,
      },
      refresh_semantics: STAGE1_REFRESH_SEMANTICS,
      sensing_runtime_boundary: STAGE1_RUNTIME_DIAGNOSTIC_BOUNDARY,
    });
  });

  // Internal/debug/compatibility endpoint for mixed read-model payloads.
  // Even though sensing_summary_stage1 is included for diagnosis/compatibility, this route is explicitly non-authoritative.
  // Not customer-facing Stage-1 contract; frontend/product MUST NOT use this as formal sensing source-of-truth.
  app.get("/api/v1/fields/:field_id/sensing-read-models", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;

    const field_id = normalizeId((req.params as any)?.field_id);
    if (!field_id) return notFound(reply);

    const fieldQ = await pool.query(
      `SELECT 1
         FROM field_index_v1
        WHERE tenant_id = $1
          AND field_id = $2`,
      [auth.tenant_id, field_id]
    );
    if (fieldQ.rowCount === 0) return notFound(reply);

    const refreshed = await refreshFieldReadModels(pool, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        field_id,
      });

    return reply.send({
      ok: true,
      field_id,
      endpoint_contract: "internal_sensing_read_models_v1",
      contract_scope: "internal/debug/compatibility only (non-authoritative; not source-of-truth)",
      customer_facing_stage1_contract: false,
      sensing_overview: refreshed.sensing_overview.payload,
      sensing_summary_stage1: refreshed.sensing_summary_stage1.payload,
      fertility_state: refreshed.fertility_state.payload,
      freshness: {
        sensing_overview: refreshed.sensing_overview.freshness,
        sensing_summary_stage1: refreshed.sensing_summary_stage1.freshness,
        fertility_state: refreshed.fertility_state.freshness,
      },
      status: {
        sensing_overview: refreshed.sensing_overview.status,
        sensing_summary_stage1: refreshed.sensing_summary_stage1.status,
        fertility_state: refreshed.fertility_state.status,
      },
      refresh_metrics: {
        sensing_overview: refreshed.sensing_overview.refresh_metrics,
        sensing_summary_stage1: refreshed.sensing_summary_stage1.refresh_metrics,
        fertility_state: refreshed.fertility_state.refresh_metrics,
      },
      refresh_tracking: {
        sensing_overview: refreshed.sensing_overview.refresh_tracking,
        sensing_summary_stage1: refreshed.sensing_summary_stage1.refresh_tracking,
        fertility_state: refreshed.fertility_state.refresh_tracking,
      },
      refresh_state: {
        sensing_overview: refreshed.sensing_overview.refresh_tracking,
        sensing_summary_stage1: refreshed.sensing_summary_stage1.refresh_tracking,
        fertility_state: refreshed.fertility_state.refresh_tracking,
      },
    });
  });

  app.get("/api/v1/devices/:device_id/positions", async (req, reply) => { // Return normalized device_position_v1 list.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;
    const device_id = normalizeId((req.params as any)?.device_id);
    if (!device_id) return notFound(reply);
    const sinceTsMsRaw = Number((req.query as any)?.since_ts_ms ?? (Date.now() - 24 * 60 * 60 * 1000));
    const since_ts_ms = Number.isFinite(sinceTsMsRaw) ? sinceTsMsRaw : (Date.now() - 24 * 60 * 60 * 1000);
    const limitRaw = Number((req.query as any)?.limit ?? 1000);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5000, Math.trunc(limitRaw))) : 1000;

    const q = await pool.query(
      `SELECT
          COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
          (record_json::jsonb #> '{payload,geo}') AS geo_json,
          (record_json::jsonb #>> '{payload,speed_mps}') AS speed_mps,
          (record_json::jsonb #>> '{payload,heading_deg}') AS heading_deg
         FROM facts
        WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
          AND (record_json::jsonb #>> '{entity,project_id}') = $2
          AND (record_json::jsonb #>> '{entity,group_id}') = $3
          AND (record_json::jsonb #>> '{entity,device_id}') = $4
          AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
          AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
          AND COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) >= $5
        ORDER BY ts_ms DESC
        LIMIT ${limit}`,
      [auth.tenant_id, auth.project_id, auth.group_id, device_id, since_ts_ms]
    );
    const positions = (q.rows ?? []).map((row: any) => {
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
      if (!geo) return null;
      return {
        type: "device_position_v1",
        payload: {
          tenant_id: auth.tenant_id,
          project_id: auth.project_id,
          group_id: auth.group_id,
          device_id,
          ts: Number(row.ts_ms ?? 0),
          point: { type: "Point", coordinates: [geo.lon, geo.lat] },
          speed_mps: row.speed_mps == null ? null : Number(row.speed_mps),
          heading_deg: row.heading_deg == null ? null : Number(row.heading_deg),
        }
      };
    }).filter(Boolean);

    return reply.send({ ok: true, device_id, items: positions.reverse() });
  });

  app.get("/api/v1/fields/:field_id/device-positions", async (req, reply) => { // Return latest positions for field-bound devices.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;
    const field_id = normalizeId((req.params as any)?.field_id);
    if (!field_id) return notFound(reply);
    const fieldQ = await pool.query(`SELECT field_id FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`, [auth.tenant_id, field_id]);
    if (fieldQ.rowCount === 0) return notFound(reply);

    const devQ = await pool.query(
      `SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = $2 ORDER BY bound_ts_ms DESC`,
      [auth.tenant_id, field_id]
    );
    const deviceIds = (devQ.rows ?? []).map((row: any) => String(row.device_id ?? "")).filter(Boolean);
    if (!deviceIds.length) return reply.send({ ok: true, field_id, items: [] });

    const q = await pool.query(
      `SELECT DISTINCT ON ((record_json::jsonb #>> '{entity,device_id}'))
          (record_json::jsonb #>> '{entity,device_id}') AS device_id,
          COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
          (record_json::jsonb #> '{payload,geo}') AS geo_json
        FROM facts
       WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
         AND (record_json::jsonb #>> '{entity,device_id}') = ANY($2::text[])
         AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
         AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
       ORDER BY (record_json::jsonb #>> '{entity,device_id}'), ts_ms DESC, occurred_at DESC`,
      [auth.tenant_id, deviceIds]
    );
    const items = (q.rows ?? []).map((row: any) => {
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
      if (!geo) return null;
      return {
        type: "device_position_v1",
        payload: {
          tenant_id: auth.tenant_id,
          project_id: auth.project_id,
          group_id: auth.group_id,
          field_id,
          device_id: String(row.device_id),
          ts: Number(row.ts_ms ?? 0),
          point: { type: "Point", coordinates: [geo.lon, geo.lat] },
        }
      };
    }).filter(Boolean);
    return reply.send({ ok: true, field_id, items });
  });

  app.get("/api/v1/fields/:field_id/trajectories", async (req, reply) => { // Aggregate recent operation_trajectory_v1 by field devices.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;
    const field_id = normalizeId((req.params as any)?.field_id);
    if (!field_id) return notFound(reply);
    const devQ = await pool.query(`SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = $2`, [auth.tenant_id, field_id]);
    const deviceIds = (devQ.rows ?? []).map((r: any) => String(r.device_id ?? "")).filter(Boolean);
    if (!deviceIds.length) return reply.send({ ok: true, field_id, items: [] });
    const sinceTsMsRaw = Number((req.query as any)?.since_ts_ms ?? (Date.now() - 24 * 60 * 60 * 1000));
    const since_ts_ms = Number.isFinite(sinceTsMsRaw) ? sinceTsMsRaw : (Date.now() - 24 * 60 * 60 * 1000);
    const q = await pool.query(
      `SELECT (record_json::jsonb #>> '{entity,device_id}') AS device_id,
              COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
              (record_json::jsonb #> '{payload,geo}') AS geo_json
         FROM facts
        WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
          AND (record_json::jsonb #>> '{entity,device_id}') = ANY($2::text[])
          AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
          AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
          AND COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) >= $3
        ORDER BY device_id ASC, ts_ms ASC`,
      [auth.tenant_id, deviceIds, since_ts_ms]
    );
    const byDevice = new Map<string, Array<[number, number]>>();
    for (const row of q.rows ?? []) {
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
      const device_id = String(row.device_id ?? "");
      if (!geo || !device_id) continue;
      const points = byDevice.get(device_id) ?? [];
      points.push([geo.lon, geo.lat]);
      byDevice.set(device_id, points);
    }
    const items = Array.from(byDevice.entries()).map(([device_id, coordinates]) => ({
      type: "operation_trajectory_v1",
      payload: {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        field_id,
        device_id,
        line: { type: "LineString", coordinates },
        point_count: coordinates.length,
      }
    }));
    return reply.send({ ok: true, field_id, items });
  });

  app.get("/api/v1/tasks/:act_task_id/trajectory", async (req, reply) => { // Build task trajectory from task timing + device telemetry.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const act_task_id = normalizeId((req.params as any)?.act_task_id);
    if (!act_task_id) return notFound(reply);
    const taskQ = await pool.query(
      `SELECT occurred_at, (record_json::jsonb) AS task_json
         FROM facts
        WHERE (record_json::jsonb ->> 'type') = 'ao_act_task_v0'
          AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
          AND (record_json::jsonb #>> '{payload,project_id}') = $2
          AND (record_json::jsonb #>> '{payload,group_id}') = $3
          AND (record_json::jsonb #>> '{payload,act_task_id}') = $4
        ORDER BY occurred_at DESC LIMIT 1`,
      [auth.tenant_id, auth.project_id, auth.group_id, act_task_id]
    );
    if (!taskQ.rows?.length) return notFound(reply);
    const task = parseJsonOrNull(taskQ.rows[0].task_json) ?? taskQ.rows[0].task_json;
    const payload = task?.payload ?? {};
    const device_id = String(payload?.meta?.device_id ?? payload?.device_id ?? "").trim();
    if (!device_id) return reply.status(422).send({ ok: false, error: "TASK_DEVICE_NOT_BOUND" });
    const start_ts_ms = Number(payload?.time_window?.start_ts ?? 0) || (Number(Date.parse(String(taskQ.rows[0].occurred_at))) || 0);
    const end_ts_ms = Number(payload?.time_window?.end_ts ?? 0) || (start_ts_ms + 2 * 60 * 60 * 1000);
    const q = await pool.query(
      `SELECT COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
              (record_json::jsonb #> '{payload,geo}') AS geo_json
         FROM facts
        WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
          AND (record_json::jsonb #>> '{entity,device_id}') = $2
          AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
          AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
          AND COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) BETWEEN $3 AND $4
        ORDER BY ts_ms ASC`,
      [auth.tenant_id, device_id, start_ts_ms, end_ts_ms]
    );
    const coordinates: Array<[number, number]> = [];
    for (const row of q.rows ?? []) {
      const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
      if (!geo) continue;
      coordinates.push([geo.lon, geo.lat]);
    }
    if (coordinates.length === 0) {
      const fallbackQ = await pool.query(
        `SELECT COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, (EXTRACT(EPOCH FROM occurred_at) * 1000)::bigint) AS ts_ms,
                (record_json::jsonb #> '{payload,geo}') AS geo_json
           FROM facts
          WHERE (record_json::jsonb #>> '{entity,tenant_id}') = $1
            AND (record_json::jsonb #>> '{entity,device_id}') = $2
            AND (record_json::jsonb ->> 'type') IN ('raw_telemetry_v1', 'device_heartbeat_v1')
            AND (record_json::jsonb #> '{payload,geo}') IS NOT NULL
          ORDER BY ts_ms DESC
          LIMIT 500`,
        [auth.tenant_id, device_id]
      );
      for (const row of (fallbackQ.rows ?? []).reverse()) {
        const geo = normalizeGeoPoint(parseJsonOrNull(row.geo_json) ?? row.geo_json);
        if (!geo) continue;
        coordinates.push([geo.lon, geo.lat]);
      }
    }
    return reply.send({
      ok: true,
      act_task_id,
      trajectory: {
        type: "operation_trajectory_v1",
        payload: {
          tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id,
          act_task_id, operation_plan_id: payload?.operation_plan_id ?? null, program_id: payload?.program_id ?? null,
          field_id: payload?.field_id ?? null, device_id, line: { type: "LineString", coordinates },
          start_ts: start_ts_ms, end_ts: end_ts_ms, point_count: coordinates.length,
        }
      }
    });
  });

  app.post("/api/v1/fields/:field_id/polygon", async (req, reply) => { // Set or update a field polygon.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.write"); // Require fields.write.
    if (!auth) return; // Auth helper responded.

    const field_id = normalizeId((req.params as any)?.field_id); // Parse field id.
    if (!field_id) return notFound(reply); // Invalid => 404.

    const geojson = normalizeGeoJsonText((req as any).body); // Accept raw body as object or JSON string.
    if (!geojson) return badRequest(reply, "MISSING_OR_INVALID:geojson"); // Validate body.

    const existsQ = await pool.query( // Confirm field exists in tenant.
      `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    ); // End query.
    if (existsQ.rowCount === 0) return notFound(reply); // Missing field => 404.

    const now_ms = Date.now(); // Server time.
    const occurredAtIso = new Date(now_ms).toISOString(); // occurred_at.
    const stable_id = sha256Hex(`field_polygon_set_v1|${auth.tenant_id}|${field_id}|${geojson}`); // Deterministic id per polygon payload.
    const fact_id = `fieldpoly_${stable_id}`; // Fact id.

    const record = { // Ledger record.
      type: "field_polygon_set_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, field_id }, // Entity envelope.
      payload: { geojson, updated_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Transaction.
      await clientConn.query("BEGIN"); // Begin tx.

      await clientConn.query( // Insert fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert polygon projection.
        `INSERT INTO field_polygon_v1 (tenant_id, field_id, geojson, updated_ts_ms)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, field_id) DO UPDATE SET
           geojson = EXCLUDED.geojson,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, field_id, geojson, now_ms]
      ); // End upsert.

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true }); // Respond ok.
    } catch (e: any) { // Error.
      await clientConn.query("ROLLBACK"); // Roll back changes.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // Return 500.
    } finally { // Always release.
      clientConn.release(); // Release connection.
    } // End try/finally.
  }); // End POST /api/v1/fields/:field_id/polygon.

  app.post("/api/v1/fields/:field_id/seasons", async (req, reply) => { // Create or update a minimal field season.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.write"); // Require fields.write.
    if (!auth) return; // Auth helper responded.

    const field_id = normalizeId((req.params as any)?.field_id); // Parse field id.
    if (!field_id) return notFound(reply); // Invalid => 404.

    const body: any = (req as any).body ?? {}; // Parse body.
    const season_id = normalizeId(body.season_id); // Required season id.
    if (!season_id) return badRequest(reply, "MISSING_OR_INVALID:season_id"); // Validate season id.

    const name = normalizeName(body.name, 256); // Required season name.
    if (!name) return badRequest(reply, "MISSING_OR_INVALID:name"); // Validate season name.

    const crop = normalizeName(body.crop, 128); // Optional crop label.
    const start_date = normalizeDateOnly(body.start_date); // Optional start date.
    const end_date = normalizeDateOnly(body.end_date); // Optional end date.
    const status = normalizeSeasonStatus(body.status); // Optional lifecycle status.
    if (!status) return badRequest(reply, "MISSING_OR_INVALID:status"); // Validate status.
    if (start_date && end_date && start_date > end_date) return badRequest(reply, "INVALID_RANGE:start_date>end_date"); // Enforce basic date range sanity.

    const fieldQ = await pool.query( // Confirm target field exists in tenant.
      `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    ); // End query.
    if (fieldQ.rowCount === 0) return notFound(reply); // Missing field => 404.

    const now_ms = Date.now(); // Server time.
    const occurredAtIso = new Date(now_ms).toISOString(); // occurred_at.
    const stable_id = sha256Hex(`field_season_upsert_v1|${auth.tenant_id}|${field_id}|${season_id}|${name}|${crop ?? ""}|${start_date ?? ""}|${end_date ?? ""}|${status}`); // Deterministic id per final season content.
    const fact_id = `fieldseason_${stable_id}`; // Fact id.

    const record = { // Append-only fact record.
      type: "field_season_upserted_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, field_id, season_id }, // Entity envelope.
      payload: { // Payload.
        name, // Season name.
        crop, // Optional crop.
        start_date, // Optional start date.
        end_date, // Optional end date.
        status, // Lifecycle state.
        updated_ts_ms: now_ms, // Update time.
        actor_id: auth.actor_id, // Audit actor.
        token_id: auth.token_id, // Audit token.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Transaction.
      await clientConn.query("BEGIN"); // Begin tx.

      const existingQ = await clientConn.query( // Check whether season already exists for created_ts_ms preservation.
        `SELECT created_ts_ms FROM field_season_index_v1
          WHERE tenant_id = $1 AND field_id = $2 AND season_id = $3`,
        [auth.tenant_id, field_id, season_id]
      ); // End query.
      const created_ts_ms = (typeof existingQ.rows?.[0]?.created_ts_ms === "number" && Number.isFinite(existingQ.rows[0].created_ts_ms)) ? existingQ.rows[0].created_ts_ms : now_ms; // Preserve creation time on updates.

      await clientConn.query( // Insert append-only fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert season projection.
        `INSERT INTO field_season_index_v1 (tenant_id, field_id, season_id, name, crop, start_date, end_date, status, created_ts_ms, updated_ts_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, field_id, season_id) DO UPDATE SET
           name = EXCLUDED.name,
           crop = EXCLUDED.crop,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           status = EXCLUDED.status,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, field_id, season_id, name, crop, start_date, end_date, status, created_ts_ms, now_ms]
      ); // End upsert.

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true, field_id, season_id }); // Return updated season id.
    } catch (e: any) { // Error path.
      await clientConn.query("ROLLBACK"); // Roll back transaction.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // Return 500.
    } finally { // Always release.
      clientConn.release(); // Release connection.
    } // End try/finally.
  }); // End POST /api/v1/fields/:field_id/seasons.

  app.get("/api/v1/fields/:field_id/seasons", async (req, reply) => { // List seasons for a field.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "fields.read"); // Require fields.read.
    if (!auth) return; // Auth helper responded.

    const field_id = normalizeId((req.params as any)?.field_id); // Parse field id.
    if (!field_id) return notFound(reply); // Invalid => 404.

    const fieldQ = await pool.query( // Confirm field exists under tenant.
      `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    ); // End query.
    if (fieldQ.rowCount === 0) return notFound(reply); // Missing => 404.

    const q = await pool.query( // Load seasons.
      `SELECT season_id, name, crop, start_date, end_date, status, created_ts_ms, updated_ts_ms
         FROM field_season_index_v1
        WHERE tenant_id = $1 AND field_id = $2
        ORDER BY updated_ts_ms DESC`,
      [auth.tenant_id, field_id]
    ); // End query.

    return reply.send({ ok: true, field_id, seasons: q.rows }); // Return season list.
  }); // End GET /api/v1/fields/:field_id/seasons.

  app.post("/api/v1/devices/:device_id/bind-field", async (req, reply) => { // Bind a device to a field.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "devices.bind"); // Require devices.bind scope.
    if (!auth) return; // Auth helper responded.

    const device_id = normalizeId((req.params as any)?.device_id); // Parse device id.
    if (!device_id) return notFound(reply); // Invalid => 404.

    const body: any = (req as any).body ?? {}; // Parse body.
    const field_id = normalizeId(body.field_id); // Parse field id.
    if (!field_id) return badRequest(reply, "MISSING_OR_INVALID:field_id"); // Validate field id.

    const devQ = await pool.query( // Confirm device exists in tenant.
      `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2`,
      [auth.tenant_id, device_id]
    ); // End query.
    if (devQ.rowCount === 0) return notFound(reply); // Missing device => 404.

    const fieldQ = await pool.query( // Confirm field exists in tenant.
      `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, field_id]
    ); // End query.
    if (fieldQ.rowCount === 0) return notFound(reply); // Missing field => 404.

    const now_ms = Date.now(); // Server time.
    const occurredAtIso = new Date(now_ms).toISOString(); // occurred_at.
    const stable_id = sha256Hex(`device_bound_to_field_v1|${auth.tenant_id}|${device_id}|${field_id}`); // Deterministic binding id.
    const fact_id = `bind_${stable_id}`; // Fact id.

    const record = { // Ledger record.
      type: "device_bound_to_field_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, device_id, field_id }, // Entity envelope.
      payload: { bound_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Transaction.
      await clientConn.query("BEGIN"); // Begin tx.

      await clientConn.query( // Insert append-only fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)
         ON CONFLICT (fact_id) DO NOTHING`,
        [fact_id, occurredAtIso, "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert current device binding.
        `INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, device_id) DO UPDATE SET
           field_id = EXCLUDED.field_id,
           bound_ts_ms = EXCLUDED.bound_ts_ms`,
        [auth.tenant_id, device_id, field_id, now_ms]
      ); // End upsert.
      await reconcileDeviceTemplateSkillBindingsV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        device_id,
        missing_required_mode: "autofill",
      });

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true, device_id, field_id }); // Return binding result.
    } catch (e: any) { // Error path.
      await clientConn.query("ROLLBACK"); // Roll back transaction.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // Return 500.
    } finally { // Always release.
      clientConn.release(); // Release connection.
    } // End try/finally.
  }); // End POST /api/v1/devices/:device_id/bind-field.
} // End registerFieldsV1Routes.
