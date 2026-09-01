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

const PROD_ROOTS = [
  "apps/server/src",
  "apps/server/db/migrations",
  "apps/executor/src",
  "apps/judge/src",
  "apps/telemetry-ingest/src",
  "apps/web/src",
  "packages/device-skills/src",
  "packages/skill-registry/src",
  "packages/control-kernel/src",
  "docker/postgres/init",
  "config/judge"
];
const AUX_ROOTS = ["apps/server/scripts", "packages/contracts", "scripts", ".github/workflows"];
const PROD_FILES = [
  "docker-compose.yml",
  "docker-compose.prod.yml",
  "docker-compose.staging.yml",
  "docker-compose.commercial_v1.yml"
];
const EXTS = [".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".sql", ".json", ".yml", ".yaml"];

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
  ExternalOperationSourceEvidenceV1: "execution.result_evidence",
  ControlVerdictV0: "decision.control_gate",
  CapabilityResolution: "execution.adapter_resolution",
  SkillBindingRecord: "governance.skill_binding",
  ProblemStateV1: "judge.problem_state",
  AoSenseV1: "judge.sensing_request",
  LBCandidateV1: "judge.learning_candidate"
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
const authoritySurfaceByPath = new Map();

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
    path: p,
    production: false,
    families: new Set(),
    kinds: new Set(),
    reasons: new Set(),
    capabilities: new Map()
  };
  x.production ||= production;
  x.families.add(family);
  x.kinds.add(kind);
  x.reasons.add(reason);
  const capability = x.capabilities.get(family) || { kinds: new Set(), reasons: new Set() };
  capability.kinds.add(kind);
  capability.reasons.add(reason);
  x.capabilities.set(family, capability);
  findings.set(p, x);
}

function nearFactWrite(content, token) {
  const t = esc(token);
  const insert = "INSERT\\s+INTO\\s+facts";
  const typeLit = "[\\\"']" + t + "[\\\"']";
  return new RegExp(insert + "[\\s\\S]{0,900}" + typeLit, "i").test(content) ||
    new RegExp(typeLit + "[\\s\\S]{0,900}" + insert, "i").test(content);
}

function configureAuthoritySurfaces(inv) {
  authoritySurfaceByPath.clear();
  for (const surface of Array.isArray(inv?.surfaces) ? inv.surfaces : []) {
    const sourcePath = String(surface?.source_path ?? "").trim();
    const authorityClass = String(surface?.authority_class ?? "").trim().toUpperCase();
    if (!sourcePath) continue;
    if (!/(WRITER|PRODUCER|SERVICE|BUILDER|AUTHORITY|PERSISTENCE|FORMALIZATION|TRANSITION|BRIDGE|REPOSITORY|ADAPTER)/.test(authorityClass)) continue;
    authoritySurfaceByPath.set(sourcePath, {
      families: Array.isArray(surface.semantic_family) ? surface.semantic_family.map(String) : [],
      authority_class: authorityClass,
    });
  }
}

function resolveAuthorityImport(importerAbs, specifier) {
  if (specifier.startsWith("@geox/")) {
    const rest = specifier.slice("@geox/".length);
    const parts = rest.split("/");
    const pkg = parts.shift();
    if (!pkg) return null;
    const subpath = parts.join("/");
    const base = path.join(ROOT, "packages", pkg, "src");
    const raw = subpath ? path.join(base, subpath) : path.join(base, "index");
    const candidates = [raw, raw + ".ts", raw + ".tsx", raw + ".js", path.join(raw, "index.ts")];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return rel(candidate);
    }
    return null;
  }
  if (!specifier.startsWith(".")) return null;
  const raw = path.resolve(path.dirname(importerAbs), specifier);
  const candidates = [raw];
  if (raw.endsWith(".js")) candidates.push(raw.slice(0, -3) + ".ts");
  if (raw.endsWith(".mjs")) candidates.push(raw.slice(0, -4) + ".ts");
  if (!path.extname(raw)) candidates.push(raw + ".ts", raw + ".js", raw + ".cjs");
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return rel(candidate);
  }
  return null;
}

function scanAuthorityCallsites(abs, content, production) {
  const importerPath = rel(abs);
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g;
  const writeLikeName = /^(?:record|create|insert|write|append|persist|upsert|submit|approve|reject|transition|execute|formalize|build|derive|evaluate|resolve|infer|select|route|issue|dispatch|claim|ack|apply|save|runQueued)/i;
  const writeLikeMethodPattern = "(?:record|create|insert|write|append|persist|upsert|submit|approve|reject|transition|execute|formalize|build|derive|evaluate|resolve|infer|select|route|issue|dispatch|claim|ack|apply|save|runQueued)[A-Za-z0-9_$]*";
  let match;
  while ((match = importRe.exec(content)) !== null) {
    const importedFrom = resolveAuthorityImport(abs, String(match[2] ?? ""));
    if (!importedFrom) continue;
    const authority = authoritySurfaceByPath.get(importedFrom);
    if (!authority) continue;

    const bindings = String(match[1] ?? "").split(",").map(x => x.trim()).filter(Boolean);
    for (const binding of bindings) {
      if (binding.startsWith("type ")) continue;
      const parts = binding.split(/\s+as\s+/i).map(x => x.trim());
      const importedName = parts[0];
      const localName = parts[1] || importedName;
      const families = authority.families.length ? authority.families : ["cross_family.authority_callsite"];

      if (writeLikeName.test(importedName)) {
        const callRe = new RegExp("\\b" + esc(localName) + "\\s*\\(", "m");
        if (callRe.test(content)) {
          for (const family of families) {
            add(importerPath, family, "AUTHORITY_CALLSITE", "calls:" + importedFrom + "#" + importedName, production);
          }
        }
      }

      const instanceRe = new RegExp(
        "\\b(?:const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*new\\s+" + esc(localName) + "\\s*\\(",
        "g"
      );
      let instanceMatch;
      while ((instanceMatch = instanceRe.exec(content)) !== null) {
        const instanceName = String(instanceMatch[1] ?? "");
        if (!instanceName) continue;
        const methodRe = new RegExp(
          "\\b" + esc(instanceName) + "\\s*\\.\\s*(" + writeLikeMethodPattern + ")\\s*\\(",
          "g"
        );
        let methodMatch;
        while ((methodMatch = methodRe.exec(content)) !== null) {
          const methodName = String(methodMatch[1] ?? "");
          for (const family of families) {
            add(
              importerPath,
              family,
              "AUTHORITY_CALLSITE",
              "class-call:" + importedFrom + "#" + importedName + "." + methodName,
              production
            );
          }
        }
      }
    }
  }
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

  scanAuthorityCallsites(abs, content, production);

  const specialPlanner = content.includes("CandidateActionV1") && content.includes("execution_policy");
  const specialFallback = content.includes("DEFAULT_SOIL_MOISTURE") && content.includes("effectiveSoilMoisture");
  const specialControlVerdict =
    p.endsWith("/ruleset/evaluator.ts") &&
    content.includes("evaluateRuleSetV0") &&
    content.includes('type: "control_verdict_v0"') &&
    content.includes("verdict:");
  const specialDeviceCapability = p.startsWith("packages/device-skills/src/") &&
    content.includes("resolveTaskCapabilityViaDeviceSkills");
  const specialDeviceSensing = p.startsWith("packages/device-skills/src/") &&
    (content.includes("inferDerivedSensingStateViaDeviceSkills") ||
     content.includes("inferFertilityFromDeviceObservationV1") ||
     content.includes("inferFertilityFromObservationAggregateV1"));
  const specialSkillBinding = p.startsWith("packages/skill-registry/src/") &&
    content.includes("resolveRuleSkillBindings");
  const specialStandaloneJudge =
    p.startsWith("apps/judge/src/") &&
    (content.includes("problem_state_v1") || content.includes("ao_sense_v1") || content.includes("lb_candidate_v1"));
  const specialJudgeConfig =
    p.startsWith("config/judge/") &&
    !p.endsWith(".schema.json") &&
    content.includes('"sufficiency"') &&
    content.includes('"time_coverage"') &&
    content.includes('"qc"');
  const semanticDefaultRisk =
    p.startsWith("docker/postgres/init/") &&
    content.includes("field_memory_v1") &&
    (content.includes("DEFAULT 'projectA'") || content.includes("DEFAULT 0.8"));
  const legacyDecisionPolicy =
    p === "apps/server/src/domain/decision_engine_v1.ts" &&
    content.includes("HARD_RULE_POLICY_CONFIG_V1") &&
    content.includes("evaluateHardRuleHintsV1") &&
    content.includes("getHardRuleRecommendationBlueprintV1");
  const legacyAgronomyDecision =
    p === "apps/server/src/domain/agronomy/agronomy_engine.ts" &&
    content.includes("evaluateAgronomy") &&
    content.includes("should_irrigate");
  const legacyCropCatalogPolicy =
    p === "apps/server/src/domain/agronomy/crop_catalog.ts" &&
    content.includes("CROP_CATALOG") &&
    content.includes("soil_moisture_min");
  const legacyCropStageAuthority =
    p === "apps/server/src/domain/agronomy/stage_resolver.ts" &&
    content.includes("resolveCropStage") &&
    content.includes("CROP_STAGE_ALLOWLIST");
  const legacyRuleEngineAuthority =
    p === "apps/server/src/domain/agronomy/rule_engine.ts" &&
    content.includes("evaluateRulesByInput") &&
    content.includes("confidence: 0.8");
  const bootstrapInitActivation =
    p.startsWith("docker-compose") &&
    content.includes("./docker/postgres/init:/docker-entrypoint-initdb.d:ro");
  const executionDeploymentProfile =
    p.startsWith("docker-compose") &&
    content.includes("GEOX_EXECUTION_DEFAULT_DISABLED") &&
    (content.includes("GEOX_RUNTIME_ENV") || p === "docker-compose.prod.yml" || p === "docker-compose.staging.yml");
  const databaseAutomation =
    p.endsWith(".sql") &&
    (/(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION)[\s\S]*?RETURNS\s+trigger/i.test(content) ||
     /CREATE\s+TRIGGER\s+/i.test(content));
  const genericFactsWriter = /\bINSERT\s+INTO\s+facts\b/i.test(content);
  if (!families.size && !specialPlanner && !specialFallback && !specialControlVerdict && !specialDeviceCapability && !specialDeviceSensing && !specialSkillBinding && !specialStandaloneJudge && !specialJudgeConfig && !semanticDefaultRisk && !legacyDecisionPolicy && !legacyAgronomyDecision && !legacyCropCatalogPolicy && !legacyCropStageAuthority && !legacyRuleEngineAuthority && !bootstrapInitActivation && !executionDeploymentProfile && !databaseAutomation && !genericFactsWriter) return;

  for (const f of families) add(p, f, "SEMANTIC_TOUCHPOINT", "semantic-token-or-type", production);
  if (genericFactsWriter) {
    add(p, "governance.fact_ledger", "GENERIC_FACT_WRITER", "writes-facts-ledger", production);
  }

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
    const builderAuthorityPath =
      p.startsWith("apps/server/src/domain/") ||
      p.startsWith("apps/server/src/services/") ||
      p.startsWith("apps/server/src/evidence/") ||
      p.startsWith("apps/executor/src/adapters/");
    const kind = builderAuthorityPath ? "SEMANTIC_BUILDER" : "PROJECTION_BUILDER";
    for (const f of families) add(p, f, kind, "high-risk-builder-name", production);
  }

  // Runtime adapters may create authority through typed HTTP boundaries rather than direct SQL.
  const receiptHttpProducer =
    p.startsWith("apps/executor/src/") &&
    /(?:\/api\/v1\/ao-act\/receipts(?:\/uplink)?|\/api\/control\/ao_act\/receipt)/.test(content) &&
    /(?:fetch\s*\(|postJson\s*\(|httpJson\s*\()/.test(content);
  if (receiptHttpProducer) {
    add(p, "execution.receipt", "HTTP_AUTHORITY_PRODUCER", "ao-act-receipt-http-producer", production);
  }

  for (const state of STRONG_STATES) {
    const s = esc(state);
    const assignment = new RegExp(
      "(?:status|state|verdict|current_stage|complete)\\s*[:=]\\s*[^\\n]{0,100}[\\\"']" + s + "[\\\"']", "i"
    );
    const returned = new RegExp("return\\s+[\\\"']" + s + "[\\\"']", "i");
    if (assignment.test(content) || returned.test(content)) {
      add(p, "cross_family.status_derivation", "PROJECTION_DERIVER", "strong-state:" + state, production);
    }
  }

  if (specialPlanner) {
    add(p, "decision.planning_option", "AUTHORITY_DERIVER", "planner-execution-policy-binding", production);
  }
  if (specialFallback) {
    add(p, "evidence.raw_observation", "PERSISTENCE_AUTHORITY_RISK", "fabricated-observation-fallback", production);
  }
  if (specialControlVerdict) {
    add(p, "decision.control_gate", "AUTHORITY_DERIVER", "legacy-control-verdict-allow-deny-undetermined", production);
  }
  if (specialDeviceCapability) {
    add(p, "execution.adapter_resolution", "AUTHORITY_DERIVER", "device-skill-task-capability-resolution", production);
  }
  if (specialDeviceSensing) {
    add(p, "twin.state", "AUTHORITY_DERIVER", "device-skill-derived-sensing-state", production);
  }
  if (specialSkillBinding) {
    add(p, "governance.skill_binding", "AUTHORITY_DERIVER", "skill-binding-selection", production);
  }
  if (specialStandaloneJudge) {
    if (content.includes("problem_state_v1")) add(p, "judge.problem_state", "AUTHORITY_DERIVER", "standalone-judge-problem-state", production);
    if (content.includes("ao_sense_v1")) add(p, "judge.sensing_request", "AUTHORITY_DERIVER", "standalone-judge-sensing-request", production);
    if (content.includes("lb_candidate_v1")) add(p, "judge.learning_candidate", "AUTHORITY_DERIVER", "standalone-judge-learning-candidate", production);
  }
  if (specialJudgeConfig) {
    add(p, "judge.problem_state", "CONFIG_AUTHORITY", "standalone-judge-threshold-config", production);
  }
  if (semanticDefaultRisk) {
    add(p, "field_memory", "SEMANTIC_DEFAULT_AUTHORITY_RISK", "bootstrap-field-memory-defaults", production);
  }
  if (legacyDecisionPolicy) {
    add(p, "decision.candidate", "AUTHORITY_DERIVER", "legacy-hard-rule-recommendation-blueprint", production);
  }
  if (legacyAgronomyDecision) {
    add(p, "decision.calculation", "AUTHORITY_DERIVER", "legacy-irrigation-threshold-decision", production);
  }
  if (legacyCropCatalogPolicy) {
    add(p, "decision.calculation", "CONFIG_AUTHORITY", "legacy-crop-threshold-catalog", production);
  }
  if (legacyCropStageAuthority) {
    add(p, "context.crop_stage", "AUTHORITY_DERIVER", "legacy-crop-stage-resolution", production);
  }
  if (legacyRuleEngineAuthority) {
    add(p, "decision.candidate", "AUTHORITY_DERIVER", "legacy-rule-recommendation-derivation", production);
    add(p, "context.crop_stage", "SEMANTIC_DEFAULT_AUTHORITY_RISK", "legacy-seedling-stage-fallback", production);
  }
  if (bootstrapInitActivation) {
    add(p, "governance.bootstrap", "BOOTSTRAP_ACTIVATION", "postgres-init-semantic-seed-mount", production);
  }
  if (executionDeploymentProfile) {
    add(p, "execution.activation_policy", "CONFIG_AUTHORITY", "execution-default-disabled-deployment-profile", production);
  }
  if (databaseAutomation) {
    add(p, "governance.database_automation", "DATABASE_AUTOMATION_AUTHORITY", "sql-trigger-or-trigger-function", production);
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

function inventoryCoverage(inv) {
  const paths = new Set();
  const familiesByPath = new Map();
  if (inv.schema_version !== "bline_residual_authority_inventory_v1") failures.push("INVENTORY_SCHEMA_VERSION_INVALID");
  if (inv.enforcement?.failure_code !== "UNREGISTERED_AUTHORITY_CAPABLE_PATH") failures.push("INVENTORY_FAILURE_CODE_INVALID");
  for (const s of Array.isArray(inv.surfaces) ? inv.surfaces : []) {
    const id = String(s.surface_id || "").trim();
    const p = String(s.source_path || "").trim();
    if (!id) failures.push("INVENTORY_SURFACE_ID_MISSING");
    for (const k of REQUIRED) if (!Object.hasOwn(s, k)) failures.push("INVENTORY_FIELD_MISSING:" + id + ":" + k);
    if (p) {
      paths.add(p);
      const families = familiesByPath.get(p) || new Set();
      for (const family of Array.isArray(s.semantic_family) ? s.semantic_family : []) {
        const normalized = String(family || "").trim();
        if (normalized) families.add(normalized);
      }
      familiesByPath.set(p, families);
      if (!fs.existsSync(path.join(ROOT, p))) failures.push("INVENTORY_CURRENT_PATH_MISSING:" + id + ":" + p);
    }
  }
  return { paths, familiesByPath };
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

function assertScannerSentinels() {
  const sentinels = [
    ["apps/server/src/services/fertilization/fertilization_service_v1.ts", "GENERIC_FACT_WRITER"],
    ["apps/server/src/routes/delivery_evidence_export_v1.ts", "GENERIC_FACT_WRITER"],
    ["docker/postgres/init/003_p1_skill_seed.sql", "GENERIC_FACT_WRITER"],
    ["packages/control-kernel/src/ruleset/evaluator.ts", "AUTHORITY_DERIVER"],
    ["apps/judge/src/problem_state.ts", "AUTHORITY_DERIVER"],
    ["docker-compose.yml", "BOOTSTRAP_ACTIVATION"],
    ["apps/server/db/migrations/2026_05_14_variable_task_no_auto_acked_v1.sql", "DATABASE_AUTOMATION_AUTHORITY"],
    ["apps/server/src/domain/decision_engine_v1.ts", "AUTHORITY_DERIVER"],
    ["apps/server/src/domain/agronomy/stage_resolver.ts", "AUTHORITY_DERIVER"],
    ["apps/server/src/domain/agronomy/rule_engine.ts", "SEMANTIC_DEFAULT_AUTHORITY_RISK"]
  ];
  for (const [p, kind] of sentinels) {
    const finding = findings.get(p);
    if (!finding || !finding.kinds.has(kind)) {
      failures.push("SCANNER_SENTINEL_MISSING:" + p + ":" + kind);
    }
  }
}

function main() {
  for (const p of [INVENTORY, B02_REGISTER, B02_LINTER]) {
    if (!fs.existsSync(p)) failures.push("REQUIRED_FILE_MISSING:" + rel(p));
  }
  if (failures.length) return finish(new Set(), new Set());

  const inventory = readJson(INVENTORY);
  configureAuthoritySurfaces(inventory);
  const coverage = inventoryCoverage(inventory);
  const invSet = coverage.paths;
  const invFamiliesByPath = coverage.familiesByPath;
  const b02Set = registeredB02Paths(readJson(B02_REGISTER));
  const touchClassified = new Set([...invSet, ...b02Set]);

  runB02();

  for (const root of PROD_ROOTS) {
    for (const f of listFiles(root)) if (!isTest(rel(f))) scan(f, true);
  }
  for (const file of PROD_FILES) {
    const abs = path.join(ROOT, file);
    if (fs.existsSync(abs)) scan(abs, true);
  }
  for (const root of AUX_ROOTS) {
    for (const f of listFiles(root)) scan(f, false);
  }

  assertScannerSentinels();

  const hardKinds = new Set([
    "PERSISTENCE_WRITER","GENERIC_FACT_WRITER","SEMANTIC_BUILDER","AUTHORITY_DERIVER",
    "CONFIG_AUTHORITY","SEMANTIC_DEFAULT_AUTHORITY_RISK","BOOTSTRAP_ACTIVATION","DATABASE_AUTOMATION_AUTHORITY",
    "HTTP_AUTHORITY_PRODUCER","AUTHORITY_CALLSITE","PERSISTENCE_AUTHORITY_RISK"
  ]);
  const hard = [];
  const touches = [];

  for (const x of findings.values()) {
    const registeredFamilies = invFamiliesByPath.get(x.path) || new Set();
    for (const [family, capability] of x.capabilities.entries()) {
      const kinds = [...capability.kinds].sort();
      const reasons = [...capability.reasons].sort();
      const hardHit = kinds.some(k => hardKinds.has(k));
      if (x.production && hardHit && !registeredFamilies.has(family)) {
        hard.push({ path: x.path, family, production: true, kinds, reasons });
      }
    }
    if (touchClassified.has(x.path)) continue;
    const n = {
      path: x.path,
      production: x.production,
      families: [...x.families].sort(),
      kinds: [...x.kinds].sort(),
      reasons: [...x.reasons].sort()
    };
    if (!n.production || !n.kinds.some(k => hardKinds.has(k))) touches.push(n);
  }

  hard.sort((a,b) => a.path.localeCompare(b.path) || a.family.localeCompare(b.family));
  touches.sort((a,b) => a.path.localeCompare(b.path));

  for (const x of hard) {
    failures.push("UNREGISTERED_AUTHORITY_CAPABLE_PATH:" + x.path + ":" + x.family + ":" + x.kinds.join(","));
  }
  for (const x of touches) {
    warnings.push("UNREGISTERED_SEMANTIC_TOUCHPOINT:" + x.path + ":" + x.families.join(",") + ":" + x.kinds.join(","));
  }

  console.log("BLINE_RESIDUAL_DISCOVERY " + JSON.stringify({
    production_findings: [...findings.values()].filter(x => x.production).length,
    inventory_paths: invSet.size,
    b02_classified_paths: b02Set.size,
    unregistered_authority_capabilities: hard.length,
    unregistered_touchpoints: touches.length,
    authority_capabilities: hard,
    semantic_touchpoints: touches,
    proof_rule: "HARD_AUTHORITY_REQUIRES_EXACT_PATH_PLUS_SEMANTIC_FAMILY_IN_RESIDUAL_INVENTORY"
  }));

  finish(invSet, b02Set);
}

try { main(); }
catch (e) {
  console.error("BLINE_RESIDUAL_AUTHORITY_AUDIT_CRASH " + (e?.stack || String(e)));
  process.exitCode = 1;
}
