import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  ProductionEvidenceWorkItemFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  KbsRawHourlyMultiIntervalDecoderV1,
  MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
  MCFT_CAP09_KBS_RAW_HOURLY_MULTI_INTERVAL_DECODER_ID_V1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_KBS_RAW_HOURLY_MULTI_INTERVAL_PRODUCT_PATH_V1_RESULT.json",
);
const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_mcft_cap09",
  field_id: "field_mcft_external",
  season_id: "season_2026",
  zone_id: "zone_root",
};
const TARGETS = [
  "2026-08-13T02:00:00.000Z",
  "2026-08-13T03:00:00.000Z",
  "2026-08-13T04:00:00.000Z",
] as const;
const REQUESTED_AT = "2026-08-13T19:59:00.000Z";
const AVAILABLE_AT = "2026-08-13T20:00:00.000Z";
const RETAINED_AT = "2026-08-13T20:00:01.000Z";
const CANONICALIZED_AT = "2026-08-13T20:00:02.000Z";
const HEADER = "datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n";
const ROWS = [
  "2026-08-13 02:00:00,120.0,2.0,1.7,23.0,0.1",
  "2026-08-13 03:00:00,150.0,2.5,1.8,24.0,0.2",
  "2026-08-13 04:00:00,180.0,3.0,1.9,25.0,0.3",
];
const RAW = Buffer.from(HEADER + ROWS.join("\n") + "\n", "utf8");

function sha256(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}

function response(): Response {
  const copied = Uint8Array.from(RAW);
  return {
    status: 200,
    url: MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
    headers: new Headers({ "content-type": "text/csv; charset=utf-8" }),
    arrayBuffer: async () => copied.buffer as ArrayBuffer,
  } as unknown as Response;
}

async function main(): Promise<void> {
  let providerFetchCount = 0;
  let retentionCount = 0;
  const order: string[] = [];
  const fetchImpl = (async (input: unknown): Promise<Response> => {
    providerFetchCount += 1;
    order.push("provider_fetch");
    assert.equal(String(input), MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1);
    return response();
  }) as typeof fetch;

  const retention: RawEvidenceRetentionPortV1 = {
    async retainRawEvidence(input) {
      retentionCount += 1;
      order.push("raw_retention");
      assert.equal(providerFetchCount, 1);
      assert.equal(input.raw_sha256, sha256(RAW));
      assert.deepEqual(Buffer.from(input.bytes), Buffer.from(RAW));
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: "s3-private://mcft-cap09-kbs-batch/" + input.raw_sha256.slice("sha256:".length),
        retained_sha256: input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: RETAINED_AT,
        externally_publishable: false,
      };
    },
  };

  const factory = new ProductionEvidenceWorkItemFactoryV1({
    retention,
    fetch_impl: fetchImpl,
    clock: () => new Date(AVAILABLE_AT),
  });
  const publication = factory.buildKbsRawHourlyPublicationFetch({
    requested_at: REQUESTED_AT,
    request_id_prefix: "kbs-publication-focused",
  });
  assert.equal(publication.request.source_event_time, undefined);
  assert.equal(publication.request.locator, MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1);
  assert.match(publication.request.request_id, /:kbs-raw-hourly-publication$/);

  const item = factory.buildKbsRawHourlyBatch({
    target_logical_times: TARGETS,
    requested_at: REQUESTED_AT,
    request_id_prefix: "kbs-multi-interval-focused",
  });

  assert.equal(item.dataset_id, "kbs_lter_raw_hourly_multi_interval_batch_v1");
  assert.equal(item.request.source_event_time, undefined);
  assert.ok(item.decoder instanceof KbsRawHourlyMultiIntervalDecoderV1);
  assert.equal(item.decoder.decoder_id, MCFT_CAP09_KBS_RAW_HOURLY_MULTI_INTERVAL_DECODER_ID_V1);

  const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1(
    {
      dataset_id: item.dataset_id,
      scope: SCOPE,
      request: item.request,
    },
    {
      transport: item.transport,
      retention,
      decoder: item.decoder,
    },
    () => CANONICALIZED_AT,
  );

  assert.equal(providerFetchCount, 1, "KBS_BATCH_EXACT_ONE_PROVIDER_FETCH_REQUIRED");
  assert.equal(retentionCount, 1, "KBS_BATCH_EXACT_ONE_RAW_RETENTION_REQUIRED");
  assert.equal(results.length, TARGETS.length * 2, "KBS_BATCH_EXACT_TWO_CANONICAL_RECORDS_PER_TARGET_REQUIRED");
  assert.deepEqual(
    [...new Set(results.map((result) => String(result.record.role_time.interval_end)))].sort(),
    [...TARGETS],
    "KBS_BATCH_ALL_TARGET_INTERVALS_REQUIRED",
  );
  assert.equal(
    new Set(results.map((result) => result.raw_provenance.retention_ref)).size,
    1,
    "KBS_BATCH_ONE_RETAINED_PROVENANCE_REQUIRED",
  );
  assert.equal(
    new Set(results.map((result) => result.raw_provenance.raw_sha256)).size,
    1,
    "KBS_BATCH_ONE_RAW_DIGEST_REQUIRED",
  );
  assert.equal(order[0], "provider_fetch");
  assert.equal(order[1], "raw_retention");

  assert.throws(
    () => factory.buildKbsRawHourlyBatch({
      target_logical_times: [TARGETS[0]],
      requested_at: REQUESTED_AT,
      request_id_prefix: "kbs-batch-one-target",
    }),
    /KBS_RAW_HOURLY_MULTI_INTERVAL_AT_LEAST_TWO_TARGETS_REQUIRED/,
  );
  assert.throws(
    () => factory.buildKbsRawHourlyBatch({
      target_logical_times: [TARGETS[0], TARGETS[0]],
      requested_at: REQUESTED_AT,
      request_id_prefix: "kbs-batch-duplicate",
    }),
    /KBS_RAW_HOURLY_MULTI_INTERVAL_TARGET_DUPLICATE/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_multi_interval_product_path_result_v1",
    status: "PASS",
    target_interval_count: TARGETS.length,
    provider_request_count: providerFetchCount,
    private_raw_retention_count: retentionCount,
    canonical_record_count: results.length,
    one_retained_batch_reused_across_all_targets: true,
    raw_retention_before_all_decode: true,
    source_event_time_not_forged_from_one_target: true,
    target_free_complete_table_publication_fetch_factory: true,
    database_connection_attempted: false,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_planner_bound: false,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_multi_interval_product_path_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    database_connection_attempted: false,
    production_planner_bound: false,
    runtime_process_start: false,
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
