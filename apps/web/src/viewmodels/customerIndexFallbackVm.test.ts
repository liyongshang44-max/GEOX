import assert from "node:assert/strict";
import { buildCustomerFieldsIndexVm } from "./customerFieldsIndexVm";
import { buildCustomerOperationsIndexVm } from "./customerOperationsIndexVm";

const forbiddenFormalConclusions = ["已通过验收", "可信价值", "已形成田块记忆"];

const fieldsFallbackVm = buildCustomerFieldsIndexVm({
  source: "dashboard_aggregate_fallback",
  dataScope: "FALLBACK_RECENT_ONLY",
  is_fallback: true,
  generated_at: "2026-06-07T00:00:00.000Z",
  field_count: 1,
  data_scope_note: "当前展示近期/可见地块，非完整授权列表",
  fields: [
    {
      field_id: "field_1",
      field_name: "示范田",
      risk_level: "LOW",
      risk_reasons: ["已形成田块记忆", "可信价值充足"],
      crop_name: "玉米",
      stage_name: "拔节期",
      recent_operation_title: "灌溉作业已通过验收",
      summary: "customer-safe summary",
    },
  ],
} as any);

const operationsFallbackVm = buildCustomerOperationsIndexVm({
  source: "dashboard_aggregate_fallback",
  dataScope: "FALLBACK_RECENT_ONLY",
  is_fallback: true,
  generated_at: "2026-06-07T00:00:00.000Z",
  operation_count: 1,
  data_scope_note: "当前仅展示近期作业，非全部作业列表",
  operations: [
    {
      operation_id: "operation_1",
      field_name: "示范田",
      customer_title: "灌溉作业",
      operation_type: "IRRIGATION",
      final_status: "ACCEPTED",
      acceptance_status: "PASS",
      chain_status: "FORMAL_CHAIN_PASSED",
      data_trust_status: "FORMAL",
      trust_level: "FORMAL_ACCEPTED",
      summary: "customer-safe operation summary",
    },
  ],
} as any);

const fieldsErrorVm = buildCustomerFieldsIndexVm({
  source: "empty_error_state",
  dataScope: "ERROR_EMPTY",
  is_fallback: true,
  generated_at: "2026-06-07T00:00:00.000Z",
  field_count: 0,
  fields: [],
  data_scope_note: "正式报告条件不足，地块列表暂不可用，请稍后刷新",
});

const operationsErrorVm = buildCustomerOperationsIndexVm({
  source: "empty_error_state",
  dataScope: "ERROR_EMPTY",
  is_fallback: true,
  generated_at: "2026-06-07T00:00:00.000Z",
  operation_count: 0,
  operations: [],
  data_scope_note: "正式报告条件不足，作业列表暂不可用，请稍后刷新",
});

const visibleText = JSON.stringify({ fieldsFallbackVm, operationsFallbackVm, fieldsErrorVm, operationsErrorVm });
for (const token of forbiddenFormalConclusions) {
  assert.equal(visibleText.includes(token), false, `fallback VM leaked formal conclusion: ${token}`);
}

assert.equal(fieldsFallbackVm.cards[0]?.riskLabel, "正式报告条件不足");
assert.equal(fieldsFallbackVm.cards[0]?.summaryText, "customer-safe summary");
assert.equal(fieldsFallbackVm.cards[0]?.href, "/customer/fields/field_1");
assert.equal(fieldsErrorVm.emptyState.title, "正式报告条件不足");
assert.equal(fieldsErrorVm.cards.length, 0);
assert(fieldsErrorVm.subtitle.includes("地块列表暂不可用"));

assert.equal(operationsFallbackVm.rows[0]?.statusLine, "正式报告条件不足 · 列表暂不可用 · 作业列表暂不可用");
assert.equal(operationsFallbackVm.rows[0]?.summaryText, "customer-safe operation summary");
assert.equal(operationsFallbackVm.rows[0]?.href, "/customer/operations/operation_1");
assert.equal(operationsErrorVm.emptyState.title, "正式报告条件不足");
assert.equal(operationsErrorVm.rows.length, 0);
assert(operationsErrorVm.subtitle.includes("作业列表暂不可用"));

console.log("customerIndexFallbackVm smoke passed");
