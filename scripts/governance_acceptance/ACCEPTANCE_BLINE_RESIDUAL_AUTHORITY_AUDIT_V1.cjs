#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const BASE = path.join(ROOT, "docs/architecture/semantic_convergence");
const INVENTORY = path.join(BASE, "GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json");
const B02_REGISTER = path.join(BASE, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const B02_LINTER = path.join(ROOT, "scripts/governance_acceptance/ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs");
const SELF = "scripts/governance_acceptance/ACCEPTANCE_BLINE_RESIDUAL_AUTHORITY_AUDIT_V1.cjs";

const PROD_ROOTS = ["apps/server/src", "apps/server/db/migrations", "apps/executor/src"];
const AUX_ROOTS = ["apps/server/scripts", "scripts", ".github/workflows"];
const EXTS = [".ts", ".js", ".cjs", ".mjs", ".sql", ".yml", ".yaml"];

const REQUIRED = [
  "source_path","entrypoint","activation_mode","writes","reads","semantic_family",
  "authority_class","runtime_reachable","feature_flag","downstream_consumers","removal_target"
];

const TOKENS = {
  canonical_observation_v1: "evidence.raw_observation",
  evidence_qualification_v1: "evidence.qualification",
  context_snapshot_v1: "context.snapshot",
  qualified_crop_stage_state_v1: "context.crop_stage",
  calculation_result_v1: "decision.calculation",
  candidate_decision_v1: "decision.candidate",
  decision_recommendation_v1: "decision.candidate",
  approval_request_v1: "decision.approval",
  approval_decision_v1: "decision.approval",
  prescription_contract_v1: "action.prescription_spec",
  operation_plan_v1: "operation.plan",
  ao_act_task_v0: "execution.task",
  ao_act_dispatch_v1: "execution.dispatch_delivery",
  human_work_receipt_v1: "execution.result_evidence",
  ao_act_receipt_v1: "execution.receipt",
  as_executed_record_v1: "execution.as_executed",
  acceptance_result_v1: "acceptance.verdict",
  field_memory_v1: "field_memory",
  roi_entry_v1: "roi",
  decision_cycle_v1: "governance.trace_projection"
};

const TYPE_TOKENS = {
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
  ExternalOperationSourceEvidenceV1: "execution.result_evidence"
};

const TABLES = {
  prescription_contract_v1: "action.prescription_spec",
  dispatch_queue_v1: "execution.dispatch_delivery",
  work_assignment_index_v1: "execution.task",
  work_assignment_audit_v1: "execution.task",
  operation_plan_index_v1: "operation.plan",
  as_executed_record_v1: "execution.as_executed",
  field_memory_v1: "field_memory",
  roi_entry_v1: "roi"
};

const STRONG_STATES = [
  "READY_FOR_APPROVAL","APPROVAL_REQUIRED","APPROVED","ELIGIBLE",
  "DISPATCH_REQUESTED","DISPATCHED","ACKED","RECEIPT_RECEIVED",
  "AS_EXECUTED","ACCEPTED","ROI_FORMALIZED","FORMAL_MEMORY_WRITTEN"
];

const SEMANTIC_NOUN =
  "(?:CanonicalObservation|EvidenceQualification|ContextSnapshot|CropStage|CalculationResult|CandidateDecision|CandidateAction|Recommendation|Approval|Prescription|OperationPlan|AoAct|Task|Dispatch|Receipt|AsExecuted|Acceptance|FieldMemory|Roi|DecisionCycle|Scenario|Forecast|PlanningOption|EvidenceArtifact)";

const failures = [];
const warnings = [];
const findings = new Map();

const rel = p => path.relative(ROOT, p).split(path.sep).join("/");
const readJson = p => JSON.parse(fs.readFileSync(p, "utf8"));
const esc = s => s.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");

function listFiles(root) {
  const out = [];
  const stack = [path.join(ROOT, root)];
  while (stack.length) {
    const d = stack.pop();
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (["node_modules","dist",".git","coverage","acceptance-output"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (e.isFile() && EXTS.some(x => p.endsWith(x))) out.push(p);
    }
  }
  return out;
}

function isTest(p) {
  return p.includes("/__tests__/") || p.includes("/fixtures/") ||
    p.endsWith(".test.ts") || p.endsWith(".test.js") || p.endsWith(".spec.ts");
}

function add(p, family, kind, reason, production) {
  const x = findings.get(p) || {
    path: p, production: false, families: new Set(), kinds: new Set(), reasons: new Set()
  };
  x.production ||= production;
  x.families.add(family);
  x.kinds.add(kind);
  x.reasons.add(reason);
  findings.set(p, x);
}

function nearFactWrite(content, token) {
  const t = esc(token);
  const insert = "INSERT\\s+INTO\\s+facts";
  const typeLit = "[\\\"']" + t + "[\\\"']";
  return new RegExp(insert + "[\\s\\S]{0,900}" + typeLit, "i").test(content) ||
    new RegExp(typeLit + "[\\s\\S]{0,900}" + insert, "i").test(content);
}

function scan(abs, production) {
  const p = rel(abs);
  if (p === SELF) return;
  const content = fs.readFileSync(abs, "utf8");
  const low = content.toLowerCase();
  const families = new Set();

  for (const [token, family] of Object.entries(TOKENS)) {
    if (low.includes(token)) families.add(family);
  }
  for (const [token, family] of Object.entries(TYPE_TOKENS)) {
    if (content.includes(token)) families.add(family);
  }
  for (const [table, family] of Object.entries(TABLES)) {
    if (low.includes(table)) families.add(family);
  }

  const specialPlanner = content.includes("CandidateActionV1") && content.includes("execution_policy");
  const specialFallback = content.includes("DEFAULT_SOIL_MOISTURE") && content.includes("effectiveSoilMoisture");
  if (!families.size && !specialPlanner && !specialFallback) return;

  for (const f of families) add(p, f, "SEMANTIC_TOUCHPOINT", "semantic-token-or-type", production);

  for (const [token, family] of Object.entries(TOKENS)) {
    if (nearFactWrite(content, token)) {
      add(p, family, "PERSISTENCE_WRITER", "facts-writer-near:" + token, production);
    }
  }

  for (const [table, family] of Object.entries(TABLES)) {
    const dml = new RegExp(
      "(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(?:public\\.)?" + esc(table) + "\\b", "i"
    );
    if (dml.test(content)) add(p, family, "PERSISTENCE_WRITER", "table-writer:" + table, production);
  }

  const builder = new RegExp(
    "(?:export\\s+)?(?:async\\s+)?function\\s+(?:build|create|derive|compile|adapt|materialize|evaluate|project|formalize)[A-Za-z0-9_]*" +
    SEMANTIC_NOUN + "[A-Za-z0-9_]*\\s*\\(", "i"
  );
  const nounFirstBuilder = new RegExp(
    "(?:export\\s+)?(?:async\\s+)?function\\s+(?:build|create|derive|compile|adapt|materialize|evaluate|project|formalize)" +
    SEMANTIC_NOUN + "[A-Za-z0-9_]*\\s*\\(", "i"
  );
  if (builder.test(content) || nounFirstBuilder.test(content)) {
    for (const f of families) add(p, f, "SEMANTIC_BUILDER", "high-risk-builder-name", production);
  }

  for (const state of STRONG_STATES) {
    const s = esc(state);
    const assignment = new RegExp(
      "(?:status|state|verdict|current_stage|complete)\\s*[:=]\\s*[^\\n]{0,100}[\\\"']" + s + "[\\\"']", "i"
    );
    const returned = new RegExp("return\\s+[\\\"']" + s + "[\\\"']", "i");
    if (assignment.test(content) || returned.test(content)) {
      add(p, "cross_family.status_derivation", "SEMANTIC_DERIVER", "strong-state:" + state, production);
    }
  }

  if (specialPlanner) {
    add(p, "decision.planning_option", "SEMANTIC_DERIVER", "planner-execution-policy-binding", production);
  }
  if (specialFallback) {
    add(p, "evidence.raw_observation", "PERSISTENCE_AUTHORITY_RISK", "fabricated-observation-fallback", production);
  }

  if (p.startsWith("apps/server/db/migrations/")) {
    for (const [table, family] of Object.entries(TABLES)) {
      const ddl = new RegExp(
        "(?:CREATE|ALTER)\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?" + esc(table) + "\\b", "i"
      );
      if (ddl.test(content)) add(p, family, "SCHEMA_AUTHORITY", "ddl:" + table, production);
    }
  }

  const entry = /app\.(?:get|post|put|patch|delete)\s*\(|require\.main\s*===\s*module|process\.argv|register[A-Z]|start[A-Z]/m;
  if (entry.test(content)) {
    for (const f of families) add(p, f, "ACTIVATION_TOUCHPOINT", "runtime-entrypoint", production);
  }
}

function inventoryPaths(inv) {
  const out = new Set();
  if (inv.schema_version !== "bline_residual_authority_inventory_v1") failures.push("INVENTORY_SCHEMA_VERSION_INVALID");
  if (inv.enforcement?.failure_code !== "UNREGISTERED_AUTHORITY_CAPABLE_PATH") failures.push("INVENTORY_FAILURE_CODE_INVALID");
  for (const s of Array.isArray(inv.surfaces) ? inv.surfaces : []) {
    const id = String(s.surface_id || "").trim();
    const p = String(s.source_path || "").trim();
    if (!id) failures.push("INVENTORY_SURFACE_ID_MISSING");
    for (const k of REQUIRED) if (!Object.hasOwn(s, k)) failures.push("INVENTORY_FIELD_MISSING:" + id + ":" + k);
    if (p) {
      out.add(p);
      if (!fs.existsSync(path.join(ROOT, p))) failures.push("INVENTORY_CURRENT_PATH_MISSING:" + id + ":" + p);
    }
  }
  return out;
}

function registeredB02Paths(reg) {
  const out = new Set();
  for (const s of Array.isArray(reg.semantics) ? reg.semantics : []) {
    for (const x of [...(s.registered_producers || []), ...(s.registered_consumers || [])]) {
      const p = String(x.path || "").trim();
      if (p) out.add(p);
    }
  }
  return out;
}

function runB02() {
  const r = spawnSync(process.execPath, [B02_LINTER], { cwd: ROOT, encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) failures.push("B02_LINTER_FAILED");
}

function finish(invSet, b02Set) {
  for (const w of warnings) console.warn("WARN " + w);
  for (const f of failures) console.error("FAIL " + f);
  console.log("BLINE_RESIDUAL_AUTHORITY_AUDIT_STATS " + JSON.stringify({
    inventory_paths: invSet.size,
    b02_classified_paths: b02Set.size,
    findings: findings.size,
    failures: failures.length,
    warnings: warnings.length
  }));
  if (failures.length) {
    console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_FAIL count=" + failures.length);
    process.exitCode = 1;
  } else {
    console.log("BLINE_RESIDUAL_AUTHORITY_AUDIT_PASS");
  }
}

function main() {
  for (const p of [INVENTORY, B02_REGISTER, B02_LINTER]) {
    if (!fs.existsSync(p)) failures.push("REQUIRED_FILE_MISSING:" + rel(p));
  }
  if (failures.length) return finish(new Set(), new Set());

  const invSet = inventoryPaths(readJson(INVENTORY));
  const b02Set = registeredB02Paths(readJson(B02_REGISTER));
  const classified = new Set([...invSet, ...b02Set]);

  runB02();

  for (const root of PROD_ROOTS) {
    for (const f of listFiles(root)) if (!isTest(rel(f))) scan(f, true);
  }
  for (const root of AUX_ROOTS) {
    for (const f of listFiles(root)) scan(f, false);
  }

  const hardKinds = new Set([
    "PERSISTENCE_WRITER","SEMANTIC_BUILDER","SEMANTIC_DERIVER",
    "PERSISTENCE_AUTHORITY_RISK","SCHEMA_AUTHORITY"
  ]);
  const hard = [];
  const touches = [];

  for (const x of findings.values()) {
    if (classified.has(x.path)) continue;
    const n = {
      path: x.path,
      production: x.production,
      families: [...x.families].sort(),
      kinds: [...x.kinds].sort(),
      reasons: [...x.reasons].sort()
    };
    const hardHit = n.kinds.some(k => hardKinds.has(k));
    if (n.production && hardHit) hard.push(n);
    else touches.push(n);
  }

  hard.sort((a,b) => a.path.localeCompare(b.path));
  touches.sort((a,b) => a.path.localeCompare(b.path));

  for (const x of hard) {
    failures.push("UNREGISTERED_AUTHORITY_CAPABLE_PATH:" + x.path + ":" + x.families.join(",") + ":" + x.kinds.join(","));
  }
  for (const x of touches) {
    warnings.push("UNREGISTERED_SEMANTIC_TOUCHPOINT:" + x.path + ":" + x.families.join(",") + ":" + x.kinds.join(","));
  }

  console.log("BLINE_RESIDUAL_DISCOVERY " + JSON.stringify({
    production_findings: [...findings.values()].filter(x => x.production).length,
    classified_paths: classified.size,
    unregistered_authority_paths: hard.length,
    unregistered_touchpoints: touches.length,
    authority_paths: hard,
    semantic_touchpoints: touches
  }));

  finish(invSet, b02Set);
}

try { main(); }
catch (e) {
  console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_CRASH " + (e?.stack || String(e)));
  process.exitCode = 1;
}
