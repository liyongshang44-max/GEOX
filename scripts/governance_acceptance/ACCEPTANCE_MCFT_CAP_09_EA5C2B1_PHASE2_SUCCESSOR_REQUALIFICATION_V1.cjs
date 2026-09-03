#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PHASE1_BASE = "8943c752a354cb916cc7f144681203aa9a19f70b";
const PHASE2_CLOSURE = "c3346768a44b16b127378cb690ada1d8cfec1049";
const PROTECTED_MAIN_ADOPTION_BASE = "fa6e260d8cdec4a82403a86f1c7b3d5420e44ef8";
const HISTORICAL_GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR.cjs";
const HISTORICAL_AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-V1.json";
const HISTORICAL_ACCEPTANCE = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS.ts";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml";
const EXECUTOR = "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts";
const TRANSPORT = "apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.ts";
const PROVIDER = "apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts";
const KBS_HOURLY_PROVIDER = "apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts";
const KBS_HOURLY_CORE = "apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py";
const GFS_PROVIDER = "apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.ts";
const GFS_SCIENTIFIC_CORE = "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py";
const GFS_BUNDLE_COMPOSER = "apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.ts";
const GFS_BUNDLE_TRANSPORT = "apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.ts";
const GFS_BUNDLE_DECODER = "apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.ts";
const GFS_BUNDLE_PYTHON_DECODER = "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py";
const THIS = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs";
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1_RESULT.json");

const FROZEN_DEPENDENCIES = [
  HISTORICAL_GATE,
  HISTORICAL_AUTHORITY,
  HISTORICAL_ACCEPTANCE,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json",
  "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts",
];

const ALLOWED_SENSITIVE_DELTA = new Set([
  EXECUTOR,
  TRANSPORT,
  PROVIDER,
  KBS_HOURLY_PROVIDER,
  KBS_HOURLY_CORE,
  GFS_PROVIDER,
  GFS_SCIENTIFIC_CORE,
  GFS_BUNDLE_COMPOSER,
  GFS_BUNDLE_TRANSPORT,
  GFS_BUNDLE_DECODER,
  GFS_BUNDLE_PYTHON_DECODER,
  WORKFLOW,
  THIS,
]);

function git(...args) {
  return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function exactCommit(value, code) {
  const text = String(value || "").trim();
  assert.match(text, /^[0-9a-f]{40}$/, code);
  return git("rev-parse", `${text}^{commit}`);
}
function isSensitive(file) {
  return file === EXECUTOR ||
    file === WORKFLOW ||
    file === THIS ||
    file.startsWith("apps/server/src/external_evidence/provider/") ||
    file === HISTORICAL_GATE ||
    file === HISTORICAL_AUTHORITY ||
    file === HISTORICAL_ACCEPTANCE;
}
function requireMarkers(file, markers, code) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const marker of markers) assert.ok(text.includes(marker), `${code}:${marker}`);
  return text;
}

try {
  const base = exactCommit(process.env.MCFT_BASE_SHA || PHASE1_BASE, "EA5C2B1_PHASE2_BASE_SHA_INVALID");
  const protectedMainAdoption = process.env.MCFT_CAP09_PROTECTED_MAIN_ADOPTION === "1";
  if (protectedMainAdoption) {
    assert.equal(base, PROTECTED_MAIN_ADOPTION_BASE, "EA5C2B1_PROTECTED_MAIN_ADOPTION_BASE_REQUIRED");
    assert.equal(git("merge-base", PHASE2_CLOSURE, "HEAD"), PHASE2_CLOSURE, "EA5C2B1_PHASE2_CLOSURE_NOT_ANCESTOR_OF_ADOPTION");
    for (const file of [HISTORICAL_GATE, HISTORICAL_AUTHORITY, HISTORICAL_ACCEPTANCE]) {
      assert.equal(
        git("rev-parse", `HEAD:${file}`),
        git("rev-parse", `${PHASE1_BASE}:${file}`),
        `EA5C2B1_PROTECTED_MAIN_ADOPTION_HISTORICAL_AUTHORITY_DRIFT:${file}`,
      );
    }
    const workflow = requireMarkers(WORKFLOW, [
      "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR.cjs",
      "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs",
      PROTECTED_MAIN_ADOPTION_BASE,
      "Execute live KBS source through frozen EA3 and EA5C1 pipeline against CI-only stores",
    ], "EA5C2B1_PROTECTED_MAIN_ADOPTION_WORKFLOW_MARKER_MISSING");
    for (const forbidden of [
      "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY:",
      "GEOX_MCFT_CAP09_S6_DATABASE_URL:",
    ]) assert.equal(workflow.includes(forbidden), false, `EA5C2B1_PROTECTED_MAIN_ADOPTION_FORMAL_SECRET_BINDING_FORBIDDEN:${forbidden}`);
    for (const [file, markers] of [
      [EXECUTOR, ["collectRetainDecodeCanonicalizeExternalEvidenceV1", "PostgresExternalFormalEvidenceIngressV1", "runtime_public_provider_fetch_count: 0"]],
      [TRANSPORT, ["class ControlledHttpsByteClientV1", "class HttpsExternalEvidenceTransportV1", "FINAL_HOST_NOT_ALLOWED", "FINAL_IDENTITY_DRIFT"]],
      [KBS_HOURLY_PROVIDER, ["class KbsRawHourlyLiveTransportV1", "class KbsRawHourlyExactIntervalDecoderV1", "freshness_is_late_authoritative_admission_gate: false"]],
      [GFS_PROVIDER, ["class GfsNomadsLiveProviderV1", "selectLatestCompleteCycle", "cross_cycle_substitution_authorized: false"]],
    ]) requireMarkers(file, markers, "EA5C2B1_PROTECTED_MAIN_ADOPTION_MARKER_MISSING");
    const result = {
      schema_version: "geox_mcft_cap09_ea5c2b1_phase2_successor_requalification_v1",
      status: "PASS",
      classification: "PROTECTED_MAIN_ADOPTION_PHASE2_CONTINUITY_REQUALIFICATION",
      governed_base_sha: base,
      phase1_frozen_authority_sha: PHASE1_BASE,
      phase2_closure_sha: PHASE2_CLOSURE,
      candidate_sha: git("rev-parse", "HEAD"),
      historical_ea5c2b1_gate_unchanged: true,
      historical_ea5c2b1_authority_unchanged: true,
      historical_ea5c2b1_runtime_acceptance_unchanged: true,
      later_provider_evolution_requalified_by_current_workflow: true,
      production_evidence_runtime_activated: false,
      production_twin_runtime_activated: false,
      provider_production_cadence_owner_activated: false,
      formal_database_mutation: false,
      formal_v5_armed: false,
      graduation_effect: false,
      mcft_cap09_completed: false,
    };
    write(result);
    console.log(JSON.stringify(result));
  } else {
    assert.ok(
      base === PHASE1_BASE || base === PHASE2_CLOSURE,
      "EA5C2B1_GOVERNED_PREDECESSOR_REQUIRED",
    );
    assert.equal(git("merge-base", base, "HEAD"), base, "EA5C2B1_PHASE2_BASE_NOT_ANCESTOR");

  // Historical/frozen authority remains pinned to the original Phase1 predecessor even
  // when this gate requalifies a later stacked Phase3 successor on top of Phase2 closure.
  for (const file of FROZEN_DEPENDENCIES) {
    assert.equal(
      git("rev-parse", `HEAD:${file}`),
      git("rev-parse", `${PHASE1_BASE}:${file}`),
      `EA5C2B1_PHASE2_FROZEN_AUTHORITY_DRIFT:${file}`,
    );
  }

  const rawChanged = git("diff", "--name-only", `${base}...HEAD`);
  const changed = rawChanged ? rawChanged.split(/\r?\n/).filter(Boolean).sort() : [];
  const sensitive = changed.filter(isSensitive);
  const forbiddenSensitive = sensitive.filter((file) => !ALLOWED_SENSITIVE_DELTA.has(file));
  assert.deepEqual(forbiddenSensitive, [], "EA5C2B1_PHASE2_UNDECLARED_SENSITIVE_PATH");
  const requiredSensitive = base === PHASE1_BASE
    ? [
        EXECUTOR, TRANSPORT, PROVIDER,
        KBS_HOURLY_PROVIDER, KBS_HOURLY_CORE,
        GFS_PROVIDER, GFS_SCIENTIFIC_CORE,
        WORKFLOW, THIS,
      ]
    : [
        GFS_BUNDLE_COMPOSER,
        GFS_BUNDLE_TRANSPORT,
        GFS_BUNDLE_DECODER,
        GFS_BUNDLE_PYTHON_DECODER,
        WORKFLOW,
        THIS,
      ];
  for (const required of requiredSensitive) {
    assert.equal(sensitive.includes(required), true, `EA5C2B1_PHASE2_REQUIRED_DELTA_MISSING:${required}`);
  }

  const diffCheck = cp.spawnSync("git", ["diff", "--check", `${base}...HEAD`, "--", ...sensitive], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(diffCheck.status, 0, `EA5C2B1_PHASE2_DIFF_CHECK_FAILED:${String(diffCheck.stdout || "")}${String(diffCheck.stderr || "")}`);

  const executor = requireMarkers(EXECUTOR, [
    "KbsVariate25SoilEvidenceDecoderV1",
    "fetchKbsVariate25SoilRawV1",
    "collectRetainDecodeCanonicalizeExternalEvidenceV1",
    "PostgresExternalFormalEvidenceIngressV1",
    "runtime_public_provider_fetch_count: 0",
  ], "EA5C2B1_PHASE2_EXECUTOR_MARKER_MISSING");
  assert.equal(/\bINSERT\s+INTO\b/i.test(executor), false, "EA5C2B1_PHASE2_DIRECT_SQL_WRITE_FORBIDDEN");

  const transport = requireMarkers(TRANSPORT, [
    "class ControlledHttpsByteClientV1",
    "class HttpsExternalEvidenceTransportV1",
    "request.allowed_final_hosts",
    "parsed.protocol === \"https:\"",
    "method: \"GET\"",
    "FINAL_HOST_NOT_ALLOWED",
    "FINAL_IDENTITY_DRIFT",
  ], "EA5C2B1_PHASE2_TRANSPORT_MARKER_MISSING");
  assert.equal(/\bINSERT\s+INTO\b/i.test(transport), false, "EA5C2B1_PHASE2_TRANSPORT_DB_WRITE_FORBIDDEN");

  const provider = requireMarkers(PROVIDER, [
    "https://lter.kbs.msu.edu/weather/variates/25",
    "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1",
    "measurement_depth_mm: 100",
    "direct_field_equivalence: false",
    "direct_root_zone_equivalence: false",
    "root_zone_representativeness: \"PARTIAL\"",
    "raw_values_embedded: false",
    "NO_PUBLIC_RAW_VALUE_EMISSION",
    "HttpsExternalEvidenceTransportV1",
  ], "EA5C2B1_PHASE2_PROVIDER_MARKER_MISSING");
  assert.equal(/\bINSERT\s+INTO\b/i.test(provider), false, "EA5C2B1_PHASE2_PROVIDER_DB_WRITE_FORBIDDEN");

  const kbsHourlyProvider = requireMarkers(KBS_HOURLY_PROVIDER, [
    "class KbsRawHourlyLiveTransportV1",
    "class KbsRawHourlyExactIntervalDecoderV1",
    "HttpsExternalEvidenceTransportV1",
    "mcft_cap09_kbs_raw_hourly_scientific_core_v1.py",
    "freshness_is_late_authoritative_admission_gate: false",
    "historical_online_freshness_diagnostic_hours",
    "refet-0.4.2",
  ], "EA5C2B1_PHASE2_KBS_HOURLY_PROVIDER_MARKER_MISSING");
  for (const forbidden of [
    "scripts/runtime_acceptance",
    "GITHUB_",
    "github.run",
    "RuntimeTickCursor",
    "twin_state",
    "INSERT INTO",
    ".replace(source",
    "source.replace(",
  ]) assert.equal(kbsHourlyProvider.includes(forbidden), false, `EA5C2B1_PHASE2_KBS_HOURLY_PROVIDER_FORBIDDEN_DEPENDENCY:${forbidden}`);

  const gfsProvider = requireMarkers(GFS_PROVIDER, [
    "class GfsNomadsLiveProviderV1",
    "ControlledHttpsByteClientV1",
    "selectLatestCompleteCycle",
    "fetchDirectoryRaw",
    "fetchPgrb2FilteredRaw",
    "fetchSfluxIndexRaw",
    "fetchSfluxMessageRaw",
    "parseGfsDirectoryInventoryV1",
    "parseGfsSfluxIndexV1",
    "same_exact_cycle_required: true",
    "cross_cycle_substitution_authorized: false",
    "Range:",
    "content-range",
    "last-modified",
  ], "EA5C2B1_PHASE2_GFS_PROVIDER_MARKER_MISSING");
  for (const forbidden of [
    "scripts/runtime_acceptance",
    "acceptance-output",
    "GITHUB_",
    "github.run",
    "RuntimeTickCursor",
    "twin_state",
    "INSERT INTO",
    "psycopg",
    "subprocess",
  ]) assert.equal(gfsProvider.includes(forbidden), false, `EA5C2B1_PHASE2_GFS_PROVIDER_FORBIDDEN_DEPENDENCY:${forbidden}`);

  const gfsBundleComposer = requireMarkers(GFS_BUNDLE_COMPOSER, [
    "class GfsNomadsRawBundleComposerV1",
    "retention_before_directory_parse",
    "retention_before_sflux_idx_parse",
    "retention_before_scientific_decode",
    "selectLatestCompleteCycle",
  ], "EA5C2B1_PHASE2_GFS_BUNDLE_COMPOSER_MARKER_MISSING");
  const gfsBundleTransport = requireMarkers(GFS_BUNDLE_TRANSPORT, [
    "class GfsNomadsBundleTransportV1",
    "GfsNomadsRawBundleComposerV1",
    "application/x-tar",
    "DETERMINISTIC_AGGREGATE_OF_RETAINED_NOMADS_OBJECTS",
  ], "EA5C2B1_PHASE2_GFS_BUNDLE_TRANSPORT_MARKER_MISSING");
  const gfsBundleDecoder = requireMarkers(GFS_BUNDLE_DECODER, [
    "class GfsRawBundleEvidenceDecoderV1",
    "mcft_cap09_gfs_raw_bundle_decoder_v1.py",
    "decode-bundle",
    "FUTURE_WEATHER_ASSUMPTION",
    "FUTURE_ET0_ASSUMPTION",
  ], "EA5C2B1_PHASE2_GFS_BUNDLE_DECODER_MARKER_MISSING");
  const gfsBundlePythonDecoder = requireMarkers(GFS_BUNDLE_PYTHON_DECODER, [
    "core.decode_pgrb2_v1",
    "core.decode_sflux_v1",
    "core.assemble_72h_scientific_series_v1",
    "build_drafts_v1",
    "FUTURE_WEATHER_ASSUMPTION",
    "FUTURE_ET0_ASSUMPTION",
  ], "EA5C2B1_PHASE2_GFS_BUNDLE_PYTHON_DECODER_MARKER_MISSING");
  for (const [label, text] of [
    ["COMPOSER", gfsBundleComposer],
    ["TRANSPORT", gfsBundleTransport],
    ["DECODER", gfsBundleDecoder],
    ["PYTHON_DECODER", gfsBundlePythonDecoder],
  ]) {
    for (const forbidden of [
      "scripts/runtime_acceptance",
      "acceptance-output",
      "GITHUB_",
      "RuntimeTickCursor",
      "INSERT INTO twin_",
      "UPDATE twin_",
      "DELETE FROM twin_",
    ]) {
      assert.equal(text.includes(forbidden), false, `EA5C2B1_PHASE2_GFS_BUNDLE_${label}_FORBIDDEN_DEPENDENCY:${forbidden}`);
    }
  }

  const kbsHourlyCore = requireMarkers(KBS_HOURLY_CORE, [
    "class KbsRawHourlyScientificAuthorityV1",
    "class KbsRawHourlyExactIntervalV1",
    "def parse_kbs_raw_hourly_csv_v1",
    "def compute_asce_short_hourly_et0_v1",
    "def decode_exact_kbs_raw_hourly_interval_v1",
    "decode-exact",
    "refet.Hourly(",
    "method=\"asce\"",
    "target.minute == 0 and target.second == 0 and target.microsecond == 0",
    "len(matches) == 1",
    "0 <= rainfall <= 100",
    "-50 <= air <= 60",
    "0 < actual_vapor_pressure <= 10",
    "0 <= solar <= 1600",
    "0 <= wind <= 100",
  ], "EA5C2B1_PHASE2_KBS_HOURLY_CORE_MARKER_MISSING");
  for (const forbidden of [
    "scripts/runtime_acceptance",
    "acceptance-output",
    "MCFT_SUBJECT_SHA",
    "GITHUB_",
    "github.run",
    "importlib.util",
    "subprocess",
    "os.environ",
    "Path.cwd",
    "tempfile",
    "urlopen",
    "INSERT INTO",
    "RuntimeTickCursor",
    "twin_state",
  ]) assert.equal(kbsHourlyCore.includes(forbidden), false, `EA5C2B1_PHASE2_PRODUCT_SCIENTIFIC_CORE_FORBIDDEN_DEPENDENCY:${forbidden}`);

  const workflow = requireMarkers(WORKFLOW, [
    "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR.cjs",
    "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_PHASE2_SUCCESSOR_REQUALIFICATION_V1.cjs",
    PHASE1_BASE,
    "Execute live KBS source through frozen EA3 and EA5C1 pipeline against CI-only stores",
  ], "EA5C2B1_PHASE2_WORKFLOW_MARKER_MISSING");
  for (const forbidden of [
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY:",
    "GEOX_MCFT_CAP09_S6_DATABASE_URL:",
  ]) assert.equal(workflow.includes(forbidden), false, `EA5C2B1_PHASE2_FORMAL_SECRET_BINDING_FORBIDDEN:${forbidden}`);

  const result = {
    schema_version: "geox_mcft_cap09_ea5c2b1_phase2_successor_requalification_v1",
    status: "PASS",
    classification: base === PHASE1_BASE
      ? "PHASE2_EVIDENCE_PROVIDER_EXTRACTION_SUCCESSOR_REQUALIFICATION"
      : "PHASE3_EVIDENCE_PROVIDER_MAINTENANCE_REQUALIFICATION",
    governed_base_sha: base,
    phase1_frozen_authority_sha: PHASE1_BASE,
    phase2_closure_sha: PHASE2_CLOSURE,
    candidate_sha: git("rev-parse", "HEAD"),
    historical_ea5c2b1_gate_unchanged: true,
    historical_ea5c2b1_authority_unchanged: true,
    historical_ea5c2b1_runtime_acceptance_unchanged: true,
    sensitive_changed_files: sensitive,
    provider_semantics_promoted_without_runtime_fallback: true,
    product_kbs_raw_hourly_provider_adapter_present: true,
    product_kbs_raw_hourly_scientific_core_present: true,
    product_gfs_acquisition_provider_present: true,
    product_gfs_acquisition_provider_uses_shared_https_client: true,
    product_gfs_scientific_core_declared_sensitive_delta: sensitive.includes(GFS_SCIENTIFIC_CORE),
    product_gfs_provider_declared_sensitive_delta: sensitive.includes(GFS_PROVIDER),
    product_gfs_bundle_composer_declared_sensitive_delta: sensitive.includes(GFS_BUNDLE_COMPOSER),
    product_gfs_bundle_transport_declared_sensitive_delta: sensitive.includes(GFS_BUNDLE_TRANSPORT),
    product_gfs_bundle_decoder_declared_sensitive_delta: sensitive.includes(GFS_BUNDLE_DECODER),
    product_gfs_bundle_python_decoder_declared_sensitive_delta: sensitive.includes(GFS_BUNDLE_PYTHON_DECODER),
    product_scientific_core_acceptance_dependency: false,
    product_scientific_core_github_identity_dependency: false,
    product_scientific_core_provider_fetch_dependency: false,
    product_scientific_core_database_write_dependency: false,
    kbs_raw_hourly_freshness_is_late_authoritative_admission_gate: false,
    retention_before_decode_boundary_preserved: true,
    governed_postgres_ingress_boundary_preserved: true,
    production_evidence_runtime_activated: false,
    production_twin_runtime_activated: false,
    provider_production_cadence_owner_activated: false,
    runtime_provider_fallback: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  write(result);
  console.log(JSON.stringify(result));
  }
} catch (error) {
  const result = {
    schema_version: "geox_mcft_cap09_ea5c2b1_phase2_successor_requalification_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(error);
  process.exitCode = 1;
}
