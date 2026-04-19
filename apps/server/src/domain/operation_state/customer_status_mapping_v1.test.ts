import test from "node:test";
import assert from "node:assert/strict";
import {
  customerViewByStatusV1,
  operationStatusLabelV1,
  resolveCustomerViewStatusV1,
} from "./customer_status_mapping_v1.js";

test("customer status mapping: no approval and no task => PENDING_APPROVAL", () => {
  const status = resolveCustomerViewStatusV1({
    final_status: "PENDING",
    has_approval: false,
    has_task: false,
    has_receipt: false,
    has_acceptance: false,
    invalid_execution: false,
  });
  assert.equal(status, "PENDING_APPROVAL");
});

test("customer status mapping: task without receipt => PENDING_RECEIPT", () => {
  const status = resolveCustomerViewStatusV1({
    final_status: "DISPATCHED",
    has_approval: true,
    has_task: true,
    has_receipt: false,
    has_acceptance: false,
    invalid_execution: false,
  });
  assert.equal(status, "PENDING_RECEIPT");
});

test("customer status mapping: receipt without acceptance => PENDING_ACCEPTANCE", () => {
  const status = resolveCustomerViewStatusV1({
    final_status: "RUNNING",
    has_approval: true,
    has_task: true,
    has_receipt: true,
    has_acceptance: false,
    invalid_execution: false,
  });
  assert.equal(status, "PENDING_ACCEPTANCE");
});

test("customer status mapping: success terminal or acceptance => COMPLETED", () => {
  const fromSuccess = resolveCustomerViewStatusV1({
    final_status: "SUCCEEDED",
    has_approval: true,
    has_task: true,
    has_receipt: true,
    has_acceptance: false,
    invalid_execution: false,
  });
  assert.equal(fromSuccess, "COMPLETED");

  const fromAcceptance = resolveCustomerViewStatusV1({
    final_status: "PENDING_ACCEPTANCE",
    has_approval: true,
    has_task: true,
    has_receipt: true,
    has_acceptance: true,
    invalid_execution: false,
  });
  assert.equal(fromAcceptance, "COMPLETED");
});

test("customer status mapping: invalid_execution has highest priority", () => {
  const status = resolveCustomerViewStatusV1({
    final_status: "SUCCEEDED",
    has_approval: true,
    has_task: true,
    has_receipt: true,
    has_acceptance: true,
    invalid_execution: true,
  });
  assert.equal(status, "INVALID_EXECUTION");

  const view = customerViewByStatusV1("INVALID_EXECUTION");
  assert.deepEqual(view, {
    summary: "本次作业未被系统认定为有效执行",
    today_action: "需重新执行或补充证据",
    risk_level: "high",
  });
});

test("customer status mapping: summary/today_action/risk_level are frozen", () => {
  assert.deepEqual(customerViewByStatusV1("IN_PROGRESS"), {
    summary: "作业执行中，系统正在持续采集进度",
    today_action: "保持设备在线并关注执行状态",
    risk_level: "medium",
  });
  assert.deepEqual(customerViewByStatusV1("PENDING_APPROVAL"), {
    summary: "当前建议待审批，尚未进入执行阶段",
    today_action: "下一步：等待审批",
    risk_level: "medium",
  });
  assert.deepEqual(customerViewByStatusV1("PENDING_RECEIPT"), {
    summary: "作业已下发，等待回执数据",
    today_action: "督促执行端回传回执与证据",
    risk_level: "medium",
  });
  assert.deepEqual(customerViewByStatusV1("PENDING_ACCEPTANCE"), {
    summary: "已收到执行数据，待验收确认",
    today_action: "下一步：进入验收",
    risk_level: "low",
  });
  assert.deepEqual(customerViewByStatusV1("COMPLETED"), {
    summary: "作业已完成并形成闭环",
    today_action: "继续观察效果并归档证据",
    risk_level: "low",
  });
  assert.deepEqual(customerViewByStatusV1("INVALID_EXECUTION"), {
    summary: "本次作业未被系统认定为有效执行",
    today_action: "需重新执行或补充证据",
    risk_level: "high",
  });
  assert.equal(operationStatusLabelV1("INVALID_EXECUTION"), "执行无效");
});
