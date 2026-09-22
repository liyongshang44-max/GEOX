import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  GfsNomadsLiveProviderV1,
  MCFT_CAP09_GFS_MEMBER_MAX_ATTEMPTS_V1,
  MCFT_CAP09_GFS_MEMBER_MAX_TOTAL_RETRIES_V1,
  MCFT_CAP09_GFS_MEMBER_RETRY_BASE_MS_V1,
  MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED_CODE_V1,
  gfsPgrb2FilterUrlV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_GFS_MEMBER_RETRY_RESILIENCE_V1_RESULT.json");
const TIMING_AUTH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json",
);
const WORK_ITEMS = path.resolve(
  "apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.ts",
);
const CYCLE = "2026-09-20T00:00:00Z";
const GRIB = new TextEncoder().encode("GRIB-member-retry");
const PRODUCTION_GFS_HTTP_TIMEOUT_MS = 120_000;
const GFS_SUBSEQUENT_DUE_WINDOW_MS = 40 * 60_000;

async function main(): Promise<void> {
  assert.equal(MCFT_CAP09_GFS_MEMBER_MAX_ATTEMPTS_V1, 2);
  assert.equal(MCFT_CAP09_GFS_MEMBER_MAX_TOTAL_RETRIES_V1, 1);
  assert.equal(MCFT_CAP09_GFS_MEMBER_RETRY_BASE_MS_V1, 1_000);

  const workItemsSource = fs.readFileSync(WORK_ITEMS, "utf8");
  assert.match(
    workItemsSource,
    /gfs_timeout_ms \?\? 120_000/,
    "GFS_PRODUCTION_HTTP_TIMEOUT_CONTRACT_DRIFT",
  );
  const timing = JSON.parse(fs.readFileSync(TIMING_AUTH, "utf8")) as {
    timing_budget_qualified: boolean;
    timing_budget_frozen: boolean;
    qualified_budget: {
      measured_envelope_ms: number;
      selected_budget_ms: number;
      safety_margin_ms: number;
    };
  };
  assert.equal(timing.timing_budget_qualified, true);
  assert.equal(timing.timing_budget_frozen, true);
  const worstSingleRetryExtraMs =
    PRODUCTION_GFS_HTTP_TIMEOUT_MS + MCFT_CAP09_GFS_MEMBER_RETRY_BASE_MS_V1;
  assert.ok(
    worstSingleRetryExtraMs <= timing.qualified_budget.safety_margin_ms,
    "GFS_MEMBER_RETRY_MUST_FIT_FROZEN_SAFETY_MARGIN",
  );
  assert.ok(
    timing.qualified_budget.measured_envelope_ms + worstSingleRetryExtraMs
      <= timing.qualified_budget.selected_budget_ms,
    "GFS_MEMBER_RETRY_MUST_FIT_FROZEN_SELECTED_BUDGET",
  );
  assert.ok(
    timing.qualified_budget.selected_budget_ms < GFS_SUBSEQUENT_DUE_WINDOW_MS,
    "GFS_SELECTED_BUDGET_MUST_FIT_40M_SUBSEQUENT_DUE_WINDOW",
  );

  let nowMs = 0;
  const cadenceWaits: number[] = [];
  const retryWaits: number[] = [];
  const requestStarts: { lead: number; at: number }[] = [];
  const callsByLead = new Map<number, number>();

  const fakeFetch: typeof fetch = async (input) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const lead = url === gfsPgrb2FilterUrlV1(CYCLE, 5)
      ? 5
      : url === gfsPgrb2FilterUrlV1(CYCLE, 6)
        ? 6
        : -1;
    assert.notEqual(lead, -1, "GFS_MEMBER_RETRY_UNEXPECTED_URL");
    requestStarts.push({ lead, at: nowMs });
    const calls = (callsByLead.get(lead) ?? 0) + 1;
    callsByLead.set(lead, calls);

    // One transient member failure is recovered in-place.
    if (lead === 5 && calls === 1) throw new TypeError("fetch failed");
    // A second independent transient failure in the same provider/bundle may not
    // consume another local retry; it must escape to the outer fail-closed path.
    if (lead === 6) throw Object.assign(new TypeError("fetch failed"), { code: "ECONNRESET" });
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
      max_attempts: 2,
      max_total_retries: 1,
      retry_base_ms: 100,
      async wait_ms(milliseconds) {
        retryWaits.push(milliseconds);
        nowMs += milliseconds;
      },
    },
  });

  const recovered = await provider.fetchPgrb2FilteredRaw(CYCLE, 5);
  assert.equal(recovered.kind, "GFS_PGRB2_FILTER_RESPONSE");
  assert.equal(callsByLead.get(5), 2);
  assert.deepEqual(
    requestStarts.slice(0, 2),
    [{ lead: 5, at: 0 }, { lead: 5, at: 10_000 }],
    "GFS_MEMBER_RETRY_MUST_PRESERVE_10S_GRIB_FILTER_CADENCE",
  );
  assert.deepEqual(retryWaits, [100], "GFS_MEMBER_RETRY_EXACT_ONE_LOCAL_BACKOFF_REQUIRED");
  assert.deepEqual(cadenceWaits, [9_900], "GFS_MEMBER_RETRY_CADENCE_WAIT_DRIFT");

  let secondFailure: unknown = null;
  try {
    await provider.fetchPgrb2FilteredRaw(CYCLE, 6);
  } catch (error) {
    secondFailure = error;
  }
  assert(secondFailure instanceof Error);
  assert.equal(callsByLead.get(6), 1, "GFS_MEMBER_TOTAL_RETRY_BUDGET_MUST_BE_ONE");
  assert.equal(
    (secondFailure as Error & { code?: string }).code,
    MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED_CODE_V1,
  );
  assert.equal(
    (secondFailure as Error & { diagnostic_token?: string }).diagnostic_token,
    "MCFT_CAP09_GFS_PGRB2_F006",
  );
  const secondStructured = secondFailure as Error & {
    failure_stage?: string;
    failure_token?: string;
    member_kind?: string;
    lead?: number;
    local_retry_ordinal?: number;
  };
  assert.equal(secondStructured.failure_stage, "MEMBER_FETCH");
  assert.equal(secondStructured.failure_token, "MCFT_CAP09_GFS_PGRB2_F006");
  assert.equal(secondStructured.member_kind, "GFS_PGRB2_FILTER_RESPONSE");
  assert.equal(secondStructured.lead, 6);
  assert.equal(
    secondStructured.local_retry_ordinal,
    0,
    "GFS_MEMBER_RETRY_ORDINAL_ZERO_WHEN_BUNDLE_LOCAL_RETRY_BUDGET_ALREADY_CONSUMED",
  );
  assert.deepEqual(
    requestStarts,
    [
      { lead: 5, at: 0 },
      { lead: 5, at: 10_000 },
      { lead: 6, at: 20_000 },
    ],
  );
  assert.deepEqual(cadenceWaits, [9_900, 10_000]);

  let exhaustedCalls = 0;
  let exhaustedNowMs = 0;
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
      now_ms: () => exhaustedNowMs,
      async wait_ms(milliseconds) {
        exhaustedNowMs += milliseconds;
      },
    },
    member_retry: {
      max_attempts: 2,
      max_total_retries: 1,
      retry_base_ms: 100,
      async wait_ms(milliseconds) {
        exhaustedNowMs += milliseconds;
      },
    },
  });

  let exhaustedError: unknown = null;
  try {
    await exhausted.fetchPgrb2FilteredRaw(CYCLE, 5);
  } catch (error) {
    exhaustedError = error;
  }
  assert(exhaustedError instanceof Error);
  assert.equal(exhaustedCalls, 2, "GFS_MEMBER_RETRY_EXACT_BOUNDED_ATTEMPTS_REQUIRED");
  assert.equal(
    (exhaustedError as Error & { code?: string }).code,
    MCFT_CAP09_GFS_MEMBER_RETRY_EXHAUSTED_CODE_V1,
  );
  const exhaustedStructured = exhaustedError as Error & {
    diagnostic_token?: string;
    failure_stage?: string;
    failure_token?: string;
    member_kind?: string;
    lead?: number;
    local_retry_ordinal?: number;
  };
  assert.equal(
    exhaustedStructured.diagnostic_token,
    "MCFT_CAP09_GFS_PGRB2_F005",
  );
  assert.equal(exhaustedStructured.failure_stage, "MEMBER_FETCH");
  assert.equal(exhaustedStructured.failure_token, "MCFT_CAP09_GFS_PGRB2_F005");
  assert.equal(exhaustedStructured.member_kind, "GFS_PGRB2_FILTER_RESPONSE");
  assert.equal(exhaustedStructured.lead, 5);
  assert.equal(exhaustedStructured.local_retry_ordinal, 1);
  assert.equal(
    exhaustedError.message.includes("https://"),
    false,
    "GFS_MEMBER_RETRY_ERROR_MUST_NOT_LEAK_URL",
  );

  let semanticCalls = 0;
  const semantic = new GfsNomadsLiveProviderV1({
    byte_client: new ControlledHttpsByteClientV1({
      fetch_impl: async () => {
        semanticCalls += 1;
        return new Response("missing", {
          status: 404,
          headers: { "content-type": "text/plain" },
        });
      },
      user_agent: "GEOX-MCFT-CAP09-GFS-MEMBER-RETRY-ACCEPTANCE/1",
      max_raw_bytes: 20_000_000,
      timeout_ms: 10_000,
    }),
    member_retry: {
      max_attempts: 2,
      max_total_retries: 1,
      retry_base_ms: 100,
      async wait_ms() {},
    },
  });
  await assert.rejects(
    () => semantic.fetchPgrb2FilteredRaw(CYCLE, 5),
    /MCFT_CAP09_GFS_PGRB2_F005_HTTP_STATUS:404/,
  );
  assert.equal(
    semanticCalls,
    1,
    "GFS_MEMBER_RETRY_MUST_NOT_RETRY_DETERMINISTIC_HTTP_404",
  );

  const proof = {
    schema_version: "geox_mcft_cap09_gfs_member_retry_resilience_acceptance_v2",
    status: "PASS",
    transient_member_failure_retried_in_place: true,
    successful_prior_member_work_not_restarted_by_member_retry: true,
    exact_member_attempt_bound: MCFT_CAP09_GFS_MEMBER_MAX_ATTEMPTS_V1,
    exact_bundle_local_retry_budget: MCFT_CAP09_GFS_MEMBER_MAX_TOTAL_RETRIES_V1,
    second_independent_transient_failure_escapes_to_outer_fail_closed_path: true,
    production_http_timeout_ms: PRODUCTION_GFS_HTTP_TIMEOUT_MS,
    local_retry_base_ms: MCFT_CAP09_GFS_MEMBER_RETRY_BASE_MS_V1,
    worst_single_retry_extra_ms: worstSingleRetryExtraMs,
    frozen_measured_envelope_ms: timing.qualified_budget.measured_envelope_ms,
    frozen_safety_margin_ms: timing.qualified_budget.safety_margin_ms,
    frozen_selected_budget_ms: timing.qualified_budget.selected_budget_ms,
    residual_retry_margin_ms:
      timing.qualified_budget.selected_budget_ms
      - timing.qualified_budget.measured_envelope_ms
      - worstSingleRetryExtraMs,
    subsequent_due_window_ms: GFS_SUBSEQUENT_DUE_WINDOW_MS,
    grib_filter_10s_responsible_sharing_preserved: true,
    deterministic_semantic_failure_not_retried: true,
    retry_exhaustion_has_sanitized_phase_token: true,
    retry_exhaustion_has_structured_failure_stage: true,
    retry_exhaustion_has_structured_member_kind: true,
    retry_exhaustion_has_structured_lead: true,
    retry_exhaustion_has_local_retry_ordinal: true,
    retry_exhaustion_url_leak: false,
    deterministic_test_clock_progresses_during_retry_waits: true,
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
    schema_version: "geox_mcft_cap09_gfs_member_retry_resilience_acceptance_v2",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
