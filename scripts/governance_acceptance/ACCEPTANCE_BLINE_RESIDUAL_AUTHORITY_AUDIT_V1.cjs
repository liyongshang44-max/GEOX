#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const baseDir = path.join(repoRoot, "docs/architecture/semantic_convergence");
const inventoryPath = path.join(baseDir, "GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json");
const b02RegisterPath = path.join(baseDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const b02LinterPath = path.join(repoRoot, "scripts/governance_acceptance/ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs");
const selfPath = "scripts/governance_acceptance/ACCEPTANCE_BLINE_RESIDUAL_AUTHORITY_AUDIT_V1.cjs";

const REQUIRED_FIELDS = [
  "source_path","entrypoint","activation_mode","writes","reads","semantic_family",
  "authority_class","runtime_reachable","feature_flag","downstream_consumers","removal_target"
];

const PRODUCTION_ROOTS = ["apps/server/src","apps/server/db/migrations","apps/executor/src"];
const AUXILIARY_ROOTS = ["apps/server/scripts","scripts",".github/workflows"];
const EXTENSIONS = [".ts",".js",".cjs",".mjs",".sql",".yml",".yaml"];

const SEMANTIC_TOKENS = {
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

const BUILDER_VERBS = "(?:build|create|derive|compile|adapt|materialize|evaluate|project|formalize)";
const failures = [];
const warnings = [];
const findings = new Map();

function rp(absPath) { return path.relative(repoRoot, absPath).split(path.sep).join("/"); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

function listFiles(root) {
  const out = [];
  const stack = [path.join(repoRoot, root)];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    for (const e of fs.readdirSync(current,{withFileTypes:true})) {
      if (["node_modules","dist",".git","coverage","acceptance-output"].includes(e.name)) continue;
      const full = path.join(current,e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.isFile()) continue;
      const p = rp(full);
      if (EXTENSIONS.some(ext => p.endsWith(ext))) out.push(full);
    }
  }
  return out;
}

function isTestPath(p) {
  return p.includes("/__tests__/") || p.includes("/fixtures/") ||
    p.endsWith(".test.ts") || p.endsWith(".test.js") || p.endsWith(".spec.ts");
}

function add(pathname, family, kind, reason, production) {
  const item = findings.get(pathname) || {
    path: pathname, production: false, families: new Set(), kinds: new Set(), reasons: new Set()
  };
  item.production ||= production;
  item.families.add(family);
  item.kinds.add(kind);
  item.reasons.add(reason);
  findings.set(pathname,item);
}

function scan(absPath, production) {
  const pathname = rp(absPath);
  if (pathname === selfPath) return;
  const content = fs.readFileSync(absPath,"utf8");
  const lower = content.toLowerCase();

  const presentFamilies = new Set();
  for (const [token,family] of Object.entries(SEMANTIC_TOKENS)) {
    if (lower.includes(token.toLowerCase())) presentFamilies.add(family);
  }
  for (const [token,family] of Object.entries(TYPE_TOKENS)) {
    if (content.includes(token)) presentFamilies.add(family);
  }
  for (const [table,family] of Object.entries(TABLES)) {
    if (lower.includes(table.toLowerCase())) presentFamilies.add(family);
  }
  if (!presentFamilies.size &&
      !content.includes("DEFAULT_SOIL_MOISTURE") &&
      !(content.includes("CandidateActionV1") && content.includes("execution_policy"))) return;

  for (const family of presentFamilies) {
    add(pathname,family,"SEMANTIC_TOUCHPOINT","semantic-token-or-type",production);
  }

  // Runtime persistence truth creation.
  for (const [token,family] of Object.entries(SEMANTIC_TOKENS)) {
    const factWrite = content.includes("INSERT INTO facts") && lower.includes(token.toLowerCase());
    if (factWrite) add(pathname,family,"PERSISTENCE_WRITER","facts-writer:"+token,production);
  }
  for (const [table,family] of Object.entries(TABLES)) {
    const tableWrite = new RegExp(
      "(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(?:public\\.)?"+table+"\\b","i"
    );
    if (tableWrite.test(content)) add(pathname,family,"PERSISTENCE_WRITER","table-writer:"+table,production);
  }

  // Pure builders can create semantic authority without I/O.
  const builderDef = new RegExp(
    "(?:export\\s+)?(?:async\\s+)?function\\s+"+BUILDER_VERBS+"[A-Za-z0-9_]*\\s*\\(","i"
  );
  if (builderDef.test(content)) {
    for (const family of presentFamilies) {
      add(pathname,family,"SEMANTIC_BUILDER","builder-definition",production);
    }
  }

  // Strong-state derivation: only actual assignment/return/object-key use, not a bare string mention.
  for (const state of STRONG_STATES) {
    const assignment = new RegExp(
      "(?:status|state|verdict|current_stage|complete)\\s*[:=]\\s*[^\\n]{0,100}[\"']"+state+"[\"']","i"
    );
    const returned = new RegExp("return\\s+[\"']"+state+"[\"']","i");
    if (assignment.test(content) || returned.test(content)) {
      add(pathname,"cross_family.status_derivation","SEMANTIC_DERIVER","strong-state:"+state,production);
    }
  }

  if (content.includes("CandidateActionV1") && content.includes("execution_policy")) {
    add(pathname,"decision.planning_option","SEMANTIC_DERIVER","planner-execution-policy-binding",production);
  }
  if (content.includes("DEFAULT_SOIL_MOISTURE") && content.includes("effectiveSoilMoisture")) {
    add(pathname,"evidence.raw_observation","PERSISTENCE_AUTHORITY_RISK","fabricated-observation-fallback",production);
  }

  // Schema/migration authority is distinct from runtime producer authority.
  if (pathname.startsWith("apps/server/db/migrations/")) {
    for (const [table,family] of Object.entries(TABLES)) {
      const ddl = new RegExp("(?:CREATE|ALTER)\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?"+table+"\\b","i");
      if (ddl.test(content)) add(pathname,family,"SCHEMA_AUTHORITY","ddl:"+table,production);
    }
  }

  const entrypoint = /app\.(?:get|post|put|patch|delete)\s*\(|require\.main\s*===\s*module|process\.argv|register[A-Z]|start[A-Z]/m;
  if (entrypoint.test(content)) {
    for (const family of presentFamilies) add(pathname,family,"ACTIVATION_TOUCHPOINT","runtime-entrypoint",production);
  }
}

function validateInventory(inventory) {
  const out = new Set();
  if (inventory.schema_version !== "bline_residual_authority_inventory_v1") failures.push("INVENTORY_SCHEMA_VERSION_INVALID");
  if (inventory.enforcement?.failure_code !== "UNREGISTERED_AUTHORITY_CAPABLE_PATH") failures.push("INVENTORY_FAILURE_CODE_INVALID");
  for (const surface of Array.isArray(inventory.surfaces) ? inventory.surfaces : []) {
    const id = String(surface.surface_id || "").trim();
    const pathname = String(surface.source_path || "").trim();
    if (!id) failures.push("INVENTORY_SURFACE_ID_MISSING");
    for (const field of REQUIRED_FIELDS) if (!Object.hasOwn(surface,field)) failures.push("INVENTORY_FIELD_MISSING:"+id+":"+field);
    if (!pathname) continue;
    out.add(pathname);
    if (!fs.existsSync(path.join(repoRoot,pathname))) failures.push("INVENTORY_CURRENT_PATH_MISSING:"+id+":"+pathname);
  }
  return out;
}

function b02Paths(register) {
  const out = new Set();
  for (const s of Array.isArray(register.semantics) ? register.semantics : []) {
    for (const x of [...(s.registered_producers||[]),...(s.registered_consumers||[])]) {
      const p = String(x.path || "").trim();
      if (p) out.add(p);
    }
  }
  return out;
}

function runB02() {
  const r = spawnSync(process.execPath,[b02LinterPath],{cwd:repoRoot,encoding:"utf8"});
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) failures.push("B02_LINTER_FAILED");
}

function main() {
  for (const p of [inventoryPath,b02RegisterPath,b02LinterPath]) {
    if (!fs.existsSync(p)) failures.push("REQUIRED_FILE_MISSING:"+rp(p));
  }
  if (failures.length) return finish(new Set(),new Set());

  const inventory = readJson(inventoryPath);
  const register = readJson(b02RegisterPath);
  const inventorySet = validateInventory(inventory);
  const b02Set = b02Paths(register);
  const classified = new Set([...inventorySet,...b02Set]);

  runB02();

  for (const root of PRODUCTION_ROOTS) {
    for (const file of listFiles(root)) {
      const p = rp(file);
      if (!isTestPath(p)) scan(file,true);
    }
  }
  for (const root of AUXILIARY_ROOTS) {
    for (const file of listFiles(root)) scan(file,false);
  }

  const hardKinds = new Set(["PERSISTENCE_WRITER","SEMANTIC_BUILDER","SEMANTIC_DERIVER","PERSISTENCE_AUTHORITY_RISK","SCHEMA_AUTHORITY"]);
  const hard = [];
  const touch = [];

  for (const item of findings.values()) {
    if (classified.has(item.path)) continue;
    const normalized = {
      path:item.path,
      production:item.production,
      families:[...item.families].sort(),
      kinds:[...item.kinds].sort(),
      reasons:[...item.reasons].sort()
    };
    const isHard = normalized.kinds.some(k => hardKinds.has(k));
    if (item.production && isHard) hard.push(normalized);
    else touch.push(normalized);
  }

  hard.sort((a,b)=>a.path.localeCompare(b.path));
  touch.sort((a,b)=>a.path.localeCompare(b.path));

  for (const item of hard) {
    failures.push("UNREGISTERED_AUTHORITY_CAPABLE_PATH:"+item.path+":"+item.families.join(",")+":"+item.kinds.join(","));
  }
  for (const item of touch) {
    warnings.push("UNREGISTERED_SEMANTIC_TOUCHPOINT:"+item.path+":"+item.families.join(",")+":"+item.kinds.join(","));
  }

  console.log("BLINE_RESIDUAL_DISCOVERY "+JSON.stringify({
    production_findings:[...findings.values()].filter(x=>x.production).length,
    classified_paths:classified.size,
    unregistered_authority_paths:hard.length,
    unregistered_touchpoints:touch.length,
    authority_paths:hard,
    semantic_touchpoints:touch
  }));
  finish(inventorySet,b02Set);
}

function finish(inventorySet,b02Set) {
  for (const w of warnings) console.warn("WARN "+w);
  for (const f of failures) console.error("FAIL "+f);
  console.log("BLINE_RESIDUAL_AUTHORITY_AUDIT_STATS "+JSON.stringify({
    inventory_paths:inventorySet.size,
    b02_classified_paths:b02Set.size,
    findings:findings.size,
    failures:failures.length,
    warnings:warnings.length
  }));
  if (failures.length) {
    console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_FAIL count="+failures.length);
    process.exitCode=1;
  } else {
    console.log("BLINE_RESIDUAL_AUTHORITY_AUDIT_PASS");
  }
}

try { main(); }
catch (e) {
  console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_CRASH "+(e?.stack||String(e)));
  process.exitCode=1;
}
