#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const agent = fs.readFileSync("apps/server/src/jobs/agronomy_agent.ts", "utf8");
const jobs = fs.readFileSync("apps/server/src/jobs/runtime.ts", "utf8");
const compose = fs.readFileSync("docker-compose.commercial_v1.yml", "utf8");
const activeGate = fs.readFileSync("scripts/governance_acceptance/ACCEPTANCE_BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_V1.cjs", "utf8");
const registry = JSON.parse(fs.readFileSync("docs/architecture/semantic_convergence/GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1.json", "utf8"));

const failures = [];
const need=(src,tokens,label)=>tokens.forEach(t=>{if(!src.includes(t)) failures.push(label+"_MISSING:"+t)});
const forbid=(src,tokens,label)=>tokens.forEach(t=>{if(src.includes(t)) failures.push(label+"_FORBIDDEN:"+t)});

forbid(agent,[
  "DEFAULT_SOIL_MOISTURE",
  'type: "decision_recommendation_v1"',
  "createOperationPlanFromRecommendation",
  'type: "operation_plan_v1"',
  'type: "operation_plan_transition_v1"',
  "agronomy_agent_auto_create",
  'evidence_refs: ["telemetry:soil_moisture"]'
],"AGENT");

need(agent,[
  "fact_id AS telemetry_fact_id",
  "s.telemetry_fact_id",
  "telemetry_fact_id: safeString(row.telemetry_fact_id) || null",
  "const telemetryFactId = safeString(telemetry?.telemetry_fact_id)",
  "if (!Number.isFinite(soilMoisture ?? Number.NaN) || !telemetryFactId)",
  "skippedByReason.no_telemetry += 1",
  "continue;",
  'type: "recommendation_v1"',
  'authority_mode: "LEGACY_AGRONOMY_SIGNAL_ONLY"',
  "human_approval_required: true",
  "no_direct_execution: true",
  "approval_created: false",
  "operation_plan_created: false",
  "task_created: false",
  "dispatch_created: false",
  "evidence_refs: [telemetryFactId]",
  "fact_id: telemetryFactId"
],"AGENT");

need(compose,[
  "jobs:",
  'command: ["node", "apps/server/dist/jobs/runtime.js"]',
  'AGRONOMY_AGENT_ENABLED: "1"'
],"COMPOSE");
need(jobs,[
  'import { runAgronomyAgentOnce } from "./agronomy_agent.js";',
  'if (process.env.AGRONOMY_AGENT_ENABLED === "1")',
  "await runAgronomyAgentOnce(pool)"
],"JOBS");
need(activeGate,[
  "BACKGROUND_RUNTIME_ROOTS",
  "registerBackgroundRuntimeGraph",
  "BACKGROUND_AGRONOMY_AGENT_NOT_COMMERCIAL_ACTIVE",
  "addParent(BACKGROUND_RUNTIME_ROOTS[0], COMMERCIAL_COMPOSE)",
  "addParent(AGRONOMY_AGENT, BACKGROUND_RUNTIME_ROOTS[0])"
],"ACTIVE_GATE");

const jobsRow = registry.surfaces.find(x=>x.source_path==="apps/server/src/jobs/runtime.ts");
const agentRow = registry.surfaces.find(x=>x.source_path==="apps/server/src/jobs/agronomy_agent.ts");
if(!jobsRow) failures.push("ACTIVE_REGISTRY_JOBS_RUNTIME_MISSING");
if(!agentRow) failures.push("ACTIVE_REGISTRY_AGRONOMY_AGENT_MISSING");
if(jobsRow && !jobsRow.activation_parent?.includes("docker-compose.commercial_v1.yml")) failures.push("ACTIVE_REGISTRY_JOBS_PARENT_INVALID");
if(agentRow && !agentRow.activation_parent?.includes("apps/server/src/jobs/runtime.ts")) failures.push("ACTIVE_REGISTRY_AGENT_PARENT_INVALID");
if(agentRow && agentRow.surface_role!=="DERIVER") failures.push("ACTIVE_REGISTRY_AGENT_ROLE_INVALID");
if(!Array.isArray(registry.background_runtime_roots) || !registry.background_runtime_roots.includes("apps/server/src/jobs/runtime.ts")) failures.push("BACKGROUND_RUNTIME_ROOT_REGISTRY_MISSING");

const missingBlockStart = agent.indexOf("const telemetryFactId = safeString(telemetry?.telemetry_fact_id)");
const missingBlockEnd = agent.indexOf("if (!selectedProgramItem.program_id)", missingBlockStart);
const missingBlock = missingBlockStart >= 0 ? agent.slice(missingBlockStart, missingBlockEnd) : "";
if(!missingBlock.includes("continue;")) failures.push("MISSING_TELEMETRY_MUST_CONTINUE");
if(missingBlock.includes("insertFact(")) failures.push("MISSING_TELEMETRY_WRITE_FORBIDDEN");

console.log("BLINE_AGRONOMY_AGENT_FAIL_CLOSED_STATS "+JSON.stringify({
  failures:failures.length,
  fabricated_default_absent:!agent.includes("DEFAULT_SOIL_MOISTURE"),
  exact_telemetry_fact_bound:agent.includes("evidence_refs: [telemetryFactId]"),
  decision_writer_absent:!agent.includes('type: "decision_recommendation_v1"'),
  direct_plan_writer_absent:!agent.includes("createOperationPlanFromRecommendation"),
  background_runtime_registered:Boolean(jobsRow&&agentRow)
}));
for(const f of failures) console.error("FAIL "+f);
if(failures.length) process.exit(1);
console.log("BLINE_AGRONOMY_AGENT_FAIL_CLOSED_PASS");
