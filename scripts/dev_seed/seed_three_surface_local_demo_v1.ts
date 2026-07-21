// Purpose: CLI for the deterministic, development-only MCFT-CAP-07 local product demo.
// Boundary: apply requires an explicit local host and confirmation; no production authority, Runtime source activation, model activation, or CAP-08 authorization.

import { Pool } from "pg";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";
import { buildDemoBundle, type DemoBundle, type JsonRecord } from "./three_surface_local_demo_contract_v1.js";
import { assertRequiredRelations, persistRootAndForecasts, seedFieldNavigator } from "./three_surface_local_demo_persistence_v1.js";
import { persistOptionalDomain } from "./three_surface_local_demo_optional_persistence_v1.js";

const LOCAL_CURSOR_KEY = "mcft-cap07-local-demo-cursor-signing-key-2026";

function flag(name: string): boolean { return process.argv.includes(name); }
function argument(name: string): string | null { const index = process.argv.indexOf(name); return index >= 0 && process.argv[index + 1] ? String(process.argv[index + 1]).trim() : null; }
function databaseUrl(): string {
  const explicit = argument("--database-url") || String(process.env.DATABASE_URL || "").trim();
  if (explicit) return explicit;
  const user = encodeURIComponent(String(process.env.POSTGRES_USER || "landos"));
  const password = encodeURIComponent(String(process.env.POSTGRES_PASSWORD || "landos_pwd"));
  const database = encodeURIComponent(String(process.env.POSTGRES_DB || "landos"));
  return `postgres://${user}:${password}@127.0.0.1:5433/${database}`;
}
function assertLocalApplyAllowed(urlText: string): void {
  if (!flag("--confirm-local-demo")) throw new Error("LOCAL_DEMO_CONFIRMATION_REQUIRED: pass --confirm-local-demo");
  const parsed = new URL(urlText);
  const host = parsed.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error(`LOCAL_DEMO_DATABASE_HOST_FORBIDDEN:${host}`);
  const runtime = String(process.env.GEOX_RUNTIME_ENV || "development").trim().toLowerCase();
  if (!["development", "dev", "local", "test"].includes(runtime)) throw new Error(`LOCAL_DEMO_RUNTIME_ENV_FORBIDDEN:${runtime}`);
}

async function verifyBundle(pool: Pool, bundle: DemoBundle): Promise<JsonRecord> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON ||= JSON.stringify({ local_demo_v1: LOCAL_CURSOR_KEY });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID ||= "local_demo_v1";
  const api = new PostgresMcftFieldTwinReadApiV1(pool);
  const request = { scope: bundle.scope };
  const [runtime, states, forecasts, scenarios, residuals, actionLifecycle, candidate, evaluation, trace, health] = await Promise.all([
    api.readRuntime(request),
    api.readStates({ ...request, limit: 50 }),
    api.readForecasts({ ...request, limit: 50 }),
    api.readScenarios({ ...request, limit: 50 }),
    api.readResiduals({ ...request, limit: 50 }),
    api.readActionLifecycle({ ...request, limit: 50 }),
    api.readModelGovernance({ ...request, collection_kind: "CALIBRATION_CANDIDATE", limit: 50 }),
    api.readModelGovernance({ ...request, collection_kind: "SHADOW_EVALUATION", limit: 50 }),
    api.readTrace(request),
    api.readHealth(request),
  ]);
  const count = (value: JsonRecord): number => Array.isArray(value.items) ? value.items.length : 0;
  return {
    runtime_root_graph_status: runtime.root_graph_status,
    state_count: count(states),
    forecast_count: count(forecasts),
    scenario_count: count(scenarios),
    residual_count: count(residuals),
    action_feedback_count: count(actionLifecycle),
    calibration_candidate_count: count(candidate),
    shadow_evaluation_count: count(evaluation),
    trace_node_count: Array.isArray(trace.nodes) ? trace.nodes.length : 0,
    health_relationship: health.health_relationship,
  };
}

async function main(): Promise<void> {
  const mode = flag("--apply") ? "apply" : flag("--verify") ? "verify" : "dry-run";
  const bundle = await buildDemoBundle();
  const route = `/operator/fields/${encodeURIComponent(bundle.scope.field_id)}?season_id=${encodeURIComponent(bundle.scope.season_id)}&zone_id=${encodeURIComponent(bundle.scope.zone_id)}`;
  if (mode === "dry-run") {
    console.log(JSON.stringify({
      ok: true,
      seed: "THREE_SURFACE_LOCAL_DEMO_V1",
      mode,
      scope: bundle.scope,
      canonical_fact_count: 16,
      root_member_count: bundle.root.members.length,
      route,
      boundaries: {
        local_only: true,
        runtime_source_authorized: false,
        canonical_production_write_authorized: false,
        model_activation_created: false,
        mcft_cap_08_authorized: false,
      },
    }, null, 2));
    return;
  }

  const url = databaseUrl();
  if (mode === "apply") assertLocalApplyAllowed(url);
  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    if (mode === "apply") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await assertRequiredRelations(client);
        await seedFieldNavigator(client, bundle.scope);
        await persistRootAndForecasts(client, bundle);
        await persistOptionalDomain(client, bundle);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
    const readback = await verifyBundle(pool, bundle);
    console.log(JSON.stringify({
      ok: true,
      seed: "THREE_SURFACE_LOCAL_DEMO_V1",
      mode,
      scope: bundle.scope,
      route,
      readback,
      boundaries: {
        local_only: true,
        runtime_source_authorized: false,
        canonical_production_write_authorized: false,
        model_activation_created: false,
        mcft_cap_08_authorized: false,
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
