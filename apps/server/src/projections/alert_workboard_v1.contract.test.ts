import test from "node:test";
import assert from "node:assert/strict";

import { projectAlertWorkboardV1, DEFAULT_WORKFLOW_PRIORITY_V1, DEFAULT_WORKFLOW_STATUS_V1 } from "./alert_workboard_v1";

const scope = {
  tenant_id: "t-1",
  project_id: "p-1",
  group_id: "g-1",
};

test("alert workboard v1: merges workflow fields with defaults", () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const base = projectAlertWorkboardV1({
    scope,
    operations: [],
    telemetry_health: [
      {
        ...scope,
        device_id: "d-1",
        field_id: "f-1",
        heartbeat_lag_ms: 16 * 60 * 1000,
      },
    ],
    workflow: [],
    nowMs,
    device_field_map: new Map([["d-1", "f-1"]]),
  });

  assert.equal(base.length, 1);
  assert.equal(base[0]?.workflow_status, DEFAULT_WORKFLOW_STATUS_V1);
  assert.equal(base[0]?.priority, DEFAULT_WORKFLOW_PRIORITY_V1);
  assert.equal(base[0]?.sla_due_at, null);
  assert.equal(base[0]?.sla_breached, false);
  assert.equal(base[0]?.field_id, "f-1");
  assert.equal(base[0]?.device_id, "d-1");
});

test("alert workboard v1: applies breached-first default sort and workflow filters", () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const seed = projectAlertWorkboardV1({
    scope,
    operations: [],
    telemetry_health: [
      {
        ...scope,
        device_id: "d-1",
        field_id: "f-1",
        heartbeat_lag_ms: 16 * 60 * 1000,
      },
      {
        ...scope,
        device_id: "d-2",
        field_id: "f-2",
        telemetry_lag_ms: 11 * 60 * 1000,
      },
    ],
    workflow: [],
    nowMs,
    device_field_map: new Map([
      ["d-1", "f-1"],
      ["d-2", "f-2"],
    ]),
  });

  const high = seed.find((x) => x.category === "DEVICE_HEARTBEAT_STALE");
  const medium = seed.find((x) => x.category === "TELEMETRY_HEALTH_DEGRADED");
  assert.ok(high?.alert_id);
  assert.ok(medium?.alert_id);

  const items = projectAlertWorkboardV1({
    scope,
    operations: [],
    telemetry_health: [
      {
        ...scope,
        device_id: "d-1",
        field_id: "f-1",
        heartbeat_lag_ms: 16 * 60 * 1000,
      },
      {
        ...scope,
        device_id: "d-2",
        field_id: "f-2",
        telemetry_lag_ms: 11 * 60 * 1000,
      },
    ],
    workflow: [
      {
        alert_id: String(medium?.alert_id),
        workflow_status: "ASSIGNED",
        assignee_actor_id: "actor-1",
        priority: 2,
        sla_due_at: nowMs - 1,
      },
      {
        alert_id: String(high?.alert_id),
        workflow_status: "OPEN",
        priority: 1,
      },
    ],
    filter: { workflow_status: ["ASSIGNED"], sla_breached: true },
    nowMs,
    device_field_map: new Map([
      ["d-1", "f-1"],
      ["d-2", "f-2"],
    ]),
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.category, "TELEMETRY_HEALTH_DEGRADED");
  assert.equal(items[0]?.workflow_status, "ASSIGNED");
  assert.equal(items[0]?.sla_breached, true);
});

test("alert workboard v1: supports operation_id filter", () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const operationPlanIdA = "opl_a";
  const operationPlanIdB = "opl_b";
  const items = projectAlertWorkboardV1({
    scope,
    operations: [
      {
        operation_plan_id: operationPlanIdA,
        operation_state: {
          operation_id: operationPlanIdA,
          operation_plan_id: operationPlanIdA,
          tenant_id: scope.tenant_id,
          project_id: scope.project_id,
          group_id: scope.group_id,
          field_id: "f-1",
          device_id: "d-1",
          action_type: "IRRIGATE",
          status: "DONE",
          final_status: "DONE",
          acceptance: null,
          timeline: {},
        } as any,
        evidence_bundle: {},
        acceptance: null,
        receipt: null,
        cost: {},
      },
      {
        operation_plan_id: operationPlanIdB,
        operation_state: {
          operation_id: operationPlanIdB,
          operation_plan_id: operationPlanIdB,
          tenant_id: scope.tenant_id,
          project_id: scope.project_id,
          group_id: scope.group_id,
          field_id: "f-2",
          device_id: "d-2",
          action_type: "IRRIGATE",
          status: "FAILED",
          final_status: "FAILED",
          acceptance: null,
          timeline: {},
        } as any,
        evidence_bundle: {},
        acceptance: null,
        receipt: null,
        cost: {},
      },
    ],
    telemetry_health: [],
    workflow: [],
    filter: { operation_id: [operationPlanIdB] },
    nowMs,
    operation_field_map: new Map([
      [operationPlanIdA, "f-1"],
      [operationPlanIdB, "f-2"],
    ]),
    operation_device_map: new Map([
      [operationPlanIdA, "d-1"],
      [operationPlanIdB, "d-2"],
    ]),
  });
  assert.ok(items.length >= 1);
  assert.ok(items.every((item) => String(item.operation_plan_id ?? "") === operationPlanIdB));
});

test("alert workboard v1: uses linked alert-operation relation when present", () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const seed = projectAlertWorkboardV1({
    scope,
    operations: [],
    telemetry_health: [
      {
        ...scope,
        device_id: "d-3",
        field_id: "f-3",
        heartbeat_lag_ms: 16 * 60 * 1000,
      },
    ],
    workflow: [],
    nowMs,
    device_field_map: new Map([["d-3", "f-3"]]),
  });
  const target = seed[0];
  assert.ok(target?.alert_id);

  const items = projectAlertWorkboardV1({
    scope,
    operations: [],
    telemetry_health: [
      {
        ...scope,
        device_id: "d-3",
        field_id: "f-3",
        heartbeat_lag_ms: 16 * 60 * 1000,
      },
    ],
    workflow: [],
    alert_operation_map: new Map([[String(target?.alert_id), { operation_id: "op-linked-1" }]]),
    operation_field_map: new Map([["op-linked-1", "f-op"]]),
    operation_device_map: new Map([["op-linked-1", "d-op"]]),
    nowMs,
  });
  assert.equal(items[0]?.operation_plan_id, "op-linked-1");
  assert.equal(items[0]?.field_id, "f-op");
  assert.equal(items[0]?.device_id, "d-op");
});
