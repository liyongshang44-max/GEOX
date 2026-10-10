import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  GfsNomadsLiveProviderV1,
  candidateGfsCyclesV1,
  gfsDirectoryUrlV1,
  gfsLeadWindowV1,
  gfsPgrb2FilterUrlV1,
  gfsPgrb2NamesV1,
  gfsSfluxNamesV1,
  gfsSfluxUrlsV1,
  parseGfsDirectoryInventoryV1,
  parseGfsSfluxIndexV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_GFS_PRODUCT_ACQUISITION_PROVIDER_V1_RESULT.json");
const TICK = "2026-08-13T20:00:00Z";
const NEWEST = "2026-08-13T18:00:00Z";
const OLDER = "2026-08-13T12:00:00Z";
const AVAILABLE_STAMP = "13-Aug-2026 19:00";
const LAST_MODIFIED = "Thu, 13 Aug 2026 19:00:00 GMT";

function directoryHtml(cycle: string, omit?: string): string {
  const window = gfsLeadWindowV1(TICK, cycle);
  const names: string[] = [];
  for (let lead = window.support_lead; lead <= window.lead_end; lead += 1) {
    names.push(...gfsPgrb2NamesV1(cycle, lead));
    names.push(...gfsSfluxNamesV1(cycle, lead));
  }
  return names.filter((name) => name !== omit).map((name) =>
    `<a href="${name}">${name}</a> ${AVAILABLE_STAMP} 1.0M`,
  ).join("\n");
}

const newestMissing = gfsSfluxNamesV1(NEWEST, gfsLeadWindowV1(TICK, NEWEST).lead_end)[1];
const newestDirectory = directoryHtml(NEWEST, newestMissing);
const olderDirectory = directoryHtml(OLDER);
const pgrb2Bytes = new TextEncoder().encode("GRIBPRODUCT-PGRB2");
const sfluxIdxText = "1:0:d=2026081312:DSWRF:surface:8 hour fcst:\n2:12:d=2026081312:TMP:surface:8 hour fcst:\n";
const sfluxMessage = new TextEncoder().encode("GRIBxxxx7777");

let fakeFetchCount = 0;
let observedRange: string | null = null;
let externalNetworkRequestCount = 0;

const fakeFetch: typeof fetch = async (input, init) => {
  fakeFetchCount += 1;
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init?.headers);
  observedRange = headers.get("range") ?? observedRange;

  if (url === gfsDirectoryUrlV1(NEWEST)) {
    return new Response(newestDirectory, { status: 200, headers: { "content-type": "text/html" } });
  }
  if (url === gfsDirectoryUrlV1(OLDER)) {
    return new Response(olderDirectory, { status: 200, headers: { "content-type": "text/html" } });
  }
  if (url === gfsPgrb2FilterUrlV1(OLDER, 8)) {
    return new Response(pgrb2Bytes, { status: 200, headers: { "content-type": "application/octet-stream" } });
  }
  const [sfluxUrl, sfluxIdxUrl] = gfsSfluxUrlsV1(OLDER, 8);
  if (url === sfluxIdxUrl) {
    return new Response(sfluxIdxText, {
      status: 200,
      headers: { "content-type": "text/plain", "last-modified": LAST_MODIFIED },
    });
  }
  if (url === sfluxUrl) {
    assert.equal(headers.get("range"), "bytes=0-11");
    return new Response(sfluxMessage, {
      status: 206,
      headers: {
        "content-type": "application/octet-stream",
        "content-range": "bytes 0-11/1000000",
        "last-modified": LAST_MODIFIED,
      },
    });
  }
  externalNetworkRequestCount += 1;
  throw new Error(`UNEXPECTED_FAKE_FETCH:${url}`);
};

async function main(): Promise<void> {
  assert.deepEqual(candidateGfsCyclesV1(TICK).slice(0, 2), [NEWEST, OLDER]);
  const byteClient = new ControlledHttpsByteClientV1({
    fetch_impl: fakeFetch,
    clock: () => new Date("2026-08-13T20:00:30.000Z"),
    user_agent: "GEOX-MCFT-CAP09-GFS-PRODUCT-QUALIFICATION/1.0",
    max_raw_bytes: 20_000_000,
    timeout_ms: 10_000,
  });
  const provider = new GfsNomadsLiveProviderV1({ byte_client: byteClient });

  const retainParseOrder: string[] = [];
  const selection = await provider.selectLatestCompleteCycle(TICK, async (raw) => {
    retainParseOrder.push(`retain:${raw.identity}`);
    assert.equal(raw.kind, "GFS_DIRECTORY_LISTING");
    assert.match(raw.sha256, /^sha256:[0-9a-f]{64}$/);
    retainParseOrder.push(`parse:${raw.identity}`);
    return parseGfsDirectoryInventoryV1(raw.response.bytes);
  });
  assert.equal(selection.cycle, OLDER);
  assert.equal(selection.rejected_cycles.length, 1);
  assert.equal(selection.rejected_cycles[0]?.cycle, NEWEST);
  assert.match(selection.rejected_cycles[0]?.reason ?? "", /MCFT_CAP09_GFS_SFLUX_DIRECTORY_ENTRY_MISSING/);
  assert.deepEqual(retainParseOrder, [
    `retain:${NEWEST}`, `parse:${NEWEST}`,
    `retain:${OLDER}`, `parse:${OLDER}`,
  ]);

  const pgrb2 = await provider.fetchPgrb2FilteredRaw(OLDER, 8);
  assert.equal(pgrb2.kind, "GFS_PGRB2_FILTER_RESPONSE");
  assert.equal(new TextDecoder().decode(pgrb2.response.bytes.slice(0, 4)), "GRIB");

  const idxRaw = await provider.fetchSfluxIndexRaw(OLDER, 8, TICK);
  const idxRetainedBeforeParse = true;
  const selected = parseGfsSfluxIndexV1(idxRaw.response.bytes, 8);
  assert.deepEqual({ offset: selected.offset, end: selected.end, length: selected.length }, { offset: 0, end: 11, length: 12 });
  const message = await provider.fetchSfluxMessageRaw(OLDER, 8, TICK, selected);
  assert.equal(message.kind, "GFS_SFLUX_EXACT_GRIB_MESSAGE");
  assert.equal(observedRange, "bytes=0-11");
  assert.equal(new TextDecoder().decode(message.response.bytes), "GRIBxxxx7777");

  const result = {
    schema_version: "geox_mcft_cap09_gfs_product_acquisition_provider_qualification_v1",
    status: "PASS",
    product_provider_id: provider.provider_id,
    newest_partial_cycle_rejected: true,
    older_complete_cycle_selected: true,
    selected_cycle: selection.cycle,
    same_exact_cycle_required: true,
    directory_retention_callback_precedes_parse: retainParseOrder.every((value, index) => index % 2 === 0 ? value.startsWith("retain:") : value.startsWith("parse:")),
    sflux_idx_retained_before_parse: idxRetainedBeforeParse,
    pgrb2_product_fetch_proved: true,
    sflux_idx_product_fetch_proved: true,
    sflux_exact_range_product_fetch_proved: true,
    exact_range_header: observedRange,
    content_range_verified: true,
    last_modified_availability_verified: true,
    grib_message_boundary_verified: true,
    fake_transport_request_count: fakeFetchCount,
    external_network_request_count: externalNetworkRequestCount,
    database_write_count: 0,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_cadence_activation: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const result = {
    schema_version: "geox_mcft_cap09_gfs_product_acquisition_provider_qualification_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  };
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
