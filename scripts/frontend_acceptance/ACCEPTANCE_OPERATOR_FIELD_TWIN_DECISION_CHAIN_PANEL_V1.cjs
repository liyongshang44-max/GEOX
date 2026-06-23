// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_DECISION_CHAIN_PANEL_V1.cjs
// Purpose: verify H51 Operator Twin field workspace exposes H31-H45 as a read-only decision-to-water-response chain.
// Boundary: this acceptance checks frontend wiring only; it must not require customer exposure or direct execution controls.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const WORKSPACE_PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx";
const POST_IRRIGATION_PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinPostIrrigationPage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const APP_PATH = "apps/web/src/app/App.tsx";

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), "missing required token: " + label, { needle });
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), "forbidden token present: " + label, { needle });
}

const workspacePage = readText(WORKSPACE_PAGE_PATH);
const postIrrigationPage = readText(POST_IRRIGATION_PAGE_PATH);
const api = readText(API_PATH);
const app = readText(APP_PATH);
const combinedOperatorPages = workspacePage + "\n" + postIrrigationPage;

[
  "DecisionToWaterResponseChainCard",
  'data-contract="h31_h45_read_only_chain_v1"',
  'data-table="h31-h45-decision-chain"',
  "H31",
  "H32",
  "H33",
  "H34",
  "H35",
  "H36-H39",
  "H40-H42",
  "H43-H44",
  "H45",
  "No_REPLACEMENT_SENTINEL"
].filter((token) => token !== "No_REPLACEMENT_SENTINEL").forEach((token) => {
  assertIncludes(workspacePage, token, "workspace H31-H45 read-only chain token");
});

[
  "ExecutionTailChainPanel",
  'data-contract="h40_h45_execution_tail_read_only"',
  'data-table="h40-h45-execution-tail"',
  "task_id",
  "receipt_id",
  "as_executed_id",
  "acceptance_result_id",
  "response_delta_v1"
].forEach((token) => {
  assertIncludes(postIrrigationPage, token, "post-irrigation execution tail chain token");
});

[
  "fetchOperatorFieldTwinWorkspace",
  "fetchOperatorFieldTwinPostIrrigationVerification",
  "OperatorFieldTwinPostIrrigationVerificationV1",
  "writeReady: false",
  "memoryWriteReady: false",
  "roiWriteReady: false"
].forEach((token) => {
  assertIncludes(api, token, "operator twin read API source token");
});

[
  "OperatorFieldTwinWorkspacePage",
  "OperatorFieldTwinPostIrrigationPage",
  'path="twin/fields/:fieldId"',
  'path="twin/fields/:fieldId/post-irrigation"'
].forEach((token) => {
  assertIncludes(app, token, "operator route shell token");
});

[
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/control/ao_act/task",
  "POST /api/v1/actions/task/from-operation-plan",
  "POST /api/v1/approval",
  "POST /api/v1/roi",
  "POST /api/v1/field-memory",
  "customer_delivery"
].forEach((token) => {
  assertNotIncludes(combinedOperatorPages, token, "H51 operator panels must not include write or customer-delivery token");
});

console.log("[operator-field-twin-decision-chain-panel] PASS");
