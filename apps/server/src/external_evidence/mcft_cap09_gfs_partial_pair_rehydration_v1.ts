// MCFT-CAP-09 production GFS partial-pair retained-raw rehydration adapter.
// Exact durable partial progress -> exact fact provenance -> private retained raw ->
// one normal EvidenceRuntimeCycle work item. No provider refetch, raw rewrite,
// RuntimeTickCursor access, Twin mutation, timer, environment, or process activation.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
} from "../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type { ExternalEvidenceDecoderPortV1 } from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  EvidenceRuntimeScopeV1,
  EvidenceSupplyCursorSnapshotV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import type { EvidenceRuntimeCycleWorkItemV1 } from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import type { GfsCyclePairProgressV1 } from "./mcft_cap09_evidence_source_progress_v1.js";
import {
  ExistingRetainedRawVerificationBarrierV1,
  VerifiedRetainedRawReadbackTransportV1,
  buildVerifiedRetainedRawReplayRequestV1,
} from "./verified_retained_raw_replay_v1.js";
import type {
  PrivateRetainedRawReadInputV1,
  PrivateRetainedRawReadReceiptV1,
} from "./s3_compatible_private_retained_raw_reader_v1.js";
import {
  MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1,
  MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
  MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
} from "./provider/gfs_nomads_bundle_transport_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
  MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1,
  MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1,
  type GfsRawBundleEvidenceDecoderConfigV1,
} from "./provider/gfs_raw_bundle_evidence_decoder_v1.js";
import type {
  ExternalEvidenceFactReplayProvenanceReadPortV1,
} from "../persistence/external_evidence/postgres_external_evidence_fact_replay_provenance_v1.js";

export const MCFT_CAP09_GFS_PARTIAL_PAIR_REHYDRATION_ADAPTER_ID_V1 =
  "MCFT_CAP09_GFS_PARTIAL_PAIR_REHYDRATION_ADAPTER_V1" as const;
export const MCFT_CAP09_GFS_PRODUCTION_DATASET_ID_V1 =
  "noaa_ncep_gfs_same_cycle_72h_bundle_v1" as const;

export interface PrivateRetainedRawReadPortV1 {
  readRetainedRawEvidence(input: PrivateRetainedRawReadInputV1): Promise<PrivateRetainedRawReadReceiptV1>;
}

export type GfsPartialPairDecoderFactoryV1 = (input: {
  target_logical_time: string;
  restored_ingested_at: string;
}) => ExternalEvidenceDecoderPortV1;

export type GfsPartialPairRehydrationBuildV1 = {
  adapter_id: typeof MCFT_CAP09_GFS_PARTIAL_PAIR_REHYDRATION_ADAPTER_ID_V1;
  cycle_key: string;
  cycle_issued_at: string;
  target_logical_time: string;
  available_role: "WEATHER" | "FUTURE_ET0";
  missing_role: "WEATHER" | "FUTURE_ET0";
  source_fact_id: string;
  source_record_semantic_sha256: string;
  work_item: EvidenceRuntimeCycleWorkItemV1;
  exact_fact_read_count: 1;
  private_retained_raw_read_count: 1;
  provider_request_count: 0;
  raw_store_write_count: 0;
  cursor_mutation_count: 0;
  runtime_tick_cursor_access_count: 0;
};

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const t = Date.parse(text);
  if (!Number.isFinite(t) || new Date(t).toISOString() !== text) throw new Error(code);
  return text;
}
function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function prefixV1(value: unknown): string {
  const text = textV1(value, "GFS_PARTIAL_REHYDRATION_WORK_ITEM_PREFIX_REQUIRED");
  if (!/^[0-9A-Za-z_.:-]+$/.test(text)) throw new Error("GFS_PARTIAL_REHYDRATION_WORK_ITEM_PREFIX_INVALID");
  return text;
}
function selectPartialV1(partial: GfsCyclePairProgressV1): {
  available_role: "WEATHER" | "FUTURE_ET0";
  missing_role: "WEATHER" | "FUTURE_ET0";
  cursor: EvidenceSupplyCursorSnapshotV1;
} {
  if (partial.state !== "PARTIAL" || partial.paired_valid_from !== null) {
    throw new Error("GFS_PARTIAL_REHYDRATION_PARTIAL_STATE_REQUIRED");
  }
  if ((partial.weather !== null) === (partial.future_et0 !== null)) {
    throw new Error("GFS_PARTIAL_REHYDRATION_EXACT_ONE_AVAILABLE_ROLE_REQUIRED");
  }
  return partial.weather
    ? { available_role: "WEATHER", missing_role: "FUTURE_ET0", cursor: partial.weather }
    : { available_role: "FUTURE_ET0", missing_role: "WEATHER", cursor: partial.future_et0! };
}
function bindingV1(role: "WEATHER" | "FUTURE_ET0"): string {
  return role === "WEATHER"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
}
function recordTypeV1(role: "WEATHER" | "FUTURE_ET0"): string {
  return role === "WEATHER" ? "future_weather_assumption_v1" : "future_et0_assumption_v1";
}
function originV1(cycleKey: string, role: "WEATHER" | "FUTURE_ET0"): string {
  return role === "WEATHER"
    ? "gfs_" + cycleKey + "_pgrb2_0p25_kbs"
    : "gfs_" + cycleKey + "_asce_short_reference_et0_kbs";
}

export class GfsPartialPairRehydrationWorkItemFactoryV1 {
  readonly adapter_id = MCFT_CAP09_GFS_PARTIAL_PAIR_REHYDRATION_ADAPTER_ID_V1;
  private readonly decoderFactory: GfsPartialPairDecoderFactoryV1;

  constructor(private readonly deps: {
    fact_replay: ExternalEvidenceFactReplayProvenanceReadPortV1;
    raw_reader: PrivateRetainedRawReadPortV1;
    decoder_factory?: GfsPartialPairDecoderFactoryV1;
    decoder_config?: Omit<GfsRawBundleEvidenceDecoderConfigV1, "restored_ingested_at">;
  }) {
    this.decoderFactory = deps.decoder_factory ?? ((input) =>
      new GfsRawBundleEvidenceDecoderV1(input.target_logical_time, {
        ...deps.decoder_config,
        restored_ingested_at: input.restored_ingested_at,
      }));
  }

  async buildWorkItem(input: {
    scope: EvidenceRuntimeScopeV1;
    partial: GfsCyclePairProgressV1;
    target_logical_time: string;
    work_item_id_prefix: string;
  }): Promise<GfsPartialPairRehydrationBuildV1> {
    const target = hourV1(input.target_logical_time, "GFS_PARTIAL_REHYDRATION_TARGET_INVALID");
    const cycleIssuedAt = hourV1(input.partial.cycle_issued_at, "GFS_PARTIAL_REHYDRATION_CYCLE_ISSUED_AT_INVALID");
    const cycleKey = textV1(input.partial.cycle_key, "GFS_PARTIAL_REHYDRATION_CYCLE_KEY_REQUIRED");
    if (!/^\d{8}t\d{6}z$/.test(cycleKey)) throw new Error("GFS_PARTIAL_REHYDRATION_CYCLE_KEY_INVALID");

    const selected = selectPartialV1(input.partial);
    const expectedBinding = bindingV1(selected.available_role);
    const expectedOrigin = originV1(cycleKey, selected.available_role);
    if (selected.cursor.binding_id !== expectedBinding) throw new Error("GFS_PARTIAL_REHYDRATION_BINDING_MISMATCH");
    if (selected.cursor.origin_source_id !== expectedOrigin) throw new Error("GFS_PARTIAL_REHYDRATION_ORIGIN_MISMATCH");
    if (selected.cursor.role_time.issued_at !== cycleIssuedAt) throw new Error("GFS_PARTIAL_REHYDRATION_CURSOR_ISSUED_AT_MISMATCH");
    if (selected.cursor.role_time.valid_from !== target) throw new Error("GFS_PARTIAL_REHYDRATION_CURSOR_TARGET_MISMATCH");

    const replay = await this.deps.fact_replay.readReplayProvenance({
      scope: input.scope,
      fact_id: textV1(selected.cursor.fact_id, "GFS_PARTIAL_REHYDRATION_FACT_ID_REQUIRED"),
      record_semantic_sha256: textV1(selected.cursor.record_semantic_sha256, "GFS_PARTIAL_REHYDRATION_SEMANTIC_REQUIRED"),
      record_type: recordTypeV1(selected.available_role),
      binding_id: expectedBinding,
      origin_source_id: expectedOrigin,
      source_record_id: textV1(selected.cursor.latest_source_record_id, "GFS_PARTIAL_REHYDRATION_SOURCE_RECORD_ID_REQUIRED"),
    });

    if (replay.dataset_id !== MCFT_CAP09_GFS_PRODUCTION_DATASET_ID_V1) throw new Error("GFS_PARTIAL_REHYDRATION_DATASET_MISMATCH");
    if (
      replay.decoder.decoder_id !== MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1
      || replay.decoder.decoder_version !== MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1
    ) throw new Error("GFS_PARTIAL_REHYDRATION_DECODER_PROVENANCE_MISMATCH");

    const raw = replay.raw_provenance;
    if (
      raw.provider_id !== MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1
      || raw.source_family !== MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1
      || raw.source_locator !== MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1
      || raw.final_locator !== MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1
      || raw.content_type !== "application/x-tar"
      || raw.source_event_time !== target
    ) throw new Error("GFS_PARTIAL_REHYDRATION_RAW_PROVENANCE_MISMATCH");

    const read = await this.deps.raw_reader.readRetainedRawEvidence({
      retention_ref: raw.retention_ref,
      retained_sha256: raw.raw_sha256,
      retained_bytes: raw.raw_bytes,
    });
    const decoder = this.decoderFactory({
      target_logical_time: target,
      restored_ingested_at: replay.restored_ingested_at,
    });
    if (
      decoder.decoder_id !== MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1
      || decoder.decoder_version !== MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1
    ) throw new Error("GFS_PARTIAL_REHYDRATION_DECODER_FACTORY_MISMATCH");

    const transport = new VerifiedRetainedRawReadbackTransportV1(raw, read);
    const retention = new ExistingRetainedRawVerificationBarrierV1(raw, read);
    const request = buildVerifiedRetainedRawReplayRequestV1(raw, {
      purpose_limitations: ["GFS_PARTIAL_PAIR_REHYDRATION", "RESTORE_EXACT_CANONICAL_GFS_PAIR"],
    });
    return {
      adapter_id: this.adapter_id,
      cycle_key: cycleKey,
      cycle_issued_at: cycleIssuedAt,
      target_logical_time: target,
      available_role: selected.available_role,
      missing_role: selected.missing_role,
      source_fact_id: replay.fact_id,
      source_record_semantic_sha256: replay.record_semantic_sha256,
      work_item: {
        work_item_id: prefixV1(input.work_item_id_prefix) + ":gfs-partial-rehydrate:" + cycleKey,
        dataset_id: replay.dataset_id,
        request,
        transport,
        decoder,
        retention,
      },
      exact_fact_read_count: 1,
      private_retained_raw_read_count: 1,
      provider_request_count: 0,
      raw_store_write_count: 0,
      cursor_mutation_count: 0,
      runtime_tick_cursor_access_count: 0,
    };
  }
}
