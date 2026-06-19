// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_EVIDENCE_GAP_V1.cjs
// Purpose: verify H21 field workspace internal evidence summary and data-gap display contract.
// Boundary: this keeps evidence and data-gap visibility inside the field workspace; it does not add the H24 evidence page.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const PAGE_PATH = "apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx";
const API_PATH = "apps/web/src/api/operatorTwin.ts";
const SERVER_ROUTE_PATH = "apps/server/src/routes/v1/operator_twin.ts";
const PACKAGE_JSON_PATH = "package.json";

const SCRIPT_NAME = "ci:frontend:operator-field-twin-workspace-evidence-gap";
const SCRIPT_COMMAND =
  "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_EVIDENCE_GAP_V1.cjs";

const REQUIRED_PAGE_TOKENS = [
  "EvidenceSummary",
  "DataGapSummary",
  'data-card="EvidenceSummary"',
  'data-card="DataGapSummary"',
  "workspace.current_state.evidence_refs",
  "workspace.data_coverage.evidence_refs",
  "workspace.scenario_comparison.evidence_refs",
  "workspace.recommendation_candidate.evidence_refs",
  "workspace.layers.flatMap",
  "workspace.data_gaps",
  "DATA_GAPS_PRESENT",
  "NO_DATA_GAPS",
  "evidence_refs",
];

const REQUIRED_API_TOKENS = [
  "evidence_refs: string[]",
  "data_gaps",
  "gap_code",
  "severity",
  "label",
];

const REQUIRED_SERVER_TOKENS = [
  "collectEvidenceRefs",
  "evidence_refs: collectEvidenceRefs(waterState)",
  "data_gaps:",
  "gap_code:",
  "severity:",
  "label:",
];

const FORBIDDEN_PAGE_TOKENS = [
  'path="twin/fields/:fieldId/evidence"',
  'to={row.twin_href + "/evidence"',
  'to={"/operator/twin/fields/" + fieldId + "/evidence"',
  "/operator/twin/fields/:fieldId/evidence",
  "/operator/twin/evidence",
  "EvidenceTracePanel",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "submitRecommendation(",
  "/api/control",
  "/api/control/ao_act",
];

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function assertTokens(source, tokens, relPath, message) {
  for (const token of tokens) {
    assert(source.includes(token), message, { path: relPath, token });
  }
}

function assertNoTokens(source, tokens, relPath, message) {
  for (const token of tokens) {
    assert(!source.includes(token), message, { path: relPath, token });
  }
}

function assertPackageScriptPinned() {
  const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
  const actual = pkg.scripts && pkg.scripts[SCRIPT_NAME];

  assert(actual === SCRIPT_COMMAND, "H21 field workspace evidence-gap package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function main() {
  const page = read(PAGE_PATH);
  const api = read(API_PATH);
  const server = read(SERVER_ROUTE_PATH);

  assertTokens(page, REQUIRED_PAGE_TOKENS, PAGE_PATH, "H21 evidence/data-gap page contract missing");
  assertTokens(api, REQUIRED_API_TOKENS, API_PATH, "H21 evidence/data-gap API type contract missing");
  assertTokens(server, REQUIRED_SERVER_TOKENS, SERVER_ROUTE_PATH, "H21 evidence/data-gap server projector contract missing");
  assertNoTokens(page, FORBIDDEN_PAGE_TOKENS, PAGE_PATH, "H21 evidence/data-gap scope drifted into H24/action routes");
  assertPackageScriptPinned();

  console.log("[operator-field-twin-workspace-evidence-gap] PASS");
}

try {
  main();
} catch (error) {
  console.error("[operator-field-twin-workspace-evidence-gap] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
