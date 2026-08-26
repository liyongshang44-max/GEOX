import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  ExternalEvidenceFetchRequestV1,
  VerifiedRawEvidenceProvenanceV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  buildKbsRawHourlyFetchRequestV1,
  KbsRawHourlyExactIntervalDecoderV1,
  KbsRawHourlyLiveTransportV1,
  MCFT_CAP09_KBS_RAW_HOURLY_DECODER_ID_V1,
  MCFT_CAP09_KBS_RAW_HOURLY_DECODER_VERSION_V1,
  MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
  MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";

const OUT = "acceptance-output/MCFT_CAP_09_KBS_RAW_HOURLY_PRODUCT_ADAPTER_V1_RESULT.json";
const TARGET = "2026-08-13T03:00:00.000Z";
const AVAILABLE_AT = "2026-08-13T20:00:00.000Z";
const DECODED_AT = "2026-08-13T20:01:00.000Z";
const HEADER = "datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n";
const BASE_ROWS = [
  "2026-08-13 02:00:00,120.0,2.0,1.7,23.0,0.1",
  "2026-08-13 03:00:00,150.0,2.5,1.8,24.0,0.2",
  "2026-08-13 04:00:00,180.0,3.0,1.9,25.0,0.3",
];

function csv(rows: readonly string[]): Uint8Array {
  return Buffer.from(`${HEADER}${rows.join("\n")}\n`, "utf8");
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fakeResponse(body: Uint8Array, finalUrl = MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1): Response {
  const copied = Uint8Array.from(body);
  return {
    status: 200,
    url: finalUrl,
    headers: new Headers({ "content-type": "text/csv; charset=utf-8" }),
    arrayBuffer: async () => copied.buffer as ArrayBuffer,
  } as unknown as Response;
}

function retainedProvenance(
  request: ExternalEvidenceFetchRequestV1,
  bytes: Uint8Array,
  availableAt = AVAILABLE_AT,
): VerifiedRawEvidenceProvenanceV1 {
  return {
    request_id: request.request_id,
    provider_id: request.provider_id,
    source_family: request.source_family,
    source_locator: request.locator,
    final_locator: request.locator,
    content_type: "text/csv; charset=utf-8",
    source_issue_time: request.source_issue_time,
    source_event_time: request.source_event_time,
    retrieved_at: availableAt,
    available_at: availableAt,
    raw_sha256: sha256(bytes),
    raw_bytes: bytes.byteLength,
    retention_ref: `fixture-retained://sha256/${sha256(bytes).slice("sha256:".length)}`,
    retained_at: availableAt,
    use_policy_ref: request.use_policy_ref,
  };
}

async function expectRejectContains(action: () => Promise<unknown>, code: string): Promise<void> {
  let failure: unknown;
  try {
    await action();
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, `EXPECTED_REJECTION_MISSING:${code}`);
  const record = failure as { stderr?: unknown; stdout?: unknown; stack?: unknown; message?: unknown };
  const text = [record.message, record.stderr, record.stdout, record.stack, String(failure)]
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .join("\n");
  assert.ok(text.includes(code), `EXPECTED_REJECTION_CODE_MISSING:${code}:${text}`);
}

async function expectDecodeReject(
  request: ExternalEvidenceFetchRequestV1,
  body: Uint8Array,
  code: string,
): Promise<void> {
  const decoder = new KbsRawHourlyExactIntervalDecoderV1(TARGET, {
    clock: () => new Date(DECODED_AT),
  });
  await expectRejectContains(
    () => decoder.decodeRetainedEvidence({ raw_bytes: body, provenance: retainedProvenance(request, body) }),
    code,
  );
}

async function main(): Promise<void> {
  const fixture = csv(BASE_ROWS);
  const request = buildKbsRawHourlyFetchRequestV1({
    request_id: "kbs-product-adapter-focused-qualification-v1",
    requested_at: "2026-08-13T19:59:00.000Z",
    source_event_time: TARGET,
  });

  assert.equal(request.locator, MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1);
  assert.deepEqual(request.allowed_final_hosts, ["lter.kbs.msu.edu"]);
  assert.equal(request.provider_id, "KBS_LTER");
  assert.equal(request.source_family, "RAW_HOURLY_WEATHER");
  assert.equal(request.source_event_time, TARGET);
  assert.ok(request.limitations.includes("PRIVATE_RESTRICTED_RAW_EVIDENCE"));
  assert.ok(request.limitations.includes("NO_PUBLIC_RAW_VALUE_EMISSION"));

  let positiveMockFetchCount = 0;
  const positiveFetch = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    positiveMockFetchCount += 1;
    assert.equal(String(input), MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1);
    assert.equal(init?.method, "GET");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("user-agent"), "GEOX-MCFT-CAP09-KBS-RAW-HOURLY/1");
    return fakeResponse(fixture);
  }) as typeof fetch;

  const transport = new KbsRawHourlyLiveTransportV1({
    fetch_impl: positiveFetch,
    clock: () => new Date(AVAILABLE_AT),
  });
  assert.equal(transport.transport_id, "MCFT_CAP09_KBS_RAW_HOURLY_LIVE_TRANSPORT_V1");
  const fetched = await transport.fetchRawEvidence(request);
  assert.equal(positiveMockFetchCount, 1);
  assert.equal(transport.provider_request_count, 1);
  assert.equal(fetched.final_locator, MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1);
  assert.equal(fetched.available_at, AVAILABLE_AT);
  assert.deepEqual(Buffer.from(fetched.bytes), Buffer.from(fixture));

  const decoder = new KbsRawHourlyExactIntervalDecoderV1(TARGET, {
    clock: () => new Date(DECODED_AT),
  });
  assert.equal(decoder.decoder_id, MCFT_CAP09_KBS_RAW_HOURLY_DECODER_ID_V1);
  assert.equal(decoder.decoder_version, MCFT_CAP09_KBS_RAW_HOURLY_DECODER_VERSION_V1);
  assert.equal(
    fs.existsSync(path.resolve(MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1)),
    true,
    "PRODUCT_SCIENTIFIC_CORE_PATH_REQUIRED",
  );

  const provenance: VerifiedRawEvidenceProvenanceV1 = {
    ...retainedProvenance(request, fetched.bytes, fetched.available_at),
    final_locator: fetched.final_locator,
    content_type: fetched.content_type,
    retrieved_at: fetched.retrieved_at,
  };
  const drafts = await decoder.decodeRetainedEvidence({ raw_bytes: fetched.bytes, provenance });
  assert.equal(drafts.length, 2);
  const rain = drafts.find((draft) => draft.role === "RAINFALL_OBSERVATION");
  const et0 = drafts.find((draft) => draft.role === "HISTORICAL_ET0_INPUT");
  assert.ok(rain, "RAINFALL_DRAFT_REQUIRED");
  assert.ok(et0, "HISTORICAL_ET0_DRAFT_REQUIRED");
  assert.equal(rain.canonical_payload.value, 0.2);
  assert.equal(rain.canonical_payload.unit, "mm");
  assert.equal(rain.role_time.interval_end, TARGET);
  assert.equal(rain.available_to_runtime_at, AVAILABLE_AT);
  assert.equal(rain.quality.historical_online_freshness_diagnostic_le_threshold, false);
  assert.equal(rain.quality.freshness_is_late_authoritative_admission_gate, false);
  assert.equal(et0.role_time.interval_end, TARGET);
  assert.equal(et0.canonical_payload.unit, "mm");
  assert.equal(et0.canonical_payload.method_version, "refet-0.4.2");
  assert.equal(typeof et0.canonical_payload.value, "number");
  assert.ok(Number.isFinite(et0.canonical_payload.value));
  assert.equal(et0.quality.historical_online_freshness_diagnostic_le_threshold, false);
  assert.equal(et0.quality.freshness_is_late_authoritative_admission_gate, false);

  const draftText = JSON.stringify(drafts);
  assert.equal(draftText.includes("datetime_utc"), false, "RAW_CSV_HEADER_MUST_NOT_BE_EMBEDDED");
  assert.equal(draftText.includes("raw_bytes"), false, "RAW_BYTES_MUST_NOT_BE_EMBEDDED");

  assert.throws(
    () => new KbsRawHourlyExactIntervalDecoderV1("2026-08-13T03:30:00.000Z"),
    /KBS_RAW_HOURLY_DECODER_TARGET_INVALID/,
  );

  await expectDecodeReject(
    request,
    csv([BASE_ROWS[0], BASE_ROWS[2]]),
    "MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED:0",
  );
  await expectDecodeReject(
    request,
    csv([BASE_ROWS[0], BASE_ROWS[1], BASE_ROWS[1], BASE_ROWS[2]]),
    "MCFT_CAP09_KBS_EXACT_TARGET_ROW_REQUIRED:2",
  );
  await expectDecodeReject(
    request,
    csv([BASE_ROWS[0], "2026-08-13 03:00:00,150.0,2.5,NaN,24.0,0.2", BASE_ROWS[2]]),
    "MCFT_CAP09_KBS_TARGET_ET0_INPUT_MISSING",
  );
  await expectDecodeReject(
    request,
    csv([BASE_ROWS[0], "2026-08-13 03:00:00,150.0,2.5,1.8,24.0,101.0", BASE_ROWS[2]]),
    "MCFT_CAP09_KBS_TARGET_RAIN_INVALID",
  );
  for (const row of [
    "2026-08-13 03:00:00,150.0,2.5,1.8,61.0,0.2",
    "2026-08-13 03:00:00,150.0,2.5,0.0,24.0,0.2",
    "2026-08-13 03:00:00,1601.0,2.5,1.8,24.0,0.2",
    "2026-08-13 03:00:00,150.0,101.0,1.8,24.0,0.2",
  ]) {
    await expectDecodeReject(
      request,
      csv([BASE_ROWS[0], row, BASE_ROWS[2]]),
      "MCFT_CAP09_KBS_TARGET_ET0_INPUT_RANGE",
    );
  }

  const providerCountBeforeMismatches = transport.provider_request_count;
  await expectRejectContains(
    () => transport.fetchRawEvidence({ ...request, locator: `${request.locator}?drift=1` }),
    "KBS_RAW_HOURLY_LOCATOR_MISMATCH",
  );
  await expectRejectContains(
    () => transport.fetchRawEvidence({ ...request, provider_id: "NOT_KBS" }),
    "KBS_RAW_HOURLY_PROVIDER_ID_MISMATCH",
  );
  await expectRejectContains(
    () => transport.fetchRawEvidence({ ...request, source_family: "NOT_RAW_HOURLY" }),
    "KBS_RAW_HOURLY_SOURCE_FAMILY_MISMATCH",
  );
  assert.equal(transport.provider_request_count, providerCountBeforeMismatches);
  assert.equal(positiveMockFetchCount, 1);

  let finalHostFaultFetchCount = 0;
  const finalHostFaultFetch = (async (): Promise<Response> => {
    finalHostFaultFetchCount += 1;
    return fakeResponse(fixture, "https://forbidden.example/datatables/13.csv");
  }) as typeof fetch;
  const finalHostTransport = new KbsRawHourlyLiveTransportV1({
    fetch_impl: finalHostFaultFetch,
    clock: () => new Date(AVAILABLE_AT),
  });
  await expectRejectContains(
    () => finalHostTransport.fetchRawEvidence(request),
    "KBS_RAW_HOURLY_FINAL_HOST_NOT_ALLOWED:forbidden.example",
  );
  assert.equal(finalHostFaultFetchCount, 1);

  const faultDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-kbs-focused-fault-"));
  try {
    const mismatchCore = path.join(faultDir, "mismatch_core.py");
    fs.writeFileSync(
      mismatchCore,
      [
        "import json,sys",
        "out=sys.argv[sys.argv.index('--output')+1]",
        "payload={",
        "'schema_version':'geox_mcft_cap09_kbs_raw_hourly_exact_interval_scientific_result_v1',",
        "'target_interval_end':'2026-08-13T02:00:00.000Z',",
        "'provider_latest_timestamp':'2026-08-13T04:00:00.000Z',",
        "'provider_latest_age_hours':16.0,",
        "'historical_online_freshness_diagnostic_le_threshold':False,",
        "'freshness_is_late_authoritative_admission_gate':False,",
        "'rainfall_mm':0.2,'historical_et0_mm':0.1,'air_temperature_c':24.0,",
        "'actual_vapor_pressure_kpa':1.8,'solar_radiation_w_m2':150.0,'wind_speed_10m':2.5}",
        "open(out,'w',encoding='utf-8').write(json.dumps(payload)+'\\n')",
      ].join("\n") + "\n",
      "utf8",
    );
    const mismatchDecoder = new KbsRawHourlyExactIntervalDecoderV1(TARGET, {
      scientific_core_path: mismatchCore,
      clock: () => new Date(DECODED_AT),
    });
    await expectRejectContains(
      () => mismatchDecoder.decodeRetainedEvidence({ raw_bytes: fixture, provenance: retainedProvenance(request, fixture) }),
      "KBS_RAW_HOURLY_RESULT_TARGET_MISMATCH",
    );
  } finally {
    fs.rmSync(faultDir, { recursive: true, force: true });
  }

  const productSource = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.ts"),
    "utf8",
  );
  for (const forbidden of [/\bINSERT\s+INTO\b/i, /RuntimeTickCursor/, /\btwin_state\b/]) {
    assert.equal(forbidden.test(productSource), false, `PRODUCT_ADAPTER_FORBIDDEN_MUTATION_MARKER:${String(forbidden)}`);
  }

  const result = {
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_product_adapter_qualification_v1",
    status: "PASS",
    product_transport_instantiated: true,
    product_decoder_instantiated: true,
    product_scientific_core_path_used: MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1,
    exact_t_decode_proved: true,
    rainfall_evidence_draft_proved: true,
    historical_et0_evidence_draft_proved: true,
    historical_online_freshness_diagnostic_le_threshold: false,
    freshness_is_late_authoritative_admission_gate: false,
    raw_payload_embedded: false,
    positive_mock_fetch_count: positiveMockFetchCount,
    final_host_fault_mock_fetch_count: finalHostFaultFetchCount,
    external_network_request_count: 0,
    database_write_count: 0,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_cadence_activation: false,
    production_evidence_runtime_activation: false,
    production_twin_runtime_activation: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
    negative_fail_closed_cases_proved: [
      "NON_CANONICAL_TARGET_HOUR",
      "MISSING_EXACT_TARGET_ROW",
      "DUPLICATE_EXACT_TARGET_ROW",
      "NONFINITE_ET0_INPUT",
      "OUT_OF_RANGE_RAIN",
      "OUT_OF_RANGE_AIR_TEMPERATURE",
      "OUT_OF_RANGE_VAPOR",
      "OUT_OF_RANGE_SOLAR",
      "OUT_OF_RANGE_WIND",
      "SCIENTIFIC_RESULT_TARGET_MISMATCH",
      "PROVIDER_LOCATOR_MISMATCH",
      "PROVIDER_ID_MISMATCH",
      "SOURCE_FAMILY_MISMATCH",
      "HTTPS_FINAL_HOST_MISMATCH",
    ],
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
