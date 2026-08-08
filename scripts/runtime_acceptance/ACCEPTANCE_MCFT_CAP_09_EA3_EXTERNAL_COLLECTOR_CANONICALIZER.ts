import fs from "node:fs";
import path from "node:path";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidencePipelineInputV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
  type McftCap09ExternalEvidenceRoleV1,
  type RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER_RESULT.json");
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA ?? "";

function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

async function expectReject(fn: () => Promise<unknown>, code: string): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    requireCondition(message.startsWith(code), `EA3_EXPECTED_REJECTION_MISMATCH:${code}:${message}`);
    return message;
  }
  throw new Error(`EA3_EXPECTED_REJECTION_MISSING:${code}`);
}

const SCOPE: TwinScopeKeyV1 = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t1r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t1r1_formal_v1",
};

const ROLE_EXPECTATIONS: Record<McftCap09ExternalEvidenceRoleV1, {
  record_type: string;
  epistemic_class: string;
  event_field: string;
  event_time: string;
  source_unit: string;
  canonical_unit: string;
}> = {
  SOIL_MOISTURE_OBSERVATION: {
    record_type: "soil_moisture_observation_v1",
    epistemic_class: "OBSERVED",
    event_field: "observed_at",
    event_time: "2026-08-08T19:00:00.000Z",
    source_unit: "fraction",
    canonical_unit: "fraction",
  },
  RAINFALL_OBSERVATION: {
    record_type: "observed_rainfall_v1",
    epistemic_class: "OBSERVED",
    event_field: "interval_end",
    event_time: "2026-08-08T19:30:00.000Z",
    source_unit: "mm",
    canonical_unit: "mm",
  },
  HISTORICAL_ET0_INPUT: {
    record_type: "historical_et0_estimate_v1",
    epistemic_class: "ESTIMATED",
    event_field: "interval_end",
    event_time: "2026-08-08T19:45:00.000Z",
    source_unit: "mm_per_hour",
    canonical_unit: "mm_per_hour",
  },
  FUTURE_WEATHER_ASSUMPTION: {
    record_type: "future_weather_assumption_v1",
    epistemic_class: "ASSUMED",
    event_field: "issued_at",
    event_time: "2026-08-08T18:00:00.000Z",
    source_unit: "governed_multi_variable_bundle",
    canonical_unit: "governed_multi_variable_bundle",
  },
  FUTURE_ET0_ASSUMPTION: {
    record_type: "future_et0_assumption_v1",
    epistemic_class: "ASSUMED",
    event_field: "issued_at",
    event_time: "2026-08-08T18:00:00.000Z",
    source_unit: "mm_per_hour",
    canonical_unit: "mm_per_hour",
  },
};

function makeDraft(role: McftCap09ExternalEvidenceRoleV1, overrides: Partial<GovernedDecodedEvidenceDraftV1> = {}): GovernedDecodedEvidenceDraftV1 {
  const expected = ROLE_EXPECTATIONS[role];
  const roleTime = {
    [expected.event_field]: expected.event_time,
    ingested_at: "2026-08-08T20:04:00.000Z",
  };
  const sourcePayload = role === "FUTURE_WEATHER_ASSUMPTION"
    ? { source_cycle: "SYNTHETIC_CONTRACT_ONLY", point_count: 72, values_embedded_in_public_result: false }
    : role === "FUTURE_ET0_ASSUMPTION"
      ? { source_cycle: "SYNTHETIC_CONTRACT_ONLY", point_count: 72, solar_quality: "LIMITED", values_embedded_in_public_result: false }
      : { synthetic_contract_value_present: true, values_embedded_in_public_result: false };
  const canonicalPayload = role === "FUTURE_WEATHER_ASSUMPTION" || role === "FUTURE_ET0_ASSUMPTION"
    ? { point_count: 72, interval: "T_PLUS_1_TO_T_PLUS_72", values_embedded_in_public_result: false }
    : { interval_count: 1, values_embedded_in_public_result: false };
  return {
    role,
    source_record_id: `ea3-contract-${role.toLowerCase()}`,
    binding_id: `ea3-binding-${role.toLowerCase()}`,
    origin_source_kind: role.startsWith("FUTURE_") ? "NOAA_NCEP_GFS_CONTRACT_FIXTURE" : "KBS_LTER_CONTRACT_FIXTURE",
    origin_source_id: `ea3-source-${role.toLowerCase()}`,
    epistemic_class: expected.epistemic_class,
    available_to_runtime_at: "2026-08-08T20:03:00.000Z",
    role_time: roleTime,
    quality: { status: role === "FUTURE_ET0_ASSUMPTION" ? "LIMITED" : "PASS", contract_fixture_only: true },
    source_payload: sourcePayload,
    canonical_payload: canonicalPayload,
    source_unit: expected.source_unit,
    canonical_unit: expected.canonical_unit,
    conversion_rule: {
      conversion_rule_id: `EA3_CONTRACT_RULE_${role}`,
      conversion_rule_version: "1",
      authority_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
      contract_fixture_only: true,
    },
    source_binding_version: 1,
    limitations: [
      "CONTRACT_FIXTURE_ONLY_NOT_LIVE_SOURCE_AUTHORITY",
      role === "SOIL_MOISTURE_OBSERVATION" ? "NO_FIELD_OR_ROOT_ZONE_EQUIVALENCE" : "NO_FIELD_EQUIVALENCE",
    ],
    ...overrides,
  };
}

function makeRequest(role: McftCap09ExternalEvidenceRoleV1): ExternalEvidenceFetchRequestV1 {
  return {
    request_id: `ea3-request-${role.toLowerCase()}`,
    provider_id: role.startsWith("FUTURE_") ? "NOAA_NCEP_GFS_CONTRACT_FIXTURE" : "KBS_LTER_CONTRACT_FIXTURE",
    source_family: role,
    locator: `https://example.invalid/ea3/${role.toLowerCase()}`,
    allowed_final_hosts: ["example.invalid"],
    use_policy_ref: "EA3_CONTRACT_FIXTURE_NO_PROVIDER_RIGHTS_CLAIM",
    requested_at: "2026-08-08T20:00:00.000Z",
    source_issue_time: role.startsWith("FUTURE_") ? "2026-08-08T18:00:00.000Z" : undefined,
    source_event_time: role.startsWith("FUTURE_") ? undefined : ROLE_EXPECTATIONS[role].event_time,
    expected_content_type_prefixes: ["application/json"],
    limitations: ["CONTRACT_FIXTURE_ONLY_NO_LIVE_PROVIDER_REQUEST"],
  };
}

function makePipelineInput(role: McftCap09ExternalEvidenceRoleV1): ExternalEvidencePipelineInputV1 {
  return {
    dataset_id: "mcft_cap09_external_formal_v1",
    scope: SCOPE,
    request: makeRequest(role),
    canonicalized_at: "2026-08-08T20:05:00.000Z",
  };
}

type HarnessOptions = {
  draftOverride?: Partial<GovernedDecodedEvidenceDraftV1>;
  retentionDigestOverride?: string;
};

function makeHarness(role: McftCap09ExternalEvidenceRoleV1, options: HarnessOptions = {}) {
  const sequence: string[] = [];
  let decoderCalls = 0;
  const raw = new TextEncoder().encode(JSON.stringify({ role, contract_fixture_only: true, raw_values_published: false }));
  const transport: ExternalEvidenceTransportPortV1 = {
    async fetchRawEvidence(request) {
      sequence.push(`fetch:${role}`);
      requireCondition(request.locator.startsWith("https://example.invalid/"), "EA3_LIVE_NETWORK_LOCATOR_FORBIDDEN_IN_ACCEPTANCE");
      return {
        status: 200,
        final_locator: request.locator,
        content_type: "application/json; charset=utf-8",
        available_at: "2026-08-08T19:59:00.000Z",
        retrieved_at: "2026-08-08T20:01:00.000Z",
        bytes: raw,
      };
    },
  };
  const retention: RawEvidenceRetentionPortV1 = {
    async retainRawEvidence(input) {
      sequence.push(`retain:${role}`);
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: `private://ea3/${role.toLowerCase()}/contract-fixture`,
        retained_sha256: options.retentionDigestOverride ?? input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: "2026-08-08T20:02:00.000Z",
        externally_publishable: false,
      };
    },
  };
  const decoder: ExternalEvidenceDecoderPortV1 = {
    decoder_id: "EA3_SYNTHETIC_CONTRACT_DECODER_ONLY_NOT_PROVIDER_AUTHORITY",
    decoder_version: "1",
    async decodeRetainedEvidence(input) {
      decoderCalls += 1;
      sequence.push(`decode:${role}`);
      requireCondition(input.provenance.retention_ref.startsWith("private://ea3/"), "EA3_DECODER_RETENTION_REF_REQUIRED");
      JSON.parse(new TextDecoder().decode(input.raw_bytes));
      return [makeDraft(role, options.draftOverride)];
    },
  };
  return { transport, retention, decoder, sequence, getDecoderCalls: () => decoderCalls };
}

async function main(): Promise<void> {
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), "EA3_EXACT_SUBJECT_SHA_REQUIRED");
  const roles = Object.keys(ROLE_EXPECTATIONS) as McftCap09ExternalEvidenceRoleV1[];
  const roleResults: Record<string, unknown> = {};
  let transportCallCount = 0;
  let retentionCallCount = 0;
  let decoderCallCount = 0;

  for (const role of roles) {
    const harness = makeHarness(role);
    const result = await collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput(role), harness);
    requireCondition(result.length === 1, `EA3_ROLE_RESULT_COUNT_INVALID:${role}`);
    const item = result[0]!;
    requireCondition(item.record.record_type === ROLE_EXPECTATIONS[role].record_type, `EA3_ROLE_RECORD_TYPE_DRIFT:${role}`);
    requireCondition(item.record.epistemic_class === ROLE_EXPECTATIONS[role].epistemic_class, `EA3_ROLE_EPISTEMIC_DRIFT:${role}`);
    requireCondition(item.record.field_id === "field_kbs_mcse_t1r1", `EA3_ROLE_SCOPE_DRIFT:${role}`);
    requireCondition(item.record.quality.raw_payload_embedded === false, `EA3_ROLE_RAW_PAYLOAD_FLAG_DRIFT:${role}`);
    requireCondition(item.record.source_payload.raw_provenance !== undefined, `EA3_ROLE_RAW_PROVENANCE_MISSING:${role}`);
    requireCondition(item.record.limitations.length >= 2, `EA3_ROLE_LIMITATION_MISSING:${role}`);
    requireCondition(/^sha256:[0-9a-f]{64}$/.test(item.canonical_payload_sha256), `EA3_CANONICAL_HASH_INVALID:${role}`);
    requireCondition(/^sha256:[0-9a-f]{64}$/.test(item.record_semantic_sha256), `EA3_RECORD_HASH_INVALID:${role}`);
    requireCondition(harness.sequence.join(",") === `fetch:${role},retain:${role},decode:${role}`, `EA3_RETENTION_ORDER_DRIFT:${role}:${harness.sequence.join(",")}`);
    transportCallCount += 1;
    retentionCallCount += 1;
    decoderCallCount += harness.getDecoderCalls();

    const deterministicHarness = makeHarness(role);
    const deterministic = await collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput(role), deterministicHarness);
    requireCondition(deterministic[0]!.canonical_payload_sha256 === item.canonical_payload_sha256, `EA3_CANONICAL_PAYLOAD_NONDETERMINISTIC:${role}`);
    requireCondition(deterministic[0]!.record_semantic_sha256 === item.record_semantic_sha256, `EA3_RECORD_NONDETERMINISTIC:${role}`);
    transportCallCount += 1;
    retentionCallCount += 1;
    decoderCallCount += deterministicHarness.getDecoderCalls();

    roleResults[role] = {
      record_type: item.record.record_type,
      epistemic_class: item.record.epistemic_class,
      quality_status: item.record.quality.status,
      canonical_payload_sha256: item.canonical_payload_sha256,
      record_semantic_sha256: item.record_semantic_sha256,
      retention_precedes_decoder: true,
      deterministic_reproof: true,
      raw_payload_embedded: false,
    };
  }

  const badRetention = makeHarness("SOIL_MOISTURE_OBSERVATION", { retentionDigestOverride: `sha256:${"0".repeat(64)}` });
  const retentionError = await expectReject(
    () => collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput("SOIL_MOISTURE_OBSERVATION"), badRetention),
    "EA3_RETENTION_DIGEST_MISMATCH",
  );
  requireCondition(badRetention.getDecoderCalls() === 0, "EA3_DECODER_CALLED_AFTER_RETENTION_FAILURE");
  transportCallCount += 1;
  retentionCallCount += 1;

  const futureLeakage = makeHarness("FUTURE_WEATHER_ASSUMPTION", {
    draftOverride: {
      role_time: { issued_at: "2026-08-08T20:04:00.000Z", ingested_at: "2026-08-08T20:04:00.000Z" },
    },
  });
  const futureLeakageError = await expectReject(
    () => collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput("FUTURE_WEATHER_ASSUMPTION"), futureLeakage),
    "EA3_EVENT_TIME_AFTER_RUNTIME_AVAILABILITY",
  );
  transportCallCount += 1;
  retentionCallCount += 1;
  decoderCallCount += futureLeakage.getDecoderCalls();

  const epistemicMismatch = makeHarness("SOIL_MOISTURE_OBSERVATION", { draftOverride: { epistemic_class: "ASSUMED" } });
  const epistemicError = await expectReject(
    () => collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput("SOIL_MOISTURE_OBSERVATION"), epistemicMismatch),
    "EA3_EPISTEMIC_CLASS_MISMATCH",
  );
  transportCallCount += 1;
  retentionCallCount += 1;
  decoderCallCount += epistemicMismatch.getDecoderCalls();

  const rawBinaryLeak = makeHarness("RAINFALL_OBSERVATION", {
    draftOverride: { source_payload: { raw_blob: new Uint8Array([1, 2, 3]) } },
  });
  const rawBinaryError = await expectReject(
    () => collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput("RAINFALL_OBSERVATION"), rawBinaryLeak),
    "EA3_RAW_BINARY_IN_CANONICAL_RECORD_FORBIDDEN",
  );
  transportCallCount += 1;
  retentionCallCount += 1;
  decoderCallCount += rawBinaryLeak.getDecoderCalls();

  const unsafeTrust = makeHarness("HISTORICAL_ET0_INPUT", {
    draftOverride: { source_payload: { is_simulated: true } },
  });
  const unsafeTrustError = await expectReject(
    () => collectRetainDecodeCanonicalizeExternalEvidenceV1(makePipelineInput("HISTORICAL_ET0_INPUT"), unsafeTrust),
    "EA3_UNSAFE_TRUST_SURFACE_FORBIDDEN",
  );
  transportCallCount += 1;
  retentionCallCount += 1;
  decoderCallCount += unsafeTrust.getDecoderCalls();

  const result = {
    schema_version: "geox_mcft_cap09_ea3_external_collector_canonicalizer_result_v1",
    status: "PASS",
    subject_sha: SUBJECT_SHA,
    role_count: roles.length,
    role_results: roleResults,
    retention_barrier: {
      verified: true,
      retention_digest_mismatch_error: retentionError,
      decoder_calls_after_retention_failure: badRetention.getDecoderCalls(),
    },
    negative_cases: {
      future_leakage_error: futureLeakageError,
      epistemic_mismatch_error: epistemicError,
      raw_binary_leak_error: rawBinaryError,
      unsafe_trust_surface_error: unsafeTrustError,
    },
    io_counts: {
      injected_transport_calls: transportCallCount,
      private_retention_calls: retentionCallCount,
      decoder_calls: decoderCallCount,
      public_provider_live_request_count: 0,
      database_write_count: 0,
      formal_evidence_write_count: 0,
      runtime_public_provider_fetch_count: 0,
    },
    authority_nonclaims: {
      live_source_qualified: false,
      gfs_72h_full_value_pipeline_qualified: false,
      future_et0_72h_value_execution_qualified: false,
      formal_ingress_eligible: false,
      formal_window_started: false,
      mcft_cap09_completed: false,
    },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const failure = {
    schema_version: "geox_mcft_cap09_ea3_external_collector_canonicalizer_result_v1",
    status: "FAIL",
    subject_sha: SUBJECT_SHA || null,
    error: error instanceof Error ? `${error.name}:${error.message}` : String(error),
    public_provider_live_request_count: 0,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(failure, null, 2)}\n`);
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
});
