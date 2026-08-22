// tools/commercial-evidence-demo/server.ts
// Purpose: standalone read-only Commercial Evidence Demo microsite.
// Boundary: this server is not registered in the GEOX production server. It executes existing pure Runtime/Twin Kernel code, reads existing persisted Twin Kernel read models through GEOX_BASE_URL, and can expose an allowlisted historical MCFT qualification read model from Neon.

import { execFileSync, spawnSync } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommercialEvidencePacketV1 } from "./packet.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(ROOT, "../..");
const PORT = Number(process.env.COMMERCIAL_EVIDENCE_DEMO_PORT ?? 4177);
const GEOX_BASE_URL = String(process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const GEOX_OPERATOR_BASE_URL = String(process.env.GEOX_OPERATOR_BASE_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const DEFAULT_DECISION_CYCLE_ID = String(process.env.COMMERCIAL_EVIDENCE_DECISION_CYCLE_ID ?? "").trim();
const LIVE_DATA_TIMEOUT_MS = Number(process.env.COMMERCIAL_EVIDENCE_LIVE_DATA_TIMEOUT_MS ?? 4000);
const MCFT_READ_URL = String(process.env.COMMERCIAL_EVIDENCE_MCFT_READ_URL ?? "").trim();
const MCFT_HISTORICAL_DATABASE = "geox_mcft_cap09_s6_accel24t_am19_v3";
const MCFT_SOURCE_MODE = "NEON_MCFT_HISTORICAL_QUALIFICATION_READ_MODEL_V1";
const requireFromServer = createRequire(join(REPO_ROOT, "apps/server/package.json"));

type PgClientLike = {
  connect: () => Promise<void>;
  query: (sql: string) => Promise<{ rows: any[] }>;
  end: () => Promise<void>;
};

function subjectSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "UNPINNED_LOCAL_CHECKOUT";
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function sendStatic(res: ServerResponse, file: string): Promise<void> {
  const fullPath = join(ROOT, file);
  const body = await readFile(fullPath);
  const mime = extname(file) === ".html"
    ? "text/html; charset=utf-8"
    : extname(file) === ".js"
      ? "text/javascript; charset=utf-8"
      : "text/css; charset=utf-8";
  res.writeHead(200, {
    "content-type": mime,
    "cache-control": "no-store",
    "content-length": body.length,
  });
  res.end(body);
}

function safeDecisionCycleId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,240}$/.test(trimmed)) return null;
  return trimmed;
}

function buildRuntimeValueTrace(): unknown {
  const run = spawnSync(process.execPath, ["scripts/governance_acceptance/TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (run.status !== 0) {
    const diagnostic = String(run.stderr || run.stdout || "").trim().slice(0, 1200);
    throw new Error(`COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_FAILED:${run.status}:${diagnostic}`);
  }
  try {
    const parsed = JSON.parse(run.stdout.trim());
    if (parsed?.ok !== true || parsed?.runtime_builders_invoked !== true || parsed?.complete_tk_chain_built !== true) {
      throw new Error("RUNTIME_VALUE_TRACE_ACCEPTANCE_NOT_PASS");
    }
    return {
      ...parsed,
      demo_trace_mode: "CONTROLLED_IN_MEMORY_EXISTING_BUILDERS",
      production_authority: false,
      database_required: false,
      canonical_write_count: 0,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "RUNTIME_VALUE_TRACE_ACCEPTANCE_NOT_PASS") throw error;
    throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_NON_JSON_OUTPUT");
  }
}

async function upstreamJson(pathname: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(LIVE_DATA_TIMEOUT_MS) ? Math.max(250, Math.min(15000, LIVE_DATA_TIMEOUT_MS)) : 4000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(`${GEOX_BASE_URL}${pathname}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await upstream.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`UPSTREAM_NON_JSON_RESPONSE:${upstream.status}`);
    }
    if (!upstream.ok || payload?.ok === false) {
      throw new Error(`UPSTREAM_HTTP_${upstream.status}:${String(payload?.error ?? "UNKNOWN_UPSTREAM_ERROR")}`);
    }
    return payload;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("UPSTREAM_READ_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readConnectedTwinData(requestedDecisionCycleId: string | null): Promise<unknown> {
  try {
    let decisionCycleId = safeDecisionCycleId(requestedDecisionCycleId) ?? safeDecisionCycleId(DEFAULT_DECISION_CYCLE_ID);
    const sourceMode = decisionCycleId ? "EXPLICIT_DECISION_CYCLE_ID" : "OPERATOR_DECISION_QUEUE";
    let queueEntry: unknown = null;

    if (!decisionCycleId) {
      const queue: any = await upstreamJson("/api/v1/twin-kernel/operator-workflow/decision-cycles?limit=25");
      const decisionCycles = Array.isArray(queue?.decision_cycles) ? queue.decision_cycles : [];
      queueEntry = decisionCycles[0] ?? null;
      decisionCycleId = safeDecisionCycleId(String((queueEntry as any)?.decision_cycle_id ?? ""));
      if (!decisionCycleId) {
        return {
          ok: true,
          connected: false,
          read_only: true,
          source_mode: sourceMode,
          geox_base_url: GEOX_BASE_URL,
          error: "NO_ELIGIBLE_PERSISTED_DECISION_CYCLE",
        };
      }
    }

    const traceWrapper: any = await upstreamJson(`/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
    const twinTrace = traceWrapper?.twin_trace;
    if (!twinTrace || twinTrace.read_only !== true) throw new Error("PERSISTED_TWIN_TRACE_READ_ONLY_MODEL_MISSING");

    return {
      ok: true,
      connected: true,
      read_only: true,
      source_mode: sourceMode,
      geox_base_url: GEOX_BASE_URL,
      decision_cycle_id: decisionCycleId,
      queue_entry: queueEntry,
      twin_trace: twinTrace,
      upstream_contract: {
        decision_queue: sourceMode === "OPERATOR_DECISION_QUEUE" ? "/api/v1/twin-kernel/operator-workflow/decision-cycles" : null,
        twin_trace: `/api/v1/twin-kernel/traces/${decisionCycleId}`,
      },
      database_write_count: 0,
      canonical_runtime_write_count: 0,
    };
  } catch (error: unknown) {
    return {
      ok: true,
      connected: false,
      read_only: true,
      geox_base_url: GEOX_BASE_URL,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validatedMcftDatabaseName(): string {
  if (!MCFT_READ_URL) throw new Error("MCFT_READ_URL_NOT_CONFIGURED");
  let parsed: URL;
  try {
    parsed = new URL(MCFT_READ_URL);
  } catch {
    throw new Error("MCFT_READ_URL_INVALID");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error("MCFT_READ_URL_PROTOCOL_INVALID");
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (databaseName !== MCFT_HISTORICAL_DATABASE) throw new Error("MCFT_DATABASE_NOT_ALLOWLISTED");
  return databaseName;
}

function createMcftPgClient(): PgClientLike {
  const pg = requireFromServer("pg") as { Client: new (config: Record<string, unknown>) => PgClientLike };
  return new pg.Client({
    connectionString: MCFT_READ_URL,
    application_name: "geox_commercial_evidence_demo_read_only",
  });
}

const MCFT_COUNTS_SQL = `
SELECT record_json->>'type' AS record_type, count(*)::int AS count
FROM facts
WHERE record_json->>'type' IN (
  'soil_moisture_observation_v1',
  'future_weather_assumption_v1',
  'future_et0_assumption_v1',
  'observed_rainfall_v1',
  'historical_et0_estimate_v1',
  'twin_evidence_window_v1',
  'twin_state_estimate_v1',
  'twin_forecast_run_v1',
  'twin_scenario_set_v1',
  'twin_runtime_tick_v1',
  'twin_runtime_checkpoint_v1',
  'twin_runtime_health_v1'
)
GROUP BY record_json->>'type'
ORDER BY record_type;
`;

const MCFT_LATEST_READ_MODEL_SQL = `
WITH latest AS (
  SELECT DISTINCT ON (record_json->>'type')
    record_json->>'type' AS record_type,
    occurred_at,
    record_json->'payload' AS obj,
    record_json->'payload'->'payload' AS p
  FROM facts
  WHERE record_json->>'type' IN (
    'twin_runtime_tick_v1',
    'twin_evidence_window_v1',
    'twin_state_estimate_v1',
    'twin_forecast_run_v1',
    'twin_scenario_set_v1',
    'twin_runtime_health_v1',
    'twin_runtime_checkpoint_v1'
  )
  ORDER BY record_json->>'type', occurred_at DESC
),
tick AS (SELECT * FROM latest WHERE record_type = 'twin_runtime_tick_v1'),
ew AS (SELECT * FROM latest WHERE record_type = 'twin_evidence_window_v1'),
state AS (SELECT * FROM latest WHERE record_type = 'twin_state_estimate_v1'),
forecast AS (SELECT * FROM latest WHERE record_type = 'twin_forecast_run_v1'),
scenario AS (SELECT * FROM latest WHERE record_type = 'twin_scenario_set_v1'),
health AS (SELECT * FROM latest WHERE record_type = 'twin_runtime_health_v1'),
checkpoint AS (SELECT * FROM latest WHERE record_type = 'twin_runtime_checkpoint_v1')
SELECT
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'status', p->>'status',
    'runtime_mode', p->>'runtime_mode',
    'operation_variant', p->>'operation_variant',
    'evidence_window_ref', p->>'evidence_window_ref',
    'posterior_state_ref', p->>'posterior_state_ref',
    'forecast_result_ref', p->>'forecast_result_ref',
    'checkpoint_ref', p->>'checkpoint_ref',
    'limitations', COALESCE(p->'limitations', '[]'::jsonb)
  ) FROM tick) AS tick,
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'selected_soil_observation', jsonb_build_object(
      'observation_ref', p->'observation_selection'->'selected_observation'->>'observation_ref',
      'binding_id', p->'observation_selection'->'selected_observation'->>'binding_id',
      'observed_at', p->'observation_selection'->'selected_observation'->>'observed_at',
      'available_to_runtime_at', p->'observation_selection'->'selected_observation'->>'available_to_runtime_at',
      'ingested_at', p->'observation_selection'->'selected_observation'->>'ingested_at',
      'quality_status', p->'observation_selection'->'selected_observation'->>'quality_status',
      'epistemic_class', p->'observation_selection'->'selected_observation'->>'epistemic_class',
      'candidate_assessment', p->'observation_selection'->'selected_observation'->>'candidate_assessment',
      'canonical_value', p->'observation_selection'->'selected_observation'->'canonical_value',
      'canonical_unit', p->'observation_selection'->'selected_observation'->>'canonical_unit'
    ),
    'rejected_observation_count', jsonb_array_length(COALESCE(p->'observation_selection'->'rejected_observation_refs', '[]'::jsonb)),
    'consumed_evidence_refs', COALESCE(p->'consumed_evidence_refs', '[]'::jsonb),
    'forcing', jsonb_build_object(
      'mode', p->'base_continuation_window'->'current_interval_forcing'->>'mode',
      'runtime_health', p->'base_continuation_window'->'current_interval_forcing'->>'runtime_health',
      'interval_start', p->'base_continuation_window'->'current_interval_forcing'->>'interval_start',
      'interval_end', p->'base_continuation_window'->'current_interval_forcing'->>'interval_end',
      'selection_policy_id', p->'base_continuation_window'->'current_interval_forcing'->>'selection_policy_id',
      'precipitation_mm', p->'base_continuation_window'->'current_interval_forcing'->'precipitation_mm',
      'reference_et0_mm', p->'base_continuation_window'->'current_interval_forcing'->'reference_et0_model_water_loss_demand_mm',
      'precipitation_epistemic_class', p->'base_continuation_window'->'current_interval_forcing'->>'precipitation_epistemic_class',
      'et0_epistemic_class', p->'base_continuation_window'->'current_interval_forcing'->>'et0_epistemic_class',
      'provider_wait_required', p->'base_continuation_window'->'current_interval_forcing'->'provider_wait_required',
      'exact_provider_pair_available', p->'base_continuation_window'->'current_interval_forcing'->'exact_provider_pair_available',
      'completed_tick_retroactive_rewrite_authorized', p->'base_continuation_window'->'current_interval_forcing'->'completed_tick_retroactive_rewrite_authorized',
      'source_record_refs', COALESCE(p->'base_continuation_window'->'current_interval_forcing'->'source_record_refs', '[]'::jsonb),
      'limitations', COALESCE(p->'base_continuation_window'->'current_interval_forcing'->'limitations', '[]'::jsonb)
    )
  ) FROM ew) AS evidence_window,
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'root_zone_vwc_fraction', p->'root_zone_vwc_fraction',
    'root_zone_storage_mm', p->'root_zone_storage_mm',
    'available_water_fraction', p->'available_water_fraction',
    'depletion_from_field_capacity_mm', p->'depletion_from_field_capacity_mm',
    'confidence', p->'confidence',
    'use_eligibility', p->'use_eligibility',
    'runtime_mode', p->>'runtime_mode'
  ) FROM state) AS state,
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'status', p->>'status',
    'issued_at', p->>'issued_at',
    'point_count', jsonb_array_length(COALESCE(p->'points', '[]'::jsonb)),
    'scenario_eligible', p->'scenario_eligible',
    'trajectory_hash', p->>'trajectory_hash'
  ) FROM forecast) AS forecast,
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'option_count', jsonb_array_length(COALESCE(p->'options', '[]'::jsonb)),
    'scenario_policy_id', p->>'scenario_policy_id',
    'transaction_variant', p->>'transaction_variant'
  ) FROM scenario) AS scenario,
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'operation_status', p->>'operation_status',
    'runtime_mode', p->>'runtime_mode',
    'limitation_reason_codes', COALESCE(p->'limitation_reason_codes', '[]'::jsonb),
    'checkpoint_ref', p->>'checkpoint_ref',
    'state_ref', p->>'state_ref',
    'forecast_result_ref', p->>'forecast_result_ref'
  ) FROM health) AS health,
  (SELECT jsonb_build_object(
    'object_id', obj->>'object_id',
    'logical_time', obj->>'logical_time',
    'determinism_hash', obj->>'determinism_hash',
    'checkpoint_kind', p->>'checkpoint_kind',
    'tick_sequence', p->'tick_sequence',
    'next_tick_logical_time', p->>'next_tick_logical_time',
    'last_posterior_state_ref', p->>'last_posterior_state_ref',
    'forecast_result_ref', p->>'forecast_result_ref'
  ) FROM checkpoint) AS checkpoint;
`;

async function readHistoricalMcftRuntimeEvidence(): Promise<unknown> {
  let client: PgClientLike | null = null;
  let transactionOpen = false;
  try {
    const databaseName = validatedMcftDatabaseName();
    client = createMcftPgClient();
    await client.connect();
    await client.query("BEGIN READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '4000ms'");
    const countsResult = await client.query(MCFT_COUNTS_SQL);
    const readModelResult = await client.query(MCFT_LATEST_READ_MODEL_SQL);
    await client.query("ROLLBACK");
    transactionOpen = false;

    const counts = Object.fromEntries(countsResult.rows.map((row) => [String(row.record_type), Number(row.count)]));
    const model = readModelResult.rows[0] ?? {};
    return {
      ok: true,
      connected: true,
      read_only: true,
      source_mode: MCFT_SOURCE_MODE,
      database_name: databaseName,
      qualification_class: "PERSISTED_ENGINEERING_QUALIFICATION",
      production_live: false,
      production_authority: false,
      formal_o00_o23_closure: false,
      contains_engineering_fixture_evidence: true,
      canonical_fact_counts: counts,
      tick: model.tick ?? null,
      evidence_window: model.evidence_window ?? null,
      state: model.state ?? null,
      forecast: model.forecast ?? null,
      scenario: model.scenario ?? null,
      health: model.health ?? null,
      checkpoint: model.checkpoint ?? null,
      hard_nonclaims: [
        "NOT_PRODUCTION_LIVE_DATA",
        "NOT_FORMAL_EXTERNAL_EVIDENCE_AS_A_WHOLE",
        "NOT_FINAL_MCFT_CAP09_FORMAL_O00_O23_CLOSURE",
        "ENGINEERING_FIXTURE_PRESENT_IN_ACCELERATED_QUALIFICATION",
      ],
      database_write_count: 0,
      canonical_runtime_write_count: 0,
    };
  } catch (error: unknown) {
    if (client && transactionOpen) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    return {
      ok: true,
      connected: false,
      read_only: true,
      source_mode: MCFT_SOURCE_MODE,
      database_name: MCFT_HISTORICAL_DATABASE,
      production_live: false,
      production_authority: false,
      formal_o00_o23_closure: false,
      error: error instanceof Error ? error.message : String(error),
      database_write_count: 0,
      canonical_runtime_write_count: 0,
    };
  } finally {
    if (client) {
      try { await client.end(); } catch {}
    }
  }
}

async function proxyTwinTrace(res: ServerResponse, decisionCycleId: string): Promise<void> {
  const upstream = await fetch(`${GEOX_BASE_URL}/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`, {
    headers: { accept: "application/json" },
  });
  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { ok: false, error: "UPSTREAM_NON_JSON_TRACE_RESPONSE", status: upstream.status };
  }
  sendJson(res, upstream.status, payload);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `127.0.0.1:${PORT}`}`);
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED" });
      return;
    }

    if (url.pathname === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        service: "geox-commercial-evidence-demo",
        read_only: true,
        connected_data_capable: true,
        mcft_neon_data_capable: true,
      });
      return;
    }

    if (url.pathname === "/api/demo") {
      sendJson(res, 200, {
        ok: true,
        ...buildCommercialEvidencePacketV1(),
        runtime_context: {
          subject_sha: subjectSha(),
          geox_base_url: GEOX_BASE_URL,
          geox_operator_base_url: GEOX_OPERATOR_BASE_URL,
          mcft_historical_database: MCFT_HISTORICAL_DATABASE,
          canonical_selector_source: "apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts",
          standalone_demo_server: true,
        },
      });
      return;
    }

    if (url.pathname === "/api/runtime-value-trace") {
      sendJson(res, 200, buildRuntimeValueTrace());
      return;
    }

    if (url.pathname === "/api/mcft-runtime-evidence") {
      sendJson(res, 200, await readHistoricalMcftRuntimeEvidence());
      return;
    }

    if (url.pathname === "/api/live-data") {
      const rawDecisionCycleId = url.searchParams.get("decision_cycle_id");
      const decisionCycleId = safeDecisionCycleId(rawDecisionCycleId);
      if (rawDecisionCycleId && !decisionCycleId) {
        sendJson(res, 400, { ok: false, error: "DECISION_CYCLE_ID_INVALID" });
        return;
      }
      sendJson(res, 200, await readConnectedTwinData(decisionCycleId));
      return;
    }

    if (url.pathname === "/api/twin-trace") {
      const decisionCycleId = safeDecisionCycleId(url.searchParams.get("decision_cycle_id"));
      if (!decisionCycleId) {
        sendJson(res, 400, { ok: false, error: "DECISION_CYCLE_ID_REQUIRED_OR_INVALID" });
        return;
      }
      await proxyTwinTrace(res, decisionCycleId);
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      await sendStatic(res, "index.html");
      return;
    }
    if (url.pathname === "/app.js") {
      await sendStatic(res, "app.js");
      return;
    }
    if (url.pathname === "/styles.css") {
      await sendStatic(res, "styles.css");
      return;
    }

    sendJson(res, 404, { ok: false, error: "COMMERCIAL_EVIDENCE_DEMO_ROUTE_NOT_FOUND" });
  } catch (error: unknown) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(JSON.stringify({
    ok: true,
    service: "geox-commercial-evidence-demo",
    url: `http://127.0.0.1:${PORT}`,
    geox_base_url: GEOX_BASE_URL,
    geox_operator_base_url: GEOX_OPERATOR_BASE_URL,
    mcft_historical_database: MCFT_HISTORICAL_DATABASE,
    mcft_read_url_configured: Boolean(MCFT_READ_URL),
    read_only: true,
    connected_data_capable: true,
    mcft_neon_data_capable: true,
    subject_sha: subjectSha(),
  }, null, 2));
});
