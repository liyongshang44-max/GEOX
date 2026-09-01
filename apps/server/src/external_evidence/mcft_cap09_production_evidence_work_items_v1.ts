// MCFT-CAP-09 Phase 3 production Evidence work-item factory.
// Builds product soil / historical weather / GFS future-Evidence work for an explicitly supplied target.
// Boundary: no target selection, cadence, environment, process lifecycle, DB write, Twin state, or RuntimeTickCursor.

import type {
  RawEvidenceRetentionPortV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  EvidenceRuntimeCycleWorkItemV1,
} from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  ControlledHttpsByteClientV1,
} from "./provider/https_external_evidence_transport_v1.js";
import {
  buildKbsVariate25SoilFetchRequestV1,
  createKbsVariate25SoilTransportV1,
  KbsVariate25SoilEvidenceDecoderV1,
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
} from "./provider/kbs_variate25_soil_provider_v1.js";
import {
  buildKbsRawHourlyFetchRequestV1,
  KbsRawHourlyExactIntervalDecoderV1,
  KbsRawHourlyLiveTransportV1,
  KbsRawHourlyMultiIntervalDecoderV1,
} from "./provider/kbs_raw_hourly_live_provider_v1.js";
import {
  GfsNomadsLiveProviderV1,
} from "./provider/gfs_nomads_live_provider_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "./provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  buildGfsNomadsBundleFetchRequestV1,
  GfsNomadsBundleTransportV1,
} from "./provider/gfs_nomads_bundle_transport_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
} from "./provider/gfs_raw_bundle_evidence_decoder_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_WORK_ITEM_FACTORY_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_WORK_ITEM_FACTORY_V1" as const;

function canonicalHourV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return value;
}

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requestPrefixV1(value: string): string {
  const text = value.trim();
  if (!text) throw new Error("PHASE3_EVIDENCE_WORK_REQUEST_PREFIX_REQUIRED");
  if (!/^[0-9A-Za-z_.:-]+$/.test(text)) throw new Error("PHASE3_EVIDENCE_WORK_REQUEST_PREFIX_INVALID");
  return text;
}

export type ProductionEvidenceSourceFamilyV1 =
  | "KBS_SOIL"
  | "KBS_RAW_HOURLY"
  | "GFS_BUNDLE";

const ALL_PRODUCTION_EVIDENCE_SOURCE_FAMILIES_V1:
  readonly ProductionEvidenceSourceFamilyV1[] = [
    "KBS_SOIL",
    "KBS_RAW_HOURLY",
    "GFS_BUNDLE",
  ];

function normalizeSourceFamiliesV1(
  value: readonly ProductionEvidenceSourceFamilyV1[] | undefined,
): readonly ProductionEvidenceSourceFamilyV1[] {
  const families = value ?? ALL_PRODUCTION_EVIDENCE_SOURCE_FAMILIES_V1;
  if (!Array.isArray(families) || families.length === 0) {
    throw new Error("PHASE3_EVIDENCE_WORK_SOURCE_FAMILIES_REQUIRED");
  }
  const seen = new Set<string>();
  for (const family of families) {
    if (!ALL_PRODUCTION_EVIDENCE_SOURCE_FAMILIES_V1.includes(family)) {
      throw new Error("PHASE3_EVIDENCE_WORK_SOURCE_FAMILY_INVALID:" + String(family));
    }
    if (seen.has(family)) {
      throw new Error("PHASE3_EVIDENCE_WORK_SOURCE_FAMILY_DUPLICATE:" + family);
    }
    seen.add(family);
  }
  return ALL_PRODUCTION_EVIDENCE_SOURCE_FAMILIES_V1.filter((family) =>
    seen.has(family)
  );
}

export type ProductionEvidenceWorkItemFactoryConfigV1 = {
  retention: RawEvidenceRetentionPortV1;
  fetch_impl?: typeof fetch;
  clock?: () => Date;
  python_executable?: string;
  gfs_product_decoder_path?: string;
  gfs_byte_client_max_bytes?: number;
  gfs_timeout_ms?: number;
};

export class ProductionEvidenceWorkItemFactoryV1 {
  readonly factory_id = MCFT_CAP09_PRODUCTION_EVIDENCE_WORK_ITEM_FACTORY_ID_V1;
  private readonly clock: () => Date;

  constructor(private readonly config: ProductionEvidenceWorkItemFactoryConfigV1) {
    this.clock = config.clock ?? (() => new Date());
  }

  buildForTarget(input: {
    target_logical_time: string;
    requested_at: string;
    request_id_prefix: string;
    source_families?: readonly ProductionEvidenceSourceFamilyV1[];
    restored_ingested_at?: string;
  }): readonly EvidenceRuntimeCycleWorkItemV1[] {
    const target = canonicalHourV1(input.target_logical_time, "PHASE3_EVIDENCE_WORK_TARGET_INVALID");
    const requestedAt = canonicalIsoV1(input.requested_at, "PHASE3_EVIDENCE_WORK_REQUESTED_AT_INVALID");
    const prefix = requestPrefixV1(input.request_id_prefix);

    const sourceFamilies = normalizeSourceFamiliesV1(input.source_families);

    const soilRequest = buildKbsVariate25SoilFetchRequestV1({
      request_id: `${prefix}:soil`,
      requested_at: requestedAt,
    });
    const soil: EvidenceRuntimeCycleWorkItemV1 = {
      work_item_id: `${prefix}:soil`,
      dataset_id: MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
      request: soilRequest,
      transport: createKbsVariate25SoilTransportV1({
        fetch_impl: this.config.fetch_impl,
        clock: this.clock,
      }),
      decoder: new KbsVariate25SoilEvidenceDecoderV1(),
    };

    const rawHourlyRequest = buildKbsRawHourlyFetchRequestV1({
      request_id: `${prefix}:kbs-raw-hourly`,
      requested_at: requestedAt,
      source_event_time: target,
    });
    const rawHourly: EvidenceRuntimeCycleWorkItemV1 = {
      work_item_id: `${prefix}:kbs-raw-hourly`,
      dataset_id: "kbs_lter_raw_hourly_exact_interval_v1",
      request: rawHourlyRequest,
      transport: new KbsRawHourlyLiveTransportV1({
        fetch_impl: this.config.fetch_impl,
        clock: this.clock,
      }),
      decoder: new KbsRawHourlyExactIntervalDecoderV1(target, {
        python_executable: this.config.python_executable,
        clock: this.clock,
      }),
    };

    const byteClient = new ControlledHttpsByteClientV1({
      fetch_impl: this.config.fetch_impl,
      clock: this.clock,
      user_agent: "GEOX-MCFT-CAP09-PHASE3-EVIDENCE-RUNTIME/1",
      max_raw_bytes: this.config.gfs_byte_client_max_bytes ?? 250_000_000,
      timeout_ms: this.config.gfs_timeout_ms ?? 120_000,
    });
    const gfsProvider = new GfsNomadsLiveProviderV1({ byte_client: byteClient });
    const gfsComposer = new GfsNomadsRawBundleComposerV1({
      provider: gfsProvider,
      retention: this.config.retention,
      clock: this.clock,
    });
    const gfsRequest = buildGfsNomadsBundleFetchRequestV1({
      request_id: `${prefix}:gfs-bundle`,
      requested_at: requestedAt,
      target_logical_time: target,
    });
    const gfs: EvidenceRuntimeCycleWorkItemV1 = {
      work_item_id: `${prefix}:gfs-bundle`,
      dataset_id: "noaa_ncep_gfs_same_cycle_72h_bundle_v1",
      request: gfsRequest,
      transport: new GfsNomadsBundleTransportV1(
        gfsComposer,
        target,
        `${prefix}:gfs-members`,
      ),
      decoder: new GfsRawBundleEvidenceDecoderV1(target, {
        python_executable: this.config.python_executable,
        product_decoder_path: this.config.gfs_product_decoder_path,
        normalize_et0: true,
        restored_ingested_at: input.restored_ingested_at,
      }),
    };

    const byFamily: Readonly<Record<
      ProductionEvidenceSourceFamilyV1,
      EvidenceRuntimeCycleWorkItemV1
    >> = {
      KBS_SOIL: soil,
      KBS_RAW_HOURLY: rawHourly,
      GFS_BUNDLE: gfs,
    };
    return sourceFamilies.map((family) => byFamily[family]);
  }

  buildKbsRawHourlyBatch(input: {
    target_logical_times: readonly string[];
    requested_at: string;
    request_id_prefix: string;
  }): EvidenceRuntimeCycleWorkItemV1 {
    const requestedAt = canonicalIsoV1(
      input.requested_at,
      "PHASE3_EVIDENCE_KBS_BATCH_REQUESTED_AT_INVALID",
    );
    const prefix = requestPrefixV1(input.request_id_prefix);
    const decoder = new KbsRawHourlyMultiIntervalDecoderV1(
      input.target_logical_times,
      {
        python_executable: this.config.python_executable,
        clock: this.clock,
      },
    );
    const request = buildKbsRawHourlyFetchRequestV1({
      request_id: `${prefix}:kbs-raw-hourly-batch`,
      requested_at: requestedAt,
    });
    return {
      work_item_id: `${prefix}:kbs-raw-hourly-batch`,
      dataset_id: "kbs_lter_raw_hourly_multi_interval_batch_v1",
      request,
      transport: new KbsRawHourlyLiveTransportV1({
        fetch_impl: this.config.fetch_impl,
        clock: this.clock,
      }),
      decoder,
    };
  }
}
