#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");

const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const RUNNER_BLOB = "26dd21c5a0b7a60fca06e5e4c2ec92289a102a47";
const GENERATED = "scripts/runtime_acceptance/.generated_RUN_MCFT_CAP_09_V13_EXACT_BASE_PREBOUNDARY_CAPTURE.ts";

const TARGET_SOURCE_ID = "DURABLE_FORCING_CURSOR_NEXT_MISSING_REQUIRED_BASE";
const INGRESS_POLICY_ID = "AMENDMENT11_ROLLING_PREBOUNDARY_TARGET_T_V1";

const HISTORICAL_NAMESPACE = "namespace: namespaceFor(target)";
const RUN_SCOPED_NAMESPACE = "namespace: `${namespaceFor(target)}-${required(\"GITHUB_RUN_ID\")}-${required(\"GITHUB_RUN_ATTEMPT\")}`";
const HISTORICAL_RETRIEVAL_VALIDATION = 'canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");';
const CURRENT_RETRIEVAL_CLOCK = 'const retrievedAt = canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");';
const HISTORICAL_REUSE_BLOCK = `if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
    }`;
const CAUSAL_REUSE_BLOCK = `if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      if (Date.parse(retainedAt) >= Date.parse(retrievedAt)) {
        return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
      }
      await this.deleteRetainedRawEvidence(ref);
    }`;
const LEGACY_MARGIN_SELECTOR = 'const MIN_INGRESS_MARGIN_MINUTES = process.env.GITHUB_WORKFLOW === "mcft-cap-09-rolling-preboundary-capture" ? 0 : 5;';
const EXPLICIT_MARGIN_SELECTOR = `const V13_ROLLING_INGRESS_POLICY_ID = "${INGRESS_POLICY_ID}";
function explicitV13RollingIngressMarginMinutes(): number {
  if (process.env.MCFT_CAP09_V13_PREBOUNDARY_INGRESS_POLICY_ID !== V13_ROLLING_INGRESS_POLICY_ID) {
    throw new Error("MCFT_CAP09_V13_EXPLICIT_ROLLING_INGRESS_POLICY_REQUIRED");
  }
  return 0;
}
const MIN_INGRESS_MARGIN_MINUTES = explicitV13RollingIngressMarginMinutes();`;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function canonicalHour(value, code) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function assertExplicitAuthorityInputs(env = process.env) {
  const target = canonicalHour(String(env.MCFT_EA5E2_TARGET_T || ""), "MCFT_CAP09_V13_EXACT_BASE_TARGET_REQUIRED");
  if (String(env.MCFT_CAP09_V13_TARGET_SOURCE_ID || "") !== TARGET_SOURCE_ID) {
    throw new Error("MCFT_CAP09_V13_DURABLE_CURSOR_TARGET_SOURCE_REQUIRED");
  }
  if (String(env.MCFT_CAP09_V13_PREBOUNDARY_INGRESS_POLICY_ID || "") !== INGRESS_POLICY_ID) {
    throw new Error("MCFT_CAP09_V13_AMENDMENT11_TARGET_T_POLICY_REQUIRED");
  }
  const idempotency = String(env.MCFT_CAP09_V13_FORCING_IDEMPOTENCY_KEY || "").trim();
  if (!/^formal-forcing-base:[0-9a-f]{64}$/.test(idempotency)) {
    throw new Error("MCFT_CAP09_V13_FORCING_IDEMPOTENCY_KEY_REQUIRED");
  }
  return { target, idempotency };
}

function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}

function buildExplicitTargetRunner() {
  const observedBlob = execFileSync("git", ["rev-parse", `HEAD:${RUNNER}`], { encoding: "utf8" }).trim();
  if (observedBlob !== RUNNER_BLOB) throw new Error(`MCFT_CAP09_V13_PROVIDER_SOURCE_BLOB_DRIFT:${observedBlob}`);

  let generated = fs.readFileSync(RUNNER, "utf8");
  generated = exactReplace(generated, HISTORICAL_NAMESPACE, RUN_SCOPED_NAMESPACE, "MCFT_CAP09_V13_RETENTION_NAMESPACE_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, HISTORICAL_RETRIEVAL_VALIDATION, CURRENT_RETRIEVAL_CLOCK, "MCFT_CAP09_V13_RETRIEVAL_CLOCK_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, HISTORICAL_REUSE_BLOCK, CAUSAL_REUSE_BLOCK, "MCFT_CAP09_V13_CAUSAL_REUSE_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, LEGACY_MARGIN_SELECTOR, EXPLICIT_MARGIN_SELECTOR, "MCFT_CAP09_V13_EXPLICIT_INGRESS_POLICY_REPLACEMENT_CARDINALITY");

  if (generated.includes(HISTORICAL_NAMESPACE)) throw new Error("MCFT_CAP09_V13_TARGET_ONLY_RETENTION_NAMESPACE_SURVIVED");
  if (generated.includes(LEGACY_MARGIN_SELECTOR)) throw new Error("MCFT_CAP09_V13_WORKFLOW_IDENTITY_MARGIN_SELECTOR_SURVIVED");
  if (!generated.includes(RUN_SCOPED_NAMESPACE)) throw new Error("MCFT_CAP09_V13_RUN_SCOPED_RETENTION_NAMESPACE_REQUIRED");
  if (!generated.includes(CURRENT_RETRIEVAL_CLOCK)) throw new Error("MCFT_CAP09_V13_CURRENT_RETRIEVAL_CLOCK_REQUIRED");
  if (!generated.includes('Date.parse(retainedAt) >= Date.parse(retrievedAt)')) throw new Error("MCFT_CAP09_V13_CAUSAL_REUSE_GUARD_REQUIRED");
  if (!generated.includes('await this.deleteRetainedRawEvidence(ref);')) throw new Error("MCFT_CAP09_V13_STALE_INTRARUN_OBJECT_DELETE_REQUIRED");
  if (!generated.includes(`const V13_ROLLING_INGRESS_POLICY_ID = "${INGRESS_POLICY_ID}";`)) throw new Error("MCFT_CAP09_V13_EXPLICIT_INGRESS_POLICY_BINDING_REQUIRED");
  if (!generated.includes("const MIN_INGRESS_MARGIN_MINUTES = explicitV13RollingIngressMarginMinutes();")) throw new Error("MCFT_CAP09_V13_EXPLICIT_INGRESS_MARGIN_REQUIRED");
  return generated;
}

function selftest() {
  const target = "2099-01-01T01:00:00.000Z";
  const idempotency = `formal-forcing-base:${"a".repeat(64)}`;
  const authority = assertExplicitAuthorityInputs({
    MCFT_EA5E2_TARGET_T: target,
    MCFT_CAP09_V13_TARGET_SOURCE_ID: TARGET_SOURCE_ID,
    MCFT_CAP09_V13_PREBOUNDARY_INGRESS_POLICY_ID: INGRESS_POLICY_ID,
    MCFT_CAP09_V13_FORCING_IDEMPOTENCY_KEY: idempotency,
  });
  if (authority.target !== target || authority.idempotency !== idempotency) throw new Error("MCFT_CAP09_V13_EXPLICIT_AUTHORITY_SELFTEST_MISMATCH");

  for (const bad of [
    { MCFT_EA5E2_TARGET_T: "2099-01-01T01:30:00.000Z", MCFT_CAP09_V13_TARGET_SOURCE_ID: TARGET_SOURCE_ID, MCFT_CAP09_V13_PREBOUNDARY_INGRESS_POLICY_ID: INGRESS_POLICY_ID, MCFT_CAP09_V13_FORCING_IDEMPOTENCY_KEY: idempotency },
    { MCFT_EA5E2_TARGET_T: target, MCFT_CAP09_V13_TARGET_SOURCE_ID: "WALL_CLOCK", MCFT_CAP09_V13_PREBOUNDARY_INGRESS_POLICY_ID: INGRESS_POLICY_ID, MCFT_CAP09_V13_FORCING_IDEMPOTENCY_KEY: idempotency },
    { MCFT_EA5E2_TARGET_T: target, MCFT_CAP09_V13_TARGET_SOURCE_ID: TARGET_SOURCE_ID, MCFT_CAP09_V13_PREBOUNDARY_INGRESS_POLICY_ID: "LEGACY_WORKFLOW_NAME", MCFT_CAP09_V13_FORCING_IDEMPOTENCY_KEY: idempotency },
  ]) {
    let failed = false;
    try { assertExplicitAuthorityInputs(bad); } catch { failed = true; }
    if (!failed) throw new Error("MCFT_CAP09_V13_EXPLICIT_AUTHORITY_NEGATIVE_SELFTEST_REQUIRED");
  }

  const generated = buildExplicitTargetRunner();
  if (generated.includes("PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET")) throw new Error("MCFT_CAP09_V13_WALL_CLOCK_TARGET_PLANNER_FORBIDDEN");
  if (generated.includes('process.env.GITHUB_WORKFLOW === "mcft-cap-09-rolling-preboundary-capture" ? 0 : 5')) throw new Error("MCFT_CAP09_V13_WORKFLOW_NAME_POLICY_FORBIDDEN");

  console.log(JSON.stringify({
    status: "PASS",
    adapter_id: "MCFT_CAP09_V13_EXACT_BASE_PREBOUNDARY_CAPTURE_V1",
    provider_source_blob: RUNNER_BLOB,
    target_source: TARGET_SOURCE_ID,
    wall_clock_target_planner_used: false,
    exact_canonical_hour_required: true,
    amendment11_rolling_ingress_deadline: "T",
    explicit_ingress_policy_id: INGRESS_POLICY_ID,
    workflow_name_selects_ingress_policy: false,
    provider_core_rewritten: false,
    run_scoped_retention_namespace: true,
    causal_retention_reuse_guard_preserved: true,
    formal_database_write_count: 0,
    production_workflow_effect: false,
  }, null, 2));
}

function run() {
  assertExplicitAuthorityInputs();
  if (!/^\d+$/.test(required("GITHUB_RUN_ID"))) throw new Error("MCFT_CAP09_V13_GITHUB_RUN_ID_REQUIRED");
  if (!/^\d+$/.test(required("GITHUB_RUN_ATTEMPT"))) throw new Error("MCFT_CAP09_V13_GITHUB_RUN_ATTEMPT_REQUIRED");

  const generated = buildExplicitTargetRunner();
  fs.writeFileSync(GENERATED, generated);
  try {
    const child = spawnSync("pnpm", ["exec", "tsx", GENERATED], {
      stdio: "inherit",
      env: { ...process.env },
    });
    if (child.error) throw child.error;
    if (child.signal) throw new Error(`MCFT_CAP09_V13_EXPLICIT_CAPTURE_CHILD_SIGNAL:${child.signal}`);
    if (child.status !== 0) process.exitCode = child.status ?? 1;
  } finally {
    try { fs.unlinkSync(GENERATED); } catch {}
  }
}

if (process.argv[2] === "selftest") selftest();
else run();
