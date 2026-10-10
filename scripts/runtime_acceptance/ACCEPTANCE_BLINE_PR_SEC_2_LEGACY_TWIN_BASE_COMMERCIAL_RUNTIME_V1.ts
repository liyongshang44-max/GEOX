import assert from "node:assert/strict";
import { Pool } from "pg";

const BASE_URL = String(process.env.BASE_URL ?? process.env.API_BASE_URL ?? "").replace(/\/$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const COMMERCIAL_BEARER = String(process.env.GEOX_AO_ACT_TOKEN ?? process.env.GEOX_ACCEPTANCE_TOKEN ?? "").trim();
const ERROR = "LEGACY_TWIN_BASE_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";

if (!BASE_URL) throw new Error("BLINE_PR_SEC_2_TWIN_BASE_URL_REQUIRED");
if (!DATABASE_URL) throw new Error("BLINE_PR_SEC_2_TWIN_DATABASE_URL_REQUIRED");
if (!COMMERCIAL_BEARER) throw new Error("BLINE_PR_SEC_2_EXISTING_COMMERCIAL_BEARER_REQUIRED");

const ROUTES = [
  "/api/v1/twin-kernel/field-state-snapshots",
  "/api/v1/twin-kernel/forecast-runs",
  "/api/v1/twin-kernel/scenario-sets",
  "/api/v1/twin-kernel/calibration-replays",
  "/api/v1/twin-kernel/field-learning-candidates",
  "/api/v1/twin-kernel/decision-cycles",
] as const;

const TABLES = [
  "field_state_snapshot_v1",
  "forecast_run_v1",
  "scenario_set_v1",
  "calibration_replay_v1",
  "forecast_error_v1",
  "field_learning_candidate_v1",
  "decision_cycle_v1",
] as const;

type TableState = { present: boolean; rows: number };
type Snapshot = Record<(typeof TABLES)[number], TableState>;

async function snapshot(pool: Pool): Promise<Snapshot> {
  const result = {} as Snapshot;
  for (const table of TABLES) {
    const reg = await pool.query<{ present: boolean }>(`SELECT to_regclass('public.${table}') IS NOT NULL AS present`);
    const present = reg.rows[0]?.present === true;
    let rows = 0;
    if (present) {
      const count = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
      rows = Number(count.rows[0]?.n ?? "0");
    }
    result[table] = { present, rows };
  }
  return result;
}

function assertNoDelta(before: Snapshot, after: Snapshot, label: string): void {
  for (const table of TABLES) {
    assert.equal(after[table].present, before[table].present, `${label}: ${table} table-presence delta must be zero`);
    assert.equal(after[table].rows, before[table].rows, `${label}: ${table} row-count delta must be zero`);
  }
}

const payload = {
  tenant_id: "caller-tenant",
  project_id: "caller-project",
  group_id: "caller-group",
  field_id: "caller-field",
  snapshot_id: "caller-snapshot",
  forecast_run_id: "caller-forecast",
  scenario_set_id: "caller-scenario",
  forecast_error_id: "caller-error",
  field_learning_candidate_id: "caller-candidate",
  observed: { observed_at: "2026-09-02T00:00:00.000Z", post_soil_moisture_percent: 42 },
  external_refs: { recommendation_id: "caller-recommendation" },
};

const cases = [
  { name: "anonymous", headers: {} },
  { name: "arbitrary_bearer", headers: { authorization: "Bearer arbitrary-untrusted-twin-caller" } },
  { name: "existing_commercial_bearer", headers: { authorization: `Bearer ${COMMERCIAL_BEARER}` } },
  { name: "caller_controlled_identifiers_payload", headers: { authorization: `Bearer ${COMMERCIAL_BEARER}` } },
] as const;

async function reject(route: string, testCase: (typeof cases)[number]): Promise<number> {
  const response = await fetch(`${BASE_URL}${route}`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", ...testCase.headers },
    body: JSON.stringify(testCase.name === "caller_controlled_identifiers_payload" ? payload : {}),
  });
  assert.equal(response.status, 403, `${route} ${testCase.name} must fail closed`);
  const body = await response.json() as { ok?: unknown; error?: unknown };
  assert.equal(body.ok, false, `${route} ${testCase.name} rejection ok flag`);
  assert.equal(body.error, ERROR, `${route} ${testCase.name} rejection error`);
  return response.status;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    const before = await snapshot(pool);
    const matrix: Array<{ route: string; case: string; status: number }> = [];
    let bsec008Before: Snapshot | null = null;
    let bsec008After: Snapshot | null = null;

    for (const route of ROUTES) {
      if (route === "/api/v1/twin-kernel/calibration-replays") bsec008Before = await snapshot(pool);
      for (const testCase of cases) {
        matrix.push({ route, case: testCase.name, status: await reject(route, testCase) });
      }
      if (route === "/api/v1/twin-kernel/calibration-replays") {
        await new Promise((resolve) => setTimeout(resolve, 100));
        bsec008After = await snapshot(pool);
        assertNoDelta(bsec008Before!, bsec008After, "BSEC-008 dual-writer proof");
        assert.equal(
          bsec008After.calibration_replay_v1.rows - bsec008Before!.calibration_replay_v1.rows,
          0,
          "BSEC-008 calibration_replay_v1 delta must be zero",
        );
        assert.equal(
          bsec008After.forecast_error_v1.rows - bsec008Before!.forecast_error_v1.rows,
          0,
          "BSEC-008 forecast_error_v1 delta must be zero",
        );
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    const after = await snapshot(pool);
    assertNoDelta(before, after, "six-route Commercial runtime proof");
    assert.equal(matrix.length, ROUTES.length * cases.length, "rejection matrix size drift");

    const deltas = Object.fromEntries(TABLES.map((table) => [table, {
      row_delta: after[table].rows - before[table].rows,
      table_presence_delta: Number(after[table].present) - Number(before[table].present),
    }]));

    console.log(JSON.stringify({
      result: "PASS",
      runtime: "docker-compose.commercial_v1.yml server registration",
      containment: "COMMERCIAL_FAIL_CLOSE",
      routes: ROUTES,
      rejection_cases_per_route: cases.map((item) => item.name),
      total_rejections: matrix.length,
      before,
      after,
      deltas,
      bsec008_dual_target: {
        calibration_replay_v1_delta: bsec008After!.calibration_replay_v1.rows - bsec008Before!.calibration_replay_v1.rows,
        forecast_error_v1_delta: bsec008After!.forecast_error_v1.rows - bsec008Before!.forecast_error_v1.rows,
      },
      new_principal_created: false,
      new_capability_created: false,
      mcft_cutover: false,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
