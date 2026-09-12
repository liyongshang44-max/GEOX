// MCFT-CAP-09 private KBS Raw Hourly publication baseline manifest store.
// Stores immutable metadata-only baseline manifests by content digest in the private Evidence object store.
// It intentionally does NOT provide the mutable/current baseline pointer; that pointer remains a separately
// fenced operational binding problem. No provider fetch, database write, canonical Evidence write, or Runtime start.

import crypto from "node:crypto";

import type { VerifiedRawEvidenceProvenanceV1 } from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type { EvidenceRuntimeScopeV1 } from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import type { KbsRawHourlyPublicationSnapshotInventoryV1 } from "./provider/kbs_raw_hourly_publication_snapshot_v1.js";
import { MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1 } from "./provider/kbs_raw_hourly_live_provider_v1.js";
import {
  S3CompatiblePrivateEvidenceObjectClientV1,
  type S3CompatiblePrivateEvidenceObjectClientConfigV1,
} from "./s3_compatible_private_evidence_object_client_v1.js";

export const MCFT_CAP09_KBS_PUBLICATION_BASELINE_STORE_ID_V1 =
  "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_BASELINE_STORE_V1" as const;
export const MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1 =
  "geox_mcft_cap09_kbs_raw_hourly_publication_baseline_v1" as const;
export const MCFT_CAP09_KBS_PUBLICATION_BASELINE_PREFIX_V1 =
  "mcft-cap09-kbs-raw-hourly-publication-baseline-v1/sha256" as const;

export type KbsRawHourlyPublicationBaselineRawProvenanceV1 = Pick<
  VerifiedRawEvidenceProvenanceV1,
  "request_id" | "provider_id" | "source_family" | "source_locator" | "final_locator" |
  "content_type" | "retrieved_at" | "available_at" | "raw_sha256" | "raw_bytes" |
  "retention_ref" | "retained_at" | "use_policy_ref"
>;

export type KbsRawHourlyPublicationBaselineManifestV1 = {
  schema_version: typeof MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1;
  scope: EvidenceRuntimeScopeV1;
  runtime_start_authority_ref: string;
  activation_fence_time: string;
  baseline_observed_at: string;
  raw_provenance: KbsRawHourlyPublicationBaselineRawProvenanceV1;
  snapshot: KbsRawHourlyPublicationSnapshotInventoryV1;
  canonical_emission_count: 0;
  externally_publishable: false;
};

export type KbsRawHourlyPublicationBaselineWriteReceiptV1 = {
  store_id: typeof MCFT_CAP09_KBS_PUBLICATION_BASELINE_STORE_ID_V1;
  baseline_ref: string;
  baseline_digest: string;
  manifest_bytes: number;
  stored_at: string;
  idempotent_existing_object: boolean;
  externally_publishable: false;
  current_pointer_bound: false;
};

export type KbsRawHourlyPublicationBaselineReadReceiptV1 = {
  store_id: typeof MCFT_CAP09_KBS_PUBLICATION_BASELINE_STORE_ID_V1;
  baseline_ref: string;
  baseline_digest: string;
  manifest_bytes: number;
  stored_at: string;
  manifest: KbsRawHourlyPublicationBaselineManifestV1;
  externally_publishable: false;
  current_pointer_bound: false;
};

const SCOPE_KEYS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function digestV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}
function digestHexV1(value: unknown, code: string): string {
  return digestV1(value, code).slice("sha256:".length);
}
function sha256V1(value: Buffer | Uint8Array | string): string {
  return "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
}
function headerV1(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
function normalizeScopeV1(scope: EvidenceRuntimeScopeV1): EvidenceRuntimeScopeV1 {
  return Object.fromEntries(
    SCOPE_KEYS.map((key) => [key, textV1(scope[key], "KBS_PUBLICATION_BASELINE_SCOPE_" + key.toUpperCase() + "_REQUIRED")]),
  ) as EvidenceRuntimeScopeV1;
}
function normalizeRawV1(raw: KbsRawHourlyPublicationBaselineRawProvenanceV1): KbsRawHourlyPublicationBaselineRawProvenanceV1 {
  if (textV1(raw.provider_id, "KBS_PUBLICATION_BASELINE_PROVIDER_REQUIRED") !== "KBS_LTER") {
    throw new Error("KBS_PUBLICATION_BASELINE_PROVIDER_INVALID");
  }
  if (textV1(raw.source_family, "KBS_PUBLICATION_BASELINE_SOURCE_FAMILY_REQUIRED") !== "RAW_HOURLY_WEATHER") {
    throw new Error("KBS_PUBLICATION_BASELINE_SOURCE_FAMILY_INVALID");
  }
  const sourceLocator = textV1(raw.source_locator, "KBS_PUBLICATION_BASELINE_SOURCE_LOCATOR_REQUIRED");
  const finalLocator = textV1(raw.final_locator, "KBS_PUBLICATION_BASELINE_FINAL_LOCATOR_REQUIRED");
  if (sourceLocator !== MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1 || finalLocator !== MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1) {
    throw new Error("KBS_PUBLICATION_BASELINE_ENDPOINT_IDENTITY_INVALID");
  }
  const rawSha256 = digestV1(raw.raw_sha256, "KBS_PUBLICATION_BASELINE_RAW_DIGEST_INVALID");
  if (!Number.isSafeInteger(raw.raw_bytes) || raw.raw_bytes <= 0) throw new Error("KBS_PUBLICATION_BASELINE_RAW_BYTES_INVALID");
  const retentionRef = textV1(raw.retention_ref, "KBS_PUBLICATION_BASELINE_RETENTION_REF_REQUIRED");
  let parsed: URL;
  try { parsed = new URL(retentionRef); } catch { throw new Error("KBS_PUBLICATION_BASELINE_RETENTION_REF_INVALID"); }
  if (
    parsed.protocol !== "s3-private:" ||
    parsed.pathname.replace(/^\/+/, "") !== "mcft-cap09-formal-raw-v1/sha256/" + rawSha256.slice("sha256:".length)
  ) throw new Error("KBS_PUBLICATION_BASELINE_RETENTION_REF_DIGEST_MISMATCH");
  return {
    request_id: textV1(raw.request_id, "KBS_PUBLICATION_BASELINE_REQUEST_ID_REQUIRED"),
    provider_id: "KBS_LTER",
    source_family: "RAW_HOURLY_WEATHER",
    source_locator: sourceLocator,
    final_locator: finalLocator,
    content_type: textV1(raw.content_type, "KBS_PUBLICATION_BASELINE_CONTENT_TYPE_REQUIRED"),
    retrieved_at: isoV1(raw.retrieved_at, "KBS_PUBLICATION_BASELINE_RETRIEVED_AT_INVALID"),
    available_at: isoV1(raw.available_at, "KBS_PUBLICATION_BASELINE_AVAILABLE_AT_INVALID"),
    raw_sha256: rawSha256,
    raw_bytes: raw.raw_bytes,
    retention_ref: retentionRef,
    retained_at: isoV1(raw.retained_at, "KBS_PUBLICATION_BASELINE_RETAINED_AT_INVALID"),
    use_policy_ref: textV1(raw.use_policy_ref, "KBS_PUBLICATION_BASELINE_USE_POLICY_REQUIRED"),
  };
}
function normalizeSnapshotV1(snapshot: KbsRawHourlyPublicationSnapshotInventoryV1): KbsRawHourlyPublicationSnapshotInventoryV1 {
  if (
    snapshot.schema_version !== "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_inventory_v1" ||
    snapshot.endpoint_shape !== "COMPLETE_ACCUMULATED_TABLE" ||
    snapshot.raw_values_emitted !== false
  ) throw new Error("KBS_PUBLICATION_BASELINE_SNAPSHOT_CONTRACT_INVALID");
  if (!Number.isSafeInteger(snapshot.parsed_row_count) || snapshot.parsed_row_count <= 0) throw new Error("KBS_PUBLICATION_BASELINE_SNAPSHOT_PARSED_COUNT_INVALID");
  if (!Number.isSafeInteger(snapshot.valid_row_count) || snapshot.valid_row_count <= 0) throw new Error("KBS_PUBLICATION_BASELINE_SNAPSHOT_VALID_COUNT_INVALID");
  if (!Number.isSafeInteger(snapshot.unique_event_time_count) || snapshot.unique_event_time_count <= 0) throw new Error("KBS_PUBLICATION_BASELINE_SNAPSHOT_EVENT_COUNT_INVALID");
  const latest = isoV1(snapshot.latest_event_time, "KBS_PUBLICATION_BASELINE_SNAPSHOT_LATEST_INVALID");
  if (!latest.endsWith(":00:00.000Z")) throw new Error("KBS_PUBLICATION_BASELINE_SNAPSHOT_LATEST_HOUR_REQUIRED");
  return {
    ...snapshot,
    latest_event_time: latest,
    latest_event_row_identity_hash: digestV1(snapshot.latest_event_row_identity_hash, "KBS_PUBLICATION_BASELINE_SNAPSHOT_LATEST_HASH_INVALID"),
    event_index_sha256: digestV1(snapshot.event_index_sha256, "KBS_PUBLICATION_BASELINE_SNAPSHOT_INDEX_HASH_INVALID"),
    raw_values_emitted: false,
  };
}

export function normalizeKbsRawHourlyPublicationBaselineManifestV1(
  input: KbsRawHourlyPublicationBaselineManifestV1,
): KbsRawHourlyPublicationBaselineManifestV1 {
  if (input.schema_version !== MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1) throw new Error("KBS_PUBLICATION_BASELINE_SCHEMA_INVALID");
  if (input.canonical_emission_count !== 0 || input.externally_publishable !== false) throw new Error("KBS_PUBLICATION_BASELINE_NON_EFFECT_CONTRACT_INVALID");
  const activation = isoV1(input.activation_fence_time, "KBS_PUBLICATION_BASELINE_ACTIVATION_FENCE_INVALID");
  const observed = isoV1(input.baseline_observed_at, "KBS_PUBLICATION_BASELINE_OBSERVED_AT_INVALID");
  if (Date.parse(observed) < Date.parse(activation)) throw new Error("KBS_PUBLICATION_BASELINE_OBSERVED_BEFORE_ACTIVATION_FENCE");
  const raw = normalizeRawV1(input.raw_provenance);
  if (Date.parse(raw.available_at) < Date.parse(activation)) throw new Error("KBS_PUBLICATION_BASELINE_RAW_AVAILABLE_BEFORE_ACTIVATION_FENCE");
  return {
    schema_version: MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1,
    scope: normalizeScopeV1(input.scope),
    runtime_start_authority_ref: textV1(input.runtime_start_authority_ref, "KBS_PUBLICATION_BASELINE_RUNTIME_START_AUTHORITY_REQUIRED"),
    activation_fence_time: activation,
    baseline_observed_at: observed,
    raw_provenance: raw,
    snapshot: normalizeSnapshotV1(input.snapshot),
    canonical_emission_count: 0,
    externally_publishable: false,
  };
}
function canonicalBytesV1(input: KbsRawHourlyPublicationBaselineManifestV1): Buffer {
  return Buffer.from(JSON.stringify(normalizeKbsRawHourlyPublicationBaselineManifestV1(input)) + "\n", "utf8");
}

export class S3CompatibleKbsRawHourlyPublicationBaselineStoreV1 {
  readonly store_id = MCFT_CAP09_KBS_PUBLICATION_BASELINE_STORE_ID_V1;
  private readonly client: S3CompatiblePrivateEvidenceObjectClientV1;
  private readonly clock: () => Date;
  constructor(config: S3CompatiblePrivateEvidenceObjectClientConfigV1) {
    this.client = new S3CompatiblePrivateEvidenceObjectClientV1(config);
    this.clock = config.clock ?? (() => new Date());
  }
  private keyV1(digest: string): string {
    return MCFT_CAP09_KBS_PUBLICATION_BASELINE_PREFIX_V1 + "/" + digestHexV1(digest, "KBS_PUBLICATION_BASELINE_DIGEST_INVALID");
  }
  private refV1(key: string): string { return "s3-private://" + this.client.bucket + "/" + key; }
  private keyFromRefV1(ref: string, digest: string): string {
    let parsed: URL;
    try { parsed = new URL(textV1(ref, "KBS_PUBLICATION_BASELINE_REF_REQUIRED")); }
    catch { throw new Error("KBS_PUBLICATION_BASELINE_REF_INVALID"); }
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.client.bucket) throw new Error("KBS_PUBLICATION_BASELINE_REF_AUTHORITY_MISMATCH");
    const key = parsed.pathname.replace(/^\/+/, "");
    if (key !== this.keyV1(digest)) throw new Error("KBS_PUBLICATION_BASELINE_REF_DIGEST_MISMATCH");
    return key;
  }
  private verifyHeadV1(input: {
    key: string; digest: string; bytes: number; status: number;
    headers: Readonly<Record<string, string | string[] | undefined>>;
  }): string {
    if (input.status !== 200) throw new Error("KBS_PUBLICATION_BASELINE_OBJECT_NOT_FOUND");
    if (Number(headerV1(input.headers, "content-length")) !== input.bytes) throw new Error("KBS_PUBLICATION_BASELINE_BYTE_COUNT_MISMATCH");
    if (headerV1(input.headers, "x-amz-meta-geox-sha256") !== input.digest) throw new Error("KBS_PUBLICATION_BASELINE_METADATA_DIGEST_MISMATCH");
    if (headerV1(input.headers, "x-amz-meta-geox-object-class") !== "PRIVATE_KBS_RAW_HOURLY_PUBLICATION_BASELINE") throw new Error("KBS_PUBLICATION_BASELINE_OBJECT_CLASS_MISMATCH");
    if (headerV1(input.headers, "x-amz-meta-geox-schema") !== MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1) throw new Error("KBS_PUBLICATION_BASELINE_METADATA_SCHEMA_MISMATCH");
    return isoV1(headerV1(input.headers, "x-amz-meta-geox-stored-at"), "KBS_PUBLICATION_BASELINE_STORED_AT_INVALID");
  }
  async writeBaselineManifest(manifestInput: KbsRawHourlyPublicationBaselineManifestV1): Promise<KbsRawHourlyPublicationBaselineWriteReceiptV1> {
    const manifest = normalizeKbsRawHourlyPublicationBaselineManifestV1(manifestInput);
    const rawRef = new URL(manifest.raw_provenance.retention_ref);
    if (rawRef.hostname !== this.client.bucket) throw new Error("KBS_PUBLICATION_BASELINE_RAW_BUCKET_MISMATCH");
    const body = canonicalBytesV1(manifest);
    const digest = sha256V1(body);
    const key = this.keyV1(digest);
    const ref = this.refV1(key);
    const probe = await this.client.headObject(key, [200, 404]);
    if (probe.status === 200) {
      const storedAt = this.verifyHeadV1({key,digest,bytes:body.byteLength,status:probe.status,headers:probe.headers});
      const existing = await this.client.getObject(key);
      if (existing.body.byteLength !== body.byteLength || sha256V1(existing.body) !== digest || !existing.body.equals(body)) {
        throw new Error("KBS_PUBLICATION_BASELINE_IDEMPOTENT_BODY_MISMATCH");
      }
      return {store_id:this.store_id,baseline_ref:ref,baseline_digest:digest,manifest_bytes:body.byteLength,stored_at:storedAt,idempotent_existing_object:true,externally_publishable:false,current_pointer_bound:false};
    }
    const storedAt = this.clock().toISOString();
    isoV1(storedAt, "KBS_PUBLICATION_BASELINE_STORE_CLOCK_INVALID");
    await this.client.putObject({
      key, body, content_type:"application/json",
      metadata:{
        "x-amz-meta-geox-sha256":digest,
        "x-amz-meta-geox-object-class":"PRIVATE_KBS_RAW_HOURLY_PUBLICATION_BASELINE",
        "x-amz-meta-geox-schema":MCFT_CAP09_KBS_PUBLICATION_BASELINE_SCHEMA_V1,
        "x-amz-meta-geox-stored-at":storedAt,
      },
    });
    const headResponse = await this.client.headObject(key);
    const verifiedAt = this.verifyHeadV1({key,digest,bytes:body.byteLength,status:headResponse.status,headers:headResponse.headers});
    return {store_id:this.store_id,baseline_ref:ref,baseline_digest:digest,manifest_bytes:body.byteLength,stored_at:verifiedAt,idempotent_existing_object:false,externally_publishable:false,current_pointer_bound:false};
  }
  async readBaselineManifest(input:{baseline_ref:string;baseline_digest:string;manifest_bytes:number;}):Promise<KbsRawHourlyPublicationBaselineReadReceiptV1>{
    const digest=digestV1(input.baseline_digest,"KBS_PUBLICATION_BASELINE_READ_DIGEST_INVALID");
    if(!Number.isSafeInteger(input.manifest_bytes)||input.manifest_bytes<=0)throw new Error("KBS_PUBLICATION_BASELINE_READ_BYTES_INVALID");
    const key=this.keyFromRefV1(input.baseline_ref,digest);
    const headResponse=await this.client.headObject(key);
    const storedAt=this.verifyHeadV1({key,digest,bytes:input.manifest_bytes,status:headResponse.status,headers:headResponse.headers});
    const object=await this.client.getObject(key);
    if(object.body.byteLength!==input.manifest_bytes||sha256V1(object.body)!==digest)throw new Error("KBS_PUBLICATION_BASELINE_READ_BODY_DIGEST_MISMATCH");
    const manifest=normalizeKbsRawHourlyPublicationBaselineManifestV1(JSON.parse(object.body.toString("utf8")));
    return {store_id:this.store_id,baseline_ref:input.baseline_ref,baseline_digest:digest,manifest_bytes:input.manifest_bytes,stored_at:storedAt,manifest,externally_publishable:false,current_pointer_bound:false};
  }
}
