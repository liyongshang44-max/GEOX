import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import * as GeoxContracts from "@geox/contracts";
import { runAgronomyInferenceV1, type InferenceTaskTypeV1 } from "../services/agronomy_inference_service_v1";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";
import { ensureDerivedSensingStateProjectionV1, getLatestDerivedSensingStatesByFieldV1 } from "../services/derived_sensing_state_v1";
const { TELEMETRY_METRIC_CATALOG_V1, isTelemetryMetricNameV1 } = GeoxContracts;
function normalizeString(v: unknown, maxLen = 128): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function normalizeTaskType(v: unknown): InferenceTaskTypeV1 {
  const s = String(v ?? "classification").trim().toLowerCase();
  if (s === "detection" || s === "classification" || s === "segmentation") return s;
  return "classification";
}

function parseJsonSafe(v: unknown): any {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
}

function formatInferenceRow(row: any): any {
  const labels = parseJsonSafe(row.labels_json);
  const rawSummary = parseJsonSafe(row.raw_output_summary_json);
  const inferenceTsMs = Number(row.inference_ts_ms);
  const inferenceTsIso = Number.isFinite(inferenceTsMs) ? new Date(inferenceTsMs).toISOString() : null;
  return {
    tenant_id: String(row.tenant_id),
    inference_id: String(row.inference_id),
    observation_id: String(row.observation_id),
    media_key: String(row.media_key),
    field_id: String(row.field_id),
    season_id: row.season_id == null ? null : String(row.season_id),
    device_id: row.device_id == null ? null : String(row.device_id),
    model_name: String(row.model_name),
    model_version: String(row.model_version),
    task_type: String(row.task_type),
    labels: Array.isArray(labels) ? labels : [],
    confidence: Number(row.confidence),
    health_score: row.health_score == null ? null : Number(row.health_score),
    pest_detected: Boolean(row.pest_detected),
    disease_detected: Boolean(row.disease_detected),
    inference_ts_ms: Number.isFinite(inferenceTsMs) ? inferenceTsMs : null,
    inference_ts: inferenceTsIso,
    raw_output_summary: rawSummary ?? {},
  };
}

function buildAgronomyDecisionInput(recentInferenceResults: any[], telemetrySummary: any[]): any {
  const latestInference = recentInferenceResults[0] ?? null;
  const telemetryByMetric = new Map<string, any>((telemetrySummary ?? []).map((item: any) => [String(item.metric), item]));

  const airTemperature = telemetryByMetric.get("air_temperature") ?? null;
  const airHumidity = telemetryByMetric.get("air_humidity") ?? null;
  const soilMoisture = telemetryByMetric.get("soil_moisture") ?? null;
  const lightLux = telemetryByMetric.get("light_lux") ?? null;

  const stressSignals: string[] = [];
  if (airTemperature?.value_in_range === false) stressSignals.push("air_temperature_out_of_range");
  if (airHumidity?.value_in_range === false) stressSignals.push("air_humidity_out_of_range");
  if (soilMoisture?.value_in_range === false) stressSignals.push("soil_moisture_out_of_range");
  if (lightLux?.value_in_range === false) stressSignals.push("light_lux_out_of_range");
  if (latestInference?.disease_detected === true) stressSignals.push("disease_detected");
  if (latestInference?.pest_detected === true) stressSignals.push("pest_detected");

  const confidence = typeof latestInference?.confidence === "number" ? latestInference.confidence : null;
  const telemetryCoverage = [airTemperature, airHumidity, soilMoisture, lightLux].filter(Boolean).length;

  return {
    generated_ts_ms: Date.now(),
    inference: latestInference,
    telemetry: {
      air_temperature: airTemperature,
      air_humidity: airHumidity,
      soil_moisture: soilMoisture,
      light_lux: lightLux,
      coverage: telemetryCoverage,
    },
    stress_signals: stressSignals,
    readiness: {
      has_inference: Boolean(latestInference),
      has_minimum_telemetry: telemetryCoverage >= 2,
      confidence_ok: confidence == null ? false : confidence >= 0.6,
    },
  };
}


async function ensureAgronomyInferenceIndexV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agronomy_inference_result_v1 (
      tenant_id text NOT NULL,
      inference_id text NOT NULL,
      fact_id text NOT NULL,
      occurred_at timestamptz NOT NULL,
      observation_id text NOT NULL,
      media_key text NOT NULL,
      field_id text NOT NULL,
      season_id text NULL,
      device_id text NULL,
      model_name text NOT NULL,
      model_version text NOT NULL,
      task_type text NOT NULL,
      labels_json jsonb NOT NULL,
      confidence numeric(6,5) NOT NULL,
      health_score numeric(6,2) NULL,
      pest_detected boolean NOT NULL,
      disease_detected boolean NOT NULL,
      inference_ts_ms bigint NOT NULL,
      raw_output_summary_json jsonb NOT NULL,
      created_ts_ms bigint NOT NULL,
      updated_ts_ms bigint NOT NULL,
      PRIMARY KEY (tenant_id, inference_id),
      UNIQUE (tenant_id, fact_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_observation_idx
    ON agronomy_inference_result_v1 (tenant_id, observation_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_field_idx
    ON agronomy_inference_result_v1 (tenant_id, field_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_season_idx
    ON agronomy_inference_result_v1 (tenant_id, season_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_device_idx
    ON agronomy_inference_result_v1 (tenant_id, device_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_media_idx
    ON agronomy_inference_result_v1 (tenant_id, media_key, inference_ts_ms DESC)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agronomy_inference_index_v1 (
      tenant_id text NOT NULL,
      inference_id text NOT NULL,
      observation_id text NOT NULL,
      media_key text NOT NULL,
      field_id text NOT NULL,
      season_id text NULL,
      device_id text NULL,
      model_name text NOT NULL,
      model_version text NOT NULL,
      task_type text NOT NULL,
      labels_json jsonb NOT NULL,
      confidence numeric(6,5) NOT NULL,
      health_score numeric(6,2) NULL,
      pest_detected boolean NOT NULL,
      disease_detected boolean NOT NULL,
      inference_ts_ms bigint NOT NULL,
      raw_output_summary_json jsonb NOT NULL,
      created_ts_ms bigint NOT NULL,
      updated_ts_ms bigint NOT NULL,
      PRIMARY KEY (tenant_id, inference_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_field_lookup_idx
    ON agronomy_inference_index_v1 (tenant_id, field_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_observation_lookup_idx
    ON agronomy_inference_index_v1 (tenant_id, observation_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_media_lookup_idx
    ON agronomy_inference_index_v1 (tenant_id, media_key, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_season_lookup_idx
    ON agronomy_inference_index_v1 (tenant_id, season_id, inference_ts_ms DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_device_lookup_idx
    ON agronomy_inference_index_v1 (tenant_id, device_id, inference_ts_ms DESC)
  `);

  await pool.query(`ALTER TABLE agronomy_inference_index_v1 ALTER COLUMN health_score TYPE numeric(6,2)`);
}

export function registerAgronomyInferenceV1Routes(app: FastifyInstance, pool: Pool): void {
  void ensureAgronomyInferenceIndexV1(pool).catch((e: any) => {
    app.log.error({ err: e }, "failed_to_ensure_agronomy_inference_index_v1");
  });
  void ensureDerivedSensingStateProjectionV1(pool).catch((e: any) => {
    app.log.error({ err: e }, "failed_to_ensure_derived_sensing_state_index_v1");
  });

  app.post("/api/v1/agronomy/inference/run", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = (req as any).body ?? {};
    const tenant_id = normalizeString(body.tenant_id, 128) ?? auth.tenant_id;
    if (tenant_id !== auth.tenant_id) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const observation_id = normalizeString(body.observation_id, 128);
    const media_key = normalizeString(body.media_key, 512);
    if (!observation_id && !media_key) return reply.code(400).send({ ok: false, error: "MISSING:observation_id_or_media_key" });

    const model_name = normalizeString(body.model_name, 128) ?? "geox-agri-baseline";
    const model_version = normalizeString(body.model_version, 64) ?? "1.0.0";
    const task_type = normalizeTaskType(body.task_type);

    const lookup = observation_id
      ? await pool.query(
        `SELECT tenant_id, observation_id, field_id, season_id, telemetry_id, media_key, device_id,
                observation_type, note
           FROM agronomy_observation_index_v1
          WHERE tenant_id = $1 AND observation_id = $2
          LIMIT 1`,
        [tenant_id, observation_id]
      )
      : await pool.query(
        `SELECT tenant_id, observation_id, field_id, season_id, telemetry_id, media_key, device_id,
                observation_type, note
           FROM agronomy_observation_index_v1
          WHERE tenant_id = $1 AND media_key = $2
          ORDER BY observed_ts_ms DESC
          LIMIT 1`,
        [tenant_id, media_key]
      );

    if ((lookup.rowCount ?? 0) < 1) return reply.code(404).send({ ok: false, error: "OBSERVATION_NOT_FOUND" });

    const row: any = lookup.rows[0];
    const inference_ts_ms = Date.now();
    const output = await runAgronomyInferenceV1({
      observation_id: String(row.observation_id),
      media_key: String(row.media_key),
      observation_type: String(row.observation_type ?? ""),
      mime: "application/octet-stream",
      note: row.note == null ? null : String(row.note),
      model_name,
      model_version,
      task_type,
      inference_ts_ms,
    });

    const inference_id = `inf_${inference_ts_ms}_${Math.random().toString(16).slice(2, 10)}`;
    const occurred_at = output.inference_ts;
    const fact_id = `fact_inf_${Math.random().toString(16).slice(2, 12)}`;

    const record = {
      type: "agronomy_inference_result_v1",
      schema_version: "1.0.0",
      occurred_at,
      entity: {
        tenant_id,
        inference_id,
        observation_id: String(row.observation_id),
        field_id: String(row.field_id),
        season_id: row.season_id == null ? null : String(row.season_id),
        device_id: row.device_id == null ? null : String(row.device_id),
        media_key: String(row.media_key),
      },
      payload: {
        model_name: output.model_name,
        model_version: output.model_version,
        task_type: output.task_type,
        labels: output.labels,
        confidence: output.confidence,
        health_score: output.health_score,
        pest_detected: output.pest_detected,
        disease_detected: output.disease_detected,
        inference_ts: output.inference_ts,
        raw_output_summary: output.raw_output_summary,
      },
      refs: {
        observation_id: String(row.observation_id),
        telemetry_id: row.telemetry_id == null ? null : String(row.telemetry_id),
      },
    };

    const conn = await pool.connect();
    try {
      await conn.query("BEGIN");
      await conn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4::jsonb)`,
        [fact_id, occurred_at, "agronomy_inference_v1", JSON.stringify(record)]
      );

      await conn.query(
        `INSERT INTO agronomy_inference_result_v1 (
           tenant_id, inference_id, fact_id, occurred_at, observation_id, media_key, field_id, season_id, device_id,
           model_name, model_version, task_type, labels_json, confidence, health_score,
           pest_detected, disease_detected, inference_ts_ms, raw_output_summary_json, created_ts_ms, updated_ts_ms
         ) VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19::jsonb,$20,$20)`,
        [
          tenant_id,
          inference_id,
          fact_id,
          occurred_at,
          String(row.observation_id),
          String(row.media_key),
          String(row.field_id),
          row.season_id == null ? null : String(row.season_id),
          row.device_id == null ? null : String(row.device_id),
          output.model_name,
          output.model_version,
          output.task_type,
          JSON.stringify(output.labels),
          output.confidence,
          output.health_score,
          output.pest_detected,
          output.disease_detected,
          inference_ts_ms,
          JSON.stringify(output.raw_output_summary),
          inference_ts_ms,
        ]
      );

      await conn.query(
        `INSERT INTO agronomy_inference_index_v1 (
           tenant_id, inference_id, observation_id, media_key, field_id, season_id, device_id,
           model_name, model_version, task_type, labels_json, confidence, health_score,
           pest_detected, disease_detected, inference_ts_ms, raw_output_summary_json, created_ts_ms, updated_ts_ms
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17::jsonb,$18,$18)`,
        [
          tenant_id,
          inference_id,
          String(row.observation_id),
          String(row.media_key),
          String(row.field_id),
          row.season_id == null ? null : String(row.season_id),
          row.device_id == null ? null : String(row.device_id),
          output.model_name,
          output.model_version,
          output.task_type,
          JSON.stringify(output.labels),
          output.confidence,
          output.health_score,
          output.pest_detected,
          output.disease_detected,
          inference_ts_ms,
          JSON.stringify(output.raw_output_summary),
          inference_ts_ms,
        ]
      );
      await conn.query("COMMIT");
    } catch (e) {
      await conn.query("ROLLBACK");
      throw e;
    } finally {
      conn.release();
    }

    return reply.send({ ok: true, inference_id, fact_id, result: record });
  });

  app.get("/api/v1/agronomy/inference/:inference_id", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const p: any = (req as any).params ?? {};
    const q: any = (req as any).query ?? {};
    const tenant_id = normalizeString(q.tenant_id, 128) ?? auth.tenant_id;
    if (tenant_id !== auth.tenant_id) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const inference_id = normalizeString(p.inference_id, 128);
    if (!inference_id) return reply.code(400).send({ ok: false, error: "MISSING_OR_INVALID:inference_id" });

    const r = await pool.query(
      `SELECT tenant_id, inference_id, observation_id, media_key, field_id, season_id, device_id,
              model_name, model_version, task_type, labels_json, confidence, health_score,
              pest_detected, disease_detected, inference_ts_ms, raw_output_summary_json
         FROM agronomy_inference_result_v1
        WHERE tenant_id = $1 AND inference_id = $2
        LIMIT 1`,
      [tenant_id, inference_id]
    );
    if ((r.rowCount ?? 0) < 1) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, inference: formatInferenceRow(r.rows[0]) });
  });

  app.get("/api/v1/agronomy/inference", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const tenant_id = normalizeString(q.tenant_id, 128) ?? auth.tenant_id;
    if (tenant_id !== auth.tenant_id) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const observation_id = normalizeString(q.observation_id, 128);
    const media_key = normalizeString(q.media_key, 512);
    const season_id = normalizeString(q.season_id, 128);
    const device_id = normalizeString(q.device_id, 128);
    if (!observation_id && !media_key && !season_id && !device_id) {
      return reply.code(400).send({ ok: false, error: "MISSING:observation_id_or_media_key_or_season_id_or_device_id" });
    }

    const where: string[] = ["tenant_id = $1"];
    const values: any[] = [tenant_id];
    let i = 2;
    if (observation_id) {
      where.push(`observation_id = $${i++}`);
      values.push(observation_id);
    }
    if (media_key) {
      where.push(`media_key = $${i++}`);
      values.push(media_key);
    }
    if (season_id) {
      where.push(`season_id = $${i++}`);
      values.push(season_id);
    }
    if (device_id) {
      where.push(`device_id = $${i++}`);
      values.push(device_id);
    }

    const r = await pool.query(
      `SELECT tenant_id, inference_id, observation_id, media_key, field_id, season_id, device_id,
              model_name, model_version, task_type, labels_json, confidence, health_score,
              pest_detected, disease_detected, inference_ts_ms, raw_output_summary_json
         FROM agronomy_inference_result_v1
        WHERE ${where.join(" AND ")}
        ORDER BY inference_ts_ms DESC
        LIMIT 50`,
      values
    );

    return reply.send({ ok: true, count: r.rowCount ?? 0, items: (r.rows ?? []).map((row: any) => formatInferenceRow(row)) });
  });

  app.get("/api/v1/agronomy/inputs/:field_id", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const p: any = (req as any).params ?? {};
    const q: any = (req as any).query ?? {};
    const tenant_id = normalizeString(q.tenant_id, 128) ?? auth.tenant_id;
    if (tenant_id !== auth.tenant_id) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const field_id = normalizeString(p.field_id, 128);
    if (!field_id) return reply.code(400).send({ ok: false, error: "MISSING_OR_INVALID:field_id" });

    const observationsQ = await pool.query(
      `SELECT observation_id, field_id, season_id, telemetry_id, media_key, device_id, observed_ts_ms,
              observation_type, media_type, note
         FROM agronomy_observation_index_v1
        WHERE tenant_id = $1 AND field_id = $2
        ORDER BY observed_ts_ms DESC
        LIMIT 10`,
      [tenant_id, field_id]
    );

    const inferenceQ = await pool.query(
      `SELECT inference_id, observation_id, model_name, model_version, task_type,
              labels_json, confidence, health_score, pest_detected, disease_detected, inference_ts_ms,
              tenant_id, media_key, field_id, season_id, device_id, raw_output_summary_json
         FROM agronomy_inference_result_v1
        WHERE tenant_id = $1 AND field_id = $2
        ORDER BY inference_ts_ms DESC
        LIMIT 10`,
      [tenant_id, field_id]
    );

    const devicesQ = await pool.query(
      `SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [tenant_id, field_id]
    );
    const deviceIds = (devicesQ.rows ?? []).map((r: any) => String(r.device_id)).filter(Boolean);

    const metricNames = Object.keys(TELEMETRY_METRIC_CATALOG_V1).filter((m): m is keyof typeof TELEMETRY_METRIC_CATALOG_V1 => isTelemetryMetricNameV1(m));
    let telemetrySummary: any[] = [];

    if (deviceIds.length > 0) {
      const telemetryQ = await pool.query(
        `SELECT DISTINCT ON (metric)
            metric,
            value_num,
            value_text,
            (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS ts_ms,
            device_id,
            fact_id
           FROM telemetry_index_v1
          WHERE tenant_id = $1
            AND device_id = ANY($2::text[])
            AND metric = ANY($3::text[])
          ORDER BY metric, ts DESC`,
        [tenant_id, deviceIds, metricNames]
      );

      telemetrySummary = (telemetryQ.rows ?? []).map((row: any) => {
        const metric = String(row.metric);
        const spec = isTelemetryMetricNameV1(metric) ? TELEMETRY_METRIC_CATALOG_V1[metric] : null;
        const valueNum = row.value_num == null ? null : Number(row.value_num);
        const inRange = spec && typeof valueNum === "number"
          ? valueNum >= spec.min && valueNum <= spec.max
          : null;
        return {
          metric,
          unit: spec?.unit ?? null,
          range: spec ? { min: spec.min, max: spec.max } : null,
          value_num: valueNum,
          value_text: row.value_text == null ? null : String(row.value_text),
          ts_ms: Number(row.ts_ms),
          device_id: String(row.device_id),
          fact_id: String(row.fact_id),
          value_in_range: inRange,
        };
      });
    }

    const recentInferenceResults = (inferenceQ.rows ?? []).map((row: any) => formatInferenceRow(row));
    const derivedStateRows = await getLatestDerivedSensingStatesByFieldV1(pool, {
      tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      field_id
    });
    const decision_input = buildAgronomyDecisionInput(recentInferenceResults, telemetrySummary);

    return reply.send({
      ok: true,
      tenant_id,
      field_id,
      recent_observations: observationsQ.rows ?? [],
      recent_inference_results: recentInferenceResults,
      latest_derived_sensing_states: derivedStateRows,
      telemetry_summary: telemetrySummary,
      decision_input,
    });
  });
}
