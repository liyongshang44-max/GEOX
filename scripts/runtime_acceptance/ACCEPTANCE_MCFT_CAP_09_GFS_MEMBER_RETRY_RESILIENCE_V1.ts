import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  GfsNomadsLiveProviderV1,
  MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED_CODE_V1,
  gfsPgrb2FilterUrlV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_GFS_MEMBER_RETRY_RESILIENCE_V1_RESULT.json");
const CYCLE = "2026-09-20T00:00:00Z";
const LEAD = 5;
const GRIB = new TextEncoder().encode("GRIB-member-retry");

async function main(): Promise<void> {
  let nowMs = 0;
  const cadenceWaits: number[] = [];
  const retryWaits: number[] = [];
  const requestStarts: number[] = [];
  let calls = 0;

  const fakeFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.equal(url, gfsPgrb2FilterUrlV1(CYCLE, LEAD));
    requestStarts.push(nowMs);
    calls += 1;
    if (calls <= 2) throw new TypeError("fetch failed");
    return new Response(GRIB, {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    });
  };

  const provider = new GfsNomadsLiveProviderV1({
    byte_client: new ControlledHttpsByteClientV1({
      fetch_impl: fakeFetch,
      clock: () => new Date("2026-09-20T04:00:00.000Z"),
      user_agent: "GEOX-MCFT-CAP09-GFS-MEMBER-RETRY-ACCEPTANCE/1",
      max_raw_bytes: 20_000_000,
      timeout_ms: 10_000,
    }),
    grib_filter_cadence: {
      now_ms: () => nowMs,
      async wait_ms(milliseconds) {
        cadenceWaits.push(milliseconds);
        nowMs += milliseconds;
      },
    },
    member_retry: {
      max_attempts: 3,
      retry_base_ms: 100,
      async wait_ms(milliseconds) {
        retryWaits.push(milliseconds);
        nowMs += milliseconds;
      },
    },
  });

  const recovered = await provider.fetchPgrb2FilteredRaw(CYCLE, LEAD);
  assert.equal(calls, 3);
  assert.equal(recovered.kind, "GFS_PGRB2_FILTER_RESPONSE");
  assert.deepEqual(requestStarts, [0, 10_000, 20_000], "GFS_MEMBER_RETRY_MUST_PRESERVE_10S_GRIB_FILTER_CADENCE");
  assert.deepEqual(retryWaits, [100, 200], "GFS_MEMBER_RETRY_BOUNDED_BACKOFF_REQUIRED");
  assert.deepEqual(cadenceWaits, [9_900, 9_800], "GFS_MEMBER_RETRY_CADENCE_WAIT_DRIFT");

  let exhaustedCalls = 0;
  const exhausted = new GfsNomadsLiveProviderV1({
    byte_client: new ControlledHttpsByteClientV1({
      fetch_impl: async () => {
        exhaustedCalls += 1;
        throw Object.assign(new TypeError("fetch failed"), { code: "ECONNRESET" });
      },
      user_agent: "GEOX-MCFT-CAP09-GFS-MEMBER-RETRY-ACCEPTANCE/1",
      max_raw_bytes: 20_000_000,
      timeout_ms: 10_000,
    }),
    grib_filter_cadence: {
      now_ms: () => 0,
      async wait_ms() {},
    },
    member_retry: {
      max_attempts: 3,
      retry_base_ms: 100,
      async wait_ms() {},
    },
  });

  let exhaustedError: unknown = null;
  try {
    await exhausted.fetchPgrb2FilteredRaw(CYCLE, LEAD);
  } catch (error) {
    exhaustedError = error;
  }
  assert(exhaustedError instanceof Error);
  assert.equal(exhaustedCalls, 3, "GFS_MEMBER_RETRY_EXACT_BOUNDED_ATTEMPTS_REQUIRED");
  assert.equal((exhaustedError as Error & { code?: string }).code, MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED_CODE_V1);
  assert.equal(
    (exhaustedError as Error & { diagnostic_token?: string }).diagnostic_token,
    "MCFT_CAP09_GFS_PGRB2_F005",
  );
  assert.equal(exhaustedError.message.includes("https://"), false, "GFS_MEMBER_RETRY_ERROR_MUST_NOT_LEAK_URL");

  let semanticCalls = 0;
  const semantic = new GfsNomadsLiveProviderV1({
    byte_client: new ControlledHttpsByteClientV1({
      fetch_impl: async () => {
        semanticCalls += 1;
        return new Response("missing", { status: 404, headers: { "content-type": "text/plain" } });
      },
      user_agent: "GEOX-MCFT-CAP09-GFS-MEMBER-RETRY-ACCEPTANCE/1",
      max_raw_bytes: 20_000_000,
      timeout_ms: 10_000,
    }),
    member_retry: {
      max_attempts: 3,
      retry_base_ms: 100,
      async wait_ms() {},
    },
  });
  await assert.rejects(
    () => semantic.fetchPgrb2FilteredRaw(CYCLE, LEAD),
    /MCFT_CAP09_GFS_PGRB2_F005_HTTP_STATUS:404/,
  );
  assert.equal(semanticCalls, 1, "GFS_MEMBER_RETRY_MUST_NOT_RETRY_DETERMINISTIC_HTTP_404");

  const proof = {
    schema_version: "geox_mcft_cap09_gfs_member_retry_resilience_acceptance_v1",
    status: "PASS",
    transient_member_failure_retried_in_place: true,
    successful_prior_member_work_not_restarted_by_member_retry: true,
    exact_member_attempt_bound: 3,
    grib_filter_10s_responsible_sharing_preserved: true,
    deterministic_semantic_failure_not_retried: true,
    retry_exhaustion_has_sanitized_phase_token: true,
    retry_exhaustion_url_leak: false,
    outer_attempt_budget_changed: false,
    database_access_count: 0,
    provider_external_network_request_count: 0,
    formal_v5_arm: false,
    a0_authorized: false,
    o00_authorized: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_gfs_member_retry_resilience_acceptance_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
