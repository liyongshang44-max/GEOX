#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const architectureDir = path.join(repoRoot, "docs", "architecture", "semantic_convergence");
const inventoryPath = path.join(architectureDir, "GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json");
const b02RegisterPath = path.join(architectureDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const b02LinterPath = path.join(repoRoot, "scripts", "governance_acceptance", "ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs");

const REQUIRED_SURFACE_FIELDS = [
  "source_path",
  "entrypoint",
  "activation_mode",
  "writes",
  "reads",
  "semantic_family",
  "authority_class",
  "runtime_reachable",
  "feature_flag",
  "downstream_consumers",
  "removal_target",
];

const PRODUCTION_ROOTS = [
  "apps/server/src",
  "apps/server/db/migrations",
  "apps/executor/src",
];

const AUXILIARY_ROOTS = [
  "apps/server/scripts",
  "scripts",
  ".github/workflows",
];

const SOURCE_EXTENSIONS = [".ts", ".js", ".cjs", ".mjs", ".sql", ".yml", ".yaml"];

const HIGH_RISK_FACT_TYPES = {
  canonical_observation_v1: "evidence.raw_observation",
  evidence_qualification_v1: "evidence.qualification",
  context_snapshot_v1: "context.snapshot",
  qualified_crop_stage_state_v1: "context.crop_stage",
  calculation_result_v1: "decision.calculation",
  candidate_decision_v1: "decision.candidate",
  decision_recommendation_v1: "decision.candidate",
  approval_request_v1: "decision.approval",
  approval_decision_v1: "decision.approval",
  operation_plan_v1: "operation.plan",
  ao_act_task_v0: "execution.task",
  ao_act_dispatch_v1: "execution.dispatch_delivery",
  human_work_receipt_v1: "execution.result_evidence",
  ao_act_receipt_v1: "execution.receipt",
  as_executed_record_v1: "execution.as_executed",
  acceptance_result_v1: "acceptance.verdict",
  field_memory_v1: "field_memory",
  decision_cycle_v1: "governance.trace_projection",
};

const HIGH_RISK_TYPE_TOKENS = {
  CanonicalObservationV1: "evidence.raw_observation",
  EvidenceQualificationV1: "evidence.qualification",
  ContextSnapshotV1: "context.snapshot",
  QualifiedCropStageStateV1: "context.crop_stage",
  CalculationResultV1: "decision.calculation",
  CandidateDecisionV1: "decision.candidate",
  CandidateActionV1: "decision.planning_option",
  DecisionEligibilityDecisionV1: "decision.eligibility",
  DecisionEligibilityCriterionV1: "decision.eligibility",
  DecisionEpisodeV1: "governance.trace_projection",
  ExternalOperationSourceEvidenceV1: "execution.result_evidence",
};

const HIGH_RISK_TABLES = {
  prescription_contract_v1: "action.prescription_spec",
  dispatch_queue_v1: "execution.dispatch_delivery",
  work_assignment_index_v1: "execution.task",
  work_assignment_audit_v1: "execution.task",
  operation_plan_index_v1: "operation.plan",
};

const HIGH_RISK_STATUS_TOKENS = [
  "READY_FOR_APPROVAL",
  "APPROVAL_REQUIRED",
  "APPROVED",
  "ELIGIBLE",
  "DISPATCH_REQUESTED",
  "DISPATCHED",
  "ACKED",
  "RECEIPT_RECEIVED",
  "AS_EXECUTED",
  "ACCEPTED",
  "FORMAL_MEMORY_WRITTEN",
];

const ENTRYPOINT_HINTS = [
  "app.get(",
  "app.post(",
  "app.put(",
  "app.patch(",
  "app.delete(",
  "register",
  "startBackgroundWorkers",
  "process.argv",
  "require.main === module",
  "workflow_dispatch:",
  "schedule:",
  "cron:",
];

const failures = [];
const warnings = [];
const discoveries = [];

function repoPath(absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isTestOrFixturePath(p) {
  return (
    p.includes("/__tests__/") ||
    p.includes("/fixtures/") ||
    p.endsWith(".test.ts") ||
    p.endsWith(".test.js") ||
    p.endsWith(".spec.ts") ||
    p.startsWith("scripts/governance_acceptance/") ||
    p.startsWith("scripts/runtime_acceptance/") ||
    p.startsWith("scripts/acceptance/")
  );
}

function listFiles(root) {
  const absoluteRoot = path.join(repoRoot, root);
  const out = [];
  const stack = [absoluteRoot];

  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (["node_modules", "dist", ".git", "coverage", "acceptance-output"].includes(entry.name)) continue;

      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }

      if (!entry.isFile()) continue;

      const rp = repoPath(full);
      if (!SOURCE_EXTENSIONS.some((ext) => rp.endsWith(ext))) continue;
      out.push(full);
    }
  }

  return out;
}

function addDiscovery(pathname, family, reason, production, kind) {
  const key = [pathname, family, reason, kind].join("|");
  if (discoveries.some((item) => item.key === key)) return;
  discoveries.push({ key, path: pathname, family, reason, production, kind });
}

function scanContent(absPath, production) {
  const rp = repoPath(absPath);
  const content = fs.readFileSync(absPath, "utf8");

  for (const [typeName, family] of Object.entries(HIGH_RISK_FACT_TYPES)) {
    const quoted = new RegExp("[\\\"']" + typeName + "[\\\"']", "m");
    if (quoted.test(content)) {
      addDiscovery(rp, family, "semantic-token:" + typeName, production, "SEMANTIC_OBJECT_OR_FACT");
    }
  }

  for (const [token, family] of Object.entries(HIGH_RISK_TYPE_TOKENS)) {
    if (content.includes(token)) {
      addDiscovery(rp, family, "typed-token:" + token, production, "TYPED_BUILDER_OR_CONSUMER");
    }
  }

  for (const [tableName, family] of Object.entries(HIGH_RISK_TABLES)) {
    const writeRegex = new RegExp(
      "(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?)\\s+(?:public\\.)?" +
      tableName +
      "\\b",
      "i"
    );
    if (writeRegex.test(content)) {
      addDiscovery(rp, family, "table-writer:" + tableName, production, "PERSISTENCE_WRITER");
    }
  }

  const hasHighRiskSemanticToken =
    Object.keys(HIGH_RISK_FACT_TYPES).some((token) => content.includes(token)) ||
    Object.keys(HIGH_RISK_TYPE_TOKENS).some((token) => content.includes(token)) ||
    Object.keys(HIGH_RISK_TABLES).some((token) => content.includes(token));

  if (hasHighRiskSemanticToken) {
    for (const status of HIGH_RISK_STATUS_TOKENS) {
      if (content.includes(status)) {
        addDiscovery(
          rp,
          "cross_family.status_derivation",
          "status-token:" + status,
          production,
          "STATUS_OR_PROJECTION_DERIVATION"
        );
      }
    }
  }

  if (content.includes("CandidateActionV1") && content.includes("execution_policy")) {
    addDiscovery(
      rp,
      "decision.planning_option",
      "planner-execution-policy-binding",
      production,
      "PLANNING_POLICY_BINDING"
    );
  }

  if (content.includes("DEFAULT_SOIL_MOISTURE") && content.includes("effectiveSoilMoisture")) {
    addDiscovery(
      rp,
      "evidence.raw_observation",
      "fabricated-observation-fallback",
      production,
      "FABRICATED_OBSERVATION_RISK"
    );
  }

  if (
    content.includes("INSERT INTO facts") &&
    Object.keys(HIGH_RISK_FACT_TYPES).some((token) => content.includes(token))
  ) {
    addDiscovery(
      rp,
      "cross_family.fact_writer",
      "facts-writer-with-high-risk-semantic-token",
      production,
      "FACT_WRITER"
    );
  }

  if (
    hasHighRiskSemanticToken &&
    ENTRYPOINT_HINTS.some((token) => content.includes(token))
  ) {
    addDiscovery(
      rp,
      "cross_family.activation",
      "runtime-entrypoint-with-high-risk-semantic-token",
      production,
      "ENTRYPOINT_OR_ACTIVATION"
    );
  }
}

function validateInventory(inventory) {
  if (inventory.schema_version !== "bline_residual_authority_inventory_v1") {
    failures.push("INVENTORY_SCHEMA_VERSION_INVALID");
  }

  if (inventory.enforcement?.failure_code !== "UNREGISTERED_AUTHORITY_CAPABLE_PATH") {
    failures.push("INVENTORY_FAILURE_CODE_INVALID");
  }

  if (!Array.isArray(inventory.surfaces)) {
    failures.push("INVENTORY_SURFACES_MISSING");
    return new Set();
  }

  const ids = new Set();
  const paths = new Set();

  for (const surface of inventory.surfaces) {
    const id = String(surface.surface_id || "").trim();
    const pathname = String(surface.source_path || "").trim();

    if (!id) failures.push("INVENTORY_SURFACE_ID_MISSING");
    if (id && ids.has(id)) failures.push("INVENTORY_SURFACE_ID_DUPLICATE:" + id);
    if (id) ids.add(id);

    for (const field of REQUIRED_SURFACE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(surface, field)) {
        failures.push("INVENTORY_FIELD_MISSING:" + (id || "UNKNOWN") + ":" + field);
      }
    }

    if (!pathname) {
      failures.push("INVENTORY_SOURCE_PATH_MISSING:" + (id || "UNKNOWN"));
      continue;
    }

    paths.add(pathname);

    const absPath = path.join(repoRoot, pathname);
    if (!fs.existsSync(absPath)) {
      failures.push("INVENTORY_CURRENT_PATH_MISSING:" + id + ":" + pathname);
    }

    if (!Array.isArray(surface.writes)) failures.push("INVENTORY_WRITES_NOT_ARRAY:" + id);
    if (!Array.isArray(surface.reads)) failures.push("INVENTORY_READS_NOT_ARRAY:" + id);

    if (!Array.isArray(surface.semantic_family) || surface.semantic_family.length < 1) {
      failures.push("INVENTORY_SEMANTIC_FAMILY_INVALID:" + id);
    }

    if (!Array.isArray(surface.downstream_consumers)) {
      failures.push("INVENTORY_DOWNSTREAM_CONSUMERS_NOT_ARRAY:" + id);
    }
  }

  return paths;
}

function classifiedPathsFromB02(register) {
  const out = new Set();

  for (const semantic of Array.isArray(register.semantics) ? register.semantics : []) {
    for (const producer of Array.isArray(semantic.registered_producers) ? semantic.registered_producers : []) {
      const pathname = String(producer.path || "").trim();
      if (pathname) out.add(pathname);
    }

    for (const consumer of Array.isArray(semantic.registered_consumers) ? semantic.registered_consumers : []) {
      const pathname = String(consumer.path || "").trim();
      if (pathname) out.add(pathname);
    }
  }

  return out;
}

function runB02() {
  if (!fs.existsSync(b02LinterPath)) {
    failures.push("B02_LINTER_MISSING");
    return;
  }

  const result = spawnSync(process.execPath, [b02LinterPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    failures.push("B02_LINTER_FAILED");
  }
}

function main() {
  for (const required of [inventoryPath, b02RegisterPath, b02LinterPath]) {
    if (!fs.existsSync(required)) failures.push("REQUIRED_FILE_MISSING:" + repoPath(required));
  }

  if (failures.length) return finish(new Set(), new Set());

  const inventory = readJson(inventoryPath);
  const register = readJson(b02RegisterPath);
  const inventoryPaths = validateInventory(inventory);
  const b02Paths = classifiedPathsFromB02(register);
  const classified = new Set([...inventoryPaths, ...b02Paths]);

  runB02();

  for (const root of PRODUCTION_ROOTS) {
    for (const file of listFiles(root)) {
      const rp = repoPath(file);
      if (isTestOrFixturePath(rp)) continue;
      scanContent(file, true);
    }
  }

  for (const root of AUXILIARY_ROOTS) {
    for (const file of listFiles(root)) {
      scanContent(file, false);
    }
  }

  const byPath = new Map();

  for (const discovery of discoveries) {
    const current = byPath.get(discovery.path) || {
      path: discovery.path,
      production: false,
      families: new Set(),
      kinds: new Set(),
      reasons: new Set(),
    };

    current.production = current.production || discovery.production;
    current.families.add(discovery.family);
    current.kinds.add(discovery.kind);
    current.reasons.add(discovery.reason);
    byPath.set(discovery.path, current);
  }

  const unregistered = [];
  const auxiliaryUnclassified = [];

  for (const item of byPath.values()) {
    if (classified.has(item.path)) continue;

    const normalized = {
      path: item.path,
      production: item.production,
      families: [...item.families].sort(),
      kinds: [...item.kinds].sort(),
      reasons: [...item.reasons].sort(),
    };

    if (item.production) {
      unregistered.push(normalized);
    } else {
      auxiliaryUnclassified.push(normalized);
    }
  }

  unregistered.sort((a, b) => a.path.localeCompare(b.path));
  auxiliaryUnclassified.sort((a, b) => a.path.localeCompare(b.path));

  for (const item of unregistered) {
    failures.push(
      "UNREGISTERED_AUTHORITY_CAPABLE_PATH:" +
      item.path +
      ":" +
      item.families.join(",") +
      ":" +
      item.kinds.join(",")
    );
  }

  for (const item of auxiliaryUnclassified) {
    warnings.push(
      "UNCLASSIFIED_AUXILIARY_AUTHORITY_TOUCHPOINT:" +
      item.path +
      ":" +
      item.families.join(",") +
      ":" +
      item.kinds.join(",")
    );
  }

  console.log("BLINE_RESIDUAL_DISCOVERY " + JSON.stringify({
    production_matches: [...byPath.values()].filter((item) => item.production).length,
    classified_paths: classified.size,
    unregistered_production_paths: unregistered.length,
    unclassified_auxiliary_paths: auxiliaryUnclassified.length,
    unregistered,
    auxiliary_unclassified: auxiliaryUnclassified,
  }));

  finish(inventoryPaths, b02Paths);
}

function finish(inventoryPaths, b02Paths) {
  for (const warning of warnings) console.warn("WARN " + warning);
  for (const failure of failures) console.error("FAIL " + failure);

  console.log("BLINE_RESIDUAL_AUTHORITY_AUDIT_STATS " + JSON.stringify({
    inventory_paths: inventoryPaths.size,
    b02_classified_paths: b02Paths.size,
    discoveries: discoveries.length,
    failures: failures.length,
    warnings: warnings.length,
  }));

  if (failures.length) {
    console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_FAIL count=" + failures.length);
    process.exitCode = 1;
  } else {
    console.log("BLINE_RESIDUAL_AUTHORITY_AUDIT_PASS");
  }
}

try {
  main();
} catch (error) {
  console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_CRASH " + (error?.stack || String(error)));
  process.exitCode = 1;
}
