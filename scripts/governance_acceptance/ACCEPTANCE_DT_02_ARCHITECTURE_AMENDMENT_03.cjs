#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = process.env.DT02_AMENDMENT03_BASE_SHA;
const EXPECTED_BASE = "35b06a92165acc5a6598ccfefc76e4467d93da04";
const amendmentPath = "docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-03-BIOLOGICAL-STAGE-AUTHORITY.md";
const registerPath = "docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_03.cjs";
const workflowPath = ".github/workflows/dt-02-architecture-amendment-03-biological-stage-authority.yml";
const expected = [amendmentPath, registerPath, gatePath, workflowPath].sort();

function fail(code, detail) { throw new Error(detail ? code + ":" + detail : code); }
function eq(actual, expectedValue, code) {
  if (actual !== expectedValue) fail(code, "expected=" + JSON.stringify(expectedValue) + " actual=" + JSON.stringify(actual));
}
function has(text, marker, code) { if (!text.includes(marker)) fail(code, marker); }
function git() {
  const args = Array.from(arguments);
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

eq(BASE, EXPECTED_BASE, "DT02_AMENDMENT03_EXACT_BASE_REQUIRED");
eq(git("merge-base", EXPECTED_BASE, "HEAD"), EXPECTED_BASE, "DT02_AMENDMENT03_BASE_NOT_ANCESTOR");

const changed = git("diff", "--name-only", EXPECTED_BASE + "...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expected), "DT02_AMENDMENT03_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

const amendment = fs.readFileSync(amendmentPath, "utf8");
for (const marker of [
  "BiologicalStageAuthorityV1",
  "DIRECT_OBSERVED_PHENOLOGY",
  "THERMAL_MODEL_DERIVED",
  "CALENDAR_MODEL_DERIVED",
  "REMOTE_SENSING_DERIVED",
  "FUSED_DERIVED",
  "UNRESOLVED",
  "observed_biological_stage_claimed",
  "Stage Authority Resolver",
  "Biological Development Stage",
  "Crop Water-Use Stage",
  "A singleton water-use stage is required",
  "KBS, or any other provider, is not a universal truth monopoly",
  "relative-maturity days -> GDU conversion without an explicit qualified mapping",
  "Thermal accumulation, calendar age, remote sensing, or a phenology model may answer A",
  "They must not by themselves answer B"
]) has(amendment, marker, "DT02_AMENDMENT03_REQUIRED_RULE_MISSING");

const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const amendmentEntry = register.amendments.find(function (x) { return x.id === "DT02-AMENDMENT-03"; });
if (!amendmentEntry) fail("DT02_AMENDMENT03_REGISTER_ENTRY_MISSING");
eq(amendmentEntry.status, "CANDIDATE_NOT_EFFECTIVE", "DT02_AMENDMENT03_REGISTER_STATUS_DRIFT");
eq(amendmentEntry.path, amendmentPath, "DT02_AMENDMENT03_REGISTER_PATH_DRIFT");
eq(JSON.stringify(amendmentEntry.supersedes), JSON.stringify([]), "DT02_AMENDMENT03_MUST_NOT_RETROACTIVELY_SUPERSEDE");

const adr = register.decisions.find(function (x) { return x.id === "DT02-ADR-017"; });
if (!adr) fail("DT02_ADR017_MISSING");
eq(adr.status, "CANDIDATE_NOT_EFFECTIVE", "DT02_ADR017_STATUS_DRIFT");
if (!adr.amendment_refs.includes("DT02-AMENDMENT-03")) fail("DT02_ADR017_AMENDMENT_REF_MISSING");
for (const invariant of [
  "direct observation and derived stage remain epistemically distinct",
  "lifecycle authority is independent from biological stage authority",
  "derived stage uncertainty must collapse to one stage before production authority",
  "stage-specific Kc requires one uniquely mapped crop-water-use stage",
  "future observations cannot create real-time stage authority"
]) {
  if (!adr.invariants.includes(invariant)) fail("DT02_ADR017_INVARIANT_MISSING", invariant);
}

const workflow = fs.readFileSync(workflowPath, "utf8");
for (const forbidden of ["schedule:", "workflow_dispatch:", "pull_request_target", "FORMAL_DATABASE_URL", "GEOX_MCFT_CAP09_S6_DATABASE_URL"]) {
  if (workflow.includes(forbidden)) fail("DT02_AMENDMENT03_WORKFLOW_FORBIDDEN_CAPABILITY", forbidden);
}

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_dt02_architecture_amendment03_biological_stage_authority_governance_result_v1",
  status: "PASS",
  exact_base_sha: EXPECTED_BASE,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  architecture_contract: "BiologicalStageAuthorityV1",
  observed_vs_derived_separation: true,
  lifecycle_independent: true,
  source_plurality_with_exact_qualification: true,
  singleton_uncertainty_collapse_required: true,
  runtime_implementation_created: false,
  runtime_start_authorized: false,
  formal_v5_authorized: false,
  a0_o00_authorized: false
};
fs.writeFileSync(
  "acceptance-output/DT02_ARCHITECTURE_AMENDMENT03_BIOLOGICAL_STAGE_AUTHORITY_RESULT.json",
  JSON.stringify(result, null, 2) + "\n"
);
console.log(JSON.stringify(result, null, 2));
