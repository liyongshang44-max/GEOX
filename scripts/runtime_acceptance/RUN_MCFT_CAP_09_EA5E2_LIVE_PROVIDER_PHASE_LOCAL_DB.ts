import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type ExternalEvidenceDecoderInputV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  McftCap09ExternalFormalCollectorPhaseOrchestratorV1,
  type ExternalFormalCollectorSlotAuthorityV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  prefetchLiveKbsVariate25RawV1,
  type PrefetchedKbsSoilRawV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import { S3CompatiblePrivateRawEvidenceRetentionAdapterV1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";

const execFileAsync = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";
const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");
const OUTPUT_DIR = path.resolve("acceptance-output");
const PRE_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json");
const LATE_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_SAFE_PROOF.json");
const MINUTE = 60_000;
const HOUR = 3_600_000;
const PRE_OFFSET_MINUTES = -30;
const LATE_OFFSET_MINUTES = 390;
const CUTOFF_OFFSET_MINUTES = 432;
const MIN_INGRESS_MARGIN_MINUTES = 5;
const SOIL_WINDOW_MINUTES = 15;
const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 10;
const KBS_RAW_HOURLY_URL = "https://lter.kbs.msu.edu/datatables/13.csv";
const GFS_ROOT = "https://nomads.ncep.noaa.gov/";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHour(value: string, code: string): string {
  canonicalIso(value, code);
  if (!value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepUntil(value: string): Promise<void> {
  const remaining = Date.parse(value) - Date.now();
  if (remaining > 0) await sleep(remaining);
}

function assertIsolatedDatabase(urlText: string): void {
  if (process.env.MCFT_EA5E2_ISOLATED_READINESS_ACK !== "true") throw new Error("EA5E2_ISOLATED_READINESS_ACK_REQUIRED");
  const url = new URL(urlText);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("EA5E2_READINESS_DATABASE_MUST_BE_LOCALHOST");
  if (url.pathname.replace(/^\//, "") !== "ea5e2_readiness") throw new Error("EA5E2_READINESS_DATABASE_NAME_REQUIRED");
}

function assertIsolatedS3(endpoint: string): void {
  const url = new URL(endpoint);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("EA5E2_READINESS_S3_MUST_BE_LOCAL_HTTP");
}

function slotAuthority(target: string): ExternalFormalCollectorSlotAuthorityV1 {
  return {
    epoch_id: `ea5e2_live_readiness_${target.replace(/[^0-9]/g, "").toLowerCase()}`,
    slot_id: "O00",
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: target,
    pre_boundary_causal_collector_target: addMinutes(target, PRE_OFFSET_MINUTES),
    late_exact_hour_collector_scheduled: addMinutes(target, LATE_OFFSET_MINUTES),
    late_exact_hour_evidence_cutoff: addMinutes(target, CUTOFF_OFFSET_MINUTES),
  };
}

async function runPython(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(PYTHON, [PROVIDER_SCRIPT, ...args], {
    cwd: process.cwd(),
    maxBuffer: 32 * 1024 * 1024,
    timeout: 20 * 60_000,
  });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}

class PythonGfsRawBundleTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  safe_meta: Record<string, unknown> | null = null;
  constructor(private readonly target: string) {}

  async fetchRawEvidence(_: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-gfs-"));
    const bundle = path.join(temp, "gfs-raw-bundle.tar");
    const meta = path.join(temp, "gfs-safe-meta.json");
    try {
      await runPython(["fetch-gfs", "--target", this.target, "--output", bundle, "--meta", meta]);
      const safe = JSON.parse(fs.readFileSync(meta, "utf8")) as Record<string, unknown>;
      this.safe_meta = safe;
      this.provider_request_count = Number(safe.provider_request_count);
      if (!Number.isSafeInteger(this.provider_request_count) || this.provider_request_count <= 0) throw new Error("EA5E2_GFS_PROVIDER_REQUEST_COUNT_INVALID");
      const bytes = new Uint8Array(fs.readFileSync(bundle));
      const retrievedAt = canonicalIso(String(safe.retrieved_at), "EA5E2_GFS_RETRIEVED_AT_INVALID");
      return {
        status: 200,
        final_locator: GFS_ROOT,
        content_type: "application/x-tar",
        retrieved_at: retrievedAt,
        available_at: retrievedAt,
        bytes,
      };
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

class PythonGfsRawBundleDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_GFS_RAW_BUNDLE_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string) {}

  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-gfs-decode-"));
    const bundle = path.join(temp, "gfs-raw-bundle.tar");
    const output = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundle, Buffer.from(input.raw_bytes));
      await runPython([
        "decode-gfs",
        "--target", this.target,
        "--available-at", input.provenance.available_at,
        "--input", bundle,
        "--output", output,
      ]);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E2_GFS_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

class OneShotSoilTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly prefetched: PrefetchedKbsSoilRawV1) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5E2_SOIL_PREFETCH_REUSE_FORBIDDEN");
    this.used = true;
    if (request.request_id !== this.prefetched.request.request_id || request.locator !== this.prefetched.request.locator) {
      throw new Error("EA5E2_SOIL_PREFETCH_IDENTITY_MISMATCH");
    }
    return this.prefetched.response;
  }
}

class KbsRawHourlyTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  async fetchRawEvidence(_: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    this.provider_request_count += 1;
    const response = await fetch(KBS_RAW_HOURLY_URL, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.5", "User-Agent": "GEOX-MCFT-CAP09-EA5E2-LIVE/1" },
      signal: AbortSignal.timeout(90_000),
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`EA5E2_KBS_RAW_HOURLY_HTTP:${response.status}`);
    const finalUrl = new URL(response.url || KBS_RAW_HOURLY_URL);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "lter.kbs.msu.edu" || finalUrl.pathname !== "/datatables/13.csv") {
      throw new Error("EA5E2_KBS_RAW_HOURLY_IDENTITY_DRIFT");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 110_000_000) throw new Error(`EA5E2_KBS_RAW_HOURLY_BYTES:${bytes.byteLength}`);
    const retrievedAt = new Date().toISOString();
    return {
      status: response.status,
      final_locator: finalUrl.toString(),
      content_type: response.headers.get("content-type")?.trim() || "text/csv",
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      bytes,
    };
  }
}

class PythonKbsLateDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_KBS_RAW_HOURLY_EXACT_INTERVAL_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-kbs-late-"));
    const raw = path.join(temp, "kbs-raw-hourly.csv");
    const output = path.join(temp, "kbs-late-drafts.json");
    try {
      fs.writeFileSync(raw, Buffer.from(input.raw_bytes));
      await runPython([
        "decode-kbs-late",
        "--target", this.target,
        "--available-at", input.provenance.available_at,
        "--input", raw,
        "--output", output,
      ]);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E2_KBS_LATE_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

async function ensureFactsSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS facts (
    fact_id text PRIMARY KEY,
    occurred_at timestamptz NOT NULL,
    source text NOT NULL,
    record_json jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT transaction_timestamp()
  )`);
}

function writeSafe(pathName: string, value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(pathName, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

async function main(): Promise<void> {
  const mode = required("MCFT_EA5E2_LIVE_PHASE");
  if (mode !== "PRE_BOUNDARY_CAUSAL" && mode !== "LATE_EXACT_HOUR") throw new Error("MCFT_EA5E2_LIVE_PHASE_INVALID");
  const target = canonicalHour(required("MCFT_EA5E2_TARGET_T"), "EA5E2_TARGET_T_INVALID");
  const databaseUrl = required("DATABASE_URL");
  const s3Endpoint = required("MCFT_EA5E2_S3_ENDPOINT");
  assertIsolatedDatabase(databaseUrl);
  assertIsolatedS3(s3Endpoint);

  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-ea5e2-live-${mode.toLowerCase()}` });
  const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
    endpoint: s3Endpoint,
    bucket: required("MCFT_EA5E2_S3_BUCKET"),
    region: required("MCFT_EA5E2_S3_REGION"),
    access_key_id: required("MCFT_EA5E2_S3_ACCESS_KEY"),
    secret_access_key: required("MCFT_EA5E2_S3_SECRET_KEY"),
    allow_insecure_http_for_test: true,
  });
  const slot = slotAuthority(target);
  const orchestrator = new McftCap09ExternalFormalCollectorPhaseOrchestratorV1(slot);
  const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, retention);
  await ensureFactsSchema(pool);

  try {
    if (mode === "PRE_BOUNDARY_CAUSAL") {
      await sleepUntil(slot.pre_boundary_causal_collector_target);
      const phaseRequestedAt = new Date().toISOString();
      if (Date.parse(phaseRequestedAt) > Date.parse(addMinutes(target, -MIN_INGRESS_MARGIN_MINUTES))) {
        throw new Error("EA5E2_PREBOUNDARY_MINIMUM_INGRESS_MARGIN_LOST_BEFORE_GFS");
      }

      const gfsTransport = new PythonGfsRawBundleTransportV1(target);
      const gfsResults = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
        dataset_id: `mcft_cap09_ea5e2_live_gfs_${target}`,
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        request: {
          request_id: `ea5e2-live-gfs-${crypto.randomUUID()}`,
          provider_id: "NOAA_NCEP_NOMADS_GFS",
          source_family: "GFS_PGRB2_SFLUX_RAW_BUNDLE",
          locator: GFS_ROOT,
          allowed_final_hosts: ["nomads.ncep.noaa.gov"],
          use_policy_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
          requested_at: phaseRequestedAt,
          expected_content_type_prefixes: ["application/x-tar"],
          limitations: ["EA5E2_READINESS_PRIVATE_RAW_BUNDLE", "NO_FORMAL_RESOURCE_WRITE"],
        },
      }, {
        transport: gfsTransport,
        retention,
        decoder: new PythonGfsRawBundleDecoderV1(target),
      });
      if (gfsResults.length !== 2) throw new Error("EA5E2_PREBOUNDARY_GFS_PAIR_REQUIRED");

      await sleepUntil(addMinutes(target, -SOIL_FIRST_FETCH_BEFORE_T_MINUTES));
      let soilResult: (typeof gfsResults)[number] | null = null;
      let soilRequestCount = 0;
      const soilWindowStart = Date.parse(addMinutes(target, -SOIL_WINDOW_MINUTES));
      const latestIngressStartMs = Date.parse(addMinutes(target, -MIN_INGRESS_MARGIN_MINUTES));
      while (Date.now() < latestIngressStartMs) {
        const prefetched = await prefetchLiveKbsVariate25RawV1();
        soilRequestCount += 1;
        const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
          dataset_id: `mcft_cap09_ea5e2_live_soil_${target}`,
          scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
          request: prefetched.request,
        }, {
          transport: new OneShotSoilTransportV1(prefetched),
          retention,
          decoder: new KbsVariate25SoilEvidenceDecoderV1(),
        });
        if (results.length !== 1 || results[0].record.record_type !== "soil_moisture_observation_v1") throw new Error("EA5E2_PREBOUNDARY_SOIL_RESULT_REQUIRED");
        const observedAt = Date.parse(String(results[0].record.role_time.observed_at));
        if (observedAt > soilWindowStart && observedAt <= Date.parse(target)) {
          soilResult = results[0];
          break;
        }
        if (Date.now() + MINUTE >= latestIngressStartMs) break;
        await sleep(MINUTE);
      }
      if (!soilResult) throw new Error("EA5E2_PREBOUNDARY_SOIL_OBSERVATION_NOT_IN_AUTHORIZED_T_WINDOW");
      const canonicalizedAt = new Date().toISOString();
      if (Date.parse(canonicalizedAt) > latestIngressStartMs) throw new Error("EA5E2_PREBOUNDARY_MINIMUM_INGRESS_MARGIN_LOST");

      const result = await orchestrator.ingestCanonicalizedPhase({
        phase: "PRE_BOUNDARY_CAUSAL",
        requested_at: phaseRequestedAt,
        canonicalized_at: canonicalizedAt,
        provider_request_count: gfsTransport.provider_request_count + soilRequestCount,
        canonical_results: [...gfsResults, soilResult],
        ingress,
      });
      if (result.canonical_record_count !== 3 || result.canonical_fact_write_count !== 3) throw new Error("EA5E2_PREBOUNDARY_THREE_FACTS_REQUIRED");
      writeSafe(PRE_OUTPUT, {
        schema_version: "geox_mcft_cap09_ea5e2_live_provider_preboundary_safe_proof_v1",
        status: "PASS",
        target_logical_time: target,
        phase_requested_at: phaseRequestedAt,
        phase_canonicalized_at: canonicalizedAt,
        minimum_ingress_margin_minutes: MIN_INGRESS_MARGIN_MINUTES,
        provider_request_count: result.provider_request_count,
        raw_provider_object_count: Number(gfsTransport.safe_meta?.raw_provider_object_count ?? 0) + soilRequestCount,
        raw_retention_refs: result.raw_retention_refs,
        record_types: result.record_types,
        source_record_ids: result.source_record_ids,
        canonical_fact_write_count: result.canonical_fact_write_count,
        soil_observation_inside_t_minus_15_to_t: true,
        gfs_same_cycle_pair: true,
        raw_values_emitted: false,
        formal_database_write_count: 0,
        formal_r2_write_count: 0,
        formal_window_started: false,
      });
      return;
    }

    await sleepUntil(slot.late_exact_hour_collector_scheduled);
    const phaseRequestedAt = new Date().toISOString();
    const latestIngressStartMs = Date.parse(addMinutes(slot.late_exact_hour_evidence_cutoff, -MIN_INGRESS_MARGIN_MINUTES));
    if (Date.parse(phaseRequestedAt) > latestIngressStartMs) throw new Error("EA5E2_LATE_MINIMUM_INGRESS_MARGIN_LOST_BEFORE_FETCH");
    const transport = new KbsRawHourlyTransportV1();
    const lateResults = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
      dataset_id: `mcft_cap09_ea5e2_live_kbs_exact_${target}`,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: {
        request_id: `ea5e2-live-kbs-late-${crypto.randomUUID()}`,
        provider_id: "KBS_LTER",
        source_family: "RAW_HOURLY_WEATHER",
        locator: KBS_RAW_HOURLY_URL,
        allowed_final_hosts: ["lter.kbs.msu.edu"],
        use_policy_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
        requested_at: phaseRequestedAt,
        source_event_time: target,
        expected_content_type_prefixes: ["text/csv", "text/plain", "application/octet-stream"],
        limitations: ["EA5E2_READINESS_PRIVATE_RAW_HOURLY", "NO_FORMAL_RESOURCE_WRITE"],
      },
    }, {
      transport,
      retention,
      decoder: new PythonKbsLateDecoderV1(target),
    });
    const canonicalizedAt = new Date().toISOString();
    if (Date.parse(canonicalizedAt) > latestIngressStartMs) throw new Error("EA5E2_LATE_MINIMUM_INGRESS_MARGIN_LOST");
    const result = await orchestrator.ingestCanonicalizedPhase({
      phase: "LATE_EXACT_HOUR",
      requested_at: phaseRequestedAt,
      canonicalized_at: canonicalizedAt,
      provider_request_count: transport.provider_request_count,
      canonical_results: lateResults,
      ingress,
    });
    if (result.canonical_record_count !== 2 || result.canonical_fact_write_count !== 2) throw new Error("EA5E2_LATE_TWO_FACTS_REQUIRED");

    const dbSource = await new PostgresExternalFormalEvidenceSourceV1(pool).loadCandidateRecords({
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: target,
      exact_interval_availability_cutoff_time: slot.late_exact_hour_evidence_cutoff,
    });
    if (dbSource.selected_record_count !== 5 || dbSource.database_write_count !== 0 || dbSource.provider_request_count !== 0) {
      throw new Error("EA5E2_LIVE_DB_ONLY_FIVE_FAMILY_HANDOFF_REQUIRED");
    }
    const byType = new Map(dbSource.records.map((record) => [record.record_type, record]));
    const weather = byType.get("future_weather_assumption_v1");
    const futureEt0 = byType.get("future_et0_assumption_v1");
    if (!weather || !futureEt0 || weather.role_time.issued_at !== futureEt0.role_time.issued_at) throw new Error("EA5E2_LIVE_GFS_SAME_CYCLE_DB_HANDOFF_REQUIRED");

    const preCount = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    if (preCount !== 5) throw new Error(`EA5E2_LIVE_EXACT_FIVE_FACTS_REQUIRED:${preCount}`);
    writeSafe(LATE_OUTPUT, {
      schema_version: "geox_mcft_cap09_ea5e2_live_provider_two_phase_safe_proof_v1",
      status: "PASS",
      target_logical_time: target,
      phase_requested_at: phaseRequestedAt,
      phase_canonicalized_at: canonicalizedAt,
      late_exact_hour_scheduled: slot.late_exact_hour_collector_scheduled,
      late_exact_hour_cutoff: slot.late_exact_hour_evidence_cutoff,
      minimum_ingress_margin_minutes: MIN_INGRESS_MARGIN_MINUTES,
      late_provider_request_count: result.provider_request_count,
      late_raw_retention_refs: result.raw_retention_refs,
      late_record_types: result.record_types,
      late_source_record_ids: result.source_record_ids,
      late_canonical_fact_write_count: result.canonical_fact_write_count,
      database_exact_fact_count: preCount,
      db_only_selected_record_count: dbSource.selected_record_count,
      db_only_family_cardinality: dbSource.family_cardinality,
      db_only_provider_request_count: dbSource.provider_request_count,
      db_only_database_write_count: dbSource.database_write_count,
      same_gfs_cycle_future_weather_et0: true,
      exact_rain_et0_interval_t_minus_1_to_t: true,
      post_t_future_forcing_excluded: true,
      raw_values_emitted: false,
      formal_database_write_count: 0,
      formal_r2_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      formal_window_started: false,
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}:${error.message}` : String(error));
  process.exitCode = 1;
});
