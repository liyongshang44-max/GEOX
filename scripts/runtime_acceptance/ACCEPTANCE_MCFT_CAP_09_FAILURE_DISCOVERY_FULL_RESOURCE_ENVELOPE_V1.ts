import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RawEvidenceRetentionPortV1 } from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  GfsNomadsLiveProviderV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  KbsRawHourlyPublicationSnapshotInspectorV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_FULL_RESOURCE_ENVELOPE_V1_RESULT.json",
);
const CORPUS = path.resolve(
  "scripts/runtime_acceptance/fixtures/mcft_cap09_failure_corpus_v1.json",
);
const GFS_ITERATIONS = 3;
const P0H_REPLAY_ITERATIONS = 100;
const MB = 1024 * 1024;

type Sample = {
  rss: number;
  heap_used: number;
  external: number;
  array_buffers: number;
  fd_count: number | null;
  temp_root_count: number;
};

type Corpus = {
  entries?: Array<{
    id?: string;
    raw_sha256?: string;
    raw_bytes?: number;
    exact_raw_preserved_external_control_tree?: boolean;
  }>;
};

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fdCount(): number | null {
  try {
    return fs.readdirSync("/proc/self/fd").length;
  } catch {
    return null;
  }
}

function tempRootCount(): number {
  return fs.readdirSync(os.tmpdir()).filter((name) =>
    name.startsWith("mcft-cap09-gfs-bundle-")
    || name.startsWith("mcft-cap09-kbs-publication-")
    || name.startsWith("mcft-cap09-kbs-raw-hourly-")
  ).length;
}

function collectGarbage(): void {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (!gc) throw new Error("FDG_FULL_RESOURCE_ENVELOPE_REQUIRES_EXPOSE_GC");
  gc();
}

function sample(): Sample {
  collectGarbage();
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heap_used: usage.heapUsed,
    external: usage.external,
    array_buffers: usage.arrayBuffers,
    fd_count: fdCount(),
    temp_root_count: tempRootCount(),
  };
}

function canonicalTarget(): string {
  const supplied = String(process.env.GEOX_MCFT_CAP09_RESOURCE_TARGET_LOGICAL_TIME ?? "").trim();
  const date = supplied
    ? new Date(supplied)
    : new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  if (
    !Number.isFinite(date.getTime())
    || date.getUTCMinutes() !== 0
    || date.getUTCSeconds() !== 0
    || date.getUTCMilliseconds() !== 0
  ) {
    throw new Error("FDG_FULL_RESOURCE_ENVELOPE_CANONICAL_GFS_TARGET_REQUIRED");
  }
  return date.toISOString();
}

function loadP0h(): {
  bytes: Buffer;
  sha256: string;
  expected_bytes: number;
} {
  const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf8")) as Corpus;
  const p0h = corpus.entries?.find((row) => row.id === "P0_H_KBS_CSV_FIELD_TOO_LARGE");
  if (!p0h) throw new Error("FDG_FULL_RESOURCE_ENVELOPE_P0H_CORPUS_ENTRY_MISSING");
  if (!p0h.raw_sha256 || !Number.isSafeInteger(p0h.raw_bytes)) {
    throw new Error("FDG_FULL_RESOURCE_ENVELOPE_P0H_CORPUS_METADATA_INVALID");
  }
  assert.equal(
    p0h.exact_raw_preserved_external_control_tree,
    true,
    "FDG_FULL_RESOURCE_ENVELOPE_P0H_CONTROLLED_PRESERVATION_REQUIRED",
  );
  const supplied = String(process.env.GEOX_MCFT_CAP09_P0H_RAW_PATH ?? "").trim();
  if (!supplied) throw new Error("GEOX_MCFT_CAP09_P0H_RAW_PATH_REQUIRED");
  const rawPath = path.resolve(supplied);
  if (!fs.existsSync(rawPath)) throw new Error("FDG_FULL_RESOURCE_ENVELOPE_CONTROLLED_P0H_RAW_NOT_FOUND");
  const bytes = fs.readFileSync(rawPath);
  const digest = sha256(bytes);
  if (bytes.byteLength !== p0h.raw_bytes) {
    throw new Error(
      `FDG_FULL_RESOURCE_ENVELOPE_P0H_BYTES_MISMATCH:${bytes.byteLength}:${p0h.raw_bytes}`,
    );
  }
  if (digest !== p0h.raw_sha256) {
    throw new Error(`FDG_FULL_RESOURCE_ENVELOPE_P0H_SHA256_MISMATCH:${digest}:${p0h.raw_sha256}`);
  }
  return {
    bytes,
    sha256: digest,
    expected_bytes: p0h.raw_bytes,
  };
}

async function replayExactP0h(input: { bytes: Buffer }): Promise<void> {
  const inspector = new KbsRawHourlyPublicationSnapshotInspectorV1();
  for (let iteration = 0; iteration < P0H_REPLAY_ITERATIONS; iteration += 1) {
    await assert.rejects(
      () => inspector.inspectSnapshot({
        raw_bytes: input.bytes,
        available_at: "2026-09-26T02:19:39.000Z",
      }),
      (error: unknown) => {
        const row = error && typeof error === "object"
          ? error as { code?: unknown; diagnostic_token?: unknown }
          : {};
        return row.code === "MCFT_CAP09_KBS_SCIENTIFIC_SUBPROCESS_FAILED"
          && row.diagnostic_token === "MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE";
      },
      `FDG_FULL_RESOURCE_ENVELOPE_P0H_DISPOSITION_DRIFT:${iteration}`,
    );
  }
}

async function oneLiveGfs(iteration: number, target: string): Promise<{
  raw_bundle_bytes: number;
  provider_request_count: number;
  raw_provider_object_count: number;
  selected_cycle: string;
}> {
  const byteClient = new ControlledHttpsByteClientV1({
    user_agent: "GEOX-MCFT-CAP09-FDG-FULL-RESOURCE-ENVELOPE/1",
    max_raw_bytes: 20_000_000,
    timeout_ms: 90_000,
  });
  const provider = new GfsNomadsLiveProviderV1({ byte_client: byteClient });
  const retention: RawEvidenceRetentionPortV1 = {
    async retainRawEvidence(input) {
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: `fdg-resource-envelope://${iteration}/${input.raw_sha256.slice(7)}`,
        retained_sha256: input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: input.retrieved_at,
        retention_verified_at: input.retrieved_at,
        externally_publishable: false,
      };
    },
  };
  const composer = new GfsNomadsRawBundleComposerV1({
    provider,
    retention,
    clock: () => new Date(),
  });
  const result = await composer.compose({
    target_logical_time: target,
    request_id_prefix: `fdg-full-resource-${iteration}`,
  });
  try {
    assert.equal(fs.existsSync(result.bundle_file_path), true);
    assert.ok(result.raw_bundle_bytes > 0, "FDG_FULL_RESOURCE_ENVELOPE_GFS_BUNDLE_EMPTY");
    assert.ok(result.provider_request_count > 0, "FDG_FULL_RESOURCE_ENVELOPE_GFS_REQUESTS_REQUIRED");
    assert.ok(result.raw_provider_object_count > 0, "FDG_FULL_RESOURCE_ENVELOPE_GFS_OBJECTS_REQUIRED");
    return {
      raw_bundle_bytes: result.raw_bundle_bytes,
      provider_request_count: result.provider_request_count,
      raw_provider_object_count: result.raw_provider_object_count,
      selected_cycle: result.selected_cycle,
    };
  } finally {
    result.cleanup();
    assert.equal(fs.existsSync(result.bundle_file_path), false);
  }
}

async function main(): Promise<void> {
  if (process.env.GEOX_MCFT_CAP09_FULL_RESOURCE_ENVELOPE_LIVE !== "1") {
    throw new Error("SET_GEOX_MCFT_CAP09_FULL_RESOURCE_ENVELOPE_LIVE_1");
  }
  const p0h = loadP0h();
  const target = canonicalTarget();
  const before = sample();
  const samples: Sample[] = [];

  await replayExactP0h({ bytes: p0h.bytes });
  await new Promise((resolve) => setTimeout(resolve, 50));
  samples.push(sample());

  const gfs: Array<Awaited<ReturnType<typeof oneLiveGfs>>> = [];
  for (let iteration = 0; iteration < GFS_ITERATIONS; iteration += 1) {
    gfs.push(await oneLiveGfs(iteration, target));
    await new Promise((resolve) => setTimeout(resolve, 50));
    samples.push(sample());
  }

  const after = sample();
  const all = [before, ...samples, after];
  const peakRss = Math.max(...all.map((row) => row.rss));
  const peakHeap = Math.max(...all.map((row) => row.heap_used));
  const peakExternal = Math.max(...all.map((row) => row.external));
  const rssDelta = after.rss - before.rss;
  const heapDelta = after.heap_used - before.heap_used;
  const externalDelta = after.external - before.external;
  const peakRssDelta = peakRss - before.rss;
  const fdDelta = before.fd_count === null || after.fd_count === null
    ? null
    : after.fd_count - before.fd_count;

  assert.equal(after.temp_root_count, before.temp_root_count, "FDG_FULL_RESOURCE_ENVELOPE_TEMP_ROOT_LEAK");
  if (fdDelta !== null) assert.ok(fdDelta <= 8, `FDG_FULL_RESOURCE_ENVELOPE_FD_GROWTH:${fdDelta}`);
  assert.ok(rssDelta <= 96 * MB, `FDG_FULL_RESOURCE_ENVELOPE_FINAL_RSS_DELTA_TOO_HIGH:${rssDelta}`);
  assert.ok(heapDelta <= 32 * MB, `FDG_FULL_RESOURCE_ENVELOPE_FINAL_HEAP_DELTA_TOO_HIGH:${heapDelta}`);
  assert.ok(externalDelta <= 64 * MB, `FDG_FULL_RESOURCE_ENVELOPE_FINAL_EXTERNAL_DELTA_TOO_HIGH:${externalDelta}`);
  assert.ok(peakRssDelta <= 192 * MB, `FDG_FULL_RESOURCE_ENVELOPE_PEAK_RSS_DELTA_TOO_HIGH:${peakRssDelta}`);

  const result = {
    schema_version: "geox_mcft_cap09_failure_discovery_full_resource_envelope_v1",
    status: "PASS",
    subject_sha: String(process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT ?? "").trim() || null,
    tier: "FULL_RUNTIME_RESOURCE_ENVELOPE",
    exact_p0h_raw: {
      materialization_class: "CONTROLLED_EXTERNAL_FIXTURE",
      sha256: p0h.sha256,
      bytes: p0h.expected_bytes,
      replay_iterations: P0H_REPLAY_ITERATIONS,
      expected_disposition: "ATTEMPT_REJECTED",
      scientific_failure_token: "MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE",
      raw_values_emitted: false,
      raw_path_emitted: false,
      host_process_exit_required: false,
      proven: true,
    },
    gfs_live: {
      target_logical_time: target,
      acquisition_iterations: GFS_ITERATIONS,
      file_backed_streaming_composer: true,
      responsible_grib_filter_cadence_preserved: true,
      runs: gfs,
      proven: true,
    },
    resources: {
      baseline: before,
      final: after,
      peak_rss_bytes: peakRss,
      peak_heap_used_bytes: peakHeap,
      peak_external_bytes: peakExternal,
      final_rss_delta_bytes: rssDelta,
      final_heap_used_delta_bytes: heapDelta,
      final_external_delta_bytes: externalDelta,
      peak_rss_delta_bytes: peakRssDelta,
      fd_delta: fdDelta,
      temp_root_leak: false,
      limits: {
        final_rss_delta_bytes: 96 * MB,
        final_heap_used_delta_bytes: 32 * MB,
        final_external_delta_bytes: 64 * MB,
        peak_rss_delta_bytes: 192 * MB,
        maximum_fd_delta: 8,
      },
    },
    full_gfs_3x_live_acquisition_proven: true,
    exact_p0h_raw_100x_replay_proven: true,
    full_resource_envelope_complete: true,
    production_database_mutation: false,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_owner_cutover: false,
    formal_v5_armed: false,
    final_r00_r23_substituted: false,
    final_24h_admitted: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    schema_version: "geox_mcft_cap09_failure_discovery_full_resource_envelope_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    full_resource_envelope_complete: false,
    raw_values_emitted: false,
    raw_path_emitted: false,
    production_database_mutation: false,
    formal_v5_armed: false,
    final_24h_admitted: false,
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
