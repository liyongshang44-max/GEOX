import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAoActV1Routes } from "./control_ao_act.js";

class ReceiptContractPool {
  public insertedTypes: string[] = [];

  constructor(private opts: { taskExists?: boolean } = {}) {}

  async query(sql: string, params?: any[]) {
    const text = String(sql);

    if (text.includes("CREATE TABLE") || text.includes("ALTER TABLE") || text.includes("CREATE INDEX")) {
      return { rows: [], rowCount: 0 };
    }

    if (text.includes("ao_act_task_v0") && text.includes("LIMIT 1")) {
      if (this.opts.taskExists === false) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          record_json: {
            type: "ao_act_task_v0",
            payload: {
              action_type: "IRRIGATE",
              parameter_schema: {
                keys: [{ name: "duration_sec", type: "number", min: 1 }],
              },
              meta: {
                expected_evidence_requirements: ["dispatch_ack"],
              },
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.includes("ao_act_receipt_v0") && text.includes("meta,idempotency_key")) {
      return { rows: [], rowCount: 0 };
    }

    if (text.includes("FROM facts") && text.includes("operation_plan_v1") && text.includes("LIMIT 1")) {
      return {
        rows: [{
          record_json: {
            type: "operation_plan_v1",
            payload: {
              status: "ACKED",
              operation_plan_id: "opl_1",
              tenant_id: "tenantA",
              project_id: "projectA",
              group_id: "groupA",
            },
          },
        }],
        rowCount: 1,
      };
    }

    if (text.startsWith("INSERT INTO facts")) {
      const record = params?.[2] ?? params?.[3] ?? null;
      const type = String(record?.type ?? "");
      if (type) this.insertedTypes.push(type);
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

function validPayload() {
  return {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    operation_plan_id: "opl_1",
    act_task_id: "task_1",
    executor_id: { kind: "script", id: "executor_1", namespace: "sim" },
    execution_time: { start_ts: 1_700_000_000_000, end_ts: 1_700_000_030_000 },
    execution_coverage: { kind: "field", ref: "field_1" },
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: 20, chemical_ml: null },
    logs_refs: [{ kind: "dispatch_ack", ref: "log_1" }],
    constraint_check: { violated: false, violations: [] },
    observed_parameters: { duration_sec: 30 },
    meta: { idempotency_key: "idem_1", command_id: "task_1" },
  };
}

async function setupApp(pool: ReceiptContractPool) {
  process.env.GEOX_TOKEN = "receipt-contract-token";
  process.env.GEOX_TENANT_ID = "tenantA";
  process.env.GEOX_PROJECT_ID = "projectA";
  process.env.GEOX_GROUP_ID = "groupA";
  process.env.GEOX_SCOPES = "ao_act.receipt.write";

  const app = Fastify();
  registerAoActV1Routes(app, pool as any);
  await app.ready();
  return app;
}

test("receipt minimum contract: missing meta.idempotency_key -> IDEMPOTENCY_KEY_REQUIRED", async () => {
  const pool = new ReceiptContractPool();
  const app = await setupApp(pool);
  const payload = validPayload();
  delete (payload.meta as any).idempotency_key;

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload,
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "IDEMPOTENCY_KEY_REQUIRED");
  await app.close();
});

test("receipt minimum contract: missing meta.command_id -> MISSING_COMMAND_ID", async () => {
  const pool = new ReceiptContractPool();
  const app = await setupApp(pool);
  const payload = validPayload();
  delete (payload.meta as any).command_id;

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload,
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "MISSING_COMMAND_ID");
  await app.close();
});

test("receipt minimum contract: command_id != act_task_id -> COMMAND_TASK_ID_MISMATCH", async () => {
  const pool = new ReceiptContractPool();
  const app = await setupApp(pool);
  const payload = validPayload();
  (payload.meta as any).command_id = "task_other";

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload,
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "COMMAND_TASK_ID_MISMATCH");
  await app.close();
});

test("receipt minimum contract: logs_refs = [] is rejected", async () => {
  const pool = new ReceiptContractPool();
  const app = await setupApp(pool);
  const payload = validPayload();
  payload.logs_refs = [];

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload,
  });

  assert.equal(res.statusCode, 400);
  await app.close();
});

test("receipt minimum contract: missing observed_parameters is rejected", async () => {
  const pool = new ReceiptContractPool();
  const app = await setupApp(pool);
  const payload: any = validPayload();
  delete payload.observed_parameters;

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload,
  });

  assert.equal(res.statusCode, 400);
  await app.close();
});

test("receipt minimum contract: task missing -> UNKNOWN_TASK", async () => {
  const pool = new ReceiptContractPool({ taskExists: false });
  const app = await setupApp(pool);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload: validPayload(),
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "UNKNOWN_TASK");
  await app.close();
});

test("receipt minimum contract: valid minimal receipt writes receipt and advances operation plan", async () => {
  const pool = new ReceiptContractPool();
  const app = await setupApp(pool);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/actions/receipt",
    headers: { authorization: "Bearer receipt-contract-token" },
    payload: validPayload(),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.ok(pool.insertedTypes.includes("ao_act_receipt_v0"));
  assert.ok(pool.insertedTypes.includes("operation_plan_transition_v1"));
  assert.ok(pool.insertedTypes.includes("operation_plan_v1"));
  await app.close();
});
