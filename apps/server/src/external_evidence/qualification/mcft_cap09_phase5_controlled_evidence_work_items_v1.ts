// MCFT-CAP-09 Phase 5 qualification-only controlled Evidence provider boundary.
// Replaces raw acquisition only. Product decoders, GFS raw-bundle composition, raw-retention-first
// ordering, canonical Evidence persistence, visibility, cursor, and Twin semantics remain product-owned.

import { createHash } from "node:crypto";

import type {
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
  RawEvidenceRetentionPortV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  EvidenceRuntimeAcquisitionTargetV1,
  EvidenceRuntimeWorkItemFactoryV1,
} from "../mcft_cap09_evidence_runtime_composition_v1.js";
import type {
  EvidenceRuntimeCycleWorkItemV1,
} from "../mcft_cap09_evidence_runtime_cycle_service_v1.js";
import type {
  ProductionEvidenceSourceFamilyV1,
} from "../mcft_cap09_production_evidence_work_items_v1.js";
import {
  buildKbsVariate25SoilFetchRequestV1,
  KbsVariate25SoilEvidenceDecoderV1,
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
} from "../provider/kbs_variate25_soil_provider_v1.js";
import {
  buildKbsRawHourlyFetchRequestV1,
  KbsRawHourlyExactIntervalDecoderV1,
} from "../provider/kbs_raw_hourly_live_provider_v1.js";
import {
  MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
  gfsDirectoryUrlV1,
  gfsLeadWindowV1,
  gfsPgrb2FilterUrlV1,
  gfsSfluxUrlsV1,
  validateCompleteGfsCycleInventoryV1,
  type GfsCycleSelectionV1,
  type GfsDirectoryInventoryV1,
  type GfsNomadsRawObjectV1,
  type GfsSfluxIndexSelectionV1,
} from "../provider/gfs_nomads_live_provider_v1.js";
import {
  GfsNomadsRawBundleComposerV1,
} from "../provider/gfs_nomads_raw_bundle_composer_v1.js";
import {
  buildGfsNomadsBundleFetchRequestV1,
  GfsNomadsBundleTransportV1,
} from "../provider/gfs_nomads_bundle_transport_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
} from "../provider/gfs_raw_bundle_evidence_decoder_v1.js";
import type {
  ControlledHttpsByteResponseV1,
} from "../provider/https_external_evidence_transport_v1.js";

export const MCFT_CAP09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEM_FACTORY_ID_V1 =
  "MCFT_CAP09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEM_FACTORY_V1" as const;

export type Phase5ControlledRawFixtureRequestV1 =
  | { kind: "KBS_SOIL"; target_logical_time: string; request: ExternalEvidenceFetchRequestV1 }
  | { kind: "KBS_RAW_HOURLY"; target_logical_time: string; request: ExternalEvidenceFetchRequestV1 }
  | { kind: "GFS_DIRECTORY"; target_logical_time: string; cycle: string; locator: string }
  | { kind: "GFS_PGRB2"; target_logical_time: string; cycle: string; lead: number; locator: string }
  | { kind: "GFS_SFLUX_INDEX"; target_logical_time: string; cycle: string; lead: number; locator: string }
  | {
      kind: "GFS_SFLUX_MESSAGE";
      target_logical_time: string;
      cycle: string;
      lead: number;
      locator: string;
      selected: GfsSfluxIndexSelectionV1;
    };

export type Phase5ControlledRawFixtureResponseV1 = {
  status: number;
  content_type: string;
  retrieved_at: string;
  available_at: string;
  response_headers?: Readonly<Record<string, string>>;
  bytes: Uint8Array;
};

export interface Phase5ControlledEvidenceFixturePortV1 {
  selectGfsCycle(input: { target_logical_time: string }): string | Promise<string>;
  loadRaw(
    input: Phase5ControlledRawFixtureRequestV1,
  ): Phase5ControlledRawFixtureResponseV1 | Promise<Phase5ControlledRawFixtureResponseV1>;
}

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV1(value: string, code: string): string {
  const canonical = canonicalIsoV1(value, code);
  if (!canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}

function requestPrefixV1(value: string): string {
  const prefix = value.trim();
  if (!prefix) throw new Error("PHASE5_CONTROLLED_PROVIDER_REQUEST_PREFIX_REQUIRED");
  if (!/^[0-9A-Za-z_.:-]+$/.test(prefix)) throw new Error("PHASE5_CONTROLLED_PROVIDER_REQUEST_PREFIX_INVALID");
  return prefix;
}

function sha256V1(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixtureResponseV1(
  response: Phase5ControlledRawFixtureResponseV1,
  finalLocator: string,
  targetLogicalTime: string,
  code: string,
): ExternalEvidenceFetchResponseV1 {
  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
    throw new Error(`${code}_STATUS_INVALID`);
  }
  if (!(response.bytes instanceof Uint8Array) || response.bytes.byteLength <= 0) {
    throw new Error(`${code}_BYTES_REQUIRED`);
  }
  const retrievedAt = canonicalIsoV1(response.retrieved_at, `${code}_RETRIEVED_AT_INVALID`);
  const availableAt = canonicalIsoV1(response.available_at, `${code}_AVAILABLE_AT_INVALID`);
  if (Date.parse(availableAt) > Date.parse(retrievedAt)) throw new Error(`${code}_AVAILABLE_AFTER_RETRIEVAL`);
  if (Date.parse(retrievedAt) > Date.parse(targetLogicalTime)) throw new Error(`${code}_RETRIEVED_AFTER_TARGET`);
  if (!response.content_type.trim()) throw new Error(`${code}_CONTENT_TYPE_REQUIRED`);
  return {
    status: response.status,
    final_locator: finalLocator,
    content_type: response.content_type,
    retrieved_at: retrievedAt,
    available_at: availableAt,
    bytes: response.bytes,
  };
}

class Phase5ControlledFixtureTransportV1 implements ExternalEvidenceTransportPortV1 {
  constructor(
    private readonly fixture: Phase5ControlledEvidenceFixturePortV1,
    private readonly targetLogicalTime: string,
    private readonly fixtureKind: "KBS_SOIL" | "KBS_RAW_HOURLY",
    private readonly expected: Pick<ExternalEvidenceFetchRequestV1, "provider_id" | "source_family" | "locator">,
  ) {}

  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (request.provider_id !== this.expected.provider_id) throw new Error("PHASE5_CONTROLLED_PROVIDER_ID_MISMATCH");
    if (request.source_family !== this.expected.source_family) throw new Error("PHASE5_CONTROLLED_SOURCE_FAMILY_MISMATCH");
    if (request.locator !== this.expected.locator) throw new Error("PHASE5_CONTROLLED_LOCATOR_MISMATCH");
    const response = await this.fixture.loadRaw({
      kind: this.fixtureKind,
      target_logical_time: this.targetLogicalTime,
      request,
    });
    return fixtureResponseV1(
      response,
      request.locator,
      this.targetLogicalTime,
      `PHASE5_CONTROLLED_${this.fixtureKind}`,
    );
  }
}

class Phase5ControlledGfsProviderV1 {
  readonly provider_id = MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1;

  constructor(
    private readonly fixture: Phase5ControlledEvidenceFixturePortV1,
    private readonly targetLogicalTime: string,
  ) {}

  private async rawObjectV1(
    kind: GfsNomadsRawObjectV1["kind"],
    identity: string,
    locator: string,
    fixtureRequest: Phase5ControlledRawFixtureRequestV1,
    code: string,
  ): Promise<GfsNomadsRawObjectV1> {
    const source = await this.fixture.loadRaw(fixtureRequest);
    const common = fixtureResponseV1(source, locator, this.targetLogicalTime, code);
    const response: ControlledHttpsByteResponseV1 = {
      status: common.status,
      final_locator: common.final_locator,
      content_type: common.content_type,
      response_headers: Object.freeze({ ...(source.response_headers ?? {}) }),
      retrieved_at: common.retrieved_at,
      bytes: common.bytes,
    };
    return { kind, identity, response, sha256: sha256V1(response.bytes) };
  }

  async selectLatestCompleteCycle(
    tick: Date | string,
    retainThenParse: (raw: GfsNomadsRawObjectV1) => Promise<GfsDirectoryInventoryV1>,
  ): Promise<GfsCycleSelectionV1> {
    const target = canonicalHourV1(
      new Date(tick).toISOString(),
      "PHASE5_CONTROLLED_GFS_TARGET_INVALID",
    );
    if (target !== this.targetLogicalTime) throw new Error("PHASE5_CONTROLLED_GFS_TARGET_MISMATCH");
    const cycle = await this.fixture.selectGfsCycle({ target_logical_time: target });
    const window = gfsLeadWindowV1(target, cycle);
    const locator = gfsDirectoryUrlV1(window.cycle);
    const raw = await this.rawObjectV1(
      "GFS_DIRECTORY_LISTING",
      window.cycle,
      locator,
      { kind: "GFS_DIRECTORY", target_logical_time: target, cycle: window.cycle, locator },
      "PHASE5_CONTROLLED_GFS_DIRECTORY",
    );
    const inventory = await retainThenParse(raw);
    validateCompleteGfsCycleInventoryV1(inventory, target, window.cycle);
    return {
      ...window,
      directory_sha256: raw.sha256,
      rejected_cycles: [],
    };
  }

  async fetchPgrb2FilteredRaw(cycle: Date | string, lead: number): Promise<GfsNomadsRawObjectV1> {
    const normalizedCycle = new Date(cycle).toISOString().replace(".000Z", "Z");
    const locator = gfsPgrb2FilterUrlV1(normalizedCycle, lead);
    const raw = await this.rawObjectV1(
      "GFS_PGRB2_FILTER_RESPONSE",
      `${normalizedCycle}|F${String(lead).padStart(3, "0")}`,
      locator,
      {
        kind: "GFS_PGRB2",
        target_logical_time: this.targetLogicalTime,
        cycle: normalizedCycle,
        lead,
        locator,
      },
      `PHASE5_CONTROLLED_GFS_PGRB2_F${String(lead).padStart(3, "0")}`,
    );
    if (new TextDecoder("ascii").decode(raw.response.bytes.slice(0, 4)) !== "GRIB") {
      throw new Error(`PHASE5_CONTROLLED_GFS_PGRB2_NOT_GRIB:F${String(lead).padStart(3, "0")}`);
    }
    return raw;
  }

  async fetchSfluxIndexRaw(cycle: Date | string, lead: number, tick: Date | string): Promise<GfsNomadsRawObjectV1> {
    const normalizedCycle = new Date(cycle).toISOString().replace(".000Z", "Z");
    const target = canonicalHourV1(new Date(tick).toISOString(), "PHASE5_CONTROLLED_GFS_SFLUX_TARGET_INVALID");
    if (target !== this.targetLogicalTime) throw new Error("PHASE5_CONTROLLED_GFS_SFLUX_TARGET_MISMATCH");
    const [, locator] = gfsSfluxUrlsV1(normalizedCycle, lead);
    return this.rawObjectV1(
      "GFS_SFLUX_IDX",
      `${normalizedCycle}|F${String(lead).padStart(3, "0")}`,
      locator,
      {
        kind: "GFS_SFLUX_INDEX",
        target_logical_time: target,
        cycle: normalizedCycle,
        lead,
        locator,
      },
      `PHASE5_CONTROLLED_GFS_SFLUX_INDEX_F${String(lead).padStart(3, "0")}`,
    );
  }

  async fetchSfluxMessageRaw(
    cycle: Date | string,
    lead: number,
    tick: Date | string,
    selected: GfsSfluxIndexSelectionV1,
  ): Promise<GfsNomadsRawObjectV1> {
    if (selected.lead !== lead) throw new Error("PHASE5_CONTROLLED_GFS_SFLUX_SELECTION_LEAD_MISMATCH");
    const normalizedCycle = new Date(cycle).toISOString().replace(".000Z", "Z");
    const target = canonicalHourV1(new Date(tick).toISOString(), "PHASE5_CONTROLLED_GFS_SFLUX_TARGET_INVALID");
    if (target !== this.targetLogicalTime) throw new Error("PHASE5_CONTROLLED_GFS_SFLUX_TARGET_MISMATCH");
    const [locator] = gfsSfluxUrlsV1(normalizedCycle, lead);
    const raw = await this.rawObjectV1(
      "GFS_SFLUX_EXACT_GRIB_MESSAGE",
      `${normalizedCycle}|F${String(lead).padStart(3, "0")}`,
      locator,
      {
        kind: "GFS_SFLUX_MESSAGE",
        target_logical_time: target,
        cycle: normalizedCycle,
        lead,
        locator,
        selected,
      },
      `PHASE5_CONTROLLED_GFS_SFLUX_MESSAGE_F${String(lead).padStart(3, "0")}`,
    );
    const prefix = new TextDecoder("ascii").decode(raw.response.bytes.slice(0, 4));
    const suffix = new TextDecoder("ascii").decode(raw.response.bytes.slice(-4));
    if (raw.response.bytes.byteLength !== selected.length || prefix !== "GRIB" || suffix !== "7777") {
      throw new Error(`PHASE5_CONTROLLED_GFS_SFLUX_MESSAGE_BOUNDARY:F${String(lead).padStart(3, "0")}`);
    }
    return raw;
  }
}

export type Phase5ControlledProviderWorkItemFactoryConfigV1 = {
  fixture: Phase5ControlledEvidenceFixturePortV1;
  retention: RawEvidenceRetentionPortV1;
  clock?: () => Date;
  python_executable?: string;
  gfs_product_decoder_path?: string;
};

export class Phase5ControlledProviderWorkItemFactoryV1 implements EvidenceRuntimeWorkItemFactoryV1 {
  readonly factory_id = MCFT_CAP09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEM_FACTORY_ID_V1;
  private readonly clock: () => Date;

  constructor(private readonly config: Phase5ControlledProviderWorkItemFactoryConfigV1) {
    this.clock = config.clock ?? (() => new Date());
  }

  buildForTarget(input: EvidenceRuntimeAcquisitionTargetV1): readonly EvidenceRuntimeCycleWorkItemV1[] {
    const target = canonicalHourV1(input.target_logical_time, "PHASE5_CONTROLLED_PROVIDER_TARGET_INVALID");
    const requestedAt = canonicalIsoV1(input.requested_at, "PHASE5_CONTROLLED_PROVIDER_REQUESTED_AT_INVALID");
    const prefix = requestPrefixV1(input.request_id_prefix);

    const soilRequest = buildKbsVariate25SoilFetchRequestV1({
      request_id: `${prefix}:soil`,
      requested_at: requestedAt,
    });
    const soil: EvidenceRuntimeCycleWorkItemV1 = {
      work_item_id: `${prefix}:soil`,
      dataset_id: MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
      request: soilRequest,
      transport: new Phase5ControlledFixtureTransportV1(
        this.config.fixture,
        target,
        "KBS_SOIL",
        soilRequest,
      ),
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
      transport: new Phase5ControlledFixtureTransportV1(
        this.config.fixture,
        target,
        "KBS_RAW_HOURLY",
        rawHourlyRequest,
      ),
      decoder: new KbsRawHourlyExactIntervalDecoderV1(target, {
        python_executable: this.config.python_executable,
        clock: this.clock,
      }),
    };

    const controlledGfsProvider = new Phase5ControlledGfsProviderV1(this.config.fixture, target);
    const gfsComposer = new GfsNomadsRawBundleComposerV1({
      provider: controlledGfsProvider,
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
      transport: new GfsNomadsBundleTransportV1(gfsComposer, target, `${prefix}:gfs-members`),
      decoder: new GfsRawBundleEvidenceDecoderV1(target, {
        python_executable: this.config.python_executable,
        product_decoder_path: this.config.gfs_product_decoder_path,
        normalize_et0: true,
        restored_ingested_at: input.restored_ingested_at,
      }),
    };

    const byFamily: Readonly<Record<ProductionEvidenceSourceFamilyV1, EvidenceRuntimeCycleWorkItemV1>> = {
      KBS_SOIL: soil,
      KBS_RAW_HOURLY: rawHourly,
      GFS_BUNDLE: gfs,
    };
    const requested = input.source_families ?? ["KBS_SOIL", "KBS_RAW_HOURLY", "GFS_BUNDLE"];
    if (!Array.isArray(requested) || requested.length === 0 || new Set(requested).size !== requested.length) {
      throw new Error("PHASE5_CONTROLLED_PROVIDER_SOURCE_FAMILIES_INVALID");
    }
    for (const family of requested) {
      if (!(family in byFamily)) throw new Error("PHASE5_CONTROLLED_PROVIDER_SOURCE_FAMILY_INVALID");
    }
    return requested.map((family) => byFamily[family]);
  }
}
