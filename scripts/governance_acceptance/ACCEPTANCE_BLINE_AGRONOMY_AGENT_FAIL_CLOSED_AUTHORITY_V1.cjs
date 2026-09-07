#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const COMMERCIAL_COMPOSE = "docker-compose.commercial_v1.yml";
const JOBS_RUNTIME = "apps/server/dist/jobs/runtime.js";

const agent = fs.readFileSync("apps/server/src/jobs/agronomy_agent.ts", "utf8");
const jobs = fs.readFileSync("apps/server/src/jobs/runtime.ts", "utf8");
const activeGate = fs.readFileSync("scripts/governance_acceptance/ACCEPTANCE_BLINE_ACTIVE_RUNTIME_SURFACE_CLOSURE_V1.cjs", "utf8");
const registry = JSON.parse(fs.readFileSync("docs/architecture/semantic_convergence/GEOX-BLINE-ACTIVE-RUNTIME-SURFACE-DISPOSITION-V1.json", "utf8"));

const failures = [];
const need=(src,tokens,label)=>tokens.forEach(t=>{if(!src.includes(t)) failures.push(label+"_MISSING:"+t)});
const forbid=(src,tokens,label)=>tokens.forEach(t=>{if(src.includes(t)) failures.push(label+"_FORBIDDEN:"+t)});

// Historical direct-command representation remains admissible only as the exact
// bounded jobs runtime command with no explicit entrypoint/profile indirection.
function proveHistoricalDirectJobsRuntime(config) {
  const jobsService = config?.services?.jobs;
  if (!jobsService) return false;
  if (jobsService.profiles?.length) return false;
  if (jobsService.entrypoint != null) return false;
  return Array.isArray(jobsService.command) &&
    jobsService.command.length === 2 &&
    jobsService.command[0] === "node" &&
    jobsService.command[1] === JOBS_RUNTIME;
}

// Successor representation intentionally mirrors the fail-closed semantics of
// Active Runtime proveJobsRuntime(): only the governed credential bootstrap
// shell followed immediately by exec of the jobs runtime is admissible.
function proveSuccessorShellJobsRuntime(config) {
  const jobsService = config?.services?.jobs;
  if (!jobsService) return false;
  if (jobsService.profiles?.length) return false;
  if (!Array.isArray(jobsService.entrypoint) || !Array.isArray(jobsService.command)) return false;
  if (JSON.stringify(jobsService.entrypoint) !== JSON.stringify(["/bin/sh", "-ceu"])) return false;
  if (jobsService.command.length !== 1 || typeof jobsService.command[0] !== "string") return false;
  const statements = jobsService.command[0].trim().split(/\r?\n/).map(x => x.trim());
  if (statements.length !== 2) return false;
  // Compose preserves $$ in its JSON model; Docker consumes it as a literal $.
  const credentialExport = /^export DATABASE_URL="postgres:\/\/geox_jobs_v1:\${1,2}\(cat \/run\/geox\/jobs\/db_password\)@postgres:5432\/[A-Za-z0-9_-]+"$/;
  return credentialExport.test(statements[0]) &&
    statements[1] === "exec node " + JOBS_RUNTIME;
}

function proveEffectiveJobsRuntime(config) {
  const jobsService = config?.services?.jobs;
  if (!jobsService) return false;
  if (String(jobsService.environment?.AGRONOMY_AGENT_ENABLED) !== "1") return false;
  return proveHistoricalDirectJobsRuntime(config) || proveSuccessorShellJobsRuntime(config);
}

function jobsRuntimeRepresentationSelftest() {
  const direct = {
    command: ["node", JOBS_RUNTIME],
    environment: { AGRONOMY_AGENT_ENABLED: "1" }
  };
  const successorCommand = 'export DATABASE_URL="postgres://geox_jobs_v1:$(cat /run/geox/jobs/db_password)@postgres:5432/landos"\nexec node ' + JOBS_RUNTIME;
  const successor = {
    entrypoint: ["/bin/sh", "-ceu"],
    command: [successorCommand],
    environment: { AGRONOMY_AGENT_ENABLED: "1" }
  };
  const cases = [
    ["historical-direct", { services: { jobs: direct } }, true],
    ["successor-shell", { services: { jobs: successor } }, true],
    ["jobs-absent", { services: {} }, false],
    ["wrong-module-direct", { services: { jobs: { ...direct, command: ["node", "apps/server/dist/jobs/other.js"] } } }, false],
    ["wrong-module-shell", { services: { jobs: { ...successor, command: [successorCommand.replace("jobs/runtime.js", "jobs/other.js")] } } }, false],
    ["command-absent", { services: { jobs: { entrypoint: successor.entrypoint, environment: successor.environment } } }, false],
    ["comment-only", { services: { jobs: { ...successor, command: ["# exec node " + JOBS_RUNTIME] } } }, false],
    ["other-service-only", { services: { other: successor } }, false],
    ["wrong-entrypoint", { services: { jobs: { ...successor, entrypoint: ["echo"] } } }, false],
    ["inactive-profile", { services: { jobs: { ...successor, profiles: ["inactive"] } } }, false],
    ["unreachable-runtime-tail", { services: { jobs: { ...successor, command: [successorCommand.replace("\nexec", "; exit 0\nexec")] } } }, false],
    ["missing-credential-bootstrap", { services: { jobs: { ...successor, command: ["exec node " + JOBS_RUNTIME] } } }, false],
    ["agronomy-disabled", { services: { jobs: { ...successor, environment: { AGRONOMY_AGENT_ENABLED: "0" } } } }, false],
    ["direct-with-shell-entrypoint", { services: { jobs: { ...direct, entrypoint: ["/bin/sh", "-ceu"] } } }, false]
  ];
  for (const [name, config, expected] of cases) {
    if (proveEffectiveJobsRuntime(config) !== expected) {
      failures.push("JOBS_RUNTIME_REPRESENTATION_SELFTEST_FAILED:" + name);
    }
  }
}

function renderedCommercialCompose() {
  // Structural qualification only: docker compose config renders the effective
  // service model without creating services or reading runtime credential files.
  const env = { ...process.env,
    POSTGRES_USER: "landos", POSTGRES_PASSWORD: "structure-only", POSTGRES_DB: "landos",
    GEOX_MCFT_MIGRATOR_PASSWORD: "structure-only", GEOX_RUNTIME_DATABASE_PASSWORD: "structure-only",
    GEOX_DEPLOYMENT_SUBJECT_COMMIT: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    GEOX_EXECUTOR_TOKEN: "structure-only", MINIO_ROOT_USER: "structure-only", MINIO_ROOT_PASSWORD: "structure-only",
    CORS_ORIGINS: "https://structure.geox.invalid", APP_SECRET: "structure-only", PUBLIC_BASE_URL: "https://structure.geox.invalid"
  };
  return JSON.parse(cp.execFileSync("docker", ["compose", "--env-file", ".env.commercial_v1.example", "-f", COMMERCIAL_COMPOSE, "config", "--format", "json"], {
    env, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024
  }));
}

jobsRuntimeRepresentationSelftest();
let effectiveCompose = null;
try {
  effectiveCompose = renderedCommercialCompose();
} catch (error) {
  failures.push("COMPOSE_EFFECTIVE_CONFIG_UNAVAILABLE:" + String(error?.message || error));
}
if (effectiveCompose && !proveEffectiveJobsRuntime(effectiveCompose)) {
  failures.push("COMPOSE_JOBS_EFFECTIVE_RUNTIME_UNPROVEN");
}

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

need(jobs,[
  'import { runAgronomyAgentOnce } from "./agronomy_agent.js";',
  'if (process.env.AGRONOMY_AGENT_ENABLED === "1")',
  "await runAgronomyAgentOnce(pool)"
],"JOBS");
need(activeGate,[
  "BACKGROUND_RUNTIME_ROOTS",
  "proveJobsRuntime",
  "jobsRuntimeSelftest",
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
  background_runtime_registered:Boolean(jobsRow&&agentRow),
  effective_jobs_runtime_proven:Boolean(effectiveCompose&&proveEffectiveJobsRuntime(effectiveCompose))
}));
for(const f of failures) console.error("FAIL "+f);
if(failures.length) process.exit(1);
console.log("BLINE_AGRONOMY_AGENT_FAIL_CLOSED_PASS");
