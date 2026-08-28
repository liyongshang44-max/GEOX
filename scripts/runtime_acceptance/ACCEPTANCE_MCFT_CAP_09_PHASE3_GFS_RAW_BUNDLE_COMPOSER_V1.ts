import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import type {
  RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1,
  MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
  GfsNomadsLiveProviderV1,
  gfsPgrb2NamesV1,
  gfsSfluxNamesV1,
  type GfsNomadsRawObjectV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_GFS_RAW_BUNDLE_COMPOSER_V1_RESULT.json");
const TARGET = "2026-08-27T12:00:00.000Z";
const CYCLE = "2026-08-27T06:00:00Z";
const SUPPORT = 6;
const LEAD_START = 7;
const LEAD_END = 78;

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function raw(kind: GfsNomadsRawObjectV1["kind"], identity: string, bytes: Uint8Array, contentType: string): GfsNomadsRawObjectV1 {
  return {
    kind,
    identity,
    sha256: sha256(bytes),
    response: {
      status: kind === "GFS_SFLUX_EXACT_GRIB_MESSAGE" ? 206 : 200,
      final_locator: `https://nomads.ncep.noaa.gov/${encodeURIComponent(identity)}`,
      content_type: contentType,
      response_headers: {},
      retrieved_at: "2026-08-27T11:50:00.000Z",
      bytes,
    },
  };
}

function directoryBytes(): Uint8Array {
  const rows: string[] = [];
  for (let lead = SUPPORT; lead <= LEAD_END; lead += 1) {
    for (const name of [...gfsPgrb2NamesV1(CYCLE, lead), ...gfsSfluxNamesV1(CYCLE, lead)]) {
      rows.push(`<a href="${name}">${name}</a> 27-Aug-2026 11:00 1K`);
    }
  }
  return new TextEncoder().encode(rows.join("\n"));
}

function idxBytes(lead: number): Uint8Array {
  const text = [
    `1:0:d=2026082706:DSWRF:surface:${lead} hour fcst:`,
    `2:100:d=2026082706:TMP:surface:${lead} hour fcst:`,
  ].join("\n");
  return new TextEncoder().encode(text);
}

function gribBytes(seed: number): Uint8Array {
  const body = Buffer.alloc(32, seed % 251);
  Buffer.from("GRIB", "ascii").copy(body, 0);
  Buffer.from("7777", "ascii").copy(body, body.length - 4);
  return new Uint8Array(body);
}

async function main(): Promise<void> {
  const order: string[] = [];
  const retained = new Set<string>();
  let providerRequests = 0;
  const retention: RawEvidenceRetentionPortV1 = {
    async retainRawEvidence(input) {
      order.push(`retain:${input.source_family}`);
      retained.add(input.raw_sha256);
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: `s3-private://phase3-gfs/${input.raw_sha256.slice(7)}`,
        retained_sha256: input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: "2026-08-27T11:50:01.000Z",
        externally_publishable: false,
      };
    },
  };

  const provider = {
    provider_id: MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
    async selectLatestCompleteCycle(_tick: string, retainThenParse: (raw: GfsNomadsRawObjectV1) => Promise<unknown>) {
      providerRequests += 1;
      const d = raw("GFS_DIRECTORY_LISTING", CYCLE, directoryBytes(), "text/html");
      await retainThenParse(d);
      assert(retained.has(d.sha256), "PHASE3_GFS_DIRECTORY_MUST_BE_RETAINED_BEFORE_PARSE");
      order.push("directory_parsed_after_retention");
      return {
        cycle: CYCLE,
        lead_start: LEAD_START,
        lead_end: LEAD_END,
        support_lead: SUPPORT,
        directory_sha256: d.sha256,
        rejected_cycles: [],
      };
    },
    async fetchPgrb2FilteredRaw(_cycle: string, lead: number) {
      providerRequests += 1;
      return raw("GFS_PGRB2_FILTER_RESPONSE", `${CYCLE}|F${String(lead).padStart(3, "0")}`, gribBytes(lead), "application/octet-stream");
    },
    async fetchSfluxIndexRaw(_cycle: string, lead: number) {
      providerRequests += 1;
      return raw("GFS_SFLUX_IDX", `${CYCLE}|F${String(lead).padStart(3, "0")}`, idxBytes(lead), "text/plain");
    },
    async fetchSfluxMessageRaw(_cycle: string, lead: number, _tick: string, selected: { lead: number }) {
      providerRequests += 1;
      assert.equal(selected.lead, lead);
      return raw("GFS_SFLUX_EXACT_GRIB_MESSAGE", `${CYCLE}|F${String(lead).padStart(3, "0")}`, gribBytes(lead + 100), "application/octet-stream");
    },
  };

  const times = [
    new Date("2026-08-27T11:49:59.000Z"),
    new Date("2026-08-27T11:51:00.000Z"),
  ];
  const composer = new GfsNomadsRawBundleComposerV1({
    provider,
    retention,
    clock: () => times.shift() ?? new Date("2026-08-27T11:51:00.000Z"),
  });
  const result = await composer.compose({
    target_logical_time: TARGET,
    request_id_prefix: "phase3-gfs-composer-test",
  });

  const leadCount = LEAD_END - SUPPORT + 1;
  const expectedRawObjects = 1 + leadCount * 3;
  assert.equal(result.provider_request_count, expectedRawObjects);
  assert.equal(providerRequests, expectedRawObjects);
  assert.equal(result.raw_provider_object_count, expectedRawObjects);
  assert.equal(result.members.length, expectedRawObjects);
  assert.equal(retained.size, expectedRawObjects);
  assert.equal(result.retention_before_directory_parse, true);
  assert.equal(result.retention_before_sflux_idx_parse, true);
  assert.equal(result.retention_before_scientific_decode, true);
  assert.equal(result.manifest.member_count, expectedRawObjects);
  assert.equal(result.manifest.product_bundle_composer_used, true);
  assert.equal(result.bundle_bytes.byteLength, result.raw_bundle_bytes);
  assert.equal(sha256(result.bundle_bytes), result.raw_bundle_sha256);
  assert.equal(Buffer.from(result.bundle_bytes.slice(257, 263)).toString("ascii"), "ustar\0");

  let virtualNowMs = 1_000;
  const cadenceWaits: number[] = [];
  const filteredUrls: string[] = [];
  const filteredFetch = (async (input: string | URL | Request) => {
    filteredUrls.push(String(input));
    return new Response(Buffer.from(gribBytes(filteredUrls.length)), {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    });
  }) as typeof fetch;
  const cadenceClient = new ControlledHttpsByteClientV1({
    fetch_impl: filteredFetch,
    clock: () => new Date("2026-08-27T11:50:00.000Z"),
    user_agent: "GEOX-MCFT-CAP09-PHASE3-CADENCE-TEST/1",
    max_raw_bytes: 250_000_000,
    timeout_ms: 5_000,
  });
  const cadenceProvider = new GfsNomadsLiveProviderV1({
    byte_client: cadenceClient,
    grib_filter_cadence: {
      now_ms: () => virtualNowMs,
      async wait_ms(milliseconds) {
        cadenceWaits.push(milliseconds);
        virtualNowMs += milliseconds;
      },
    },
  });
  await cadenceProvider.fetchPgrb2FilteredRaw(CYCLE, SUPPORT);
  await cadenceProvider.fetchPgrb2FilteredRaw(CYCLE, SUPPORT + 1);
  assert.equal(filteredUrls.length, 2);
  assert.deepEqual(
    cadenceWaits,
    [MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1],
  );
  assert.equal(MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1, 10_000);

  const source = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.ts"),
    "utf8",
  );
  for (const forbidden of [
    "scripts/runtime_acceptance",
    "process.env",
    "setInterval(",
    "setTimeout(",
    "child_process",
    "INSERT INTO",
    "UPDATE twin_",
    "DELETE FROM twin_",
  ]) {
    assert.equal(source.includes(forbidden), false, `PHASE3_GFS_COMPOSER_FORBIDDEN_DEPENDENCY:${forbidden}`);
  }

  const proof = {
    schema_version: "geox_mcft_cap09_phase3_gfs_raw_bundle_composer_qualification_v1",
    status: "PASS",
    support_lead: SUPPORT,
    lead_end: LEAD_END,
    lead_count: leadCount,
    raw_provider_object_count: expectedRawObjects,
    provider_request_count: result.provider_request_count,
    retained_object_count: retained.size,
    retention_before_directory_parse: true,
    retention_before_sflux_idx_parse: true,
    retention_before_scientific_decode: true,
    deterministic_tar_header: true,
    product_provider_id: result.provider_id,
    product_bundle_composer_id: result.composer_id,
    nomads_grib_filter_minimum_interval_ms:
      MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1,
    nomads_responsible_sharing_cadence_proven: true,
    database_write_count: 0,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_cadence_activation: false,
    formal_v5_armed: false,
    graduation_effect: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(proof, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
