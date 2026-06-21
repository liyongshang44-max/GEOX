// scripts/governance_acceptance/ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_BOUNDARY_V1.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function pass(message) {
  console.log(`ok - ${message}`);
}

function must(condition, message, detail) {
  assert.ok(condition, detail || message);
  pass(message);
}

function routeHandlerSource(routeSource) {
  const start = routeSource.indexOf("async function handleRecommendationApprovalDecision");
  const end = routeSource.indexOf("async function handleRecommendationApprovalRequest");
  assert.ok(start >= 0 && end > start, "H37 decision handler source must be locatable");
  return routeSource.slice(start, end);
}

function listSourceFiles(relativeDirectory) {
  const directory = path.join(REPO_ROOT, relativeDirectory);
  const output = [];

  if (!fs.existsSync(directory)) return output;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build"].includes(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...listSourceFiles(path.relative(REPO_ROOT, fullPath)));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      output.push(fullPath);
    }
  }

  return output;
}

function assertCustomerFilesDoNotExposeDecisionFacts() {
  const files = [
    ...listSourceFiles("apps/server/src/routes"),
    ...listSourceFiles("apps/web/src"),
  ].filter((filePath) => /customer/i.test(filePath));

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(REPO_ROOT, filePath);

    must(
      !source.includes("operator_recommendation_approval_decision_submission_v1"),
      `customer file hides operator decision submission ${relativePath}`,
    );
    must(
      !source.includes("approval_decision_v1") || source.includes("confirmed"),
      `customer file hides unconfirmed approval_decision_v1 ${relativePath}`,
    );
  }
}

const routeSource = readRepoFile("apps/server/src/routes/control_approval_request_v1.ts");
const builderSource = readRepoFile("apps/server/src/domain/approval/recommendation_approval_decision_builder_v1.ts");
const roleSource = readRepoFile("apps/server/src/domain/auth/roles.ts");
const h37RouteSource = routeHandlerSource(routeSource);

must(
  routeSource.includes('/api/v1/operator/approval-requests/:request_id/decision'),
  "route exists",
);
must(
  h37RouteSource.includes("approval_request_v1")
    && h37RouteSource.includes("latestScopedApprovalRequestById"),
  "route reads approval_request_v1 by full scope helper",
);
must(
  h37RouteSource.includes('type: "approval_decision_v1"'),
  "route writes approval_decision_v1",
);
must(
  h37RouteSource.includes("operator_recommendation_approval_decision_submission_v1"),
  "route writes operator_recommendation_approval_decision_submission_v1",
);
must(
  h37RouteSource.includes('type: "approval_request_v1"')
    && h37RouteSource.includes("approval_request_transition_v1"),
  "route appends approval_request_v1 status transition",
);

for (const forbidden of [
  "/api/v1/actions/task",
  "/api/v1/approvals/approve",
  "operation_plan_v1",
  "operation_plan_transition_v1",
  "ao_act_task_v0",
  "roi_ledger_v1",
  "field_memory_v1",
]) {
  must(
    !h37RouteSource.includes(forbidden),
    `decision route does not call/create ${forbidden}`,
  );
}

for (const forbidden of [
  'from "pg"',
  'from "fastify"',
  "routes/",
  "process.env",
  "Date.now",
  "new Date",
  "randomUUID",
]) {
  must(!builderSource.includes(forbidden), `builder excludes ${forbidden}`);
}

must(
  /approver:\s*\[[^\]]*"approval\.decide"/.test(roleSource)
    && /admin:\s*\["\*"\]/.test(roleSource),
  "auth matrix gives approval.decide to approver/admin",
);
must(
  !/operator:\s*\[[^\]]*"approval\.decide"/.test(roleSource),
  "operator role does not get approval.decide",
);

assertCustomerFilesDoNotExposeDecisionFacts();

console.log("ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_BOUNDARY_V1 passed");
