import assert from "node:assert/strict";
import { runAgronomyAgentOnce } from "../../apps/server/src/jobs/agronomy_agent.ts";

type QueryResult = { rows: any[]; rowCount: number };
type CapturedFact = { fact_id: string; source: string; record_json: any };

const PROGRAM = {
  status: "ACTIVE",
  program_id: "prg_bline_agent_exact_001",
  field_id: "field_bline_agent_exact_001",
  season_id: "season_bline_agent_exact_001",
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  crop_code: "corn",
  crop_stage: "vegetative",
  days_after_planting: "35",
  updated_ts: String(Date.now()),
  created_ts: String(Date.now()-1000),
  occurred_at: new Date().toISOString(),
  fact_id: "fact_program_bline_agent_exact_001",
};

class FakePool {
  readonly telemetry: any[];
  readonly inserts: CapturedFact[] = [];
  constructor(telemetry: any[]) { this.telemetry = telemetry; }

  async query(sqlRaw: any, params: any[] = []): Promise<QueryResult> {
    const sql = String(sqlRaw);

    if (sql.includes("WITH latest_soil AS")) {
      return { rows: this.telemetry, rowCount: this.telemetry.length };
    }

    if (sql.includes("FROM facts") && sql.includes("'field_program_v1'") && sql.includes("field_id}') = $1")) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes("FROM facts") && sql.includes("'field_program_v1'")) {
      return { rows: [PROGRAM], rowCount: 1 };
    }

    if (sql.includes("FROM facts") && sql.includes("'operation_plan_v1'") && sql.includes("NOT IN")) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes("FROM facts") && sql.includes("'recommendation_v1'") && sql.includes("occurred_at >=")) {
      const existing = this.inserts.find((x) => x.record_json?.type === "recommendation_v1");
      if (!existing) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          matched_program_id: existing.record_json.payload.program_id,
          matched_recommendation_id: existing.record_json.payload.recommendation_id,
        }],
        rowCount: 1,
      };
    }

    if (sql.includes("INSERT INTO facts")) {
      this.inserts.push({
        fact_id: String(params[0] ?? ""),
        source: String(params[1] ?? ""),
        record_json: params[2],
      });
      return { rows: [], rowCount: 1 };
    }

    throw new Error("UNEXPECTED_FAKE_POOL_QUERY:" + sql.replace(/\s+/g, " ").slice(0, 240));
  }
}

async function missingTelemetryCase() {
  const pool = new FakePool([]);
  const result = await runAgronomyAgentOnce(pool as any);
  assert.equal(result.created, 0, "missing telemetry must create zero signals");
  assert.equal(result.skipped_by_reason.no_telemetry, 1, "missing telemetry must be counted");
  assert.equal(pool.inserts.length, 0, "missing telemetry must create zero facts");
  return {
    created: result.created,
    no_telemetry: result.skipped_by_reason.no_telemetry,
    writes: pool.inserts.length,
  };
}

async function exactTelemetryCase() {
  const telemetryFactId = "raw_fact_bline_agent_soil_001";
  const pool = new FakePool([{
    tenant_id: PROGRAM.tenant_id,
    field_id: PROGRAM.field_id,
    device_id: "device_bline_agent_soil_001",
    telemetry_fact_id: telemetryFactId,
    soil_moisture: 18,
  }]);

  const result = await runAgronomyAgentOnce(pool as any);
  const types = pool.inserts.map((x) => String(x.record_json?.type ?? ""));
  assert.equal(result.created, 1, "exact telemetry should produce one retained legacy signal");
  assert.deepEqual(types, ["recommendation_v1"], "Agent may write recommendation_v1 signal only");

  const signal = pool.inserts[0]?.record_json?.payload ?? {};
  assert.equal(signal.authority_mode, "LEGACY_AGRONOMY_SIGNAL_ONLY");
  assert.equal(signal.human_approval_required, true);
  assert.equal(signal.no_direct_execution, true);
  assert.equal(signal.approval_created, false);
  assert.equal(signal.operation_plan_created, false);
  assert.equal(signal.task_created, false);
  assert.equal(signal.dispatch_created, false);
  assert.equal(signal.telemetry_fact_id, telemetryFactId);
  assert.deepEqual(signal.evidence_refs, [telemetryFactId]);
  assert.equal(signal.source_input?.fact_id, telemetryFactId);
  assert.equal(signal.source_input?.metric, "soil_moisture");
  assert.equal(signal.source_input?.value, 18);
  assert.equal(types.includes("decision_recommendation_v1"), false);
  assert.equal(types.includes("operation_plan_v1"), false);
  assert.equal(types.includes("operation_plan_transition_v1"), false);

  return {
    created: result.created,
    types,
    telemetry_fact_id: signal.telemetry_fact_id,
    evidence_refs: signal.evidence_refs,
    authority_mode: signal.authority_mode,
    no_direct_execution: signal.no_direct_execution,
  };
}

async function main() {
  const missing = await missingTelemetryCase();
  const exact = await exactTelemetryCase();
  console.log(JSON.stringify({
    ok: true,
    suite: "ACCEPTANCE_BLINE_AGRONOMY_AGENT_FAIL_CLOSED_RUNTIME_V1",
    checks: {
      missing_telemetry_zero_writes: missing.writes === 0,
      missing_telemetry_counted: missing.no_telemetry === 1,
      exact_telemetry_fact_provenance: exact.telemetry_fact_id === "raw_fact_bline_agent_soil_001",
      retained_signal_only: exact.types.length === 1 && exact.types[0] === "recommendation_v1",
      non_executable_signal: exact.no_direct_execution === true,
    },
    missing,
    exact,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
