import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js";

type ObservationTypeV1 = "DISEASE_SPOT" | "PEST" | "CROP_VIGOR" | "LODGING" | "MISSING_SEEDLINGS";
type AgriMediaTypeV1 = "LEAF_IMAGE" | "FIELD_IMAGE" | "FIELD_VIDEO" | "UAV_SCOUT_IMAGE" | "UAV_SCOUT_VIDEO";
type AgriDeviceTypeV1 = "UAV" | "MOBILE_CAMERA" | "FIELD_CAMERA" | "SCOUT_TERMINAL" | "IOT_GATEWAY";
type AgriSourceTypeV1 = "HUMAN_SCOUT" | "DRONE_PATROL" | "DEVICE_AUTO_CAPTURE" | "SYSTEM_IMPORT" | "THIRD_PARTY";

const OBSERVATION_TYPE_SET = new Set<ObservationTypeV1>(["DISEASE_SPOT", "PEST", "CROP_VIGOR", "LODGING", "MISSING_SEEDLINGS"]);
const MEDIA_TYPE_SET = new Set<AgriMediaTypeV1>(["LEAF_IMAGE", "FIELD_IMAGE", "FIELD_VIDEO", "UAV_SCOUT_IMAGE", "UAV_SCOUT_VIDEO"]);
const DEVICE_TYPE_SET = new Set<AgriDeviceTypeV1>(["UAV", "MOBILE_CAMERA", "FIELD_CAMERA", "SCOUT_TERMINAL", "IOT_GATEWAY"]);
const SOURCE_TYPE_SET = new Set<AgriSourceTypeV1>(["HUMAN_SCOUT", "DRONE_PATROL", "DEVICE_AUTO_CAPTURE", "SYSTEM_IMPORT", "THIRD_PARTY"]);

function normalizeString(v: unknown, maxLen = 128): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function normalizeOptionalString(v: unknown, maxLen = 512): string | null {
  if (v == null) return null;
  return normalizeString(v, maxLen);
}

function normalizeNumber(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function normalizeEnum<T extends string>(v: unknown, allowed: Set<T>): T | null {
  if (typeof v !== "string") return null;
  const candidate = v.trim().toUpperCase() as T;
  return allowed.has(candidate) ? candidate : null;
}

function guessMediaType(mime: string, explicit: AgriMediaTypeV1 | null, deviceType: AgriDeviceTypeV1): AgriMediaTypeV1 {
  if (explicit) return explicit;
  const isVideo = mime.startsWith("video/");
  if (deviceType === "UAV") return isVideo ? "UAV_SCOUT_VIDEO" : "UAV_SCOUT_IMAGE";
  return isVideo ? "FIELD_VIDEO" : "FIELD_IMAGE";
}

function extFromNameAndMime(name: string, mime: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext) return ext;
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/quicktime") return ".mov";
  return ".bin";
}

async function ensureAgronomyObservationIndexV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agronomy_observation_index_v1 (
      tenant_id text NOT NULL,
      observation_id text NOT NULL,
      field_id text NOT NULL,
      season_id text NULL,
      telemetry_id text NULL,
      media_key text NOT NULL,
      observed_ts_ms bigint NOT NULL,
      observation_type text NOT NULL,
      media_type text NOT NULL,
      device_type text NOT NULL,
      source_type text NOT NULL,
      device_id text NULL,
      severity numeric(6,2) NULL,
      confidence numeric(6,2) NULL,
      note text NULL,
      created_ts_ms bigint NOT NULL,
      updated_ts_ms bigint NOT NULL,
      PRIMARY KEY (tenant_id, observation_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_observation_index_v1_lookup_idx
    ON agronomy_observation_index_v1 (tenant_id, field_id, observed_ts_ms DESC)
  `);

  await pool.query(`ALTER TABLE agronomy_observation_index_v1 ADD COLUMN IF NOT EXISTS device_id text NULL`);
}

export function registerAgronomyMediaV1Routes(app: FastifyInstance, pool: Pool, mediaRootDir: string): void {
  void ensureAgronomyObservationIndexV1(pool).catch((e: any) => {
    app.log.error({ err: e }, "failed_to_ensure_agronomy_observation_index_v1");
  });

  app.post("/api/v1/agronomy/observations/media", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const parts = (req as any).parts();
    const fields = new Map<string, string>();
    let fileBuf: Buffer | null = null;
    let fileMime = "application/octet-stream";
    let fileName = "upload.bin";

    for await (const part of parts) {
      if (part.type === "file") {
        fileBuf = await part.toBuffer();
        fileMime = part.mimetype ?? fileMime;
        fileName = part.filename ?? fileName;
      } else if (part.type === "field") {
        const v = typeof part.value === "string" ? part.value : String(part.value ?? "");
        fields.set(part.fieldname, v);
      }
    }

    if (!fileBuf) return reply.code(400).send({ ok: false, error: "MISSING_FILE" });

    const tenant_id = normalizeString(fields.get("tenant_id"), 128) ?? auth.tenant_id;
    if (tenant_id !== auth.tenant_id) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const field_id = normalizeString(fields.get("field_id"), 128);
    if (!field_id) return reply.code(400).send({ ok: false, error: "MISSING_OR_INVALID:field_id" });

    const season_id = normalizeOptionalString(fields.get("season_id"), 128);
    const telemetry_id = normalizeOptionalString(fields.get("telemetry_id"), 128);
    const device_id = normalizeOptionalString(fields.get("device_id"), 128);
    const source_id = normalizeOptionalString(fields.get("source_id"), 128);

    const observation_type = normalizeEnum(fields.get("observation_type"), OBSERVATION_TYPE_SET);
    if (!observation_type) return reply.code(400).send({ ok: false, error: "MISSING_OR_INVALID:observation_type" });

    const device_type = normalizeEnum(fields.get("device_type"), DEVICE_TYPE_SET) ?? "MOBILE_CAMERA";
    const source_type = normalizeEnum(fields.get("source_type"), SOURCE_TYPE_SET) ?? "HUMAN_SCOUT";
    const mediaTypeInput = normalizeEnum(fields.get("media_type"), MEDIA_TYPE_SET);
    const media_type = guessMediaType(fileMime, mediaTypeInput, device_type);

    const severity = normalizeNumber(fields.get("severity"), 0, 1);
    const confidence = normalizeNumber(fields.get("confidence"), 0, 1);
    const note = normalizeOptionalString(fields.get("note"), 2000);

    const observed_ts_ms = Number(fields.get("observed_ts_ms"));
    const observedTsMs = Number.isFinite(observed_ts_ms) ? observed_ts_ms : Date.now();
    const occurredAtIso = new Date(observedTsMs).toISOString();

    const ext = extFromNameAndMime(fileName, fileMime);
    const media_key = `agronomy/${tenant_id}/${field_id}/${randomUUID()}${ext}`;
    const outPath = path.join(mediaRootDir, media_key);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, fileBuf);

    const observation_id = `obs_${randomUUID()}`;
    const fact_id = `fact_${randomUUID()}`;
    const now = Date.now();

    const record = {
      type: "agronomy_observation_v1",
      schema_version: "1.0.0",
      occurred_at: occurredAtIso,
      entity: {
        tenant_id,
        field_id,
        season_id,
        observation_id,
        telemetry_id,
        media_id: media_key,
      },
      payload: {
        observation_type,
        severity,
        confidence,
        note,
        observation_object: {
          disease_spot: observation_type === "DISEASE_SPOT",
          pest: observation_type === "PEST",
          crop_vigor: observation_type === "CROP_VIGOR",
          lodging: observation_type === "LODGING",
          missing_seedlings: observation_type === "MISSING_SEEDLINGS",
        },
        media: {
          media_key,
          mime: fileMime,
          filename: fileName,
          media_type,
        },
        source: {
          source_type,
          source_id,
          device_type,
          device_id,
        },
        associations: {
          field_id,
          season_id,
          telemetry_id,
          media_key,
        },
      },
      refs: {
        media_url: `/media/${media_key}`,
      },
    };

    const conn = await pool.connect();
    try {
      await conn.query("BEGIN");
      await conn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4::jsonb)`,
        [fact_id, occurredAtIso, "agronomy_media_v1", JSON.stringify(record)]
      );

      await conn.query(
        `INSERT INTO agronomy_observation_index_v1 (
           tenant_id, observation_id, field_id, season_id, telemetry_id, media_key,
           observed_ts_ms, observation_type, media_type, device_type, source_type, device_id,
           severity, confidence, note, created_ts_ms, updated_ts_ms
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
        [
          tenant_id,
          observation_id,
          field_id,
          season_id,
          telemetry_id,
          media_key,
          Math.trunc(observedTsMs),
          observation_type,
          media_type,
          device_type,
          source_type,
          device_id,
          severity,
          confidence,
          note,
          now,
        ]
      );
      await conn.query("COMMIT");
    } catch (e) {
      await conn.query("ROLLBACK");
      throw e;
    } finally {
      conn.release();
    }

    return reply.send({
      ok: true,
      observation_id,
      fact_id,
      media_key,
      media_url: `/media/${media_key}`,
      normalized_observation: record,
    });
  });

  app.get("/api/v1/agronomy/observations/:observation_id", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const p = (req as any).params ?? {};
    const q = (req as any).query ?? {};
    const tenant_id = normalizeString(q.tenant_id, 128) ?? auth.tenant_id;
    if (tenant_id !== auth.tenant_id) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const observation_id = normalizeString(p.observation_id, 128);
    if (!observation_id) return reply.code(400).send({ ok: false, error: "MISSING_OR_INVALID:observation_id" });

    const r = await pool.query(
      `SELECT tenant_id, observation_id, field_id, season_id, telemetry_id, media_key, device_id,
              observed_ts_ms, observation_type, media_type, device_type, source_type,
              severity, confidence, note, created_ts_ms, updated_ts_ms
         FROM agronomy_observation_index_v1
        WHERE tenant_id = $1 AND observation_id = $2
        LIMIT 1`,
      [tenant_id, observation_id]
    );

    if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, observation: r.rows[0] });
  });
}
