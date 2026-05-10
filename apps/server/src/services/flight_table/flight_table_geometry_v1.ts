import crypto from "node:crypto";
import type { Pool } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import type { FlightTableRunV1 } from "./flight_table_manifest_v1.js";

export type FlightTableWeatherLocationV1 = {
  lat: number;
  lng: number;
};

export type FlightTableGeometryInputV1 = {
  field_id?: string;
  geometry_format?: string;
  geometry?: unknown;
  weather_location?: FlightTableWeatherLocationV1 | null;
};

export type FlightTableGeometryVerificationV1 = {
  ok: true;
  field_id: string;
  geometry_id: string;
  geometry_status: "AVAILABLE" | "MISSING" | "INVALID";
  geometry_format: "GEOJSON";
  geometry: Record<string, unknown>;
  centroid: { lat: number; lng: number };
  area_m2: number | null;
  area_mu: number | null;
  weather_location: FlightTableWeatherLocationV1 | null;
  weather_provider_status: "UNAVAILABLE";
  weather_location_status: "LOCATION_RECORDED" | "LOCATION_UNAVAILABLE";
  fact_id: string;
};

type GeoPoint = { lat: number; lng: number };

type NormalizedGeometry = {
  geometry: Record<string, unknown>;
  coordinatesForArea: Array<[number, number]>;
  centroid: GeoPoint;
  area_m2: number | null;
};

function isSafeId(input: unknown): input is string {
  return typeof input === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(input.trim());
}

function sha256Hex(seed: string): string {
  return crypto.createHash("sha256").update(seed, "utf8").digest("hex");
}

function readCoordinates(node: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(node) || node.length === 0) return;
  if (node.length >= 2 && Number.isFinite(Number(node[0])) && Number.isFinite(Number(node[1]))) {
    const lng = Number(node[0]);
    const lat = Number(node[1]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) out.push([lng, lat]);
    return;
  }
  for (const child of node) readCoordinates(child, out);
}

function unwrapGeometry(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const type = String(obj.type ?? "");
  if (type === "Feature") return unwrapGeometry(obj.geometry);
  if (type === "FeatureCollection") {
    const features = Array.isArray(obj.features) ? obj.features : [];
    for (const feature of features) {
      const geometry = unwrapGeometry(feature);
      if (geometry) return geometry;
    }
    return null;
  }
  if ((type === "Polygon" || type === "MultiPolygon") && Array.isArray(obj.coordinates)) {
    return { type, coordinates: obj.coordinates };
  }
  return null;
}

function firstPolygonRing(geometry: Record<string, unknown>): Array<[number, number]> {
  const type = String(geometry.type ?? "");
  const coordinates = geometry.coordinates as unknown;
  if (type === "Polygon" && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    const ring: Array<[number, number]> = [];
    readCoordinates(coordinates[0], ring);
    return ring;
  }
  if (type === "MultiPolygon" && Array.isArray(coordinates) && Array.isArray(coordinates[0]) && Array.isArray((coordinates[0] as unknown[])[0])) {
    const ring: Array<[number, number]> = [];
    readCoordinates((coordinates[0] as unknown[])[0], ring);
    return ring;
  }
  return [];
}

function centroidFromPoints(points: Array<[number, number]>): GeoPoint | null {
  if (!points.length) return null;
  const sum = points.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return {
    lat: Number((sum.lat / points.length).toFixed(6)),
    lng: Number((sum.lng / points.length).toFixed(6)),
  };
}

function approximateAreaM2(ring: Array<[number, number]>): number | null {
  if (ring.length < 4) return null;
  const centroid = centroidFromPoints(ring);
  if (!centroid) return null;
  const latRad = centroid.lat * Math.PI / 180;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = Math.cos(latRad) * 111_320;
  const xy = ring.map(([lng, lat]) => ({ x: lng * metersPerDegLng, y: lat * metersPerDegLat }));
  let twiceArea = 0;
  for (let i = 0; i < xy.length; i += 1) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  const area = Math.abs(twiceArea) / 2;
  return Number.isFinite(area) && area > 0 ? Number(area.toFixed(2)) : null;
}

function normalizeWeatherLocation(input: unknown): FlightTableWeatherLocationV1 | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng ?? raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export function normalizeFlightTableGeometryInputV1(input: FlightTableGeometryInputV1): {
  field_id: string;
  geometry_format: "GEOJSON";
  geometry: Record<string, unknown>;
  weather_location: FlightTableWeatherLocationV1 | null;
} {
  const field_id = isSafeId(input.field_id) ? input.field_id.trim() : null;
  if (!field_id) throw new Error("FLIGHT_TABLE_INVALID_FIELD_ID");
  const geometry_format = String(input.geometry_format ?? "").trim().toUpperCase();
  if (geometry_format !== "GEOJSON") throw new Error("FLIGHT_TABLE_INVALID_GEOMETRY_FORMAT");
  const geometry = unwrapGeometry(input.geometry);
  if (!geometry) throw new Error("FLIGHT_TABLE_INVALID_GEOMETRY");
  const points: Array<[number, number]> = [];
  readCoordinates((geometry as any).coordinates, points);
  if (points.length < 4) throw new Error("FLIGHT_TABLE_EMPTY_GEOMETRY");
  return { field_id, geometry_format: "GEOJSON", geometry, weather_location: normalizeWeatherLocation(input.weather_location) };
}

function normalizeGeometry(geometry: Record<string, unknown>): NormalizedGeometry {
  const allPoints: Array<[number, number]> = [];
  readCoordinates((geometry as any).coordinates, allPoints);
  const centroid = centroidFromPoints(allPoints);
  if (!centroid) throw new Error("FLIGHT_TABLE_EMPTY_GEOMETRY");
  const ring = firstPolygonRing(geometry);
  const area_m2 = approximateAreaM2(ring);
  return { geometry, coordinatesForArea: ring, centroid, area_m2 };
}

async function ensureFieldPolygonProjectionV1(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS field_polygon_v1 (
       tenant_id TEXT NOT NULL,
       field_id TEXT NOT NULL,
       polygon_geojson_json TEXT NOT NULL,
       area_m2 DOUBLE PRECISION NULL,
       created_ts_ms BIGINT NULL,
       updated_ts_ms BIGINT NULL,
       PRIMARY KEY (tenant_id, field_id)
     )`,
  );
}

export async function createFlightTableFieldGeometryV1(
  pool: Pool,
  run: FlightTableRunV1,
  input: FlightTableGeometryInputV1,
  auth: AoActAuthContextV0,
): Promise<FlightTableGeometryVerificationV1> {
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) {
    throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  }

  const normalizedInput = normalizeFlightTableGeometryInputV1(input);
  const normalizedGeometry = normalizeGeometry(normalizedInput.geometry);
  const now_ms = Date.now();
  const fact_id = `field_geometry_${sha256Hex(`field_geometry_upserted_v1|${auth.tenant_id}|${normalizedInput.field_id}|${now_ms}`)}`;
  const geometry_id = `geom_${normalizedInput.field_id}`;
  const area_m2 = normalizedGeometry.area_m2;
  const area_ha = area_m2 == null ? null : area_m2 / 10000;
  const area_mu = area_m2 == null ? null : Number((area_m2 / 666.6666667).toFixed(4));
  const geometryJson = JSON.stringify(normalizedGeometry.geometry);

  await ensureFieldPolygonProjectionV1(pool);
  const fieldQ = await pool.query(
    `SELECT field_id FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`,
    [auth.tenant_id, normalizedInput.field_id],
  );
  if ((fieldQ.rowCount ?? 0) === 0) throw new Error("FLIGHT_TABLE_FIELD_NOT_FOUND");

  const record = {
    type: "field_geometry_upserted_v1",
    entity: { tenant_id: auth.tenant_id, field_id: normalizedInput.field_id, geometry_id },
    payload: {
      geometry_format: normalizedInput.geometry_format,
      geometry: normalizedGeometry.geometry,
      area_m2,
      centroid: normalizedGeometry.centroid,
      weather_location: normalizedInput.weather_location,
      weather_provider_status: "UNAVAILABLE",
      source_run_id: run.run_id,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      updated_ts_ms: now_ms,
    },
  };

  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, $2::timestamptz, $3, $4)
       ON CONFLICT (fact_id) DO NOTHING`,
      [fact_id, new Date(now_ms).toISOString(), "control", JSON.stringify(record)],
    );
    await conn.query(
      `INSERT INTO field_polygon_v1 (tenant_id, field_id, polygon_geojson_json, area_m2, created_ts_ms, updated_ts_ms)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (tenant_id, field_id) DO UPDATE SET
         polygon_geojson_json = EXCLUDED.polygon_geojson_json,
         area_m2 = EXCLUDED.area_m2,
         updated_ts_ms = EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, normalizedInput.field_id, geometryJson, area_m2, now_ms],
    );
    await conn.query(
      `UPDATE field_index_v1
          SET geojson_json = $3,
              area_m2 = COALESCE($4, area_m2),
              area_ha = COALESCE($5, area_ha),
              updated_ts_ms = $6
        WHERE tenant_id = $1 AND field_id = $2`,
      [auth.tenant_id, normalizedInput.field_id, geometryJson, area_m2, area_ha, now_ms],
    );
    await conn.query("COMMIT");
  } catch (err) {
    try { await conn.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    conn.release();
  }

  return {
    ok: true,
    field_id: normalizedInput.field_id,
    geometry_id,
    geometry_status: "AVAILABLE",
    geometry_format: "GEOJSON",
    geometry: normalizedGeometry.geometry,
    centroid: normalizedGeometry.centroid,
    area_m2,
    area_mu,
    weather_location: normalizedInput.weather_location,
    weather_provider_status: "UNAVAILABLE",
    weather_location_status: normalizedInput.weather_location ? "LOCATION_RECORDED" : "LOCATION_UNAVAILABLE",
    fact_id,
  };
}

export async function verifyFlightTableFieldGeometryV1(
  pool: Pool,
  auth: AoActAuthContextV0,
  field_id: string,
): Promise<Omit<FlightTableGeometryVerificationV1, "ok" | "fact_id" | "weather_location" | "weather_provider_status" | "weather_location_status"> | null> {
  const q = await pool.query(
    `SELECT polygon_geojson_json, area_m2 FROM field_polygon_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`,
    [auth.tenant_id, field_id],
  );
  const row = q.rows?.[0] ?? null;
  if (!row?.polygon_geojson_json) return null;
  const raw = typeof row.polygon_geojson_json === "string" ? JSON.parse(row.polygon_geojson_json) : row.polygon_geojson_json;
  const geometry = unwrapGeometry(raw);
  if (!geometry) return null;
  const normalized = normalizeGeometry(geometry);
  const area_m2 = Number.isFinite(Number(row.area_m2)) ? Number(row.area_m2) : normalized.area_m2;
  return {
    field_id,
    geometry_id: `geom_${field_id}`,
    geometry_status: "AVAILABLE",
    geometry_format: "GEOJSON",
    geometry: normalized.geometry,
    centroid: normalized.centroid,
    area_m2,
    area_mu: area_m2 == null ? null : Number((area_m2 / 666.6666667).toFixed(4)),
  };
}
