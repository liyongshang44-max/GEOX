import test from "node:test";
import assert from "node:assert/strict";
import { appendSkillRunFact } from "../src/domain/skill_registry/facts";

type FactRow = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: {
    type: string;
    payload: Record<string, unknown>;
  };
};

function createFactsDbMock() {
  const facts: FactRow[] = [];

  return {
    async query(sql: string, params: unknown[]) {
      if (sql.startsWith("INSERT INTO facts")) {
        const [fact_id, occurred_at, source, record_json] = params;
        facts.push({
          fact_id: String(fact_id),
          occurred_at: String(occurred_at),
          source: String(source),
          record_json: record_json as FactRow["record_json"],
        });
        return { rowCount: 1, rows: [] };
      }

      if (sql.startsWith("SELECT record_json")) {
        const [fact_id] = params;
        const matched = facts.find((fact) => fact.fact_id === fact_id);
        return { rows: matched ? [{ record_json: matched.record_json }] : [] };
      }

      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

test("appendSkillRunFact accepts result_status=PENDING and can be read back", async () => {
  const db = createFactsDbMock();

  const appended = await appendSkillRunFact(db as any, {
    tenant_id: "tenant-1",
    project_id: "project-1",
    group_id: "group-1",
    skill_id: "skill-1",
    version: "1.0.0",
    category: "OPS",
    status: "ACTIVE",
    result_status: "PENDING",
    trigger_stage: "before_dispatch",
    scope_type: "TENANT",
    rollout_mode: "DIRECT",
    bind_target: "default",
    input_digest: "input-digest",
    output_digest: "output-digest",
  });

  assert.equal(appended.payload.result_status, "PENDING");

  const read = await db.query("SELECT record_json FROM facts WHERE fact_id = $1", [appended.fact_id]);
  assert.equal(read.rows.length, 1);
  assert.equal(read.rows[0].record_json.type, "skill_run_v1");
  assert.equal(read.rows[0].record_json.payload.result_status, "PENDING");
});
