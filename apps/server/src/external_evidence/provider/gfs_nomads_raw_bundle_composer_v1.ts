// MCFT-CAP-09 Phase 3 product GFS raw-bundle composition.
// Boundary: acquisition + raw-retention-first deterministic bundle assembly only.
// No qualification-script dependency, database write, scheduler, RuntimeTickCursor,
// Twin state, environment, timer, or process lifecycle.

import { createHash } from "node:crypto";

import type {
  RawEvidenceRetentionPortV1,
  RawEvidenceRetentionReceiptV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  MCFT_CAP09_GFS_ACQUISITION_AUTHORITY_REF_V1,
  MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
  GfsNomadsLiveProviderV1,
  parseGfsDirectoryInventoryV1,
  parseGfsSfluxIndexV1,
  type GfsNomadsRawObjectV1,
} from "./gfs_nomads_live_provider_v1.js";

export const MCFT_CAP09_GFS_RAW_BUNDLE_COMPOSER_ID_V1 =
  "MCFT_CAP09_GFS_RAW_BUNDLE_COMPOSER_V1" as const;

export type GfsRawBundleMemberV1 = {
  name: string;
  kind: GfsNomadsRawObjectV1["kind"];
  lead?: number;
  identity_sha256?: string;
  sha256: string;
  bytes: number;
  retention_ref: string;
};

export type GfsRawBundleCompositionResultV1 = {
  composer_id: typeof MCFT_CAP09_GFS_RAW_BUNDLE_COMPOSER_ID_V1;
  provider_id: typeof MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1;
  target_logical_time: string;
  selected_cycle: string;
  lead_start: number;
  lead_end: number;
  support_lead: number;
  requested_at: string;
  retrieved_at: string;
  provider_request_count: number;
  directory_rejection_count: number;
  raw_provider_object_count: number;
  raw_member_chain_sha256: string;
  raw_bundle_sha256: string;
  raw_bundle_bytes: number;
  manifest: Record<string, unknown>;
  bundle_bytes: Uint8Array;
  members: readonly GfsRawBundleMemberV1[];
  retention_before_directory_parse: true;
  retention_before_sflux_idx_parse: true;
  retention_before_scientific_decode: true;
};

type ProviderPortV1 = Pick<
  GfsNomadsLiveProviderV1,
  "provider_id" | "selectLatestCompleteCycle" | "fetchPgrb2FilteredRaw" | "fetchSfluxIndexRaw" | "fetchSfluxMessageRaw"
>;

function sha256V1(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonV1(object[key])}`).join(",")}}`;
}

function canonicalHourV1(value: string, code: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())
    || date.getUTCMinutes() !== 0
    || date.getUTCSeconds() !== 0
    || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return date.toISOString();
}

function safeNameV1(kind: GfsNomadsRawObjectV1["kind"], lead?: number, directoryIndex?: number): string {
  if (kind === "GFS_DIRECTORY_LISTING") {
    if (!Number.isInteger(directoryIndex) || Number(directoryIndex) < 0) {
      throw new Error("PHASE3_GFS_DIRECTORY_INDEX_REQUIRED");
    }
    return `selection/${String(directoryIndex).padStart(2, "0")}_gfs_directory_listing.raw`;
  }
  if (!Number.isInteger(lead) || Number(lead) < 0) throw new Error("PHASE3_GFS_MEMBER_LEAD_REQUIRED");
  if (kind === "GFS_PGRB2_FILTER_RESPONSE") return `pgrb2/f${String(lead).padStart(3, "0")}.grib2`;
  if (kind === "GFS_SFLUX_IDX") return `sflux/f${String(lead).padStart(3, "0")}.idx`;
  if (kind === "GFS_SFLUX_EXACT_GRIB_MESSAGE") return `sflux/f${String(lead).padStart(3, "0")}.grib2`;
  throw new Error(`PHASE3_GFS_MEMBER_KIND_UNSUPPORTED:${kind}`);
}

function tarOctalV1(value: number, width: number): Buffer {
  return Buffer.from(value.toString(8).padStart(width - 1, "0") + "\0", "ascii");
}

function tarHeaderV1(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  const encoded = Buffer.from(name, "utf8");
  if (encoded.length > 100) throw new Error(`PHASE3_GFS_TAR_NAME_TOO_LONG:${name}`);
  encoded.copy(header, 0);
  tarOctalV1(0o600, 8).copy(header, 100);
  tarOctalV1(0, 8).copy(header, 108);
  tarOctalV1(0, 8).copy(header, 116);
  tarOctalV1(size, 12).copy(header, 124);
  tarOctalV1(0, 12).copy(header, 136);
  Buffer.from("        ", "ascii").copy(header, 148);
  header[156] = "0".charCodeAt(0);
  Buffer.from("ustar\0", "ascii").copy(header, 257);
  Buffer.from("00", "ascii").copy(header, 263);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  Buffer.from(checksum.toString(8).padStart(6, "0") + "\0 ", "ascii").copy(header, 148);
  return header;
}

function tarArchiveV1(entries: readonly { name: string; body: Uint8Array }[]): Uint8Array {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body);
    chunks.push(tarHeaderV1(entry.name, body.length), body);
    const remainder = body.length % 512;
    if (remainder !== 0) chunks.push(Buffer.alloc(512 - remainder, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return new Uint8Array(Buffer.concat(chunks));
}

async function retainRawObjectV1(input: {
  retention: RawEvidenceRetentionPortV1;
  raw: GfsNomadsRawObjectV1;
  request_id: string;
  requested_at: string;
  identity: string;
}): Promise<RawEvidenceRetentionReceiptV1> {
  const receipt = await input.retention.retainRawEvidence({
    retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
    request_id: input.request_id,
    provider_id: MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
    source_family: input.raw.kind,
    source_locator: input.raw.response.final_locator,
    final_locator: input.raw.response.final_locator,
    content_type: input.raw.response.content_type || "application/octet-stream",
    retrieved_at: input.raw.response.retrieved_at,
    available_at: input.raw.response.retrieved_at,
    use_policy_ref: MCFT_CAP09_GFS_ACQUISITION_AUTHORITY_REF_V1,
    raw_sha256: input.raw.sha256,
    raw_bytes: input.raw.response.bytes.byteLength,
    bytes: input.raw.response.bytes,
  });
  if (receipt.retained_sha256 !== input.raw.sha256
    || receipt.retained_bytes !== input.raw.response.bytes.byteLength
    || receipt.externally_publishable !== false) {
    throw new Error(`PHASE3_GFS_RETENTION_RECEIPT_MISMATCH:${input.identity}`);
  }
  return receipt;
}

export class GfsNomadsRawBundleComposerV1 {
  readonly composer_id = MCFT_CAP09_GFS_RAW_BUNDLE_COMPOSER_ID_V1;

  constructor(private readonly deps: {
    provider: ProviderPortV1;
    retention: RawEvidenceRetentionPortV1;
    clock: () => Date;
  }) {
    if (deps.provider.provider_id !== MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1) {
      throw new Error("PHASE3_GFS_PRODUCT_PROVIDER_ID_REQUIRED");
    }
  }

  async compose(input: {
    target_logical_time: string;
    request_id_prefix: string;
  }): Promise<GfsRawBundleCompositionResultV1> {
    const target = canonicalHourV1(input.target_logical_time, "PHASE3_GFS_TARGET_HOUR_REQUIRED");
    const prefix = input.request_id_prefix.trim();
    if (!prefix) throw new Error("PHASE3_GFS_REQUEST_ID_PREFIX_REQUIRED");
    const requestedAt = this.deps.clock().toISOString();
    let providerRequestCount = 0;
    let directoryIndex = 0;

    const bodies = new Map<string, Uint8Array>();
    const members: GfsRawBundleMemberV1[] = [];
    const idxLines: { lead: number; line_sha256: string }[] = [];

    const selection = await this.deps.provider.selectLatestCompleteCycle(target, async (raw) => {
      providerRequestCount += 1;
      const name = safeNameV1(raw.kind, undefined, directoryIndex++);
      const receipt = await retainRawObjectV1({
        retention: this.deps.retention,
        raw,
        request_id: `${prefix}:directory:${directoryIndex}`,
        requested_at: requestedAt,
        identity: raw.identity,
      });
      bodies.set(name, raw.response.bytes);
      members.push({
        name,
        kind: raw.kind,
        identity_sha256: sha256V1(raw.identity),
        sha256: raw.sha256,
        bytes: raw.response.bytes.byteLength,
        retention_ref: receipt.retention_ref,
      });
      return parseGfsDirectoryInventoryV1(raw.response.bytes);
    });

    const leads = Array.from(
      { length: selection.lead_end - selection.support_lead + 1 },
      (_, index) => selection.support_lead + index,
    );

    for (const lead of leads) {
      const raw = await this.deps.provider.fetchPgrb2FilteredRaw(selection.cycle, lead);
      providerRequestCount += 1;
      const name = safeNameV1(raw.kind, lead);
      const receipt = await retainRawObjectV1({
        retention: this.deps.retention,
        raw,
        request_id: `${prefix}:pgrb2:f${String(lead).padStart(3, "0")}`,
        requested_at: requestedAt,
        identity: raw.identity,
      });
      bodies.set(name, raw.response.bytes);
      members.push({ name, kind: raw.kind, lead, sha256: raw.sha256, bytes: raw.response.bytes.byteLength, retention_ref: receipt.retention_ref });
    }

    for (const lead of leads) {
      const idxRaw = await this.deps.provider.fetchSfluxIndexRaw(selection.cycle, lead, target);
      providerRequestCount += 1;
      const idxName = safeNameV1(idxRaw.kind, lead);
      const idxReceipt = await retainRawObjectV1({
        retention: this.deps.retention,
        raw: idxRaw,
        request_id: `${prefix}:sflux-idx:f${String(lead).padStart(3, "0")}`,
        requested_at: requestedAt,
        identity: idxRaw.identity,
      });
      bodies.set(idxName, idxRaw.response.bytes);
      members.push({ name: idxName, kind: idxRaw.kind, lead, sha256: idxRaw.sha256, bytes: idxRaw.response.bytes.byteLength, retention_ref: idxReceipt.retention_ref });

      // Parsing is deliberately after durable retention of the exact idx bytes.
      const selectedRange = parseGfsSfluxIndexV1(idxRaw.response.bytes, lead);
      idxLines.push({ lead, line_sha256: selectedRange.line_sha256 });

      const messageRaw = await this.deps.provider.fetchSfluxMessageRaw(selection.cycle, lead, target, selectedRange);
      providerRequestCount += 1;
      const messageName = safeNameV1(messageRaw.kind, lead);
      const messageReceipt = await retainRawObjectV1({
        retention: this.deps.retention,
        raw: messageRaw,
        request_id: `${prefix}:sflux-message:f${String(lead).padStart(3, "0")}`,
        requested_at: requestedAt,
        identity: messageRaw.identity,
      });
      bodies.set(messageName, messageRaw.response.bytes);
      members.push({ name: messageName, kind: messageRaw.kind, lead, sha256: messageRaw.sha256, bytes: messageRaw.response.bytes.byteLength, retention_ref: messageReceipt.retention_ref });
    }

    members.sort((a, b) => a.name.localeCompare(b.name));
    idxLines.sort((a, b) => a.lead - b.lead);
    const publicMembers = members.map(({ retention_ref: _retentionRef, ...member }) => member);
    const retrievedAt = this.deps.clock().toISOString();
    const manifest = {
      schema_version: "geox_mcft_cap09_ea5e2_gfs_raw_bundle_v1",
      target_logical_time: target.replace(".000Z", "Z"),
      selected_cycle: selection.cycle,
      lead_start: selection.lead_start,
      lead_end: selection.lead_end,
      support_lead: selection.support_lead,
      requested_at: requestedAt,
      retrieved_at: retrievedAt,
      provider_request_count: providerRequestCount,
      directory_rejection_count: selection.rejected_cycles.length,
      member_count: publicMembers.length,
      member_chain_sha256: sha256V1(canonicalJsonV1(publicMembers)),
      idx_selected_line_chain_sha256: sha256V1(canonicalJsonV1(idxLines)),
      members: publicMembers,
      product_acquisition_provider_used: true,
      product_provider_id: this.deps.provider.provider_id,
      product_bundle_composer_used: true,
      product_bundle_composer_id: this.composer_id,
      retention_before_directory_parse: true,
      retention_before_sflux_idx_parse: true,
      retention_before_scientific_decode: true,
    };
    const tarEntries: { name: string; body: Uint8Array }[] = [{
      name: "manifest.json",
      body: new TextEncoder().encode(canonicalJsonV1(manifest)),
    }];
    for (const member of members) {
      const body = bodies.get(member.name);
      if (!body) throw new Error(`PHASE3_GFS_BUNDLE_BODY_MISSING:${member.name}`);
      tarEntries.push({ name: member.name, body });
    }
    const bundleBytes = tarArchiveV1(tarEntries);

    return {
      composer_id: this.composer_id,
      provider_id: MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1,
      target_logical_time: target,
      selected_cycle: selection.cycle,
      lead_start: selection.lead_start,
      lead_end: selection.lead_end,
      support_lead: selection.support_lead,
      requested_at: requestedAt,
      retrieved_at: retrievedAt,
      provider_request_count: providerRequestCount,
      directory_rejection_count: selection.rejected_cycles.length,
      raw_provider_object_count: members.length,
      raw_member_chain_sha256: String(manifest.member_chain_sha256),
      raw_bundle_sha256: sha256V1(bundleBytes),
      raw_bundle_bytes: bundleBytes.byteLength,
      manifest,
      bundle_bytes: bundleBytes,
      members,
      retention_before_directory_parse: true,
      retention_before_sflux_idx_parse: true,
      retention_before_scientific_decode: true,
    };
  }
}
