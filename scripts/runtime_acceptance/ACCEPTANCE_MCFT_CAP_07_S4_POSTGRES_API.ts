// Purpose: prove S4 production PostgreSQL read semantics against isolated PostgreSQL 16 fixtures.
// Boundary: application code under test remains SELECT-only; fixture writes are delegated to test-only modules.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { authorizeMcftFieldTwinReadV1 } from "../../apps/server/src/auth/mcft_field_twin_read_authz_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";
import { PostgresFieldTwinProjectionReadRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_projection_read_repository_v1.js";
import { PostgresFieldTwinSnapshotRepositoryV1 } from "../../apps/server/src/repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";
import { ROOT, now, pool, resetSchema, scope, seedStateHistory } from "./mcft_cap_07_s4_postgres_fixture_core_v1.js";
import { seedCurrentScenarioDecisionPlanFeedback, seedRuntimeRoot } from "./mcft_cap_07_s4_postgres_runtime_fixture_v1.js";

const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_S4_POSTGRES_API_RESULT.json");
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = async (name: string, action: () => Promise<void> | void) => { await action(); checks.push({ name, status: "PASS" }); };

async function main(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s4-key": "0123456789abcdef0123456789abcdef" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s4-key";
  try {
    await resetSchema();
    const states = await seedStateHistory(360);
    const api = new PostgresMcftFieldTwinReadApiV1(pool);

    await check("COLLECTIONS_DO_NOT_REQUIRE_CURRENT_RUNTIME_ROOT", async () => {
      const page = await api.readStates({ scope, limit: 50 }) as any;
      assert.equal(page.items.length, 50);
      assert.equal(page.has_more, true);
      assert.equal(typeof page.next_cursor, "string");
      const second = await api.readStates({ scope, limit: 50, cursor: page.next_cursor }) as any;
      assert.equal(second.items.length, 50);
      const empty = await api.readForecasts({ scope, limit: 50 }) as any;
      assert.deepEqual(empty.items, []);
      assert.equal(empty.has_more, false);
    });

    await check("RUNTIME_ROOT_404_AND_BROKEN_POINTER_FAIL_CLOSED", async () => {
      await assert.rejects(() => api.readRuntime({ scope }), /MCFT_RUNTIME_NOT_ESTABLISHED/);
      const client = await pool.connect();
      try { await client.query(`INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,'missing-lineage','missing-lineage')`, Object.values(scope)); }
      finally { client.release(); }
      await assert.rejects(() => api.readRuntime({ scope }), /MCFT_OPERATIONAL_POINTER_TARGET_MISSING/);
      await pool.query(`DELETE FROM public.twin_active_lineage_index_v1`);
    });

    const root = await seedRuntimeRoot();

    await check("VALID_ROOT_AND_CURRENT_VS_LATEST_SCENARIO_SEPARATION", async () => {
      const runtime = await api.readRuntime({ scope }) as any;
      assert.equal(runtime.root_graph_status, "COMPLETE_EXACT_GRAPH");
      assert.equal(runtime.current_tick_forecast_result.object_ref, root.currentForecast.object_id);
      assert.equal(runtime.current_scenario_attachment.attachment_status, "NOT_ATTACHED_TO_CURRENT_RUNTIME_GRAPH");
      assert.equal(runtime.latest_scenario_in_scope.item.object_ref, root.oldScenario.object_id);
      assert.equal(runtime.scenario_source_forecast.item.object_ref, root.oldForecast.object_id);
      for (const summary of [runtime.action_feedback_summary, runtime.forecast_residual_summary, runtime.calibration_candidate_summary, runtime.shadow_evaluation_summary, runtime.model_activation_summary]) {
        assert.equal(summary.count_status, "NOT_COMPUTED");
        assert.equal(summary.total_count, null);
      }
    });

    await check("TIMELINE_SQL_KEYSET_BEYOND_201_AND_HEALTH_ROLES", async () => {
      const snapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool);
      const repository = new PostgresFieldTwinProjectionReadRepositoryV1();
      await snapshots.withReadOnlyRequestSnapshot(scope, async (context) => {
        const from = states[300].logical_time as string;
        const page = await repository.readTimelineEvents(context, 11, { from_logical_time: from, until_logical_time: null }, null);
        assert.equal(page.length, 11);
        assert.ok(page.every((event) => event.logical_time >= from));
        const after = await repository.readTimelineEvents(context, 11, { from_logical_time: null, until_logical_time: null }, { logical_time: states[300].logical_time as string, event_rank: 40, object_ref: states[300].object_id });
        assert.equal(after.length, 11);
        assert.ok(after[0].object_ref > states[300].object_id || after[0].logical_time > states[300].logical_time);
        const health = await repository.readTimelineEvents(context, 201, { from_logical_time: now(400), until_logical_time: null }, null);
        const terminal = health.find((event) => event.object_ref === root.terminalHealth.object_id)!;
        const operational = health.find((event) => event.object_ref === root.operationalHealth.object_id)!;
        assert.equal(terminal.transaction_family, "A_STATE_TICK_COMMIT");
        assert.equal(terminal.health_role, "TERMINAL_RECORD_SET_MEMBER");
        assert.equal(operational.transaction_family, "F_OPERATIONAL_ATTEMPT_HEALTH");
        assert.equal(operational.health_role, "OPERATIONAL_ATTEMPT_AUDIT");
      });
    });

    await check("REPLAY_PLAN_TIMELINE_AND_EXACT_OPTIONAL_ATTACHMENTS", async () => {
      await seedCurrentScenarioDecisionPlanFeedback(root.currentForecast, root.posterior);
      const runtime = await api.readRuntime({ scope }) as any;
      assert.equal(runtime.current_scenario_attachment.item.object_ref, "scenario-current");
      assert.equal(runtime.current_human_decision.item.object_ref, "decision-current");
      assert.equal(runtime.current_approved_plan.item.object_ref, "plan-current");
      const actions = await api.readActionLifecycle({ scope, limit: 20 }) as any;
      assert.equal(actions.items[0].object_ref, "feedback-current");
      const snapshots = new PostgresFieldTwinSnapshotRepositoryV1(pool);
      const repository = new PostgresFieldTwinProjectionReadRepositoryV1();
      await snapshots.withReadOnlyRequestSnapshot(scope, async (context) => {
        const timeline = await repository.readTimelineEvents(context, 201, { from_logical_time: now(420), until_logical_time: null }, null);
        const plan = timeline.find((event) => event.event_kind === "APPROVED_PLAN_EVIDENCE");
        assert.equal(plan?.object_ref, "plan-current");
        assert.equal(plan?.object_type, "approved_irrigation_plan_snapshot_v1");
      });
    });

    await check("MODEL_GOVERNANCE_COMPOSER_RUNS_IN_PAGE_SNAPSHOT", async () => {
      const page = await api.readModelGovernance({ scope, collection_kind: "CALIBRATION_CANDIDATE", limit: 20 }) as any;
      assert.deepEqual(page.items, []);
    });

    await check("STRICT_PILOT_AND_COMMERCIAL_AUTH_FAIL_CLOSED", () => {
      const old = { env: process.env.GEOX_RUNTIME_ENV, json: process.env.GEOX_TOKENS_JSON, file: process.env.GEOX_TOKENS_FILE, token: process.env.GEOX_TOKEN };
      process.env.GEOX_RUNTIME_ENV = "pilot";
      delete process.env.GEOX_TOKENS_JSON;
      delete process.env.GEOX_TOKENS_FILE;
      process.env.GEOX_TOKEN = "development-token-must-not-work";
      const request = { headers: { authorization: "Bearer development-token-must-not-work" } } as any;
      assert.equal(authorizeMcftFieldTwinReadV1(request), null);
      process.env.GEOX_TOKENS_JSON = JSON.stringify({ version: "ao_act_tokens_v0", tokens: [{ token: "strict-token", token_id: "strict-id", actor_id: "actor", ...scope, scopes: ["fields.read"], revoked: false, role: "viewer", allowed_field_ids: [scope.field_id] }] });
      const strictRequest = { headers: { authorization: "Bearer strict-token" } } as any;
      assert.equal(authorizeMcftFieldTwinReadV1(strictRequest)?.tenant_id, scope.tenant_id);
      if (old.env === undefined) delete process.env.GEOX_RUNTIME_ENV; else process.env.GEOX_RUNTIME_ENV = old.env;
      if (old.json === undefined) delete process.env.GEOX_TOKENS_JSON; else process.env.GEOX_TOKENS_JSON = old.json;
      if (old.file === undefined) delete process.env.GEOX_TOKENS_FILE; else process.env.GEOX_TOKENS_FILE = old.file;
      if (old.token === undefined) delete process.env.GEOX_TOKEN; else process.env.GEOX_TOKEN = old.token;
    });

    await check("READ_ADAPTER_DOES_NOT_MUTATE_FIXTURE", async () => {
      const before = Number((await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.facts")).rows[0].count);
      await api.readStates({ scope, limit: 10 });
      await api.readRuntime({ scope });
      const after = Number((await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.facts")).rows[0].count);
      assert.equal(after, before);
      const source = fs.readFileSync(path.join(ROOT, "apps/server/src/repositories/field_twin_read_model/postgres_field_twin_projection_read_repository_v1.ts"), "utf8");
      assert.doesNotMatch(source, /SELECT\s+pg_catalog\.count\(\*\)/i);
    });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_postgres_api_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
    console.log(JSON.stringify({ status: "PASS", check_count: checks.length }));
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_postgres_api_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
