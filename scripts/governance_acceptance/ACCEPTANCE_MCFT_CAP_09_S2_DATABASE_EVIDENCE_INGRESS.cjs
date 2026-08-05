#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const OUTPUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_RESULT.json",
);
const BASE = "b3f095be7f808611f1388c3e31ecff29325a7f99";
const S1_SUBJECT = "843ed078d6d384e43e2c6bd2568d789dcd508934";
const S1_RUN = 31007579256;
const S1_ARTIFACT = 8930987741;
const S1_DIGEST = "sha256:0f67da5732f43a427d2518e320a617f3ad3872c6c34065060e432d92128404ef";
const REGISTRY_MERGE = "508da08b2c5855e6391bc87e0d56042fc9232a97";
const STATUS = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json";
const WORKFLOW = ".github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml";
const SOURCE = "apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json";
const BOUNDARY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json";
const CANDIDATE = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json";
const HARD = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json";
const PREDECESSOR = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json";
const VALIDATOR = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs";
const RUNTIME = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts";
const REGISTRY = "docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json";
const SIGNAL = "docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json";
const REGISTRY_WORKFLOW = ".github/workflows/mcft-cap-09-s2-registry-registration.yml";
const CLASSIFIER = "scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs";
const CROSS_REPAIR = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs";

const FILES = [
  WORKFLOW,
  SOURCE,
  BOUNDARY,
  CANDIDATE,
  CONFIG,
  STATUS,
  HARD,
  PREDECESSOR,
  VALIDATOR,
  RUNTIME,
].sort();
const SNAPSHOT_FILES = FILES.filter((file) => file !== WORKFLOW).sort();
const FROZEN_BLOBS = {
  [REGISTRY]: "d368a0d5a3b6189dd84ecb75a6643719cd37844e",
  [SIGNAL]: "479f258e58482f3596ef3f1b88e27ef109b99d4b",
  [REGISTRY_WORKFLOW]: "10344f53995ef8855e8605dca80af0906b64f2ae",
  [CLASSIFIER]: "8f0ad3b765f4c3d0233790bebbc9a7438d346549",
  [CROSS_REPAIR]: "586a3361beb3b6aee29d93a61f9df66791eef546",
};

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const read = (file) => fs.readFileSync(file, "utf8");
const json = (file) => JSON.parse(read(file));
const ok = (value, code) => {
  if (!value) throw new Error(code);
};
const equal = (left, right, code) => {
  try {
    assert.deepEqual(left, right);
  } catch {
    throw new Error(code);
  }
};
function writeOutput(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function findArtifact(name) {
  const roots = [
    path.resolve(process.env.MCFT_CAP09_S1_EFFECTIVE_ARTIFACT_DIR || "acceptance-input/cap09-s1-effective"),
  ];
  while (roots.length) {
    const directory = roots.pop();
    if (!directory || !fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) roots.push(full);
      else if (entry.name === name) return full;
    }
  }
  throw new Error(`ARTIFACT_MISSING:${name}`);
}
function parseDeclaration(body) {
  const marker = ["MCFT", "CANDIDATE", "DECLARATION", "V2"].join("_");
  const opening = `<!-- ${marker}\n`;
  const source = String(body || "");
  const start = source.indexOf(opening);
  ok(start >= 0 && source.indexOf(opening, start + opening.length) < 0, "DECLARATION_CARDINALITY");
  const end = source.indexOf("-->", start);
  ok(end > start, "DECLARATION_END");
  const result = {};
  for (const raw of source.slice(start + opening.length, end).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const split = line.indexOf("=");
    ok(split > 0, "DECLARATION_LINE");
    result[line.slice(0, split)] = line.slice(split + 1);
  }
  return result;
}
async function api(relativeUrl) {
  ok(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, "GITHUB_ENV_REQUIRED");
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${relativeUrl}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "geox-cap09-s2-r3",
    },
  });
  const text = await response.text();
  ok(response.ok, `GITHUB_API_${response.status}:${text}`);
  return JSON.parse(text);
}
function authorityFalse(value, prefix) {
  for (const key of [
    "implementation_authorized",
    "runtime_source_authorized",
    "live_ingestion_authorized",
    "background_scheduler_authorized",
    "canonical_write_authorized",
    "public_http_writer_authorized",
    "model_activation_authorized",
    "controlled_action_authorized",
  ]) {
    ok(value[key] === false, `${prefix}:${key}`);
  }
}

(async () => {
  try {
    const base = process.env.MCFT_BASE_SHA;
    const head = git("rev-parse", "HEAD");
    ok(base === BASE, "EXACT_BASE_REQUIRED");
    ok(git("rev-list", "--count", `${base}..HEAD`) === "1", "ONE_COMMIT_REQUIRED");
    const changed = git("diff", "--name-only", `${base}...HEAD`)
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();
    equal(changed, FILES, "EXACT_TEN_FILE_BOUNDARY_REQUIRED");

    const declarationMarker = ["MCFT", "CANDIDATE", "DECLARATION", "V2"].join("_");
    for (const file of FILES) ok(!read(file).includes(declarationMarker), `DECLARATION_IN_REPOSITORY:${file}`);
    for (const [file, blob] of Object.entries(FROZEN_BLOBS)) {
      ok(git("rev-parse", `HEAD:${file}`) === blob, `FROZEN_AUTHORITY_DRIFT:${file}`);
    }

    const oldStatus = JSON.parse(git("show", `${base}:${STATUS}`));
    const status = json(STATUS);
    ok(oldStatus.s2_candidate_implemented === false, "BASE_CANDIDATE_SIGNAL_MUST_BE_FALSE");
    ok(status.s2_candidate_implemented === true, "CANDIDATE_SIGNAL_MUST_TRANSITION_TRUE");
    ok(status.candidate_declaration_present === true, "CANDIDATE_DECLARATION_STATUS_REQUIRED");
    ok(status.externally_effective === false, "CANDIDATE_MUST_NOT_SELF_EFFECT");
    ok(status.established_replay_evidence_envelope_bound === true, "REPLAY_ENVELOPE_BINDING_REQUIRED");
    ok(status.real_postgresql_acceptance_present === true, "REAL_POSTGRESQL_ACCEPTANCE_REQUIRED");
    ok(status.shared_window_semantics_preserved === true, "SHARED_WINDOW_SEMANTICS_REQUIRED");
    ok(status.conflicting_duplicate_rejected === true, "CONFLICTING_DUPLICATE_REJECTION_REQUIRED");
    ok(status.operational_unbound_observations_not_consumed === true, "UNBOUND_OPERATIONAL_NON_CONSUMPTION_REQUIRED");
    authorityFalse(status, "STATUS_AUTHORITY");
    ok(status.candidate_base_main_sha === BASE, "STATUS_BASE");
    ok(status.s2_registry_registration_merge_sha === REGISTRY_MERGE, "STATUS_REGISTRY_CHAIN");
    ok(status.s2_candidate_routing_repair_merge_sha === BASE, "STATUS_ROUTING_CHAIN");

    const registry = json(REGISTRY);
    const entry = registry.capabilities.find((item) => item.capability_line === "MCFT-CAP-09");
    ok(entry, "CAP09_REGISTRY_ENTRY_REQUIRED");
    const rules = entry.candidate_transition_fields.filter(
      (item) => item.status_file === STATUS
        && item.field_path === "s2_candidate_implemented",
    );
    ok(rules.length === 1, "S2_REGISTRY_RULE_CARDINALITY");
    ok(rules[0].allowed_candidate_values.length === 1 && rules[0].allowed_candidate_values[0] === true, "S2_REGISTRY_VALUE");
    ok(rules[0].focused_workflow === "mcft-cap-09-s2-database-evidence-ingress", "S2_REGISTRY_WORKFLOW");

    const attestation = JSON.parse(fs.readFileSync(
      findArtifact("MCFT_CAP_09_S1_EXACT_SHA_ATTESTATION.json"),
      "utf8",
    ));
    const locator = JSON.parse(fs.readFileSync(
      findArtifact("MCFT_CAP_09_S1_ATTESTATION_RETENTION_LOCATOR.json"),
      "utf8",
    ));
    ok(attestation.status === "PASS", "S1_ATTESTATION_PASS_REQUIRED");
    ok(attestation.subject_sha === S1_SUBJECT, "S1_SUBJECT");
    ok(attestation.semantic_artifact_digest === S1_DIGEST, "S1_SEMANTIC_DIGEST");
    ok(attestation.effective_authority.s2_registry_registration_authorized === true, "S2_REGISTRATION_AUTHORITY");
    ok(
      attestation.effective_authority.s2_authorized_scope === "DATABASE_EVIDENCE_INGRESS_AND_BOUNDARY_FREEZE_ONLY",
      "S2_SCOPE_AUTHORITY",
    );
    ok(locator.retention_level === "R2", "S1_RETENTION_R2");
    ok(locator.readback_verified === true, "S1_R2_READBACK");
    ok(locator.locked_version_delete_denied === true, "S1_R2_LOCKED_DELETE_DENIAL");

    const candidate = json(CANDIDATE);
    const boundary = json(BOUNDARY);
    const config = json(CONFIG);
    const hard = json(HARD);
    const predecessor = json(PREDECESSOR);
    ok(candidate.base_main_sha === BASE, "CANDIDATE_BASE");
    ok(candidate.s1_effective_subject_sha === S1_SUBJECT, "CANDIDATE_S1_SUBJECT");
    ok(candidate.s2_registry_registration_merge_sha === REGISTRY_MERGE, "CANDIDATE_REGISTRY_CHAIN");
    ok(candidate.s2_candidate_routing_repair_merge_sha === BASE, "CANDIDATE_ROUTING_CHAIN");
    ok(candidate.candidate_transition_performed === true && candidate.external_effectiveness === false, "CANDIDATE_STATE");
    ok(candidate.database_evidence_contract === "ESTABLISHED_CANONICAL_REPLAY_EVIDENCE_ENVELOPE", "CANDIDATE_EVIDENCE_CONTRACT");
    ok(candidate.database_acceptance.includes("REAL_POSTGRESQL_16"), "CANDIDATE_DATABASE_ACCEPTANCE");
    ok(boundary.base_main_sha === BASE && boundary.changed_file_count === 10, "BOUNDARY_METADATA");
    equal(boundary.changed_files.sort(), FILES, "BOUNDARY_FILES");
    ok(boundary.ports_contract_delta === 0 && boundary.migration_delta === 0, "BOUNDARY_FROZEN_CORE");
    ok(config.envelope_contract === "FACT_RECORD_JSON_TYPE_PLUS_CANONICAL_REPLAY_PAYLOAD_V1", "CONFIG_ENVELOPE");
    equal(config.actual_record_types, [
      "soil_moisture_observation_v1",
      "observed_rainfall_v1",
      "historical_et0_estimate_v1",
    ], "CONFIG_ACTUAL_TYPES");
    ok(config.semantic_window_rule === "OPEN_START_CLOSED_END_PT1H_V1", "CONFIG_WINDOW");
    ok(config.coverage_policy === "UNIQUE_INTERVAL_BUCKETS_OVER_PT1H", "CONFIG_COVERAGE");
    ok(config.trust_policy.missing_quality_defaults_to_eligible === false, "CONFIG_FAIL_CLOSED_QUALITY");
    ok(config.database_write_allowed === false && config.scheduler_loop_allowed === false, "CONFIG_NONCLAIMS");
    ok(hard.required_check_count === 18 && hard.checks.length === 18, "HARD_ACCEPTANCE_CARDINALITY");
    ok(hard.database_write_performed === false && hard.canonical_write_performed === false, "HARD_ACCEPTANCE_WRITES");
    ok(predecessor.subject_sha === S1_SUBJECT, "PREDECESSOR_SUBJECT");
    ok(predecessor.exact_sha_r2_run_id === S1_RUN && predecessor.artifact_id === S1_ARTIFACT, "PREDECESSOR_ARTIFACT");

    const source = read(SOURCE);
    for (const token of [
      "implements EvidenceIngressPortV1",
      "FACT_RECORD_JSON_TYPE_PLUS_CANONICAL_REPLAY_PAYLOAD_V1",
      "soil_moisture_observation_v1",
      "observed_rainfall_v1",
      "historical_et0_estimate_v1",
      "OPEN_START_CLOSED_END_PT1H_V1",
      "BEGIN TRANSACTION READ ONLY",
      "CONFLICTING_DUPLICATE_OBSERVATION",
      "formal_eligible",
      "is_simulated",
      "evidence_level",
      "intervalCoverage",
      "DUPLICATE_SUPERSEDED",
      "readLastFreezeDiagnostics",
    ]) {
      ok(source.includes(token), `SOURCE_TOKEN_REQUIRED:${token}`);
    }
    for (const forbidden of [
      "telemetry_observation_v1",
      "weather_observation_v1",
      "soil_observation_v1",
      "field_observation_v1",
      "remote_sensing_observation_v1",
      '|| "ELIGIBLE"',
    ]) {
      ok(!source.includes(forbidden), `SOURCE_OBSOLETE_CONTRACT_FORBIDDEN:${forbidden}`);
    }
    const selectSql = source.match(/`SELECT fact_id[\s\S]*?LIMIT \$4`/)?.[0] || "";
    ok(selectSql.includes("FROM facts"), "SOURCE_FACTS_QUERY_REQUIRED");
    ok(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/.test(selectSql), "ADAPTER_SQL_WRITE_FORBIDDEN");

    const runtime = read(RUNTIME);
    for (const token of [
      "new Pool",
      "docker/postgres/init/001_schema.sql",
      "INSERT INTO facts",
      "OPEN_START_CLOSED_END_PT1H_V1",
      "CONFLICTING_DUPLICATE_OBSERVATION",
      "raw_telemetry_v1",
      "device_observation_v1",
      "ADAPTER_MUST_NOT_WRITE_FACTS",
      "DETERMINISTIC_REPEATED_FREEZE_REQUIRED",
      "INTERVAL_BUCKET_COVERAGE_REQUIRED",
    ]) {
      ok(runtime.includes(token), `RUNTIME_TOKEN_REQUIRED:${token}`);
    }

    let declaration = { mode: "MERGE_GROUP_POLICY" };
    if (process.env.MCFT_EVENT_NAME === "pull_request") {
      const prNumber = Number(process.env.MCFT_PR_NUMBER);
      const pull = await api(`/pulls/${prNumber}`);
      const parsed = parseDeclaration(pull.body);
      ok(pull.head.sha === head && pull.base.sha === base, "PR_EXACT_BINDING");
      ok(parsed.capability_line === "MCFT-CAP-09", "DECLARATION_CAPABILITY");
      ok(parsed.slice_id === "MCFT-CAP-09.S2", "DECLARATION_SLICE");
      ok(parsed.status_file === STATUS, "DECLARATION_STATUS_FILE");
      ok(parsed.candidate_field === "s2_candidate_implemented", "DECLARATION_FIELD");
      ok(parsed.candidate_value === "true", "DECLARATION_VALUE");
      ok(parsed.focused_workflow === "mcft-cap-09-s2-database-evidence-ingress", "DECLARATION_FOCUSED_WORKFLOW");
      ok(parsed.standard_workflow === "ci", "DECLARATION_STANDARD_WORKFLOW");
      ok(parsed.candidate_head === head && parsed.base_head === base, "DECLARATION_SHA_BINDING");
      const snapshotFiles = parsed.semantic_snapshot_files.split(",");
      const snapshotBlobs = parsed.semantic_snapshot_blobs.split(",");
      equal(snapshotFiles, SNAPSHOT_FILES, "DECLARATION_SNAPSHOT_FILES");
      equal(
        snapshotBlobs,
        snapshotFiles.map((file) => git("rev-parse", `HEAD:${file}`)),
        "DECLARATION_SNAPSHOT_BLOBS",
      );
      declaration = {
        mode: "PR_BODY_VALIDATED",
        pr_number: prNumber,
        semantic_snapshot_count: snapshotFiles.length,
      };
    }

    const result = {
      schema_version: "geox_mcft_cap09_s2_database_evidence_ingress_result_v1",
      status: "PASS",
      change_class: "MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_CANDIDATE_R3",
      base_sha: base,
      head_sha: head,
      changed_files: FILES,
      exact_new_candidate_signal_count: 1,
      governance_proven: true,
      database_integration_proven: false,
      database_read_adapter_implemented: true,
      database_write_performed: false,
      future_evidence_leakage_blocked: true,
      scheduler_loop_executed: false,
      canonical_write_performed: false,
      production_wiring_present: false,
      runtime_source_delta: 1,
      runtime_executable_delta: 1,
      migration_delta: 0,
      external_effectiveness: false,
      declaration,
      first_legal_next_action: "PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION",
    };
    writeOutput(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = {
      status: "FAIL",
      base_sha: process.env.MCFT_BASE_SHA || null,
      error: String(error instanceof Error ? error.message : error),
    };
    writeOutput(failure);
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
})();
