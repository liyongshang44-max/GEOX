import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import type {
  RawEvidenceFileRetentionPortV1,
  RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  buildKbsRawHourlyFetchRequestV1,
  KbsRawHourlyLiveTransportV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";
import {
  KbsRawHourlyPublicationSnapshotInspectorV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";
import {
  GfsNomadsLiveProviderV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  buildGfsNomadsBundleFetchRequestV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
} from "../../apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.js";
import {
  McftCap09ProductionEvidenceFailureClassifierV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_LIVE_PROVIDER_SOAK_V1_RESULT.json",
);
const KBS_INTERVAL_MS = 15 * 60 * 1000;
const GFS_INTERVAL_MS = 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const FOUR_HOUR_END_GUARD_MS = 5_000;

type Disposition = "RETRYABLE" | "ATTEMPT_REJECTED" | "PROCESS_FATAL";
type ProviderCounters = {
  attempts: number;
  pass: number;
  retryable: number;
  attempt_rejected: number;
  process_fatal: number;
};

type Sample = {
  at: string;
  rss: number;
  heap_used: number;
  external: number;
  array_buffers: number;
  fd_count: number | null;
  temp_root_count: number;
};

type RetentionInput = Parameters<RawEvidenceRetentionPortV1["retainRawEvidence"]>[0];
type FileRetentionInput = Parameters<RawEvidenceFileRetentionPortV1["retainRawEvidenceFile"]>[0];
type RetentionReceipt = Awaited<ReturnType<RawEvidenceRetentionPortV1["retainRawEvidence"]>>;

function counters(): ProviderCounters {
  return { attempts: 0, pass: 0, retryable: 0, attempt_rejected: 0, process_fatal: 0 };
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(file, { highWaterMark: 256 * 1024 });
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return `sha256:${hash.digest("hex")}`;
}

function fdCount(): number | null {
  try {
    return fs.readdirSync("/proc/self/fd").length;
  } catch {
    return null;
  }
}

function tempRootCount(): number {
  try {
    return fs.readdirSync(os.tmpdir()).filter((name) =>
      name.startsWith("mcft-cap09-gfs-bundle-")
      || name.startsWith("mcft-cap09-gfs-product-output-")
      || name.startsWith("mcft-cap09-kbs-publication-")
      || name.startsWith("mcft-cap09-kbs-raw-hourly-")
      || name.startsWith("mcft-cap09-fdg-live-soak-retention-")
    ).length;
  } catch {
    return 0;
  }
}

function sample(): Sample {
  const usage = process.memoryUsage();
  return {
    at: new Date().toISOString(),
    rss: usage.rss,
    heap_used: usage.heapUsed,
    external: usage.external,
    array_buffers: usage.arrayBuffers,
    fd_count: fdCount(),
    temp_root_count: tempRootCount(),
  };
}

function soakHours(): number {
  const value = Number(process.env.GEOX_MCFT_CAP09_LIVE_PROVIDER_SOAK_HOURS ?? "");
  if (!Number.isFinite(value) || value < 2 || value > 4) {
    throw new Error("GEOX_MCFT_CAP09_LIVE_PROVIDER_SOAK_HOURS_MUST_BE_2_TO_4");
  }
  return value;
}

function floorUtcHour(date = new Date()): string {
  return new Date(Math.floor(date.getTime() / 3_600_000) * 3_600_000).toISOString();
}

function recordDisposition(counter: ProviderCounters, disposition: Disposition): void {
  if (disposition === "RETRYABLE") counter.retryable += 1;
  else if (disposition === "ATTEMPT_REJECTED") counter.attempt_rejected += 1;
  else counter.process_fatal += 1;
}

function sanitizedToken(error: unknown): string {
  const row = error && typeof error === "object"
    ? error as { failure_token?: unknown; diagnostic_token?: unknown; code?: unknown }
    : {};
  for (const value of [row.failure_token, row.diagnostic_token, row.code]) {
    if (typeof value === "string" && value.trim()) return value.trim().split(":", 1)[0]!.slice(0, 120);
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (message.trim().split(":", 1)[0] || "UNKNOWN").slice(0, 120);
}

class LocalPrivateRetentionV1 implements RawEvidenceRetentionPortV1, RawEvidenceFileRetentionPortV1 {
  readonly root = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-fdg-live-soak-retention-"));
  retained_object_count = 0;
  retained_bytes = 0;

  private target(rawSha256: string): string {
    const ordinal = String(this.retained_object_count).padStart(5, "0");
    return path.join(this.root, `${ordinal}-${rawSha256.slice("sha256:".length)}.raw`);
  }

  async retainRawEvidence(input: RetentionInput): Promise<RetentionReceipt> {
    assert.equal(sha256(input.bytes), input.raw_sha256, "FDG_LIVE_SOAK_RETENTION_SHA256_MISMATCH");
    assert.equal(input.bytes.byteLength, input.raw_bytes, "FDG_LIVE_SOAK_RETENTION_BYTES_MISMATCH");
    const file = this.target(input.raw_sha256);
    fs.writeFileSync(file, Buffer.from(input.bytes), { mode: 0o600 });
    this.retained_object_count += 1;
    this.retained_bytes += input.raw_bytes;
    return {
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      retention_ref: `file-private://${path.basename(this.root)}/${path.basename(file)}`,
      retained_sha256: input.raw_sha256,
      retained_bytes: input.raw_bytes,
      retained_at: input.retrieved_at,
      retention_verified_at: input.retrieved_at,
      externally_publishable: false,
    };
  }

  async retainRawEvidenceFile(input: FileRetentionInput): Promise<RetentionReceipt> {
    const stat = fs.statSync(input.file_path);
    assert.equal(stat.isFile(), true, "FDG_LIVE_SOAK_RETENTION_FILE_REQUIRED");
    assert.equal(stat.size, input.raw_bytes, "FDG_LIVE_SOAK_RETENTION_FILE_BYTES_MISMATCH");
    assert.equal(await sha256File(input.file_path), input.raw_sha256, "FDG_LIVE_SOAK_RETENTION_FILE_SHA256_MISMATCH");
    const file = this.target(input.raw_sha256);
    fs.copyFileSync(input.file_path, file);
    this.retained_object_count += 1;
    this.retained_bytes += input.raw_bytes;
    return {
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      retention_ref: `file-private://${path.basename(this.root)}/${path.basename(file)}`,
      retained_sha256: input.raw_sha256,
      retained_bytes: input.raw_bytes,
      retained_at: input.retrieved_at,
      retention_verified_at: input.retrieved_at,
      externally_publishable: false,
    };
  }

  cleanup(): void {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}

async function runKbs(input: {
  classifier: McftCap09ProductionEvidenceFailureClassifierV1;
  counter: ProviderCounters;
  events: Array<Record<string, unknown>>;
}): Promise<void> {
  input.counter.attempts += 1;
  const requestedAt = new Date().toISOString();
  const retention = new LocalPrivateRetentionV1();
  try {
    const request = buildKbsRawHourlyFetchRequestV1({
      request_id: `fdg-live-soak-kbs-${Date.now()}`,
      requested_at: requestedAt,
    });
    const transport = new KbsRawHourlyLiveTransportV1();
    const response = await transport.fetchRawEvidence(request);
    const rawSha256 = sha256(response.bytes);
    const receipt = await retention.retainRawEvidence({
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      request_id: request.request_id,
      provider_id: request.provider_id,
      source_family: request.source_family,
      source_locator: request.locator,
      final_locator: response.final_locator,
      content_type: response.content_type,
      retrieved_at: response.retrieved_at,
      available_at: response.available_at,
      source_issue_time: request.source_issue_time,
      source_event_time: request.source_event_time,
      use_policy_ref: request.use_policy_ref,
      raw_sha256: rawSha256,
      raw_bytes: response.bytes.byteLength,
      bytes: response.bytes,
    });
    assert.equal(receipt.retained_sha256, rawSha256);
    assert.equal(receipt.retained_bytes, response.bytes.byteLength);
    const inspector = new KbsRawHourlyPublicationSnapshotInspectorV1();
    const inventory = await inspector.inspectSnapshot({
      raw_bytes: response.bytes,
      available_at: response.available_at,
    });
    input.counter.pass += 1;
    input.events.push({
      at: new Date().toISOString(),
      provider: "KBS_LTER",
      status: "PASS",
      raw_bytes: response.bytes.byteLength,
      parsed_row_count: inventory.parsed_row_count,
      valid_row_count: inventory.valid_row_count,
      unique_event_time_count: inventory.unique_event_time_count,
      latest_event_time: inventory.latest_event_time,
      private_retention_before_scientific_parse: true,
      raw_values_emitted: false,
    });
  } catch (error) {
    const disposition = input.classifier.classify(error);
    recordDisposition(input.counter, disposition);
    input.events.push({
      at: new Date().toISOString(),
      provider: "KBS_LTER",
      status: disposition,
      failure_token: sanitizedToken(error),
      raw_values_emitted: false,
    });
    if (disposition === "PROCESS_FATAL") throw error;
  } finally {
    retention.cleanup();
  }
}

async function runGfs(input: {
  classifier: McftCap09ProductionEvidenceFailureClassifierV1;
  counter: ProviderCounters;
  events: Array<Record<string, unknown>>;
  ordinal: number;
}): Promise<void> {
  input.counter.attempts += 1;
  const retention = new LocalPrivateRetentionV1();
  let result: Awaited<ReturnType<GfsNomadsRawBundleComposerV1["compose"]>> | null = null;
  try {
    const byteClient = new ControlledHttpsByteClientV1({
      user_agent: "GEOX-MCFT-CAP09-FDG-LIVE-PROVIDER-SOAK/1",
      max_raw_bytes: 20_000_000,
      timeout_ms: 90_000,
    });
    const provider = new GfsNomadsLiveProviderV1({ byte_client: byteClient });
    const composer = new GfsNomadsRawBundleComposerV1({
      provider,
      retention,
      clock: () => new Date(),
    });
    const target = floorUtcHour();
    const request = buildGfsNomadsBundleFetchRequestV1({
      request_id: `fdg-live-soak-gfs-bundle-${input.ordinal}`,
      requested_at: new Date().toISOString(),
      target_logical_time: target,
    });
    result = await composer.compose({
      target_logical_time: target,
      request_id_prefix: `fdg-live-soak-gfs-members-${input.ordinal}`,
    });
    const bundleReceipt = await retention.retainRawEvidenceFile({
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      request_id: request.request_id,
      provider_id: request.provider_id,
      source_family: request.source_family,
      source_locator: request.locator,
      final_locator: request.locator,
      content_type: "application/x-tar",
      retrieved_at: result.retrieved_at,
      available_at: result.retrieved_at,
      source_issue_time: request.source_issue_time,
      source_event_time: request.source_event_time,
      use_policy_ref: request.use_policy_ref,
      raw_sha256: result.raw_bundle_sha256,
      raw_bytes: result.raw_bundle_bytes,
      file_path: result.bundle_file_path,
    });
    const decoder = new GfsRawBundleEvidenceDecoderV1(target, { normalize_et0: true });
    const drafts = await decoder.decodeRetainedEvidenceFile({
      raw_file_path: result.bundle_file_path,
      provenance: {
        request_id: request.request_id,
        provider_id: request.provider_id,
        source_family: request.source_family,
        source_locator: request.locator,
        final_locator: request.locator,
        content_type: "application/x-tar",
        source_issue_time: request.source_issue_time,
        source_event_time: request.source_event_time,
        retrieved_at: result.retrieved_at,
        available_at: result.retrieved_at,
        raw_sha256: result.raw_bundle_sha256,
        raw_bytes: result.raw_bundle_bytes,
        retention_ref: bundleReceipt.retention_ref,
        retained_at: bundleReceipt.retained_at,
        use_policy_ref: request.use_policy_ref,
      },
    });
    assert.equal(drafts.length, 2, "FDG_LIVE_SOAK_GFS_SCIENTIFIC_DRAFT_PAIR_REQUIRED");
    assert.deepEqual(
      drafts.map((draft) => draft.role),
      ["FUTURE_WEATHER_ASSUMPTION", "FUTURE_ET0_ASSUMPTION"],
      "FDG_LIVE_SOAK_GFS_SCIENTIFIC_ROLE_PAIR_REQUIRED",
    );
    assert.equal(
      retention.retained_object_count,
      result.raw_provider_object_count + 1,
      "FDG_LIVE_SOAK_GFS_ALL_RAW_AND_BUNDLE_RETENTION_REQUIRED",
    );
    input.counter.pass += 1;
    input.events.push({
      at: new Date().toISOString(),
      provider: "NOAA_NCEP_NOMADS_GFS",
      status: "PASS",
      target_logical_time: target,
      selected_cycle: result.selected_cycle,
      provider_request_count: result.provider_request_count,
      raw_provider_object_count: result.raw_provider_object_count,
      raw_bundle_bytes: result.raw_bundle_bytes,
      scientific_draft_count: drafts.length,
      private_member_retention_before_parse: true,
      private_bundle_retention_before_scientific_decode: true,
      scientific_decode_completed: true,
      raw_values_emitted: false,
    });
  } catch (error) {
    const disposition = input.classifier.classify(error);
    recordDisposition(input.counter, disposition);
    input.events.push({
      at: new Date().toISOString(),
      provider: "NOAA_NCEP_NOMADS_GFS",
      status: disposition,
      failure_token: sanitizedToken(error),
      raw_values_emitted: false,
    });
    if (disposition === "PROCESS_FATAL") throw error;
  } finally {
    result?.cleanup();
    retention.cleanup();
  }
}

async function main(): Promise<void> {
  if (process.env.GEOX_MCFT_CAP09_LIVE_PROVIDER_SOAK !== "1") {
    throw new Error("SET_GEOX_MCFT_CAP09_LIVE_PROVIDER_SOAK_1");
  }
  const requestedHours = soakHours();
  const requestedDurationMs = requestedHours * 3_600_000;
  const plannedDurationMs = requestedDurationMs >= FOUR_HOURS_MS
    ? requestedDurationMs - FOUR_HOUR_END_GUARD_MS
    : requestedDurationMs;
  const classifier = new McftCap09ProductionEvidenceFailureClassifierV1();
  const kbs = counters();
  const gfs = counters();
  const events: Array<Record<string, unknown>> = [];
  const resources: Sample[] = [sample()];
  const startWall = new Date();
  const startMono = process.hrtime.bigint();
  const endMono = startMono + BigInt(Math.ceil(plannedDurationMs * 1_000_000));
  let nextKbs = startMono;
  let nextGfs = startMono;
  let gfsOrdinal = 0;

  while (process.hrtime.bigint() < endMono) {
    const now = process.hrtime.bigint();
    if (now >= nextKbs) {
      await runKbs({ classifier, counter: kbs, events });
      nextKbs += BigInt(KBS_INTERVAL_MS) * 1_000_000n;
      resources.push(sample());
    }
    const afterKbs = process.hrtime.bigint();
    if (afterKbs >= nextGfs && afterKbs < endMono) {
      await runGfs({ classifier, counter: gfs, events, ordinal: gfsOrdinal++ });
      nextGfs += BigInt(GFS_INTERVAL_MS) * 1_000_000n;
      resources.push(sample());
    }
    const afterAttempts = process.hrtime.bigint();
    if (afterAttempts >= endMono) break;
    const nextDue = [nextKbs, nextGfs, endMono].reduce((a, b) => a < b ? a : b);
    const waitNs = nextDue > afterAttempts ? nextDue - afterAttempts : 0n;
    if (waitNs > 0n) await sleep(Number(waitNs / 1_000_000n));
  }

  const endWall = new Date();
  const endMonoObserved = process.hrtime.bigint();
  const durationHours = Number(endMonoObserved - startMono) / 3_600_000_000_000;
  resources.push(sample());

  assert.ok(durationHours >= 2, `FDG_LIVE_PROVIDER_SOAK_TOO_SHORT:${durationHours}`);
  assert.ok(durationHours <= 4, `FDG_LIVE_PROVIDER_SOAK_TOO_LONG:${durationHours}`);
  assert.equal(kbs.process_fatal, 0, "FDG_LIVE_PROVIDER_SOAK_KBS_PROCESS_FATAL");
  assert.equal(gfs.process_fatal, 0, "FDG_LIVE_PROVIDER_SOAK_GFS_PROCESS_FATAL");
  assert.ok(kbs.attempts >= 8, `FDG_LIVE_PROVIDER_SOAK_KBS_ATTEMPTS_TOO_LOW:${kbs.attempts}`);
  assert.ok(gfs.attempts >= 2, `FDG_LIVE_PROVIDER_SOAK_GFS_ATTEMPTS_TOO_LOW:${gfs.attempts}`);
  assert.ok(kbs.pass > 0, "FDG_LIVE_PROVIDER_SOAK_KBS_SUCCESS_REQUIRED");
  assert.ok(gfs.pass > 0, "FDG_LIVE_PROVIDER_SOAK_GFS_SUCCESS_REQUIRED");
  assert.equal(
    resources.at(-1)?.temp_root_count,
    resources[0]?.temp_root_count,
    "FDG_LIVE_PROVIDER_SOAK_TEMP_ROOT_LEAK",
  );

  const result = {
    schema_version: "geox_mcft_cap09_failure_discovery_live_provider_soak_v1",
    status: "PASS",
    subject_sha: String(process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT ?? "").trim() || null,
    run_class: "RUNTIME_ONLY_LIVE_PROVIDER_SOAK",
    requested_duration_hours: requestedHours,
    duration_hours: Number(durationHours.toFixed(6)),
    started_at: startWall.toISOString(),
    completed_at: endWall.toISOString(),
    monotonic_elapsed_proven: true,
    providers: { kbs, gfs },
    event_count: events.length,
    events,
    resource_sample_count: resources.length,
    peak_rss_bytes: Math.max(...resources.map((row) => row.rss)),
    peak_heap_used_bytes: Math.max(...resources.map((row) => row.heap_used)),
    peak_external_bytes: Math.max(...resources.map((row) => row.external)),
    temp_root_leak: false,
    kbs_private_retention_before_scientific_parse: true,
    gfs_private_retention_before_scientific_decode: true,
    gfs_scientific_decode_in_live_soak: true,
    no_process_fatal: true,
    no_unexpected_process_exit: true,
    raw_values_emitted: false,
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
    schema_version: "geox_mcft_cap09_failure_discovery_live_provider_soak_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    raw_values_emitted: false,
    production_database_mutation: false,
    formal_v5_armed: false,
    final_24h_admitted: false,
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
