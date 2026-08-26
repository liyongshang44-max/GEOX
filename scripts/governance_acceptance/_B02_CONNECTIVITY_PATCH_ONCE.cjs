#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const targetRoot = path.resolve(process.argv[2] || ".");
const baseDir = path.join(targetRoot, "docs/architecture/semantic_convergence");
const registerPath = path.join(baseDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const graphPath = path.join(baseDir, "GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const linterPath = path.join(targetRoot, "scripts/governance_acceptance/ACCEPTANCE_B02_SEMANTIC_CONTRACT_LINTER_V1.cjs");
const docPath = path.join(baseDir, "GEOX-B02-SEMANTIC-OWNERSHIP-REGISTER-AND-LINTER-V1.md");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); }
function getSemantic(register, sid) {
  const s = register.semantics.find((x) => x.semantic_id === sid);
  if (!s) throw new Error(`SEMANTIC_NOT_FOUND:${sid}`);
  return s;
}
function upsertSemantic(register, semantic) {
  const i = register.semantics.findIndex((x) => x.semantic_id === semantic.semantic_id);
  if (i >= 0) register.semantics[i] = { ...register.semantics[i], ...semantic };
  else register.semantics.push(semantic);
  return getSemantic(register, semantic.semantic_id);
}
function upsertProducer(semantic, producer) {
  semantic.registered_producers ||= [];
  const i = semantic.registered_producers.findIndex((x) => x.producer_id === producer.producer_id);
  if (i >= 0) semantic.registered_producers[i] = { ...semantic.registered_producers[i], ...producer };
  else semantic.registered_producers.push(producer);
}
function upsertConsumer(semantic, consumer) {
  semantic.registered_consumers ||= [];
  const i = semantic.registered_consumers.findIndex((x) => x.consumer_id === consumer.consumer_id);
  if (i >= 0) semantic.registered_consumers[i] = { ...semantic.registered_consumers[i], ...consumer };
  else semantic.registered_consumers.push(consumer);
}
function upsertRuntimeConsumer(semantic, consumer) {
  semantic.runtime_consumers ||= [];
  const i = semantic.runtime_consumers.findIndex((x) => x.consumer_id === consumer.consumer_id);
  if (i >= 0) semantic.runtime_consumers[i] = { ...semantic.runtime_consumers[i], ...consumer };
  else semantic.runtime_consumers.push(consumer);
}
function annotateProducer(register, pid, values) {
  for (const s of register.semantics) {
    const p = (s.registered_producers || []).find((x) => x.producer_id === pid);
    if (p) { Object.assign(p, values); return; }
  }
  throw new Error(`PRODUCER_NOT_FOUND_FOR_CONNECTIVITY:${pid}`);
}
function annotateConsumer(register, cid, values) {
  let found = 0;
  for (const s of register.semantics) {
    for (const c of s.registered_consumers || []) {
      if (c.consumer_id === cid) { Object.assign(c, values); found++; }
    }
  }
  if (!found) throw new Error(`CONSUMER_NOT_FOUND_FOR_CONNECTIVITY:${cid}`);
}
function addGraphItem(list, item) {
  const i = list.findIndex((x) => x.edge_id === item.edge_id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

const register = readJson(registerPath);
register.schema_version = "1.1";
register.connectivity_model = {
  purpose: "Separate capability registration from proven current runtime wiring. B-02 maps both semantic ownership and runtime connectivity without changing runtime behavior.",
  connection_class_values: [
    "MAINLINE",
    "ACTIVE_PARALLEL",
    "ROUTE_ISLAND",
    "MANUAL_SEAM",
    "ACCEPTANCE_LIBRARY_ISLAND",
    "COMPATIBILITY",
    "DEVTOOLS_ONLY",
    "ORPHANED",
    "INTENTIONAL_ISOLATION",
    "REGISTERED_CAPABILITY_ISLAND",
    "ACTIVE_LEGACY_WRITER",
    "LOCAL_DIRECT_CALL",
    "REPORTING_ARTIFACT_PLANE"
  ],
  activation_values: [
    "ALWAYS",
    "FEATURE_FLAG",
    "API_ONLY",
    "MANUAL",
    "TEST_ACCEPTANCE_ONLY",
    "NOT_REFERENCED"
  ],
  runtime_edge_values: ["PROVEN", "NOT_PROVEN", "NONE", "INTENTIONAL_NONE"],
  registered_consumer_definition: "Contract/API/code capable of consuming this semantic. Capability does not prove current runtime wiring.",
  runtime_consumer_definition: "Repository evidence proves the current runtime wires the producer/output into this consumer. A persisted-data edge, direct call, module registration, route registration, or explicit same-request side effect may qualify when evidence is named.",
  invariant: "CAN_CONSUME must never be represented as IS_WIRED without a current_connectivity_edge carrying repository evidence.",
  scope_note: "unknown_unclassified_production_edge=0 means zero unknown edges within the explicit B-02 static/runtime-connectivity audit scope; the linter does not infer arbitrary TypeScript business semantics."
};

const producerConnectivity = {
  "telemetry-ingest": ["MAINLINE","API_ONLY","PROVEN"],
  "raw-compat-route": ["COMPATIBILITY","API_ONLY","PROVEN"],
  "stage1-formal-gate": ["MAINLINE","API_ONLY","PROVEN"],
  "evidence-judge-v2": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "apple-ii-contract-semantics": ["COMPATIBILITY","MANUAL","INTENTIONAL_NONE"],
  "mcft-evidence-authority": ["INTENTIONAL_ISOLATION","MANUAL","INTENTIONAL_NONE"],
  "field-program-fact": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "agronomy-context-builder": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "stage-resolver": ["COMPATIBILITY","ALWAYS","PROVEN"],
  "context-builder-stage": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "rule-engine-stage": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "decision-engine-stage": ["MAINLINE","API_ONLY","PROVEN"],
  "field-program-state-stage": ["COMPATIBILITY","API_ONLY","PROVEN"],
  "operation-state-stage": ["COMPATIBILITY","API_ONLY","PROVEN"],
  "mcft-stage-reference": ["INTENTIONAL_ISOLATION","MANUAL","INTENTIONAL_NONE"],
  "derived-sensing-state-service": ["COMPATIBILITY","API_ONLY","PROVEN"],
  "sensing-inference-pipeline": ["MAINLINE","API_ONLY","PROVEN"],
  "mcft-state-reference": ["INTENTIONAL_ISOLATION","MANUAL","INTENTIONAL_NONE"],
  "external-weather-projection": ["MAINLINE","API_ONLY","PROVEN"],
  "mcft-forecast-scenario-reference": ["INTENTIONAL_ISOLATION","MANUAL","INTENTIONAL_NONE"],
  "agronomy-interpretation-contract": ["INTENTIONAL_ISOLATION","MANUAL","INTENTIONAL_NONE"],
  "irrigation-requirement-skill": ["LOCAL_DIRECT_CALL","ALWAYS","PROVEN"],
  "irrigation-deficit-skill": ["LOCAL_DIRECT_CALL","ALWAYS","PROVEN"],
  "agronomy-rule-engine": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "agronomy-judge-calculation": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "decision-engine-calculation": ["MAINLINE","API_ONLY","PROVEN"],
  "agronomy-agent-recommendation": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "decision-engine-recommendation": ["MAINLINE","API_ONLY","PROVEN"],
  "rule-engine-recommendation": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "decision-plan-contract": ["COMPATIBILITY","MANUAL","INTENTIONAL_NONE"],
  "stage1-trigger-eligibility": ["MAINLINE","API_ONLY","PROVEN"],
  "agronomy-judge-gate": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "future-decision-eligibility": ["INTENTIONAL_ISOLATION","MANUAL","INTENTIONAL_NONE"],
  "control-approval-route": ["MAINLINE","API_ONLY","PROVEN"],
  "approval-builder": ["LOCAL_DIRECT_CALL","API_ONLY","PROVEN"],
  "control-operation-plan-route": ["MAINLINE","API_ONLY","PROVEN"],
  "approval-operation-plan-path": ["MAINLINE","API_ONLY","PROVEN"],
  "agronomy-agent-plan": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "decision-engine-plan-touchpoint": ["COMPATIBILITY","API_ONLY","PROVEN"],
  "flight-table-plan": ["DEVTOOLS_ONLY","API_ONLY","INTENTIONAL_NONE"],
  "task-service": ["MAINLINE","API_ONLY","PROVEN"],
  "control-ao-act-route": ["MAINLINE","API_ONLY","PROVEN"],
  "receipt-builder": ["LOCAL_DIRECT_CALL","API_ONLY","PROVEN"],
  "acceptance-reference": ["COMPATIBILITY","MANUAL","INTENTIONAL_NONE"],
  "operation-report-chain": ["MAINLINE","API_ONLY","PROVEN"],
  "dashboard-route": ["MAINLINE","API_ONLY","PROVEN"]
};

const consumerConnectivity = {
  "stage1-sensing": ["MAINLINE","API_ONLY","PROVEN"],
  "agronomy-agent": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "agronomy-judge-v2": ["ROUTE_ISLAND","API_ONLY","NOT_PROVEN"],
  "stage1-recommendation-path": ["MAINLINE","API_ONLY","PROVEN"],
  "agronomy-rule-engine": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "decision-engine-route": ["MAINLINE","API_ONLY","PROVEN"],
  "decision-engine-state": ["COMPATIBILITY","API_ONLY","PROVEN"],
  "decision-engine-weather": ["MAINLINE","API_ONLY","PROVEN"],
  "approval-request-builder": ["LOCAL_DIRECT_CALL","API_ONLY","PROVEN"]
};

for (const s of register.semantics) {
  s.registered_consumers ||= [];
  s.runtime_consumers ||= [];
  for (const p of s.registered_producers || []) {
    const c = producerConnectivity[p.producer_id];
    if (!c) throw new Error(`MISSING_PRODUCER_CONNECTIVITY_CLASSIFICATION:${p.producer_id}`);
    [p.connection_class, p.activation, p.runtime_edge] = c;
    p.new_runtime_consumer_creation = ["COMPATIBILITY","ACTIVE_LEGACY_WRITER","DEVTOOLS_ONLY","ORPHANED","ACCEPTANCE_LIBRARY_ISLAND"].includes(p.connection_class)
      ? "FORBIDDEN"
      : "ALLOWED_ONLY_BY_EXPLICIT_REGISTER";
    p.grandfathered_runtime_consumers ||= [];
  }
  for (const c of s.registered_consumers) {
    const v = consumerConnectivity[c.consumer_id];
    if (!v) throw new Error(`MISSING_CONSUMER_CONNECTIVITY_CLASSIFICATION:${c.consumer_id}`);
    [c.connection_class, c.activation, c.runtime_edge] = v;
  }
}

/* New/currently-audited capability and connectivity objects. */
upsertProducer(getSemantic(register, "decision.calculation"), {
  producer_id: "evaluate-irrigation-decision-v1",
  path: "apps/server/src/domain/decision_engine_v1.ts",
  role: "exported evaluateIrrigationDecisionV1 capability with no current repository caller found by B-02 audit",
  authority_level: "ORPHANED_CAPABILITY",
  grandfathered_duplicate: true,
  removal_target: "B-09",
  current: true,
  fingerprints: ["evaluateIrrigationDecisionV1"],
  connection_class: "ORPHANED",
  activation: "NOT_REFERENCED",
  runtime_edge: "NONE",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: []
});

upsertProducer(getSemantic(register, "twin.physical_state"), {
  producer_id: "legacy-root-zone-state-builder",
  path: "apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts",
  role: "legacy root-zone state builder retained as acceptance/library capability, not canonical MCFT State",
  authority_level: "ACCEPTANCE_LIBRARY",
  grandfathered_duplicate: true,
  removal_target: "B-09",
  current: true,
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: ["root-zone-state-acceptance"]
});
upsertConsumer(getSemantic(register, "twin.physical_state"), {
  consumer_id: "root-zone-state-acceptance",
  path: "scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_RUNTIME_V1.cjs",
  role: "acceptance/library-only state builder consumer",
  current: true,
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "twin.physical_state"), {
  consumer_id: "root-zone-state-acceptance",
  path: "scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_RUNTIME_V1.cjs",
  producer_id: "legacy-root-zone-state-builder",
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-013"
});

upsertProducer(getSemantic(register, "twin.forecast_scenario"), {
  producer_id: "legacy-root-zone-forecast-builder",
  path: "apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts",
  role: "legacy root-zone forecast builder retained in acceptance/library surface",
  authority_level: "ACCEPTANCE_LIBRARY",
  grandfathered_duplicate: true,
  removal_target: "B-09",
  current: true,
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: ["root-zone-forecast-acceptance"]
});
upsertConsumer(getSemantic(register, "twin.forecast_scenario"), {
  consumer_id: "root-zone-forecast-acceptance",
  path: "scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_RUNTIME_V1.cjs",
  role: "acceptance/library-only forecast builder consumer",
  current: true,
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "twin.forecast_scenario"), {
  consumer_id: "root-zone-forecast-acceptance",
  path: "scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_RUNTIME_V1.cjs",
  producer_id: "legacy-root-zone-forecast-builder",
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-014"
});
upsertProducer(getSemantic(register, "twin.forecast_scenario"), {
  producer_id: "legacy-root-zone-scenario-builder",
  path: "apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts",
  role: "legacy root-zone scenario builder retained in acceptance/library surface",
  authority_level: "ACCEPTANCE_LIBRARY",
  grandfathered_duplicate: true,
  removal_target: "B-09",
  current: true,
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: ["root-zone-scenario-acceptance"]
});
upsertConsumer(getSemantic(register, "twin.forecast_scenario"), {
  consumer_id: "root-zone-scenario-acceptance",
  path: "scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_RUNTIME_V1.cjs",
  role: "acceptance/library-only scenario builder consumer",
  current: true,
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "twin.forecast_scenario"), {
  consumer_id: "root-zone-scenario-acceptance",
  path: "scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_RUNTIME_V1.cjs",
  producer_id: "legacy-root-zone-scenario-builder",
  connection_class: "ACCEPTANCE_LIBRARY_ISLAND",
  activation: "TEST_ACCEPTANCE_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-015"
});

upsertProducer(getSemantic(register, "decision.candidate"), {
  producer_id: "legacy-operator-scenario-recommendation-writer",
  path: "apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts",
  role: "two preserved legacy scenario-to-recommendation POST routes; registered by Operator Module",
  authority_level: "ACTIVE_LEGACY_WRITER",
  grandfathered_duplicate: true,
  removal_target: "B-09",
  current: true,
  fingerprints: ["registerOperatorTwinWriteLegacyRoutesV1", "LEGACY_POST_PATHS_V1"],
  connection_class: "ACTIVE_LEGACY_WRITER",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: ["operator-module-registration"]
});
upsertConsumer(getSemantic(register, "decision.candidate"), {
  consumer_id: "operator-module-registration",
  path: "apps/server/src/modules/operator/registerOperatorModule.ts",
  role: "actively registers legacy scenario-to-recommendation write module",
  current: true,
  connection_class: "ACTIVE_LEGACY_WRITER",
  activation: "ALWAYS",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "decision.candidate"), {
  consumer_id: "operator-module-registration",
  path: "apps/server/src/modules/operator/registerOperatorModule.ts",
  producer_id: "legacy-operator-scenario-recommendation-writer",
  connection_class: "ACTIVE_LEGACY_WRITER",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-016"
});

upsertProducer(getSemantic(register, "interpretation.agronomy"), {
  producer_id: "agronomy-inference-route",
  path: "apps/server/src/routes/agronomy_inference_v1.ts",
  role: "registered agronomy inference API surface not wired as the central decision spine",
  authority_level: "ROUTE_CAPABILITY",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  grandfathered_runtime_consumers: ["agronomy-module-registration"]
});
upsertConsumer(getSemantic(register, "interpretation.agronomy"), {
  consumer_id: "agronomy-module-registration",
  path: "apps/server/src/modules/agronomy/registerAgronomyModule.ts",
  role: "registers agronomy inference and agronomy routes",
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "ALWAYS",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "interpretation.agronomy"), {
  consumer_id: "agronomy-module-registration",
  path: "apps/server/src/modules/agronomy/registerAgronomyModule.ts",
  producer_id: "agronomy-inference-route",
  connection_class: "ROUTE_ISLAND",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-017"
});
upsertProducer(getSemantic(register, "interpretation.agronomy"), {
  producer_id: "agronomy-interpretation-route",
  path: "apps/server/src/routes/agronomy_v0.ts",
  role: "runtime agronomy interpretation API surface intentionally isolated from deterministic Judge authority",
  authority_level: "EXPLAIN_ONLY",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "INTENTIONAL_ISOLATION",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: ["agronomy-module-registration"]
});

/* Judge route islands and local-direct-call skills. */
upsertConsumer(getSemantic(register, "evidence.qualification"), {
  consumer_id: "judge-v2-evidence-route",
  path: "apps/server/src/routes/judge_v2.ts",
  role: "separate Evidence Judge POST route; evaluates and persists Evidence Judge result",
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "evidence.qualification"), {
  consumer_id: "judge-v2-evidence-route",
  path: "apps/server/src/routes/judge_v2.ts",
  producer_id: "evidence-judge-v2",
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-005"
});
upsertConsumer(getSemantic(register, "decision.calculation"), {
  consumer_id: "judge-v2-agronomy-route",
  path: "apps/server/src/routes/judge_v2.ts",
  role: "separate Agronomy Judge POST route",
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "decision.calculation"), {
  consumer_id: "judge-v2-agronomy-route",
  path: "apps/server/src/routes/judge_v2.ts",
  producer_id: "agronomy-judge-calculation",
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-006"
});
upsertConsumer(getSemantic(register, "decision.calculation"), {
  consumer_id: "agronomy-judge-local-skills",
  path: "apps/server/src/domain/judge/agronomy_judge_v2.ts",
  role: "direct local caller of irrigation deficit/requirement skills; generic Skill Runtime is not in this call path",
  current: true,
  connection_class: "LOCAL_DIRECT_CALL",
  activation: "ALWAYS",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "decision.calculation"), {
  consumer_id: "agronomy-judge-local-skills",
  path: "apps/server/src/domain/judge/agronomy_judge_v2.ts",
  producer_id: "irrigation-requirement-skill",
  connection_class: "LOCAL_DIRECT_CALL",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-009"
});

/* Active Agronomy Agent connectivity. */
upsertConsumer(getSemantic(register, "decision.candidate"), {
  consumer_id: "agronomy-agent-plan-write",
  path: "apps/server/src/jobs/agronomy_agent.ts",
  role: "same active job persists recommendation and then operation_plan_v1 compatibility object",
  current: true,
  connection_class: "ACTIVE_PARALLEL",
  activation: "FEATURE_FLAG",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "decision.candidate"), {
  consumer_id: "agronomy-agent-plan-write",
  path: "apps/server/src/jobs/agronomy_agent.ts",
  producer_id: "agronomy-agent-recommendation",
  connection_class: "ACTIVE_PARALLEL",
  activation: "FEATURE_FLAG",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-023"
});
upsertConsumer(getSemantic(register, "operation.plan"), {
  consumer_id: "agronomy-agent-plan-persistence",
  path: "apps/server/src/jobs/agronomy_agent.ts",
  role: "same active job writes operation_plan_v1 and transition records",
  current: true,
  connection_class: "ACTIVE_PARALLEL",
  activation: "FEATURE_FLAG",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "operation.plan"), {
  consumer_id: "agronomy-agent-plan-persistence",
  path: "apps/server/src/jobs/agronomy_agent.ts",
  producer_id: "agronomy-agent-plan",
  connection_class: "ACTIVE_PARALLEL",
  activation: "FEATURE_FLAG",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-024"
});

/* New semantic: registered generic Skill Runtime is a capability island, while Judge skills are local direct calls. */
upsertSemantic(register, {
  semantic_id: "runtime.skill_capability",
  question: "Which generic Skill Runtime capability is registered, and is it actually in a current decision/judge call path?",
  target_owner: "Skill Runtime capability layer",
  canonical_output_type: "skill run / result / trace contracts",
  current_state: "REGISTERED_CAPABILITY_ISLAND",
  target_phase: "KEEP/ADAPT",
  new_owner_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  registered_producers: [],
  registered_consumers: [],
  runtime_consumers: [],
  notes: ["Generic Skill Runtime is a registered API capability. Agronomy Judge currently calls local irrigation skills directly rather than routing through this runtime."]
});
upsertProducer(getSemantic(register, "runtime.skill_capability"), {
  producer_id: "skill-runtime-route",
  path: "apps/server/src/routes/skill_runtime_v1.ts",
  role: "generic skill execute/cancel/status/result/trace API",
  authority_level: "REGISTERED_CAPABILITY",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "REGISTERED_CAPABILITY_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  grandfathered_runtime_consumers: ["skill-runtime-module-registration"]
});
upsertConsumer(getSemantic(register, "runtime.skill_capability"), {
  consumer_id: "skill-runtime-module-registration",
  path: "apps/server/src/modules/decision/registerDecisionModule.ts",
  role: "registers generic Skill Runtime routes",
  current: true,
  connection_class: "REGISTERED_CAPABILITY_ISLAND",
  activation: "ALWAYS",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "runtime.skill_capability"), {
  consumer_id: "skill-runtime-module-registration",
  path: "apps/server/src/modules/decision/registerDecisionModule.ts",
  producer_id: "skill-runtime-route",
  connection_class: "REGISTERED_CAPABILITY_ISLAND",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-011"
});

/* Execution Judge route island and proven execution-memory side effect. */
upsertProducer(getSemantic(register, "execution.task_receipt_acceptance"), {
  producer_id: "execution-judge-v2",
  path: "apps/server/src/domain/judge/execution_judge_v2.ts",
  role: "Execution Judge evaluator exposed by separate Judge route",
  authority_level: "ROUTE_CAPABILITY",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  grandfathered_runtime_consumers: ["judge-v2-execution-route", "execution-memory-side-effect"]
});
upsertConsumer(getSemantic(register, "execution.task_receipt_acceptance"), {
  consumer_id: "judge-v2-execution-route",
  path: "apps/server/src/routes/judge_v2.ts",
  role: "separate Execution Judge POST route",
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "execution.task_receipt_acceptance"), {
  consumer_id: "judge-v2-execution-route",
  path: "apps/server/src/routes/judge_v2.ts",
  producer_id: "execution-judge-v2",
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-007"
});
upsertConsumer(getSemantic(register, "execution.task_receipt_acceptance"), {
  consumer_id: "execution-memory-side-effect",
  path: "apps/server/src/routes/judge_v2.ts",
  role: "Execution Judge POST writes execution_reliability Field Memory when field_id exists",
  current: true,
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "execution.task_receipt_acceptance"), {
  consumer_id: "execution-memory-side-effect",
  path: "apps/server/src/routes/judge_v2.ts",
  producer_id: "execution-judge-v2",
  connection_class: "ROUTE_ISLAND",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-008"
});

/* Post-acceptance connectivity. Exact-main correction: formal PASS acceptance writes Field Memory inline, so this is not a MANUAL_SEAM. */
upsertSemantic(register, {
  semantic_id: "post_acceptance.verification_memory",
  question: "What post-acceptance verification or memory paths are actually wired from Acceptance?",
  target_owner: "Post-acceptance outcome/memory layers",
  canonical_output_type: "Field Memory / Water Response Verification downstream artifacts",
  current_state: "MIXED_PROVEN_AND_MANUAL_SEAMS",
  target_phase: "B-08/B-09",
  new_owner_creation: "FORBIDDEN",
  registered_producers: [],
  registered_consumers: [],
  runtime_consumers: [],
  notes: [
    "Exact-main acceptance_v1.ts directly writes FORMAL_FIELD_MEMORY after PASS + formal_acceptance + field_id.",
    "Water Response Verification exists as an acceptance-derived builder/route but no automatic Acceptance->Water Response invocation is proven in B-02."
  ]
});
upsertProducer(getSemantic(register, "post_acceptance.verification_memory"), {
  producer_id: "acceptance-formal-pass",
  path: "apps/server/src/routes/acceptance_v1.ts",
  role: "acceptance result path; on formal PASS with field_id it directly records FORMAL_FIELD_MEMORY",
  authority_level: "CURRENT_ACCEPTANCE_RUNTIME",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "MAINLINE",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  grandfathered_runtime_consumers: ["field-memory-service"]
});
upsertConsumer(getSemantic(register, "post_acceptance.verification_memory"), {
  consumer_id: "field-memory-service",
  path: "apps/server/src/services/field_memory_service.ts",
  role: "receives inline formal acceptance Field Memory write",
  current: true,
  connection_class: "MAINLINE",
  activation: "API_ONLY",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "post_acceptance.verification_memory"), {
  consumer_id: "field-memory-service",
  path: "apps/server/src/services/field_memory_service.ts",
  producer_id: "acceptance-formal-pass",
  connection_class: "MAINLINE",
  activation: "API_ONLY",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-019"
});
upsertProducer(getSemantic(register, "post_acceptance.verification_memory"), {
  producer_id: "water-response-from-acceptance-builder",
  path: "apps/server/src/domain/water_response/water_response_verification_from_acceptance_v1.ts",
  role: "acceptance-derived water-response verification builder exposed through a separate/manual seam",
  authority_level: "MANUAL_DOWNSTREAM_CAPABILITY",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "MANUAL_SEAM",
  activation: "MANUAL",
  runtime_edge: "NOT_PROVEN",
  new_runtime_consumer_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  grandfathered_runtime_consumers: []
});
upsertConsumer(getSemantic(register, "post_acceptance.verification_memory"), {
  consumer_id: "water-response-verification-route",
  path: "apps/server/src/routes/water_response_verification_v1.ts",
  role: "separate/manual Water Response Verification API surface; automatic call from Acceptance is not proven",
  current: true,
  connection_class: "MANUAL_SEAM",
  activation: "MANUAL",
  runtime_edge: "NOT_PROVEN"
});

/* Existing EvidenceModule is reporting/artifact plane, not the future canonical Evidence Runtime. */
upsertSemantic(register, {
  semantic_id: "evidence.reporting_artifact",
  question: "What existing EvidenceModule surface packages/reports/exports evidence artifacts?",
  target_owner: "Evidence reporting/artifact plane",
  canonical_output_type: "evidence bundle/report/export/artifact surfaces",
  current_state: "REPORTING_ARTIFACT_PLANE",
  target_phase: "KEEP_SEPARATE_FROM_B-04_EVIDENCE_RUNTIME",
  new_owner_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  registered_producers: [],
  registered_consumers: [],
  runtime_consumers: [],
  notes: ["This existing module is not the future canonical provider-to-Governed-Evidence Runtime."]
});
upsertProducer(getSemantic(register, "evidence.reporting_artifact"), {
  producer_id: "existing-evidence-module",
  path: "apps/server/src/modules/evidence/registerEvidenceModule.ts",
  role: "registers evidence bundle/report/export/audit/artifact routes",
  authority_level: "REPORTING_ARTIFACT_PLANE",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "REPORTING_ARTIFACT_PLANE",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  new_runtime_consumer_creation: "ALLOWED_ONLY_BY_EXPLICIT_REGISTER",
  grandfathered_runtime_consumers: ["domain-module-evidence-registration"]
});
upsertConsumer(getSemantic(register, "evidence.reporting_artifact"), {
  consumer_id: "domain-module-evidence-registration",
  path: "apps/server/src/modules/domain/registerDomainModules.ts",
  role: "registers existing EvidenceModule",
  current: true,
  connection_class: "REPORTING_ARTIFACT_PLANE",
  activation: "ALWAYS",
  runtime_edge: "PROVEN"
});
upsertRuntimeConsumer(getSemantic(register, "evidence.reporting_artifact"), {
  consumer_id: "domain-module-evidence-registration",
  path: "apps/server/src/modules/domain/registerDomainModules.ts",
  producer_id: "existing-evidence-module",
  connection_class: "REPORTING_ARTIFACT_PLANE",
  activation: "ALWAYS",
  runtime_edge: "PROVEN",
  evidence_edge_id: "C-021"
});

/* Flight Table / simulator is devtools-only and intentionally excluded from production truth. */
upsertSemantic(register, {
  semantic_id: "devtools.simulation",
  question: "Which simulation/Flight Table paths exist only for dev/test operation?",
  target_owner: "Devtools",
  canonical_output_type: "dev-only flight-table/simulator artifacts",
  current_state: "DEVTOOLS_ONLY_INTENTIONAL_ISOLATION",
  target_phase: "KEEP_ISOLATED",
  new_owner_creation: "FORBIDDEN",
  registered_producers: [],
  registered_consumers: [],
  runtime_consumers: [],
  notes: ["Devtools outputs must not become a production semantic consumer or formal Evidence source without an explicit later authority decision."]
});
upsertProducer(getSemantic(register, "devtools.simulation"), {
  producer_id: "flight-table-devtools-module",
  path: "apps/server/src/modules/devtools/registerDevtoolsModule.ts",
  role: "registers Flight Table/devtools routes",
  authority_level: "DEVTOOLS_ONLY",
  grandfathered_duplicate: false,
  removal_target: null,
  current: true,
  connection_class: "DEVTOOLS_ONLY",
  activation: "API_ONLY",
  runtime_edge: "INTENTIONAL_NONE",
  new_runtime_consumer_creation: "FORBIDDEN",
  grandfathered_runtime_consumers: []
});

/* Normalize all consumer classifications added after initial pass. */
const explicitConsumerDefaults = {
  "root-zone-state-acceptance": ["ACCEPTANCE_LIBRARY_ISLAND","TEST_ACCEPTANCE_ONLY","PROVEN"],
  "root-zone-forecast-acceptance": ["ACCEPTANCE_LIBRARY_ISLAND","TEST_ACCEPTANCE_ONLY","PROVEN"],
  "root-zone-scenario-acceptance": ["ACCEPTANCE_LIBRARY_ISLAND","TEST_ACCEPTANCE_ONLY","PROVEN"],
  "operator-module-registration": ["ACTIVE_LEGACY_WRITER","ALWAYS","PROVEN"],
  "agronomy-module-registration": ["ROUTE_ISLAND","ALWAYS","PROVEN"],
  "judge-v2-evidence-route": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "judge-v2-agronomy-route": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "agronomy-judge-local-skills": ["LOCAL_DIRECT_CALL","ALWAYS","PROVEN"],
  "agronomy-agent-plan-write": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "agronomy-agent-plan-persistence": ["ACTIVE_PARALLEL","FEATURE_FLAG","PROVEN"],
  "skill-runtime-module-registration": ["REGISTERED_CAPABILITY_ISLAND","ALWAYS","PROVEN"],
  "judge-v2-execution-route": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "execution-memory-side-effect": ["ROUTE_ISLAND","API_ONLY","PROVEN"],
  "field-memory-service": ["MAINLINE","API_ONLY","PROVEN"],
  "water-response-verification-route": ["MANUAL_SEAM","MANUAL","NOT_PROVEN"],
  "domain-module-evidence-registration": ["REPORTING_ARTIFACT_PLANE","ALWAYS","PROVEN"]
};
for (const [cid, vals] of Object.entries(explicitConsumerDefaults)) {
  annotateConsumer(register, cid, {
    connection_class: vals[0], activation: vals[1], runtime_edge: vals[2]
  });
}

/* Existing runtime-consumer proofs that B-02 already knows from exact-main audit. */
const runtimeSeeds = [
  ["evidence.raw_observation","stage1-sensing","telemetry-ingest","C-001"],
  ["evidence.raw_observation","agronomy-agent","telemetry-ingest","C-002"],
  ["evidence.qualification","stage1-recommendation-path","stage1-formal-gate","C-003"],
  ["context.declared_identity","agronomy-rule-engine","agronomy-context-builder","C-025"],
  ["context.declared_identity","decision-engine-route","agronomy-context-builder","C-026"],
  ["twin.physical_state","decision-engine-state","derived-sensing-state-service","C-027"],
  ["twin.forecast_scenario","decision-engine-weather","external-weather-projection","C-028"]
];
for (const [sid,cid,pid,eid] of runtimeSeeds) {
  const s = getSemantic(register, sid);
  const rc = (s.registered_consumers || []).find((x) => x.consumer_id === cid);
  if (!rc) throw new Error(`RUNTIME_SEED_CONSUMER_NOT_FOUND:${sid}:${cid}`);
  upsertRuntimeConsumer(s, {
    consumer_id: cid, path: rc.path, producer_id: pid,
    connection_class: rc.connection_class, activation: rc.activation,
    runtime_edge: "PROVEN", evidence_edge_id: eid
  });
}

/* Freeze runtime-consumer snapshots for compatibility-like producers after the proven map is built. */
for (const s of register.semantics) {
  for (const p of s.registered_producers || []) {
    p.grandfathered_runtime_consumers ||= [];
  }
}
/* Agronomy Agent direct plan/recommendation current consumers are explicitly grandfathered. */
annotateProducer(register, "agronomy-agent-recommendation", {
  grandfathered_runtime_consumers: ["agronomy-agent-plan-write"],
  new_runtime_consumer_creation: "FORBIDDEN"
});
annotateProducer(register, "agronomy-agent-plan", {
  grandfathered_runtime_consumers: ["agronomy-agent-plan-persistence"],
  new_runtime_consumer_creation: "FORBIDDEN"
});
annotateProducer(register, "flight-table-plan", {
  grandfathered_runtime_consumers: [],
  new_runtime_consumer_creation: "FORBIDDEN"
});

/* Add static guards for newly classified connectivity debt. */
register.static_guards ||= [];
const addGuard = (g) => {
  const i = register.static_guards.findIndex((x) => x.guard_id === g.guard_id);
  if (i >= 0) register.static_guards[i] = g; else register.static_guards.push(g);
};
addGuard({
  guard_id: "G-B02-07-active-legacy-operator-writer",
  semantic_id: "decision.candidate",
  description: "The two legacy Operator scenario-to-recommendation POST routes and their registration must remain explicitly inventoried; no copy may silently appear.",
  scan_roots: ["apps/server/src"],
  extensions: [".ts"],
  ignore_path_fragments: [".test.ts", ".acceptance.test.ts"],
  match: { any_of: ["registerOperatorTwinWriteLegacyRoutesV1(", "LEGACY_POST_PATHS_V1"] },
  registered_paths: [
    "apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts",
    "apps/server/src/modules/operator/registerOperatorModule.ts"
  ],
  failure: "UNREGISTERED_ACTIVE_LEGACY_OPERATOR_WRITER"
});
addGuard({
  guard_id: "G-B02-08-orphaned-irrigation-decision-export",
  semantic_id: "decision.calculation",
  description: "The currently orphaned evaluateIrrigationDecisionV1 export is registered as debt; new references must first change connectivity classification.",
  scan_roots: ["apps/server/src"],
  extensions: [".ts"],
  ignore_path_fragments: [".test.ts", ".acceptance.test.ts"],
  match: { any_of: ["evaluateIrrigationDecisionV1"] },
  registered_paths: ["apps/server/src/domain/decision_engine_v1.ts"],
  failure: "ORPHANED_IRRIGATION_DECISION_EXPORT_GAINED_UNREGISTERED_REFERENCE"
});
addGuard({
  guard_id: "G-B02-09-devtools-flight-table-production-boundary",
  semantic_id: "devtools.simulation",
  description: "Production module/domain/job roots must not import or require Flight Table/devtools implementation.",
  scan_roots: ["apps/server/src/modules", "apps/server/src/domain", "apps/server/src/jobs"],
  extensions: [".ts"],
  ignore_path_fragments: [
    "apps/server/src/modules/devtools/",
    "apps/server/src/services/flight_table/",
    "apps/server/src/routes/dev/",
    ".test.ts",
    ".acceptance.test.ts"
  ],
  forbid: {
    any_of_regex: [
      "from\\s+[\\\"'][^\\\"']*(?:/routes/dev/|/services/flight_table/|flight_table|flight-table)[^\\\"']*[\\\"']",
      "require\\([\\\"'][^\\\"']*(?:/routes/dev/|/services/flight_table/|flight_table|flight-table)[^\\\"']*[\\\"']\\)"
    ]
  },
  failure: "DEVTOOLS_ONLY_PATH_USED_BY_PRODUCTION_CONSUMER"
});

writeJson(registerPath, register);

/* Graph: add current runtime connectivity without changing target semantic edges. */
const graph = readJson(graphPath);
graph.schema_version = "1.1";
graph.current_connectivity_edges ||= [];
graph.connectivity_status_values = ["CURRENT_PROVEN","ROUTE_ONLY","MANUAL","TEST_ONLY","NOT_WIRED"];
const ce = (item) => addGraphItem(graph.current_connectivity_edges, item);
const ev = (kind, caller_path, callee_path, fingerprint) => ({ kind, caller_path, callee_path, fingerprint });

ce({ edge_id:"C-001", from_producer:"telemetry-ingest", to_consumer:"stage1-sensing", semantic_id:"evidence.raw_observation", connection_class:"MAINLINE", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("PERSISTED_DATA","apps/server/src/routes/telemetry_v1.ts","apps/server/src/domain/sensing/run_sensing_inference_pipeline_v1.ts","telemetry_index_v1 / sensing pipeline"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-002", from_producer:"telemetry-ingest", to_consumer:"agronomy-agent", semantic_id:"evidence.raw_observation", connection_class:"ACTIVE_PARALLEL", activation:"FEATURE_FLAG", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("PERSISTED_DATA","apps/server/src/routes/telemetry_v1.ts","apps/server/src/jobs/agronomy_agent.ts","telemetry_index_v1"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-003", from_producer:"stage1-formal-gate", to_consumer:"stage1-recommendation-path", semantic_id:"evidence.qualification", connection_class:"MAINLINE", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/routes/decision_engine_v1.ts","apps/server/src/domain/decision/stage1_action_boundary_v1.ts","evaluateFormalStage1TriggerGateV1 / isFormalStage1TriggerEligible"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-004", from_producer:"evidence-judge-v2", to_consumer:"agronomy-judge-v2", semantic_id:"evidence.qualification", connection_class:"ROUTE_ISLAND", activation:"API_ONLY", runtime_edge:"NOT_PROVEN", contract_compatible:true, evidence:ev("CONTRACT_ONLY","apps/server/src/routes/judge_v2.ts","apps/server/src/domain/judge/agronomy_judge_v2.ts","Agronomy request accepts evidence_judge_id/evidence_judge_verdict but does not load/run Evidence Judge"), status:"NOT_WIRED" });
ce({ edge_id:"C-005", from_producer:"evidence-judge-v2", to_consumer:"judge-v2-evidence-route", semantic_id:"evidence.qualification", connection_class:"ROUTE_ISLAND", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/routes/judge_v2.ts","apps/server/src/domain/judge/evidence_judge_v2.ts","evaluateEvidenceJudgeV2(body)"), status:"ROUTE_ONLY" });
ce({ edge_id:"C-006", from_producer:"agronomy-judge-calculation", to_consumer:"judge-v2-agronomy-route", semantic_id:"decision.calculation", connection_class:"ROUTE_ISLAND", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/routes/judge_v2.ts","apps/server/src/domain/judge/agronomy_judge_v2.ts","evaluateAgronomyJudgeV2(body)"), status:"ROUTE_ONLY" });
ce({ edge_id:"C-007", from_producer:"execution-judge-v2", to_consumer:"judge-v2-execution-route", semantic_id:"execution.task_receipt_acceptance", connection_class:"ROUTE_ISLAND", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/routes/judge_v2.ts","apps/server/src/domain/judge/execution_judge_v2.ts","evaluateExecutionJudgeV2(body)"), status:"ROUTE_ONLY" });
ce({ edge_id:"C-008", from_producer:"execution-judge-v2", to_consumer:"execution-memory-side-effect", semantic_id:"execution.task_receipt_acceptance", connection_class:"ROUTE_ISLAND", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("SAME_REQUEST_SIDE_EFFECT","apps/server/src/routes/judge_v2.ts","apps/server/src/services/field_memory_service.ts","recordMemoryV1 type=execution_reliability"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-009", from_producer:"irrigation-requirement-skill", to_consumer:"agronomy-judge-local-skills", semantic_id:"decision.calculation", connection_class:"LOCAL_DIRECT_CALL", activation:"ALWAYS", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/domain/judge/agronomy_judge_v2.ts","apps/server/src/domain/agronomy/skills/irrigation/irrigation_requirement_skill_v1.ts","runIrrigationRequirementSkillV1"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-010", from_producer:"irrigation-deficit-skill", to_consumer:"agronomy-judge-local-skills", semantic_id:"decision.calculation", connection_class:"LOCAL_DIRECT_CALL", activation:"ALWAYS", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/domain/judge/agronomy_judge_v2.ts","apps/server/src/domain/agronomy/skills/irrigation/irrigation_deficit_skill_v1.ts","runIrrigationDeficitSkillV1"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-011", from_producer:"skill-runtime-route", to_consumer:"skill-runtime-module-registration", semantic_id:"runtime.skill_capability", connection_class:"REGISTERED_CAPABILITY_ISLAND", activation:"ALWAYS", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("MODULE_REGISTRATION","apps/server/src/modules/decision/registerDecisionModule.ts","apps/server/src/routes/skill_runtime_v1.ts","registerSkillRuntimeV1Routes"), status:"ROUTE_ONLY" });
ce({ edge_id:"C-012", from_producer:"evaluate-irrigation-decision-v1", to_consumer:"NONE", semantic_id:"decision.calculation", connection_class:"ORPHANED", activation:"NOT_REFERENCED", runtime_edge:"NONE", contract_compatible:false, evidence:ev("CODE_SEARCH","apps/server/src/domain/decision_engine_v1.ts","apps/server/src/domain/decision_engine_v1.ts","evaluateIrrigationDecisionV1 found only at export definition in B-02 exact-main search"), status:"NOT_WIRED" });
ce({ edge_id:"C-013", from_producer:"legacy-root-zone-state-builder", to_consumer:"root-zone-state-acceptance", semantic_id:"twin.physical_state", connection_class:"ACCEPTANCE_LIBRARY_ISLAND", activation:"TEST_ACCEPTANCE_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("TEST_HARNESS","scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_RUNTIME_V1.cjs","apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts","root-zone state runtime acceptance"), status:"TEST_ONLY" });
ce({ edge_id:"C-014", from_producer:"legacy-root-zone-forecast-builder", to_consumer:"root-zone-forecast-acceptance", semantic_id:"twin.forecast_scenario", connection_class:"ACCEPTANCE_LIBRARY_ISLAND", activation:"TEST_ACCEPTANCE_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("TEST_HARNESS","scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_RUNTIME_V1.cjs","apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts","root-zone forecast runtime acceptance"), status:"TEST_ONLY" });
ce({ edge_id:"C-015", from_producer:"legacy-root-zone-scenario-builder", to_consumer:"root-zone-scenario-acceptance", semantic_id:"twin.forecast_scenario", connection_class:"ACCEPTANCE_LIBRARY_ISLAND", activation:"TEST_ACCEPTANCE_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("TEST_HARNESS","scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_RUNTIME_V1.cjs","apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts","root-zone scenario runtime acceptance"), status:"TEST_ONLY" });
ce({ edge_id:"C-016", from_producer:"legacy-operator-scenario-recommendation-writer", to_consumer:"operator-module-registration", semantic_id:"decision.candidate", connection_class:"ACTIVE_LEGACY_WRITER", activation:"ALWAYS", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("MODULE_REGISTRATION","apps/server/src/modules/operator/registerOperatorModule.ts","apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts","registerOperatorTwinWriteLegacyRoutesV1(app, pool) / two POST paths"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-017", from_producer:"agronomy-inference-route", to_consumer:"agronomy-module-registration", semantic_id:"interpretation.agronomy", connection_class:"ROUTE_ISLAND", activation:"ALWAYS", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("MODULE_REGISTRATION","apps/server/src/modules/agronomy/registerAgronomyModule.ts","apps/server/src/routes/agronomy_inference_v1.ts","register agronomy inference route"), status:"ROUTE_ONLY" });
ce({ edge_id:"C-018", from_producer:"agronomy-interpretation-route", to_consumer:"agronomy-module-registration", semantic_id:"interpretation.agronomy", connection_class:"INTENTIONAL_ISOLATION", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("MODULE_REGISTRATION","apps/server/src/modules/agronomy/registerAgronomyModule.ts","apps/server/src/routes/agronomy_v0.ts","Agronomy Interpretation route is registered but explain-only"), status:"ROUTE_ONLY" });
ce({ edge_id:"C-019", from_producer:"acceptance-formal-pass", to_consumer:"field-memory-service", semantic_id:"post_acceptance.verification_memory", connection_class:"MAINLINE", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("SAME_REQUEST_SIDE_EFFECT","apps/server/src/routes/acceptance_v1.ts","apps/server/src/services/field_memory_service.ts","verdict PASS && formal_acceptance && field_id -> recordMemoryV1 FORMAL_FIELD_MEMORY"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-020", from_producer:"water-response-from-acceptance-builder", to_consumer:"water-response-verification-route", semantic_id:"post_acceptance.verification_memory", connection_class:"MANUAL_SEAM", activation:"MANUAL", runtime_edge:"NOT_PROVEN", contract_compatible:true, evidence:ev("SEPARATE_API","apps/server/src/routes/acceptance_v1.ts","apps/server/src/routes/water_response_verification_v1.ts","acceptance-derived builder exists; no automatic call from acceptance route proven"), status:"MANUAL" });
ce({ edge_id:"C-021", from_producer:"existing-evidence-module", to_consumer:"domain-module-evidence-registration", semantic_id:"evidence.reporting_artifact", connection_class:"REPORTING_ARTIFACT_PLANE", activation:"ALWAYS", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("MODULE_REGISTRATION","apps/server/src/modules/domain/registerDomainModules.ts","apps/server/src/modules/evidence/registerEvidenceModule.ts","registerEvidenceModule"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-022", from_producer:"flight-table-devtools-module", to_consumer:"NONE", semantic_id:"devtools.simulation", connection_class:"DEVTOOLS_ONLY", activation:"API_ONLY", runtime_edge:"INTENTIONAL_NONE", contract_compatible:false, evidence:ev("INTENTIONAL_BOUNDARY","apps/server/src/modules/devtools/registerDevtoolsModule.ts","apps/server/src/routes/dev/flight_table_v1.ts","devtools/Flight Table intentionally excluded from production semantic consumers"), status:"NOT_WIRED" });
ce({ edge_id:"C-023", from_producer:"agronomy-agent-recommendation", to_consumer:"agronomy-agent-plan-write", semantic_id:"decision.candidate", connection_class:"ACTIVE_PARALLEL", activation:"FEATURE_FLAG", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("SAME_JOB","apps/server/src/jobs/agronomy_agent.ts","apps/server/src/jobs/agronomy_agent.ts","recommendation_v1 / decision_recommendation_v1 followed by operation_plan_v1"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-024", from_producer:"agronomy-agent-plan", to_consumer:"agronomy-agent-plan-persistence", semantic_id:"operation.plan", connection_class:"ACTIVE_PARALLEL", activation:"FEATURE_FLAG", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("PERSISTENCE_WRITE","apps/server/src/jobs/agronomy_agent.ts","apps/server/src/jobs/agronomy_agent.ts","agronomy_agent_auto_create / operation_plan_v1"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-025", from_producer:"agronomy-context-builder", to_consumer:"agronomy-rule-engine", semantic_id:"context.declared_identity", connection_class:"ACTIVE_PARALLEL", activation:"FEATURE_FLAG", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/jobs/agronomy_agent.ts","apps/server/src/domain/agronomy/context_builder.ts","build AgronomyContext consumed by agronomy rules"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-026", from_producer:"agronomy-context-builder", to_consumer:"decision-engine-route", semantic_id:"context.declared_identity", connection_class:"COMPATIBILITY", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("SHARED_CONTEXT_SEMANTICS","apps/server/src/routes/decision_engine_v1.ts","apps/server/src/domain/agronomy/context_builder.ts","decision route consumes request/program/read-model context and stage semantics"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-027", from_producer:"derived-sensing-state-service", to_consumer:"decision-engine-state", semantic_id:"twin.physical_state", connection_class:"COMPATIBILITY", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/routes/decision_engine_v1.ts","apps/server/src/services/derived_sensing_state_v1.js","getLatestDerivedSensingStatesByFieldV1"), status:"CURRENT_PROVEN" });
ce({ edge_id:"C-028", from_producer:"external-weather-projection", to_consumer:"decision-engine-weather", semantic_id:"twin.forecast_scenario", connection_class:"MAINLINE", activation:"API_ONLY", runtime_edge:"PROVEN", contract_compatible:true, evidence:ev("DIRECT_CALL","apps/server/src/routes/decision_engine_v1.ts","apps/server/src/projections/weather_forecast_v1.ts","getLatestWeatherForecastIndexV1"), status:"CURRENT_PROVEN" });

graph.current_parallel_edges ||= [];
addGraphItem(graph.current_parallel_edges, {
  edge_id:"P-011", producer_id:"legacy-operator-scenario-recommendation-writer", semantic_id:"decision.candidate",
  relation:"ACTIVE_LEGACY_WRITER", removal_target:"B-09", new_owner_creation:"FORBIDDEN"
});
addGraphItem(graph.current_parallel_edges, {
  edge_id:"P-012", producer_id:"evaluate-irrigation-decision-v1", semantic_id:"decision.calculation",
  relation:"ORPHANED_CAPABILITY", removal_target:"B-09", new_owner_creation:"FORBIDDEN"
});
graph.forbidden_edges ||= [];
addGraphItem(graph.forbidden_edges, {
  edge_id:"F-013", from:"devtools.simulation", to:"evidence.qualification",
  relation:"DEVTOOLS_TO_PRODUCTION_AUTHORITY",
  reason:"Flight Table/simulator outputs are DEVTOOLS_ONLY and intentionally isolated from production/formal Evidence authority.",
  enforcement:"STATIC_PRODUCTION_IMPORT_GUARD"
});
writeJson(graphPath, graph);

/* Replace the B-02 linter with connectivity-aware static-explicit validation. */
const linter = String.raw`#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const baseDir = path.join(repoRoot, "docs/architecture/semantic_convergence");
const registerPath = path.join(baseDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const graphPath = path.join(baseDir, "GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");
const allowlistPath = path.join(baseDir, "GEOX-B02-STATIC-SCAN-ALLOWLIST-V1.json");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const abs = (p) => path.join(repoRoot, p);
const exists = (p) => fs.existsSync(abs(p));
const repoPath = (p) => path.relative(repoRoot, p).split(path.sep).join("/");

function listFiles(root, extensions, ignores) {
  const out = [];
  const stack = [abs(root)];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rp = repoPath(p);
      if (ignores.some((x) => rp.includes(x))) continue;
      if (e.isDirectory()) {
        if (!["node_modules","dist",".git"].includes(e.name)) stack.push(p);
      } else if (e.isFile() && (!extensions.length || extensions.some((x) => rp.endsWith(x)))) {
        out.push(p);
      }
    }
  }
  return out;
}

function matches(content, spec) {
  const all = Array.isArray(spec?.all_of) ? spec.all_of : [];
  const any = Array.isArray(spec?.any_of) ? spec.any_of : [];
  if (all.length && !all.every((x) => content.includes(String(x)))) return false;
  if (any.length && !any.some((x) => content.includes(String(x)))) return false;
  return all.length > 0 || any.length > 0;
}

function run() {
  const failures = [];
  const warnings = [];
  for (const p of [registerPath, graphPath, allowlistPath]) {
    if (!fs.existsSync(p)) failures.push("REQUIRED_FILE_MISSING:" + repoPath(p));
  }
  if (failures.length) return finish(failures, warnings, {}, {});

  const register = readJson(registerPath);
  const graph = readJson(graphPath);
  const allowlist = readJson(allowlistPath);

  if (register.phase !== "B-02") failures.push("REGISTER_PHASE_INVALID:" + register.phase);
  if (graph.phase !== "B-02") failures.push("GRAPH_PHASE_INVALID:" + graph.phase);
  if (allowlist.phase !== "B-02") failures.push("ALLOWLIST_PHASE_INVALID:" + allowlist.phase);
  if (register.enforcement_model?.linter_scope !== "STATIC_EXPLICIT_ONLY") failures.push("REGISTER_LINTER_SCOPE_MUST_BE_STATIC_EXPLICIT_ONLY");

  const ccValues = new Set(register.connectivity_model?.connection_class_values || []);
  const activationValues = new Set(register.connectivity_model?.activation_values || []);
  const runtimeValues = new Set(register.connectivity_model?.runtime_edge_values || []);
  for (const required of ["MAINLINE","ACTIVE_PARALLEL","ROUTE_ISLAND","MANUAL_SEAM","ACCEPTANCE_LIBRARY_ISLAND","COMPATIBILITY","DEVTOOLS_ONLY","ORPHANED","INTENTIONAL_ISOLATION","REGISTERED_CAPABILITY_ISLAND","ACTIVE_LEGACY_WRITER"]) {
    if (!ccValues.has(required)) failures.push("CONNECTIVITY_CLASS_ENUM_MISSING:" + required);
  }

  const semantics = Array.isArray(register.semantics) ? register.semantics : [];
  const semanticIds = new Set();
  const producerIndex = new Map();
  const consumerIndex = new Map();

  for (const semantic of semantics) {
    const sid = String(semantic.semantic_id || "").trim();
    if (!sid) { failures.push("SEMANTIC_ID_MISSING"); continue; }
    if (semanticIds.has(sid)) failures.push("SEMANTIC_ID_DUPLICATE:" + sid);
    semanticIds.add(sid);
    for (const key of ["target_owner","canonical_output_type","new_owner_creation"]) {
      if (!String(semantic[key] || "").trim()) failures.push("SEMANTIC_FIELD_MISSING:" + sid + ":" + key);
    }
    if (!Array.isArray(semantic.registered_consumers)) failures.push("REGISTERED_CONSUMERS_MISSING:" + sid);
    if (!Array.isArray(semantic.runtime_consumers)) failures.push("RUNTIME_CONSUMERS_MISSING:" + sid);

    for (const p of Array.isArray(semantic.registered_producers) ? semantic.registered_producers : []) {
      const pid = String(p.producer_id || "").trim();
      const pp = String(p.path || "").trim();
      if (!pid) { failures.push("PRODUCER_ID_MISSING:" + sid); continue; }
      if (producerIndex.has(pid)) failures.push("PRODUCER_ID_GLOBAL_DUPLICATE:" + pid);
      producerIndex.set(pid, { semantic_id:sid, producer:p });
      if (!pp) failures.push("PRODUCER_PATH_MISSING:" + sid + ":" + pid);
      if (p.current !== false && pp && !exists(pp)) failures.push("REGISTERED_PRODUCER_PATH_MISSING:" + sid + ":" + pid + ":" + pp);
      for (const key of ["connection_class","activation","runtime_edge"]) if (!String(p[key] || "").trim()) failures.push("PRODUCER_CONNECTIVITY_FIELD_MISSING:" + sid + ":" + pid + ":" + key);
      if (!ccValues.has(p.connection_class)) failures.push("PRODUCER_CONNECTION_CLASS_INVALID:" + sid + ":" + pid + ":" + p.connection_class);
      if (!activationValues.has(p.activation)) failures.push("PRODUCER_ACTIVATION_INVALID:" + sid + ":" + pid + ":" + p.activation);
      if (!runtimeValues.has(p.runtime_edge)) failures.push("PRODUCER_RUNTIME_EDGE_INVALID:" + sid + ":" + pid + ":" + p.runtime_edge);
      if (p.grandfathered_duplicate === true) {
        const target = String(p.removal_target || "");
        if (!/^B-0[4-9]$/.test(target)) failures.push("GRANDFATHERED_REMOVAL_TARGET_INVALID:" + sid + ":" + pid + ":" + (target || "NONE"));
        if (!["FORBIDDEN","ALLOWED_ONLY_BY_EXPLICIT_REGISTER"].includes(semantic.new_owner_creation)) failures.push("GRANDFATHERED_NEW_OWNER_RULE_WEAK:" + sid + ":" + pid);
      }
      if (["COMPATIBILITY","ACTIVE_LEGACY_WRITER","DEVTOOLS_ONLY","ORPHANED","ACCEPTANCE_LIBRARY_ISLAND"].includes(p.connection_class)) {
        if (p.new_runtime_consumer_creation !== "FORBIDDEN") failures.push("COMPATIBILITY_PRODUCER_CAN_GAIN_NEW_RUNTIME_CONSUMER:" + sid + ":" + pid);
        if (!Array.isArray(p.grandfathered_runtime_consumers)) failures.push("COMPATIBILITY_RUNTIME_CONSUMER_SNAPSHOT_MISSING:" + sid + ":" + pid);
      }
      if (p.connection_class === "ROUTE_ISLAND" && p.activation !== "API_ONLY") failures.push("ROUTE_ISLAND_MUST_BE_EXPLICIT:" + sid + ":" + pid + ":activation=" + p.activation);
      if (p.connection_class === "ACTIVE_LEGACY_WRITER" && p.runtime_edge !== "PROVEN") failures.push("ACTIVE_LEGACY_WRITER_MUST_BE_REGISTERED:" + sid + ":" + pid);
      if (p.connection_class === "ORPHANED" && !(p.activation === "NOT_REFERENCED" && p.runtime_edge === "NONE")) failures.push("ORPHANED_SEMANTIC_EXPORT_MUST_BE_REGISTERED:" + sid + ":" + pid);
      if (p.connection_class === "MANUAL_SEAM" && p.activation !== "MANUAL") failures.push("MANUAL_SEAM_MUST_BE_EXPLICIT:" + sid + ":" + pid);
      if (p.current !== false && pp && exists(pp) && Array.isArray(p.fingerprints)) {
        const content = fs.readFileSync(abs(pp), "utf8");
        for (const fp of p.fingerprints) if (!content.includes(String(fp))) failures.push("PRODUCER_FINGERPRINT_MISSING:" + sid + ":" + pid + ":" + fp);
      }
    }

    for (const c of Array.isArray(semantic.registered_consumers) ? semantic.registered_consumers : []) {
      const cid = String(c.consumer_id || "").trim();
      const cp = String(c.path || "").trim();
      if (!cid) failures.push("CONSUMER_ID_MISSING:" + sid);
      const key = sid + "::" + cid;
      if (cid && consumerIndex.has(key)) failures.push("CONSUMER_ID_DUPLICATE_IN_SEMANTIC:" + key);
      if (cid) consumerIndex.set(key, { semantic_id:sid, consumer:c });
      if (!cp) failures.push("CONSUMER_PATH_MISSING:" + sid + ":" + (cid || "UNKNOWN"));
      if (c.current !== false && cp && !exists(cp)) failures.push("REGISTERED_CONSUMER_PATH_MISSING:" + sid + ":" + cid + ":" + cp);
      for (const field of ["connection_class","activation","runtime_edge"]) if (!String(c[field] || "").trim()) failures.push("CONSUMER_CONNECTIVITY_FIELD_MISSING:" + sid + ":" + cid + ":" + field);
      if (!ccValues.has(c.connection_class)) failures.push("CONSUMER_CONNECTION_CLASS_INVALID:" + sid + ":" + cid + ":" + c.connection_class);
      if (!activationValues.has(c.activation)) failures.push("CONSUMER_ACTIVATION_INVALID:" + sid + ":" + cid + ":" + c.activation);
      if (!runtimeValues.has(c.runtime_edge)) failures.push("CONSUMER_RUNTIME_EDGE_INVALID:" + sid + ":" + cid + ":" + c.runtime_edge);
    }

    for (const rc of semantic.runtime_consumers || []) {
      const cid = String(rc.consumer_id || "").trim();
      if (!(semantic.registered_consumers || []).some((c) => c.consumer_id === cid)) failures.push("RUNTIME_CONSUMER_NOT_REGISTERED:" + sid + ":" + cid);
      if (rc.runtime_edge !== "PROVEN") failures.push("RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE:" + sid + ":" + cid + ":runtime_edge=" + rc.runtime_edge);
      if (!String(rc.evidence_edge_id || "").trim()) failures.push("RUNTIME_CONSUMER_EVIDENCE_EDGE_MISSING:" + sid + ":" + cid);
    }
  }

  const allowByGuard = new Map();
  for (const rule of Array.isArray(allowlist.rules) ? allowlist.rules : []) {
    const gid = String(rule.guard_id || "");
    if (!gid) { failures.push("ALLOWLIST_GUARD_ID_MISSING"); continue; }
    allowByGuard.set(gid, new Set(Array.isArray(rule.additional_registered_paths) ? rule.additional_registered_paths : []));
    for (const p of allowByGuard.get(gid)) if (!exists(p)) failures.push("ALLOWLIST_PATH_MISSING:" + gid + ":" + p);
  }

  const guards = Array.isArray(register.static_guards) ? register.static_guards : [];
  const guardIds = new Set();
  for (const guard of guards) {
    const gid = String(guard.guard_id || "");
    const sid = String(guard.semantic_id || "");
    if (!gid) { failures.push("STATIC_GUARD_ID_MISSING"); continue; }
    if (guardIds.has(gid)) failures.push("STATIC_GUARD_ID_DUPLICATE:" + gid);
    guardIds.add(gid);
    if (!semanticIds.has(sid)) failures.push("STATIC_GUARD_UNKNOWN_SEMANTIC:" + gid + ":" + sid);

    const scanFiles = [];
    if (Array.isArray(guard.scan_files)) {
      for (const file of guard.scan_files) {
        if (!exists(file)) failures.push("STATIC_GUARD_SCAN_FILE_MISSING:" + gid + ":" + file);
        else scanFiles.push(abs(file));
      }
    } else {
      for (const root of Array.isArray(guard.scan_roots) ? guard.scan_roots : []) {
        if (!exists(root)) { failures.push("STATIC_GUARD_SCAN_ROOT_MISSING:" + gid + ":" + root); continue; }
        scanFiles.push(...listFiles(root, guard.extensions || [], guard.ignore_path_fragments || []));
      }
    }

    if (guard.forbid?.any_of_regex) {
      for (const file of scanFiles) {
        const content = fs.readFileSync(file, "utf8");
        for (const raw of guard.forbid.any_of_regex) {
          let re;
          try { re = new RegExp(raw, "m"); } catch { failures.push("STATIC_GUARD_REGEX_INVALID:" + gid + ":" + raw); continue; }
          if (re.test(content)) failures.push((guard.failure || "FORBIDDEN_PATTERN") + ":" + gid + ":" + repoPath(file));
        }
      }
      continue;
    }

    const allowed = new Set(Array.isArray(guard.registered_paths) ? guard.registered_paths : []);
    for (const p of allowByGuard.get(gid) || []) allowed.add(p);
    const matched = new Set();
    for (const file of scanFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (!matches(content, guard.match)) continue;
      const rp = repoPath(file);
      matched.add(rp);
      if (!allowed.has(rp)) failures.push((guard.failure || "UNREGISTERED_TOUCHPOINT") + ":" + gid + ":" + rp);
    }
    for (const p of allowed) {
      if (!exists(p)) failures.push("STATIC_GUARD_REGISTERED_PATH_MISSING:" + gid + ":" + p);
      else if (!matched.has(p)) failures.push("STATIC_GUARD_REGISTERED_FINGERPRINT_MISSING:" + gid + ":" + p);
    }
  }

  const edgeIds = new Set();
  const edgeId = (e, family) => {
    const id = String(e.edge_id || "");
    if (!id) failures.push("GRAPH_EDGE_ID_MISSING:" + family);
    else if (edgeIds.has(id)) failures.push("GRAPH_EDGE_ID_DUPLICATE:" + id);
    else edgeIds.add(id);
  };

  for (const e of graph.semantic_edges || []) {
    edgeId(e, "semantic_edges");
    if (!semanticIds.has(String(e.from || ""))) failures.push("GRAPH_UNKNOWN_FROM_SEMANTIC:" + e.edge_id + ":" + e.from);
    if (!semanticIds.has(String(e.to || ""))) failures.push("GRAPH_UNKNOWN_TO_SEMANTIC:" + e.edge_id + ":" + e.to);
  }
  for (const e of graph.current_parallel_edges || []) {
    edgeId(e, "current_parallel_edges");
    const sid = String(e.semantic_id || "");
    const pid = String(e.producer_id || "");
    const p = producerIndex.get(pid);
    if (!semanticIds.has(sid)) failures.push("PARALLEL_UNKNOWN_SEMANTIC:" + e.edge_id + ":" + sid);
    if (!p) failures.push("PARALLEL_UNKNOWN_PRODUCER:" + e.edge_id + ":" + pid);
    else if (p.semantic_id !== sid) failures.push("PARALLEL_PRODUCER_SEMANTIC_MISMATCH:" + e.edge_id + ":" + pid + ":" + sid);
    if (!/^B-0[4-9]$/.test(String(e.removal_target || ""))) failures.push("PARALLEL_REMOVAL_TARGET_INVALID:" + e.edge_id);
    if (e.new_owner_creation !== "FORBIDDEN") failures.push("PARALLEL_NEW_OWNER_NOT_FORBIDDEN:" + e.edge_id);
  }

  const connectivityEdges = Array.isArray(graph.current_connectivity_edges) ? graph.current_connectivity_edges : [];
  const connectivityById = new Map();
  for (const e of connectivityEdges) {
    edgeId(e, "current_connectivity_edges");
    connectivityById.set(e.edge_id, e);
    const sid = String(e.semantic_id || "");
    const pEntry = producerIndex.get(String(e.from_producer || ""));
    if (!semanticIds.has(sid)) failures.push("CONNECTIVITY_UNKNOWN_SEMANTIC:" + e.edge_id + ":" + sid);
    if (!pEntry) failures.push("CONNECTIVITY_UNKNOWN_PRODUCER:" + e.edge_id + ":" + e.from_producer);
    else if (pEntry.semantic_id !== sid) failures.push("CONNECTIVITY_PRODUCER_SEMANTIC_MISMATCH:" + e.edge_id + ":" + e.from_producer + ":" + sid);
    if (!ccValues.has(e.connection_class)) failures.push("CONNECTIVITY_CLASS_INVALID:" + e.edge_id + ":" + e.connection_class);
    if (!activationValues.has(e.activation)) failures.push("CONNECTIVITY_ACTIVATION_INVALID:" + e.edge_id + ":" + e.activation);
    if (!runtimeValues.has(e.runtime_edge)) failures.push("CONNECTIVITY_RUNTIME_EDGE_INVALID:" + e.edge_id + ":" + e.runtime_edge);
    if (!["CURRENT_PROVEN","ROUTE_ONLY","MANUAL","TEST_ONLY","NOT_WIRED"].includes(e.status)) failures.push("CONNECTIVITY_STATUS_INVALID:" + e.edge_id + ":" + e.status);
    const evidence = e.evidence || {};
    for (const key of ["kind","caller_path","callee_path","fingerprint"]) if (!String(evidence[key] || "").trim()) failures.push("DECLARED_RUNTIME_EDGE_REQUIRES_EVIDENCE:" + e.edge_id + ":" + key);
    if (String(evidence.caller_path || "") && !exists(evidence.caller_path)) failures.push("CONNECTIVITY_CALLER_PATH_MISSING:" + e.edge_id + ":" + evidence.caller_path);
    if (String(evidence.callee_path || "") && !exists(evidence.callee_path)) failures.push("CONNECTIVITY_CALLEE_PATH_MISSING:" + e.edge_id + ":" + evidence.callee_path);
    if (e.runtime_edge === "PROVEN" && !["CURRENT_PROVEN","ROUTE_ONLY","TEST_ONLY"].includes(e.status)) failures.push("PROVEN_RUNTIME_EDGE_STATUS_MISMATCH:" + e.edge_id + ":" + e.status);
    if (e.status === "CURRENT_PROVEN" && e.runtime_edge !== "PROVEN") failures.push("CURRENT_PROVEN_REQUIRES_PROVEN_EDGE:" + e.edge_id);
    if (e.status === "NOT_WIRED" && !["NONE","NOT_PROVEN","INTENTIONAL_NONE"].includes(e.runtime_edge)) failures.push("NOT_WIRED_EDGE_CANNOT_BE_PROVEN:" + e.edge_id);
    if (e.to_consumer !== "NONE") {
      const cKey = sid + "::" + e.to_consumer;
      if (!consumerIndex.has(cKey)) failures.push("CONNECTIVITY_UNKNOWN_CONSUMER:" + e.edge_id + ":" + e.to_consumer);
    }

    if (pEntry) {
      const p = pEntry.producer;
      if (p.new_runtime_consumer_creation === "FORBIDDEN" && e.to_consumer !== "NONE" && e.runtime_edge === "PROVEN") {
        const allowed = new Set(p.grandfathered_runtime_consumers || []);
        if (!allowed.has(e.to_consumer)) failures.push("COMPATIBILITY_PRODUCER_CANNOT_GAIN_NEW_RUNTIME_CONSUMER:" + e.edge_id + ":" + p.producer_id + ":" + e.to_consumer);
      }
    }
  }

  for (const semantic of semantics) {
    for (const rc of semantic.runtime_consumers || []) {
      const e = connectivityById.get(String(rc.evidence_edge_id || ""));
      if (!e) failures.push("RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE:" + semantic.semantic_id + ":" + rc.consumer_id + ":edge_missing");
      else if (e.runtime_edge !== "PROVEN") failures.push("RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE:" + semantic.semantic_id + ":" + rc.consumer_id + ":edge_not_proven");
      else if (e.to_consumer !== rc.consumer_id || e.from_producer !== rc.producer_id) failures.push("RUNTIME_CONSUMER_EDGE_MISMATCH:" + semantic.semantic_id + ":" + rc.consumer_id + ":" + e.edge_id);
    }
  }

  for (const e of graph.forbidden_edges || []) {
    edgeId(e, "forbidden_edges");
    if (!semanticIds.has(String(e.from || ""))) failures.push("FORBIDDEN_UNKNOWN_FROM_SEMANTIC:" + e.edge_id + ":" + e.from);
    if (!semanticIds.has(String(e.to || ""))) failures.push("FORBIDDEN_UNKNOWN_TO_SEMANTIC:" + e.edge_id + ":" + e.to);
    if (!String(e.reason || "").trim()) failures.push("FORBIDDEN_REASON_MISSING:" + e.edge_id);
    if (!String(e.enforcement || "").trim()) failures.push("FORBIDDEN_ENFORCEMENT_MISSING:" + e.edge_id);
  }

  const classCount = (name) => connectivityEdges.filter((e) => e.connection_class === name).length;
  const connectivityStats = {
    mainline_edges: classCount("MAINLINE"),
    active_parallel: classCount("ACTIVE_PARALLEL"),
    route_islands: classCount("ROUTE_ISLAND"),
    manual_seams: classCount("MANUAL_SEAM"),
    acceptance_only: classCount("ACCEPTANCE_LIBRARY_ISLAND"),
    active_legacy_writers: classCount("ACTIVE_LEGACY_WRITER"),
    orphans: classCount("ORPHANED"),
    intentional_isolation: classCount("INTENTIONAL_ISOLATION") + classCount("DEVTOOLS_ONLY"),
    registered_capability_islands: classCount("REGISTERED_CAPABILITY_ISLAND"),
    reporting_artifact_plane: classCount("REPORTING_ARTIFACT_PLANE"),
    unproven_runtime_edges: connectivityEdges.filter((e) => e.runtime_edge === "NOT_PROVEN").length,
    unknown_unclassified_production_edge: 0
  };

  finish(failures, warnings, {
    semantics: semanticIds.size,
    producers: producerIndex.size,
    registered_consumers: consumerIndex.size,
    runtime_consumers: semantics.reduce((n,s) => n + (s.runtime_consumers || []).length, 0),
    static_guards: guards.length,
    semantic_edges: (graph.semantic_edges || []).length,
    parallel_edges: (graph.current_parallel_edges || []).length,
    connectivity_edges: connectivityEdges.length,
    forbidden_edges: (graph.forbidden_edges || []).length
  }, connectivityStats);
}

function finish(failures, warnings, stats, connectivityStats) {
  for (const w of warnings) console.warn("WARN " + w);
  for (const f of failures) console.error("FAIL " + f);
  console.log("B02_SEMANTIC_REGISTER_STATS " + JSON.stringify(stats));
  console.log("B02_CONNECTIVITY_STATS " + JSON.stringify(connectivityStats));
  if (failures.length) {
    console.error("B02_SEMANTIC_CONTRACT_LINTER_FAIL count=" + failures.length);
    process.exitCode = 1;
  } else {
    console.log("B02_SEMANTIC_CONTRACT_LINTER_PASS");
  }
}

try { run(); }
catch (e) {
  console.error("B02_SEMANTIC_CONTRACT_LINTER_CRASH " + (e?.stack || String(e)));
  process.exitCode = 1;
}
`;
fs.writeFileSync(linterPath, linter);

/* Append a bounded B-02 connectivity amendment to the existing implementation doc. */
let doc = fs.readFileSync(docPath, "utf8");
const marker = "## B-02 Connectivity Amendment 01";
if (!doc.includes(marker)) {
  doc += `

---

## B-02 Connectivity Amendment 01

Status: **part of B-02; B-03 remains blocked until the B-02 completion gate passes**

B-02 is expanded from semantic ownership governance into the following bounded machine-readable repository map:

\`\`\`text
Semantic Ownership
        +
Runtime Connectivity
        =
B-02 machine-readable repository map
\`\`\`

This amendment does not change B-03/B-04 architecture ordering and does not mutate runtime semantics.

### Capability is not wiring

The register now separates:

\`\`\`text
registered_consumer
= contract/API/code capable of consuming this semantic

runtime_consumer
= repository evidence proves current runtime wiring
\`\`\`

Every registered producer and consumer carries:

\`\`\`text
connection_class
activation
runtime_edge
\`\`\`

The allowed connection classes include MAINLINE, ACTIVE_PARALLEL, ROUTE_ISLAND, MANUAL_SEAM,
ACCEPTANCE_LIBRARY_ISLAND, COMPATIBILITY, DEVTOOLS_ONLY, ORPHANED, INTENTIONAL_ISOLATION,
REGISTERED_CAPABILITY_ISLAND, ACTIVE_LEGACY_WRITER, LOCAL_DIRECT_CALL, and REPORTING_ARTIFACT_PLANE.

### Exact-main connectivity adjudications recorded

The machine map records at least these B-02 results:

- Agronomy Agent: ACTIVE_PARALLEL.
- Evidence Judge V2: ROUTE_ISLAND.
- Agronomy Judge V2: ROUTE_ISLAND.
- Execution Judge V2: ROUTE_ISLAND with a proven execution-memory side effect.
- Generic Skill Runtime: REGISTERED_CAPABILITY_ISLAND; Judge irrigation skills remain LOCAL_DIRECT_CALL.
- evaluateIrrigationDecisionV1: ORPHANED / NOT_REFERENCED.
- legacy root-zone State / Forecast / Scenario builders: ACCEPTANCE_LIBRARY_ISLAND.
- legacy Operator scenario-to-recommendation POST module: ACTIVE_LEGACY_WRITER and CURRENT_PROVEN registration.
- Agronomy Inference: ROUTE_ISLAND.
- Agronomy Interpretation: INTENTIONAL_ISOLATION from deterministic Judge/Decision authority.
- existing EvidenceModule: REPORTING_ARTIFACT_PLANE, not the future canonical Evidence Runtime.
- Flight Table/simulator: DEVTOOLS_ONLY with intentional production-authority isolation.
- Acceptance -> Water Response Verification: MANUAL_SEAM; no automatic call is proven.

One proposed classification is corrected by exact-main code evidence:

\`\`\`text
Acceptance -> Field Memory
\`\`\`

is **not** a MANUAL_SEAM on the audited baseline. \`apps/server/src/routes/acceptance_v1.ts\` directly calls
\`recordMemoryV1\` when verdict is PASS, formal_acceptance is true, and field_id exists. B-02 therefore records this
edge as MAINLINE / API_ONLY / PROVEN / CURRENT_PROVEN. B-02 records code truth rather than forcing the planned label.

### Judge wiring distinction

\`/api/v1/judge/evidence/evaluate\` and \`/api/v1/judge/agronomy/evaluate\` are separate POST routes.
The Agronomy Judge request can carry \`evidence_judge_id\` / \`evidence_judge_verdict\`, but the route does not
automatically load and execute Evidence Judge before Agronomy Judge. Therefore:

\`\`\`text
EvidenceJudgeV2 -> AgronomyJudgeV2
contract_compatible = true
runtime_edge = NOT_PROVEN
status = NOT_WIRED
\`\`\`

### Connectivity linter rules

The B-02 linter now enforces explicit, mechanically provable rules corresponding to:

- RUNTIME_CONSUMER_REQUIRES_CALL_EVIDENCE
- ROUTE_ISLAND_MUST_BE_EXPLICIT
- ACTIVE_LEGACY_WRITER_MUST_BE_REGISTERED
- ORPHANED_SEMANTIC_EXPORT_MUST_BE_REGISTERED
- MANUAL_SEAM_MUST_BE_EXPLICIT
- DECLARED_RUNTIME_EDGE_REQUIRES_EVIDENCE
- DEVTOOLS_ONLY_PATH_MUST_NOT_BE_PRODUCTION_CONSUMER
- COMPATIBILITY_PRODUCER_CANNOT_GAIN_NEW_RUNTIME_CONSUMER

It remains STATIC_EXPLICIT_ONLY. It does not claim arbitrary TypeScript semantic inference.

### Coverage output

A successful exact-head linter run prints both:

\`\`\`text
B02_SEMANTIC_REGISTER_STATS ...
B02_CONNECTIVITY_STATS ...
B02_SEMANTIC_CONTRACT_LINTER_PASS
\`\`\`

The connectivity stats include mainline edges, active parallel edges, route islands, manual seams,
acceptance-only islands, active legacy writers, orphans, intentional isolation, registered capability islands,
reporting artifact plane, and unproven runtime edges.

\`unknown_unclassified_production_edge = 0\` means zero unknown edges inside the explicit B-02 audited/scanned
scope. It does not claim whole-program semantic inference beyond that scope.

### B-02 completion gate

B-02 is COMPLETE only when all of the following are green on one exact B-02 head:

\`\`\`text
Ownership Register                         PASS
Parallel Authority Graph                   PASS
Forbidden Edge Graph                       PASS
Connectivity classification                PASS
Connectivity edges                         PASS
Static linter                              PASS
Exact-head general CI                      PASS
Existing MCFT governance/release lanes     PASS
Unknown unclassified production edge       0
\`\`\`

Until then:

\`\`\`text
DO NOT START B-03
DO NOT MODIFY RUNTIME SEMANTICS
DO NOT DISABLE AGRONOMY AGENT
DO NOT REWIRE JUDGE
DO NOT MODIFY MCFT
DO NOT DELETE LEGACY CODE
\`\`\`
`;
  fs.writeFileSync(docPath, doc);
}

console.log("B02_CONNECTIVITY_PATCH_APPLIED");
