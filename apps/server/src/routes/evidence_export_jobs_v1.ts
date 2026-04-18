// GEOX/apps/server/src/routes/evidence_export_jobs_v1.ts
//
// Sprint C1: Evidence Export Jobs (persisted) for Commercial delivery.
// 
// Goals:
// - Provide a tenant-scoped async job interface to export evidence packs.
// - Persist job state in evidence_export_job_index_v1 (projection) and emit append-only facts for audit.
// - Produce an artifact file on local filesystem (runtime/evidence_exports_v1) with SHA-256 digest.
// 
// Scope (v1 MVP):
// - scope_type: TENANT | DEVICE | FIELD
// - artifact format: JSON / CSV / PDF (not zip) to avoid extra dependencies.
// - Filtering: performed in application layer by parsing facts.record_json JSON (source of truth).
// 
// Security:
// - Tenant isolation uses AoActAuthContextV0; all job reads/writes filter by auth.tenant_id.
// - Download endpoint only serves artifacts belonging to tenant.

import fs from "node:fs"; // Filesystem for writing and streaming artifacts.
import path from "node:path"; // Path utilities for safe joins.
import crypto from "node:crypto"; // Crypto for sha256.
import http from "node:http"; // HTTP client for S3-compatible object storage uploads.
import https from "node:https"; // HTTPS client for S3-compatible object storage uploads.
import { randomUUID } from "node:crypto"; // UUIDs for job ids and fact ids.
import type { FastifyInstance } from "fastify"; // Fastify instance.
import type { Pool } from "pg"; // Postgres pool.

import { requireAoActScopeV0, requireAoActAdminV0 } from "../auth/ao_act_authz_v0.js"; // Auth helper.
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js"; // Auth context.

type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "ERROR"; // Job status enum.

type ExportFormat = "JSON" | "CSV" | "PDF"; // Supported export file formats for v1.2.
type ExportLanguage = "zh-CN" | "en-US"; // UI-selected export language metadata for delivery.

function isNonEmptyString(v: any): v is string { // Helper: validate non-empty string.
  return typeof v === "string" && v.trim().length > 0; // True if string has content.
} // End helper.

function normalizeId(v: any): string | null { // Helper: normalize id-like strings.
  if (!isNonEmptyString(v)) return null; // Missing => null.
  const s = String(v).trim(); // Trim.
  if (s.length < 1 || s.length > 128) return null; // Length bound.
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null; // Safe charset.
  return s; // Return.
} // End helper.

function normalizeExportFormat(v: any): ExportFormat { // Helper: normalize requested export format.
  const s = String(v ?? "JSON").trim().toUpperCase(); // Normalize text.
  if (s === "CSV") return "CSV"; // CSV delivery view.
  if (s === "PDF") return "PDF"; // PDF delivery view.
  return "JSON"; // Default JSON delivery view.
} // End helper.

function normalizeExportLanguage(v: any): ExportLanguage { // Helper: normalize requested export language.
  const s = String(v ?? "zh-CN").trim(); // Normalize text.
  return s === "en-US" ? "en-US" : "zh-CN"; // Default to Chinese commercial console.
} // End helper.

function bundleFileNameForFormat(export_format: ExportFormat): string { // Helper: bundle filename by format.
  if (export_format === "CSV") return "bundle.csv"; // CSV bundle filename.
  if (export_format === "PDF") return "bundle.pdf"; // PDF bundle filename.
  return "bundle.json"; // JSON bundle filename.
} // End helper.

function bundleContentTypeForFormat(export_format: ExportFormat): string { // Helper: content type by format.
  if (export_format === "CSV") return "text/csv; charset=utf-8"; // CSV content type.
  if (export_format === "PDF") return "application/pdf"; // PDF content type.
  return "application/json"; // JSON content type.
} // End helper.

function badRequest(reply: any, error: string) { // Helper: 400 response.
  return reply.status(400).send({ ok: false, error }); // Standard envelope.
} // End helper.

function notFound(reply: any) { // Helper: 404 response.
  return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Standard envelope.
} // End helper.

function sha256FileHex(fp: string): string { // Helper: compute sha256 of a file.
  const h = crypto.createHash("sha256"); // Create hash.
  const buf = fs.readFileSync(fp); // Read all bytes (v1 artifacts are small).
  h.update(buf); // Hash bytes.
  return h.digest("hex"); // Return digest.
} // End helper.

function sha256TextHex(s: string): string { // Helper: compute sha256 of text.
  return crypto.createHash("sha256").update(s, "utf8").digest("hex"); // Return digest.
} // End helper.

function ensureDir(p: string) { // Helper: ensure directory exists.
  fs.mkdirSync(p, { recursive: true }); // Create if missing.
} // End helper.

function nowIso(ms: number): string { // Helper: convert ms to ISO.
  return new Date(ms).toISOString(); // Convert.
} // End helper.

async function ensureEvidenceExportJobIndexV1Schema(pool: Pool): Promise<void> {
  // Ensure the job index table exists and has all columns needed by Sprint C2 acceptance.
  // This is a schema-compat shim for repos that were created before this table/columns were introduced.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evidence_export_job_index_v1 (
      tenant_id        TEXT   NOT NULL,
      job_id           TEXT   NOT NULL,
      scope_type       TEXT   NOT NULL,
      scope_id         TEXT,
      from_ts_ms       BIGINT NOT NULL,
      to_ts_ms         BIGINT NOT NULL,
      status           TEXT   NOT NULL,
      created_ts_ms    BIGINT NOT NULL,
      updated_ts_ms    BIGINT NOT NULL,
      artifact_path    TEXT,
      artifact_sha256  TEXT,
      error            TEXT,
      PRIMARY KEY (tenant_id, job_id)
    );
  `);

  // Columns are added idempotently for forward/backward compatibility.
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS scope_type      TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS scope_id        TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS from_ts_ms       BIGINT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS to_ts_ms         BIGINT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS status           TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS created_ts_ms     BIGINT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS updated_ts_ms     BIGINT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS artifact_path     TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS artifact_sha256   TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS error            TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS export_format    TEXT;`);
  await pool.query(`ALTER TABLE evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS export_language  TEXT;`);
}

async function ensureEvidencePackIndexV1Schema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evidence_pack_index_v1 (
      tenant_id                  TEXT   NOT NULL,
      job_id                     TEXT   NOT NULL,
      storage_mode               TEXT   NOT NULL,
      object_store_key           TEXT   NOT NULL,
      object_store_bundle_path   TEXT,
      object_store_manifest_path TEXT,
      object_store_checksums_path TEXT,
      export_format              TEXT   NOT NULL,
      export_language            TEXT   NOT NULL,
      built_at_ts_ms             BIGINT NOT NULL,
      bundle_sha256              TEXT,
      manifest_sha256            TEXT,
      checksums_sha256           TEXT,
      PRIMARY KEY (tenant_id, job_id)
    );
  `);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS storage_mode TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_key TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_bundle_path TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_manifest_path TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_checksums_path TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS export_format TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS export_language TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS built_at_ts_ms BIGINT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS bundle_sha256 TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS manifest_sha256 TEXT;`);
  await pool.query(`ALTER TABLE evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS checksums_sha256 TEXT;`);
}


type ExportScope = { scope_type: "TENANT" | "DEVICE" | "FIELD"; scope_id: string | null }; // Scope descriptor.


type EvidencePackFileSummary = { // Evidence pack file summary for API responses.
  name: string;
  sha256: string | null;
  content_type: string;
  size_bytes: number | null;
  download_part: "bundle" | "manifest" | "checksums";
};

type EvidencePackDeliverySummary = { // Delivery metadata for current and future storage backends.
  storage_mode: "LOCAL_FILE" | "LOCAL_MIRROR" | "S3_COMPAT";
  object_store_key: string;
  object_store_presign_supported: boolean;
  object_store_download_url: string | null;
  object_store_part_download_urls?: {
    bundle: string | null;
    manifest: string | null;
    checksums: string | null;
  };
};

type EvidencePackSummary = { // Evidence pack summary exposed via list/detail endpoints.
  format: string;
  export_format: ExportFormat;
  export_language: ExportLanguage;
  pack_dir: string;
  delivery: EvidencePackDeliverySummary;
  files: EvidencePackFileSummary[];
};

function getFileSizeMaybe(fp: string): number | null { // Helper: return file size when file exists.
  try { return fs.statSync(fp).size; } catch { return null; }
} // End helper.

function deriveObjectStoreKey(tenant_id_raw: string | null | undefined, job_id_raw: string | null | undefined, export_format_raw?: string | null): string { // Helper: derive a stable future object-store key without enabling object storage yet.
  const tenant_id = normalizeId(tenant_id_raw) ?? "tenant_unknown"; // Stable tenant-safe segment.
  const job_id = normalizeId(job_id_raw) ?? "job_unknown"; // Stable job-safe segment.
  const export_format = normalizeExportFormat(export_format_raw); // Normalize extension source.
  const ext = export_format === "CSV" ? "csv" : export_format === "PDF" ? "pdf" : "json"; // Map to extension.
  return `${tenant_id}/${job_id}/bundle.${ext}`; // Object-store key is bucket-relative; never include bucket segment.
} // End helper.

function getEvidenceStorageMode(): "LOCAL_FILE" | "LOCAL_MIRROR" | "S3_COMPAT" { // Helper: normalize storage mode from env.
  const m = String(process.env.GEOX_EVIDENCE_STORAGE_MODE ?? "LOCAL_FILE").trim().toUpperCase(); // Read mode from env.
  if (m === "LOCAL_MIRROR") return "LOCAL_MIRROR"; // Local mirror mode.
  if (m === "S3_COMPAT") return "S3_COMPAT"; // Real object storage mode.
  return "LOCAL_FILE"; // Default local file mode.
} // End helper.

type S3CompatConfig = { // S3-compatible object storage runtime config.
  endpoint: string;
  publicEndpoint: string | null;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  presignTtlSec: number;
};

function getS3CompatConfig(): S3CompatConfig | null { // Helper: load S3-compatible config from env when enabled.
  const endpoint = String(process.env.GEOX_EVIDENCE_S3_ENDPOINT ?? "").trim();
  const publicEndpoint = String(process.env.GEOX_EVIDENCE_S3_PUBLIC_ENDPOINT ?? "").trim() || null;
  const bucket = String(process.env.GEOX_EVIDENCE_S3_BUCKET ?? "").trim();
  const region = String(process.env.GEOX_EVIDENCE_S3_REGION ?? "us-east-1").trim() || "us-east-1";
  const accessKeyId = String(process.env.GEOX_EVIDENCE_S3_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = String(process.env.GEOX_EVIDENCE_S3_SECRET_ACCESS_KEY ?? "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null; // Missing required config.
  const forcePathStyle = String(process.env.GEOX_EVIDENCE_S3_FORCE_PATH_STYLE ?? "true").trim().toLowerCase() !== "false";
  const ttlRaw = Number(process.env.GEOX_EVIDENCE_S3_PRESIGN_TTL_SEC ?? 900);
  const presignTtlSec = Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.min(Math.trunc(ttlRaw), 7 * 24 * 3600) : 900;
  return { endpoint, publicEndpoint, bucket, region, accessKeyId, secretAccessKey, forcePathStyle, presignTtlSec };
} // End helper.

function hmacSha256(key: Buffer | string, value: string): Buffer { return crypto.createHmac("sha256", key).update(value, "utf8").digest(); }
function s3UriEncode(s: string): string { return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }

function signV4Key(secretAccessKey: string, shortDate: string, region: string, service: string): Buffer { // Helper: AWS SigV4 signing key.
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, shortDate);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function parseS3Target(cfg: S3CompatConfig, objectKey: string): { endpoint: URL; host: string; pathName: string } { // Helper: derive host/path from endpoint + key.
  const endpoint = new URL(cfg.endpoint);
  const encodedKey = objectKey.split("/").map((x) => s3UriEncode(x)).join("/");
  if (cfg.forcePathStyle) return { endpoint, host: endpoint.host, pathName: `/${s3UriEncode(cfg.bucket)}/${encodedKey}` };
  return { endpoint, host: `${s3UriEncode(cfg.bucket)}.${endpoint.host}`, pathName: `/${encodedKey}` };
}

async function s3PutObjectFromFile(cfg: S3CompatConfig, objectKey: string, filePath: string, contentType: string): Promise<void> { // Helper: upload one file into S3-compatible storage.
  const body = fs.readFileSync(filePath);
  const bodySha256 = crypto.createHash("sha256").update(body).digest("hex");
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = iso.slice(0, 8);
  const { endpoint, host, pathName } = parseS3Target(cfg, objectKey);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${bodySha256}\nx-amz-date:${iso}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", pathName, "", canonicalHeaders, signedHeaders, bodySha256].join("\n");
  const scope = `${shortDate}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", iso, scope, crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex")].join("\n");
  const signature = crypto.createHmac("sha256", signV4Key(cfg.secretAccessKey, shortDate, cfg.region, "s3")).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const options = {
    method: "PUT",
    protocol: endpoint.protocol,
    hostname: cfg.forcePathStyle ? endpoint.hostname : `${s3UriEncode(cfg.bucket)}.${endpoint.hostname}`,
    port: endpoint.port || undefined,
    path: pathName,
    headers: {
      host,
      "content-type": contentType,
      "content-length": String(body.length),
      "x-amz-content-sha256": bodySha256,
      "x-amz-date": iso,
      authorization,
    } as Record<string, string>,
  };

  await new Promise<void>((resolve, reject) => {
    const req = (endpoint.protocol === "http:" ? http : https).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on("end", () => {
        const status = Number(res.statusCode ?? 0);
        if (status >= 200 && status < 300) return resolve();
        reject(new Error(`S3_UPLOAD_FAILED:${status}:${Buffer.concat(chunks).toString("utf8").slice(0, 200)}`));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function buildS3PresignedGetUrl(cfg: S3CompatConfig, objectKey: string): string { // Helper: generate SigV4 presigned GET URL.
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = iso.slice(0, 8);
  const targetCfg = cfg.publicEndpoint ? { ...cfg, endpoint: cfg.publicEndpoint } : cfg; // Prefer public endpoint for client-facing URLs.
  const { endpoint, host, pathName } = parseS3Target(targetCfg, objectKey);
  const scope = `${shortDate}/${cfg.region}/s3/aws4_request`;
  const queryParams = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${cfg.accessKeyId}/${scope}`],
    ["X-Amz-Date", iso],
    ["X-Amz-Expires", String(cfg.presignTtlSec)],
    ["X-Amz-SignedHeaders", "host"],
  ].sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalQuery = queryParams.map(([k, v]) => `${s3UriEncode(k)}=${s3UriEncode(v)}`).join("&");
  const canonicalRequest = ["GET", pathName, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", iso, scope, crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex")].join("\n");
  const signature = crypto.createHmac("sha256", signV4Key(cfg.secretAccessKey, shortDate, cfg.region, "s3")).update(stringToSign, "utf8").digest("hex");
  return `${endpoint.protocol}//${host}${pathName}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function getEvidenceObjectRootDir(): string { // Helper: root directory for local mirror object storage.
  return path.resolve(process.cwd(), process.env.GEOX_EVIDENCE_OBJECT_ROOT || path.join("runtime", "evidence_object_store_v1")); // Configurable root.
} // End helper.

function copyFileWithParents(src: string, dst: string) { // Helper: copy file and ensure parent exists.
  ensureDir(path.dirname(dst)); // Ensure parent exists.
  fs.copyFileSync(src, dst); // Copy bytes.
} // End helper.

function buildObjectStoreDownloadPath(job_id_raw: string | null | undefined, part: "bundle" | "manifest" | "checksums"): string { // Helper: stable API path for mirrored object storage downloads.
  return `/api/v1/evidence-export/jobs/${encodeURIComponent(String(job_id_raw ?? ""))}/download?source=object_store&part=${encodeURIComponent(part)}`; // Authorized API path.
} // End helper.

function normalizeObjectStoreKey(key_raw: string | null | undefined, bucket_raw?: string | null): string | null { // Helper: normalize key so it stays bucket-relative.
  const key = String(key_raw ?? "").trim().replace(/^\/+/, ""); // Remove optional leading slash.
  if (!key) return null;
  const bucket = String(bucket_raw ?? "").trim().replace(/^\/+|\/+$/g, ""); // Normalize bucket token.
  if (!bucket) return key;
  const bucketPrefix = `${bucket}/`;
  if (key === bucket) return ""; // Defensive: invalid but deterministic.
  if (key.startsWith(bucketPrefix)) return key.slice(bucketPrefix.length); // Strip accidental embedded bucket prefix.
  return key; // Already bucket-relative.
}

function objectStorePartKeysFromRow(row: any, export_format: ExportFormat): { bundleKey: string; manifestKey: string; checksumsKey: string } { // Helper: derive S3 object keys for all evidence-pack parts.
  const s3cfg = getS3CompatConfig();
  const keyFromRow = typeof row?.pack_object_store_key === "string" && row.pack_object_store_key.trim()
    ? row.pack_object_store_key.trim()
    : deriveObjectStoreKey(row?.tenant_id, row?.job_id, export_format);
  const normalizedKey = normalizeObjectStoreKey(keyFromRow, s3cfg?.bucket);
  const safeKey = normalizedKey && normalizedKey.length > 0 ? normalizedKey : deriveObjectStoreKey(row?.tenant_id, row?.job_id, export_format);
  const keyPrefix = safeKey.split("/").slice(0, -1).join("/");
  const bundleKey = safeKey;
  const manifestKey = `${keyPrefix}/manifest.json`;
  const checksumsKey = `${keyPrefix}/sha256.txt`;
  return { bundleKey, manifestKey, checksumsKey };
} // End helper.

function buildPackSummaryFromArtifactPath(row: any): EvidencePackSummary | null { // Helper: derive evidence pack summary from canonical artifact path plus optional pack index metadata.
  const artifact_path = typeof row?.artifact_path === "string" ? row.artifact_path : null; // Runtime artifact path.
  if (!artifact_path) return null; // Missing path => no summary.
  const pack_dir = path.dirname(artifact_path); // Pack directory is the parent of bundle.json.
  const bundle_path = artifact_path; // Canonical artifact path may be bundle.json or bundle.csv.
  const bundle_name = path.basename(bundle_path); // Runtime primary artifact filename.
  const manifest_path = path.join(pack_dir, "manifest.json"); // Manifest sidecar.
  const checksums_path = path.join(pack_dir, "sha256.txt"); // Checksums sidecar.
  if (!fs.existsSync(bundle_path) || !fs.existsSync(manifest_path) || !fs.existsSync(checksums_path)) return null; // Pack incomplete.

  let format = "geox_evidence_pack_v1"; // Default format for Sprint C3/C4 packs.
  let export_format: ExportFormat = normalizeExportFormat(row?.export_format); // Default export format from job row.
  let export_language: ExportLanguage = normalizeExportLanguage(row?.export_language); // Default export language from job row.
  try { // Best-effort parse manifest for explicit format.
    const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf8"));
    if (typeof manifest?.format === "string" && manifest.format.trim()) format = manifest.format.trim();
    if (typeof manifest?.export_format === "string") export_format = normalizeExportFormat(manifest.export_format);
    if (typeof manifest?.export_language === "string") export_language = normalizeExportLanguage(manifest.export_language);
  } catch {
    // Ignore parse errors and fall back to default format.
  }

  const storage_mode_raw = String(row?.pack_storage_mode ?? "LOCAL_FILE").trim().toUpperCase(); // Storage mode from pack index.
  const storage_mode: "LOCAL_FILE" | "LOCAL_MIRROR" | "S3_COMPAT" = storage_mode_raw === "LOCAL_MIRROR" ? "LOCAL_MIRROR" : storage_mode_raw === "S3_COMPAT" ? "S3_COMPAT" : "LOCAL_FILE";
  const { bundleKey, manifestKey, checksumsKey } = objectStorePartKeysFromRow(row, export_format); // Stable object store keys.
  const object_store_key = bundleKey; // Backward-compatible alias for bundle key.
  const s3cfg = storage_mode === "S3_COMPAT" ? getS3CompatConfig() : null; // S3 config for presigned URLs.
  const object_store_download_url = storage_mode === "LOCAL_MIRROR"
    ? buildObjectStoreDownloadPath(row?.job_id, "bundle")
    : storage_mode === "S3_COMPAT" && s3cfg
      ? buildS3PresignedGetUrl(s3cfg, bundleKey)
      : null; // Authorized download URL.
  const object_store_part_download_urls = storage_mode === "LOCAL_MIRROR"
    ? {
      bundle: buildObjectStoreDownloadPath(row?.job_id, "bundle"),
      manifest: buildObjectStoreDownloadPath(row?.job_id, "manifest"),
      checksums: buildObjectStoreDownloadPath(row?.job_id, "checksums"),
    }
    : storage_mode === "S3_COMPAT" && s3cfg
      ? {
        bundle: buildS3PresignedGetUrl(s3cfg, bundleKey),
        manifest: buildS3PresignedGetUrl(s3cfg, manifestKey),
        checksums: buildS3PresignedGetUrl(s3cfg, checksumsKey),
      }
      : { bundle: null, manifest: null, checksums: null };

  return {
    format,
    export_format,
    export_language,
    pack_dir,
    delivery: {
      storage_mode,
      object_store_key,
      object_store_presign_supported: storage_mode === "S3_COMPAT",
      object_store_download_url,
      object_store_part_download_urls,
    },
    files: [
      { name: bundle_name, sha256: sha256FileHex(bundle_path), content_type: bundleContentTypeForFormat(export_format), size_bytes: getFileSizeMaybe(bundle_path), download_part: "bundle" },
      { name: "manifest.json", sha256: sha256FileHex(manifest_path), content_type: "application/json", size_bytes: getFileSizeMaybe(manifest_path), download_part: "manifest" },
      { name: "sha256.txt", sha256: sha256FileHex(checksums_path), content_type: "text/plain; charset=utf-8", size_bytes: getFileSizeMaybe(checksums_path), download_part: "checksums" },
    ],
  };
} // End helper.

function enrichJobRow(row: any): any { // Helper: attach evidence pack summary and download urls to a job row.
  const pack = buildPackSummaryFromArtifactPath(row); // Derive pack metadata from runtime files plus optional pack-index metadata.
  const out = { ...row }; // Shallow clone row.
  if (!pack) return out; // Return row unchanged when files are unavailable.
  return {
    ...out,
    evidence_pack: {
      format: pack.format,
      export_format: pack.export_format,
      export_language: pack.export_language,
      delivery: pack.delivery,
      files: pack.files.map((f) => ({
        name: f.name,
        sha256: f.sha256,
        content_type: f.content_type,
        size_bytes: f.size_bytes,
        download_part: f.download_part,
        download_path: `/api/v1/evidence-export/jobs/${encodeURIComponent(String(out.job_id ?? ""))}/download?part=${encodeURIComponent(f.download_part)}`,
      })),
    },
  };
} // End helper.

function buildOperationBundlesFromFacts(facts: any[]): any[] { // Build operation-centric bundle for pilot closure evidence.
  type ChainItem = { recommendation: any | null; approval: any | null; operation_plan: any | null; task: any | null; receipt: any | null; timeline: any[] };
  const byOperation = new Map<string, ChainItem>();

  const ensure = (operation_plan_id: string): ChainItem => {
    const hit = byOperation.get(operation_plan_id);
    if (hit) return hit;
    const next: ChainItem = { recommendation: null, approval: null, operation_plan: null, task: null, receipt: null, timeline: [] };
    byOperation.set(operation_plan_id, next);
    return next;
  };

  for (const fact of facts) {
    const record = fact?.record_json ?? {};
    const type = String(record?.type ?? '');
    const payload = record?.payload ?? {};

    if (type === 'operation_plan_v1') {
      const operation_plan_id = String(payload?.operation_plan_id ?? '').trim();
      if (!operation_plan_id) continue;
      const row = ensure(operation_plan_id);
      row.operation_plan = record;
      row.timeline.push({ type, ts: fact?.occurred_at, fact_id: fact?.fact_id });
      continue;
    }

    if (type === 'operation_plan_transition_v1') {
      const operation_plan_id = String(payload?.operation_plan_id ?? '').trim();
      if (!operation_plan_id) continue;
      const row = ensure(operation_plan_id);
      row.timeline.push({ type, status: payload?.status ?? null, ts: fact?.occurred_at, fact_id: fact?.fact_id });
      continue;
    }

    if (type === 'ao_act_task_v0') {
      const operation_plan_id = String(payload?.operation_plan_id ?? payload?.meta?.operation_plan_id ?? '').trim();
      if (!operation_plan_id) continue;
      const row = ensure(operation_plan_id);
      row.task = record;
      row.timeline.push({ type, ts: fact?.occurred_at, fact_id: fact?.fact_id });
      continue;
    }

    if (type === 'ao_act_receipt_v0' || type === 'ao_act_receipt_v1') {
      const operation_plan_id = String(payload?.operation_plan_id ?? payload?.meta?.operation_plan_id ?? '').trim();
      if (!operation_plan_id) continue;
      const row = ensure(operation_plan_id);
      row.receipt = record;
      row.timeline.push({ type, status: payload?.status ?? payload?.meta?.receipt_status ?? null, ts: fact?.occurred_at, fact_id: fact?.fact_id });
      continue;
    }

    if (type === 'approval_decision_v1') {
      const operation_plan_id = String(payload?.operation_plan_id ?? '').trim();
      if (!operation_plan_id) continue;
      const row = ensure(operation_plan_id);
      row.approval = record;
      row.timeline.push({ type, decision: payload?.decision ?? null, ts: fact?.occurred_at, fact_id: fact?.fact_id });
      continue;
    }

    if (type === 'decision_recommendation_v1') {
      const recommendation_id = String(payload?.recommendation_id ?? '').trim();
      if (!recommendation_id) continue;
      for (const [operation_plan_id, row] of byOperation.entries()) {
        const recId = String(row.operation_plan?.payload?.recommendation_id ?? '').trim();
        if (recId && recId === recommendation_id) {
          row.recommendation = record;
          row.timeline.push({ type, ts: fact?.occurred_at, fact_id: fact?.fact_id });
          byOperation.set(operation_plan_id, row);
        }
      }
    }
  }

  const out: any[] = [];
  for (const [operation_plan_id, row] of byOperation.entries()) {
    out.push({
      operation_plan_id,
      operation_bundle: {
        recommendation: row.recommendation,
        approval: row.approval,
        operation_plan: row.operation_plan,
        task: row.task,
        receipt: row.receipt,
        timeline: row.timeline.sort((a, b) => Date.parse(String(a?.ts ?? '')) - Date.parse(String(b?.ts ?? '')))
      }
    });
  }
  return out;
}

async function buildEvidenceBundle(pool: Pool, tenant_id: string, scope: ExportScope, from_ts_ms: number, to_ts_ms: number): Promise<any> { // Build evidence JSON bundle.
  // Resolve devices in scope (for FIELD scope, include currently bound devices).
  let deviceIds: string[] = []; // Devices to include.
  if (scope.scope_type === "DEVICE" && scope.scope_id) { // Device scope.
    deviceIds = [scope.scope_id]; // Single device.
  } else if (scope.scope_type === "FIELD" && scope.scope_id) { // Field scope.
    const bindQ = await pool.query( // Query current bindings.
      `SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [tenant_id, scope.scope_id]
    ); // End query.
    deviceIds = bindQ.rows.map((r: any) => String(r.device_id)); // Collect devices.
  } // End scope branch.

  const factsQ = await pool.query( // Load facts in time window (tenant scoped filter is applied in app layer).
    `SELECT fact_id, occurred_at, source, record_json
       FROM facts
      WHERE occurred_at >= $1::timestamptz
        AND occurred_at <  $2::timestamptz
      ORDER BY occurred_at ASC
      LIMIT 200000`, // Safety cap for MVP.
    [nowIso(from_ts_ms), nowIso(to_ts_ms)]
  ); // End query.

  const facts: any[] = []; // Filtered facts to include.
  const seenFactIds = new Set<string>(); // Dedup guard (some facts may be injected outside the time window).
  for (const row of factsQ.rows) { // Iterate candidate facts.
    let rec: any = null; // Parsed record_json.
    try { rec = JSON.parse(row.record_json); } catch { rec = null; } // Parse JSON safely.
    if (!rec || typeof rec !== "object") continue; // Skip invalid rows.
    const entity = (rec as any).entity ?? {}; // Entity envelope.
    const recTenant = String(entity.tenant_id ?? ""); // Tenant id inside record.
    if (recTenant !== tenant_id) continue; // Enforce tenant filter (facts table can hold multiple tenants).
    if (scope.scope_type === "TENANT") { // Tenant scope includes everything for tenant.
      if (!seenFactIds.has(String(row.fact_id))) { // Dedup.
        seenFactIds.add(String(row.fact_id)); // Mark.
        facts.push({ fact_id: row.fact_id, occurred_at: row.occurred_at, source: row.source, record_json: rec }); // Include.
      }
      continue; // Next.
    } // End TENANT.
    if (scope.scope_type === "DEVICE") { // Device scope filter.
      const did = String(entity.device_id ?? ""); // Device id in entity.
      if (did && scope.scope_id && did === scope.scope_id) { // Match.
        if (!seenFactIds.has(String(row.fact_id))) { // Dedup.
          seenFactIds.add(String(row.fact_id)); // Mark.
          facts.push({ fact_id: row.fact_id, occurred_at: row.occurred_at, source: row.source, record_json: rec }); // Include.
        }
      } // End match.
      continue; // Next.
    } // End DEVICE.
    if (scope.scope_type === "FIELD") { // Field scope filter.
      const fid = String(entity.field_id ?? ""); // Field id in entity (for field facts or binding facts).
      const did = String(entity.device_id ?? ""); // Device id for telemetry/heartbeat.
      const matchField = scope.scope_id && fid === scope.scope_id; // Direct field match.
      const matchDevice = scope.scope_id && did && deviceIds.includes(did); // Device bound to field.
      if (matchField || matchDevice) { // If either match.
        if (!seenFactIds.has(String(row.fact_id))) { // Dedup.
          seenFactIds.add(String(row.fact_id)); // Mark.
          facts.push({ fact_id: row.fact_id, occurred_at: row.occurred_at, source: row.source, record_json: rec }); // Include.
        }
      } // End include.
      continue; // Next.
    } // End FIELD.
  } // End loop.

  // IMPORTANT (Sprint C2 acceptance): ensure the export artifact includes the job creation audit fact
  // evidence_export_job_created_v1.
  //
  // The client may compute to_ts_ms slightly before the server receives the request.
  // The server writes the job_created fact with its own now_ms, which can be > to_ts_ms,
  // causing the strict occurred_at filter to omit the job_created fact from the artifact.
  //
  // The evidence pack must remain self-describing and include the creation fact for audit.
  // Therefore, we best-effort inject the latest matching job_created fact for the tenant.
  const hasJobCreated = facts.some((f: any) => String(f?.record_json?.type ?? "") === "evidence_export_job_created_v1"); // Already present?
  if (!hasJobCreated) { // Only inject if missing.
    const q = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'evidence_export_job_created_v1'
          AND (record_json::jsonb#>>'{entity,tenant_id}') = $1
        ORDER BY occurred_at DESC
        LIMIT 5`,
      [tenant_id]
    );
    for (const r of q.rows) {
      let rr: any = null;
      try { rr = JSON.parse(r.record_json); } catch { rr = null; }
      const ent = rr?.entity ?? {};
      if (!rr) continue;
      if (String(ent?.tenant_id ?? "") !== tenant_id) continue;
      if (seenFactIds.has(String(r.fact_id))) continue;
      seenFactIds.add(String(r.fact_id));
      facts.unshift({ fact_id: r.fact_id, occurred_at: r.occurred_at, source: r.source, record_json: rr });
      break;
    }
  }

  // Ensure the evidence artifact includes the job completion audit fact
  // evidence_export_job_completed_v1.
  //
  // Similar to job_created, the completion fact may be written with a server-side timestamp
  // that is slightly after the client-side to_ts_ms captured for the export request.
  // The strict occurred_at filter can omit the completion fact from the artifact.
  //
  // The evidence pack must remain self-describing and include the completion fact for audit.
  // Therefore, we best-effort inject the latest matching job_completed fact for the tenant.
  const hasJobCompleted = facts.some((f: any) => String(f?.record_json?.type ?? "") === "evidence_export_job_completed_v1");
  if (!hasJobCompleted) {
    const q2 = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'evidence_export_job_completed_v1'
          AND (record_json::jsonb#>>'{entity,tenant_id}') = $1
        ORDER BY occurred_at DESC
        LIMIT 5`,
      [tenant_id]
    );
    for (const r of q2.rows) {
      let rr: any = null;
      try { rr = JSON.parse(r.record_json); } catch { rr = null; }
      const ent = rr?.entity ?? {};
      if (!rr) continue;
      if (String(ent?.tenant_id ?? "") !== tenant_id) continue;
      if (seenFactIds.has(String(r.fact_id))) continue;
      seenFactIds.add(String(r.fact_id));
      facts.unshift({ fact_id: r.fact_id, occurred_at: r.occurred_at, source: r.source, record_json: rr });
      break;
    }
  }




  const taskFactRows = facts.filter((f: any) => String(f?.record_json?.type ?? "") === "ao_act_task_v0"); // Collect task facts already included in the bundle.
  const taskIds = Array.from(new Set(taskFactRows.map((f: any) => String(f?.record_json?.payload?.act_task_id ?? "")).filter(Boolean))); // Collect unique act_task_id values from exported task facts.
  const operationPlanFacts: any[] = []; // Collect related operation_plan_v1 facts that must travel with the execution chain.
  for (const actTaskId of taskIds) { // Resolve one operation_plan_v1 fact per exported task when available.
    const qPlan = await pool.query( // Query latest operation_plan_v1 by act_task_id.
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,act_task_id}') = $2
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant_id, actTaskId]
    ); // End operation plan query.
    if ((qPlan.rowCount ?? 0) < 1) continue; // Skip tasks that do not yet have an operation plan bridge.
    const planRow = qPlan.rows[0]; // Read the winning operation plan row.
    let planRecord: any = null; // Prepare parsed operation plan JSON.
    try { planRecord = typeof planRow.record_json === 'string' ? JSON.parse(planRow.record_json) : planRow.record_json; } catch { planRecord = null; } // Parse record_json safely.
    if (!planRecord) continue; // Skip malformed records.
    if (!seenFactIds.has(String(planRow.fact_id))) { // Inject operation plan fact only once.
      seenFactIds.add(String(planRow.fact_id)); // Mark injected plan fact id as seen.
      operationPlanFacts.push({ fact_id: planRow.fact_id, occurred_at: planRow.occurred_at, source: planRow.source, record_json: planRecord }); // Append normalized operation plan fact.
      facts.push({ fact_id: planRow.fact_id, occurred_at: planRow.occurred_at, source: planRow.source, record_json: planRecord }); // Add plan fact into exported facts array.
    } // End inject plan fact guard.
          const operationPlanId = String(planRecord?.payload?.operation_plan_id ?? '').trim(); // Read operation_plan_id for transition lookup.

            let injectedApprovalDecision = false; // Track whether approval_decision_v1 has already been injected for this plan.

      const approvalDecisionFactId = String(planRecord?.payload?.approval_decision_fact_id ?? '').trim(); // Read approval_decision_fact_id for approval decision injection.
      if (approvalDecisionFactId && !seenFactIds.has(approvalDecisionFactId)) { // Inject linked approval_decision_v1 fact when present.
        const qApprovalDecision = await pool.query(
          `SELECT fact_id, occurred_at, source, record_json
             FROM facts
            WHERE fact_id = $1
              AND (record_json::jsonb->>'type') = 'approval_decision_v1'
              AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
            LIMIT 1`,
          [approvalDecisionFactId, tenant_id]
        ); // End approval decision query.
        if ((qApprovalDecision.rowCount ?? 0) > 0) { // Inject approval decision when found.
          const decisionRow = qApprovalDecision.rows[0];
          let decisionRecord: any = null;
          try { decisionRecord = typeof decisionRow.record_json === 'string' ? JSON.parse(decisionRow.record_json) : decisionRow.record_json; } catch { decisionRecord = null; }
          if (decisionRecord && !seenFactIds.has(String(decisionRow.fact_id))) {
            seenFactIds.add(String(decisionRow.fact_id));
            facts.push({ fact_id: decisionRow.fact_id, occurred_at: decisionRow.occurred_at, source: decisionRow.source, record_json: decisionRecord });
            injectedApprovalDecision = true;
          }
        }
      }

      if (!injectedApprovalDecision) { // Fallback 1: locate approval_decision_v1 by approval_request_id.
        const approvalRequestId = String(planRecord?.payload?.approval_request_id ?? '').trim();
        if (approvalRequestId) {
          const qApprovalDecisionByRequest = await pool.query(
            `SELECT fact_id, occurred_at, source, record_json
               FROM facts
              WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
                AND (
                  (record_json::jsonb#>>'{payload,request_id}') = $1
                  OR (record_json::jsonb#>>'{payload,approval_request_id}') = $1
                )
                AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
              ORDER BY occurred_at DESC, fact_id DESC
              LIMIT 1`,
            [approvalRequestId, tenant_id]
          ); // End approval decision fallback-by-request query.
          if ((qApprovalDecisionByRequest.rowCount ?? 0) > 0) {
            const decisionRow = qApprovalDecisionByRequest.rows[0];
            let decisionRecord: any = null;
            try { decisionRecord = typeof decisionRow.record_json === 'string' ? JSON.parse(decisionRow.record_json) : decisionRow.record_json; } catch { decisionRecord = null; }
            if (decisionRecord && !seenFactIds.has(String(decisionRow.fact_id))) {
              seenFactIds.add(String(decisionRow.fact_id));
              facts.push({ fact_id: decisionRow.fact_id, occurred_at: decisionRow.occurred_at, source: decisionRow.source, record_json: decisionRecord });
              injectedApprovalDecision = true;
            }
          }
        }
      }

      if (!injectedApprovalDecision) { // Fallback 2: locate approval_decision_v1 by act_task_id.
        const actTaskId = String(planRecord?.payload?.act_task_id ?? '').trim();
        if (actTaskId) {
          const qApprovalDecisionByTask = await pool.query(
            `SELECT fact_id, occurred_at, source, record_json
               FROM facts
              WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
                AND (record_json::jsonb#>>'{payload,act_task_id}') = $1
                AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
              ORDER BY occurred_at DESC, fact_id DESC
              LIMIT 1`,
            [actTaskId, tenant_id]
          ); // End approval decision fallback-by-task query.
          if ((qApprovalDecisionByTask.rowCount ?? 0) > 0) {
            const decisionRow = qApprovalDecisionByTask.rows[0];
            let decisionRecord: any = null;
            try { decisionRecord = typeof decisionRow.record_json === 'string' ? JSON.parse(decisionRow.record_json) : decisionRow.record_json; } catch { decisionRecord = null; }
            if (decisionRecord && !seenFactIds.has(String(decisionRow.fact_id))) {
              seenFactIds.add(String(decisionRow.fact_id));
              facts.push({ fact_id: decisionRow.fact_id, occurred_at: decisionRow.occurred_at, source: decisionRow.source, record_json: decisionRecord });
              injectedApprovalDecision = true;
            }
          }
        }
      }

      const receiptFactId = String(planRecord?.payload?.receipt_fact_id ?? '').trim(); // Read receipt_fact_id for receipt injection.
      if (receiptFactId && !seenFactIds.has(receiptFactId)) { // Inject linked receipt fact when present.
        const qReceipt = await pool.query(
          `SELECT fact_id, occurred_at, source, record_json
             FROM facts
            WHERE fact_id = $1
            LIMIT 1`,
          [receiptFactId]
        ); // End receipt query.
        if ((qReceipt.rowCount ?? 0) > 0) { // Inject receipt when found.
          const receiptRow = qReceipt.rows[0];
          let receiptRecord: any = null;
          try { receiptRecord = typeof receiptRow.record_json === 'string' ? JSON.parse(receiptRow.record_json) : receiptRow.record_json; } catch { receiptRecord = null; }
          if (receiptRecord && !seenFactIds.has(String(receiptRow.fact_id))) {
            seenFactIds.add(String(receiptRow.fact_id));
            facts.push({ fact_id: receiptRow.fact_id, occurred_at: receiptRow.occurred_at, source: receiptRow.source, record_json: receiptRecord });
          }
        }
      }

      const qTransition = await pool.query( // Query all operation_plan_transition_v1 rows for this plan.
        `SELECT fact_id, occurred_at, source, record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'operation_plan_transition_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $2
          ORDER BY occurred_at ASC, fact_id ASC`,
        [tenant_id, operationPlanId]
      ); // End transition query.
    for (const transitionRow of qTransition.rows) { // Normalize and inject each transition fact.
      let transitionRecord: any = null; // Prepare parsed transition JSON.
      try { transitionRecord = typeof transitionRow.record_json === 'string' ? JSON.parse(transitionRow.record_json) : transitionRow.record_json; } catch { transitionRecord = null; } // Parse record_json safely.
      if (!transitionRecord) continue; // Skip malformed transition records.
      if (seenFactIds.has(String(transitionRow.fact_id))) continue; // Skip already-included transition rows.
      seenFactIds.add(String(transitionRow.fact_id)); // Mark transition fact id as seen.
      facts.push({ fact_id: transitionRow.fact_id, occurred_at: transitionRow.occurred_at, source: transitionRow.source, record_json: transitionRecord }); // Add transition into exported facts array.
    } // End transition injection loop.
  } // End related operation plan injection loop.
    if (scope.scope_type === "FIELD" && scope.scope_id) { // FIELD scope fallback: inject operation plans by field/time window even when task facts were not exported.
    const qPlansByField = await pool.query( // Query operation_plan_v1 rows directly by field scope and export window.
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,target,kind}') = 'field'
          AND (record_json::jsonb#>>'{payload,target,ref}') = $2
          AND occurred_at >= $3::timestamptz
          AND occurred_at <  $4::timestamptz
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant_id, scope.scope_id, nowIso(from_ts_ms), nowIso(to_ts_ms)]
    ); // End field-scope operation plan query.
        for (const planRow of qPlansByField.rows) { // Normalize and inject each matching operation plan fact.
      let planRecord: any = null; // Prepare parsed operation plan JSON.
      try { planRecord = typeof planRow.record_json === 'string' ? JSON.parse(planRow.record_json) : planRow.record_json; } catch { planRecord = null; } // Parse record_json safely.
      if (!planRecord) continue; // Skip malformed plan records.

      if (!seenFactIds.has(String(planRow.fact_id))) { // Inject operation plan fact only once.
        seenFactIds.add(String(planRow.fact_id)); // Mark operation plan fact id as seen.
        facts.push({ fact_id: planRow.fact_id, occurred_at: planRow.occurred_at, source: planRow.source, record_json: planRecord }); // Add plan fact into exported facts array.
      } // End inject plan fact guard.

      const operationPlanId = String(planRecord?.payload?.operation_plan_id ?? '').trim(); // Read operation_plan_id for transition lookup.

            let injectedApprovalDecision = false; // Track whether approval_decision_v1 has already been injected for this plan.

      const approvalDecisionFactId = String(planRecord?.payload?.approval_decision_fact_id ?? '').trim(); // Read approval_decision_fact_id for approval decision injection.
      if (approvalDecisionFactId && !seenFactIds.has(approvalDecisionFactId)) { // Inject linked approval_decision_v1 fact when present.
        const qApprovalDecision = await pool.query(
          `SELECT fact_id, occurred_at, source, record_json
             FROM facts
            WHERE fact_id = $1
              AND (record_json::jsonb->>'type') = 'approval_decision_v1'
              AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
            LIMIT 1`,
          [approvalDecisionFactId, tenant_id]
        ); // End approval decision query.
        if ((qApprovalDecision.rowCount ?? 0) > 0) { // Inject approval decision when found.
          const decisionRow = qApprovalDecision.rows[0];
          let decisionRecord: any = null;
          try { decisionRecord = typeof decisionRow.record_json === 'string' ? JSON.parse(decisionRow.record_json) : decisionRow.record_json; } catch { decisionRecord = null; }
          if (decisionRecord && !seenFactIds.has(String(decisionRow.fact_id))) {
            seenFactIds.add(String(decisionRow.fact_id));
            facts.push({ fact_id: decisionRow.fact_id, occurred_at: decisionRow.occurred_at, source: decisionRow.source, record_json: decisionRecord });
            injectedApprovalDecision = true;
          }
        }
      }

      if (!injectedApprovalDecision) { // Fallback 1: locate approval_decision_v1 by approval_request_id.
        const approvalRequestId = String(planRecord?.payload?.approval_request_id ?? '').trim();
        if (approvalRequestId) {
          const qApprovalDecisionByRequest = await pool.query(
            `SELECT fact_id, occurred_at, source, record_json
               FROM facts
              WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
                AND (
                  (record_json::jsonb#>>'{payload,request_id}') = $1
                  OR (record_json::jsonb#>>'{payload,approval_request_id}') = $1
                )
                AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
              ORDER BY occurred_at DESC, fact_id DESC
              LIMIT 1`,
            [approvalRequestId, tenant_id]
          ); // End approval decision fallback-by-request query.
          if ((qApprovalDecisionByRequest.rowCount ?? 0) > 0) {
            const decisionRow = qApprovalDecisionByRequest.rows[0];
            let decisionRecord: any = null;
            try { decisionRecord = typeof decisionRow.record_json === 'string' ? JSON.parse(decisionRow.record_json) : decisionRow.record_json; } catch { decisionRecord = null; }
            if (decisionRecord && !seenFactIds.has(String(decisionRow.fact_id))) {
              seenFactIds.add(String(decisionRow.fact_id));
              facts.push({ fact_id: decisionRow.fact_id, occurred_at: decisionRow.occurred_at, source: decisionRow.source, record_json: decisionRecord });
              injectedApprovalDecision = true;
            }
          }
        }
      }

      if (!injectedApprovalDecision) { // Fallback 2: locate approval_decision_v1 by act_task_id.
        const actTaskId = String(planRecord?.payload?.act_task_id ?? '').trim();
        if (actTaskId) {
          const qApprovalDecisionByTask = await pool.query(
            `SELECT fact_id, occurred_at, source, record_json
               FROM facts
              WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
                AND (record_json::jsonb#>>'{payload,act_task_id}') = $1
                AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
              ORDER BY occurred_at DESC, fact_id DESC
              LIMIT 1`,
            [actTaskId, tenant_id]
          ); // End approval decision fallback-by-task query.
          if ((qApprovalDecisionByTask.rowCount ?? 0) > 0) {
            const decisionRow = qApprovalDecisionByTask.rows[0];
            let decisionRecord: any = null;
            try { decisionRecord = typeof decisionRow.record_json === 'string' ? JSON.parse(decisionRow.record_json) : decisionRow.record_json; } catch { decisionRecord = null; }
            if (decisionRecord && !seenFactIds.has(String(decisionRow.fact_id))) {
              seenFactIds.add(String(decisionRow.fact_id));
              facts.push({ fact_id: decisionRow.fact_id, occurred_at: decisionRow.occurred_at, source: decisionRow.source, record_json: decisionRecord });
              injectedApprovalDecision = true;
            }
          }
        }
      }

      const receiptFactId = String(planRecord?.payload?.receipt_fact_id ?? '').trim(); // Read receipt_fact_id for receipt injection.
      if (receiptFactId && !seenFactIds.has(receiptFactId)) { // Inject linked receipt fact when present.
        const qReceipt = await pool.query(
          `SELECT fact_id, occurred_at, source, record_json
             FROM facts
            WHERE fact_id = $1
            LIMIT 1`,
          [receiptFactId]
        ); // End receipt query.
        if ((qReceipt.rowCount ?? 0) > 0) { // Inject receipt when found.
          const receiptRow = qReceipt.rows[0];
          let receiptRecord: any = null;
          try { receiptRecord = typeof receiptRow.record_json === 'string' ? JSON.parse(receiptRow.record_json) : receiptRow.record_json; } catch { receiptRecord = null; }
          if (receiptRecord && !seenFactIds.has(String(receiptRow.fact_id))) {
            seenFactIds.add(String(receiptRow.fact_id));
            facts.push({ fact_id: receiptRow.fact_id, occurred_at: receiptRow.occurred_at, source: receiptRow.source, record_json: receiptRecord });
          }
        }
      }

      if (!operationPlanId) continue; // Skip transition lookup when plan id is missing.

      const qTransition = await pool.query( // Query all operation_plan_transition_v1 rows for this field-scoped plan.
        `SELECT fact_id, occurred_at, source, record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'operation_plan_transition_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $2
          ORDER BY occurred_at ASC, fact_id ASC`,
        [tenant_id, operationPlanId]
      ); // End transition query.
      for (const transitionRow of qTransition.rows) { // Normalize and inject each transition fact.
        let transitionRecord: any = null; // Prepare parsed transition JSON.
        try { transitionRecord = typeof transitionRow.record_json === 'string' ? JSON.parse(transitionRow.record_json) : transitionRow.record_json; } catch { transitionRecord = null; } // Parse record_json safely.
        if (!transitionRecord) continue; // Skip malformed transition records.
        if (seenFactIds.has(String(transitionRow.fact_id))) continue; // Skip already-included transition rows.
        seenFactIds.add(String(transitionRow.fact_id)); // Mark transition fact id as seen.
        facts.push({ fact_id: transitionRow.fact_id, occurred_at: transitionRow.occurred_at, source: transitionRow.source, record_json: transitionRecord }); // Add transition into exported facts array.
      } // End transition injection loop.
    } // End field-scope operation plan injection loop.
  } // End FIELD scope fallback injection.
  facts.sort((a: any, b: any) => { // Re-sort facts after best-effort chain injection.
    const ta = Date.parse(String(a?.occurred_at ?? '')) || 0; // Convert occurred_at to comparable timestamp.
    const tb = Date.parse(String(b?.occurred_at ?? '')) || 0; // Convert occurred_at to comparable timestamp.
    if (ta !== tb) return ta - tb; // Preserve chronological ordering first.
    return String(a?.fact_id ?? '').localeCompare(String(b?.fact_id ?? '')); // Break ties deterministically by fact id.
  }); // End re-sort.

  // Snapshot relevant projections for convenience (not a source of truth, but useful in delivery).
  const snapshot: any = {}; // Snapshot object.
  if (scope.scope_type === "FIELD" && scope.scope_id) { // Field snapshot.
    const fieldQ = await pool.query( // Field record.
      `SELECT * FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [tenant_id, scope.scope_id]
    ); // End query.
    const polyQ = await pool.query( // Polygon record.
      `SELECT * FROM field_polygon_v1 WHERE tenant_id = $1 AND field_id = $2`,
      [tenant_id, scope.scope_id]
    ); // End query.
    snapshot.field = fieldQ.rowCount ? fieldQ.rows[0] : null; // Field row.
    snapshot.field_polygon = polyQ.rowCount ? polyQ.rows[0] : null; // Polygon row.
    snapshot.bound_devices = deviceIds; // Bound devices at export time.
  } // End field snapshot.
  if (scope.scope_type === "DEVICE" && scope.scope_id) { // Device snapshot.
    const devQ = await pool.query( // Device record.
      `SELECT * FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2`,
      [tenant_id, scope.scope_id]
    ); // End query.
    const stQ = await pool.query( // Status record.
      `SELECT * FROM device_status_index_v1 WHERE tenant_id = $1 AND device_id = $2`,
      [tenant_id, scope.scope_id]
    ); // End query.
    snapshot.device = devQ.rowCount ? devQ.rows[0] : null; // Device row.
    snapshot.device_status = stQ.rowCount ? stQ.rows[0] : null; // Status row.
  } // End device snapshot.

  const acceptance_results = facts // Stage C3: export acceptance results as first-class section in evidence bundle.
    .filter((f: any) => String(f?.record_json?.type ?? "") === "acceptance_result_v1")
    .map((f: any) => ({ // Keep result envelope self-describing for downstream audit tooling.
      fact_id: f?.fact_id ?? null,
      occurred_at: f?.occurred_at ?? null,
      source: f?.source ?? null,
      record_json: f?.record_json ?? null,
    }));

  return { // Return bundle.
    meta: { tenant_id, scope, from_ts_ms, to_ts_ms, built_at_ts_ms: Date.now() }, // Metadata.
    snapshot, // Projection snapshot (best-effort).
    facts, // Facts array (source of truth).
    acceptance_results, // Stage C3: required acceptance_result_v1 export view.
    operation_bundles: buildOperationBundlesFromFacts(facts), // Operation-centric export structure for pilot audit closure.
  }; // End return.
} // End bundle builder.

function csvEscape(v: any): string { // Helper: RFC4180-ish escaping for compact evidence CSV.
  const s = v == null ? "" : String(v); // Normalize value.
  if (!/[",\n\r]/.test(s)) return s; // Fast path.
  return `"${s.replace(/"/g, '""')}"`; // Quote and escape.
} // End helper.

function buildEvidenceCsv(bundle: any): string { // Helper: flatten evidence facts into a delivery-friendly CSV.
  const rows: string[] = []; // Collect CSV rows.
  rows.push(["fact_id","occurred_at","source","type","tenant_id","field_id","device_id","payload_json","record_json"].join(","));
  const facts = Array.isArray(bundle?.facts) ? bundle.facts : []; // Facts array.
  for (const fact of facts) { // Iterate exported facts.
    const rec = fact?.record_json ?? {}; // Record object.
    const ent = rec?.entity ?? {}; // Entity block.
    const payloadJson = JSON.stringify(rec?.payload ?? {}); // Payload JSON string.
    const recordJson = JSON.stringify(rec ?? {}); // Full record JSON string.
    rows.push([
      csvEscape(fact?.fact_id ?? ""),
      csvEscape(fact?.occurred_at ?? ""),
      csvEscape(fact?.source ?? ""),
      csvEscape(rec?.type ?? ""),
      csvEscape(ent?.tenant_id ?? ""),
      csvEscape(ent?.field_id ?? ""),
      csvEscape(ent?.device_id ?? ""),
      csvEscape(payloadJson),
      csvEscape(recordJson),
    ].join(","));
  }
  return rows.join("\n") + "\n"; // Final CSV file.
} // End helper.

function pdfEscapeText(s: string): string { // Helper: escape PDF text control characters.
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); // Escape backslash and parens.
} // End helper.

function buildCommercialReportLines(bundle: any, scope: ExportScope, from_ts_ms: number, to_ts_ms: number, export_language: ExportLanguage): string[] { // Helper: build customer-facing report lines for PDF.
  const facts = Array.isArray(bundle?.facts) ? bundle.facts : []; // Facts list.
  const operationBundles = Array.isArray(bundle?.operation_bundles) ? bundle.operation_bundles : []; // Operation chains.
  const acceptanceResults = Array.isArray(bundle?.acceptance_results) ? bundle.acceptance_results : []; // Acceptance rows.
  const title = export_language === "en-US" ? "GEOX Commercial Report (Evidence Bundle)" : "GEOX 商业报告（证据包）";
  const lines: string[] = [
    title,
    `Tenant: ${bundle?.meta?.tenant_id ?? "-"}`,
    `Scope: ${scope.scope_type}${scope.scope_id ? `:${scope.scope_id}` : ""}`,
    `Window: ${new Date(from_ts_ms).toISOString()} -> ${new Date(to_ts_ms).toISOString()}`,
    `Language: ${export_language}`,
    `Built at: ${new Date(bundle?.meta?.built_at_ts_ms ?? Date.now()).toISOString()}`,
    "",
    "[地块 / Field]",
    `Field ID: ${bundle?.snapshot?.field?.field_id ?? bundle?.snapshot?.field?.id ?? scope.scope_id ?? "-"}`,
    `Field Name: ${bundle?.snapshot?.field?.name ?? bundle?.snapshot?.field?.field_name ?? "-"}`,
    `Area(ha): ${bundle?.snapshot?.field?.area_ha ?? "-"}`,
    "",
    `[作业 / Operations] total=${operationBundles.length}`,
  ];

  for (let i = 0; i < Math.min(5, operationBundles.length); i += 1) { // Keep concise for customer readable output.
    const row = operationBundles[i];
    const b = row?.operation_bundle ?? {};
    const plan = b?.operation_plan?.payload ?? {};
    const task = b?.task?.payload ?? {};
    const receipt = b?.receipt?.payload ?? {};
    const operationId = row?.operation_plan_id ?? plan?.operation_plan_id ?? "-";
    lines.push(`- OP#${i + 1}: ${operationId} status=${task?.status ?? receipt?.status ?? plan?.status ?? "-"}`);
    lines.push(`  action=${plan?.action_type ?? task?.action_type ?? "-"}`);
  }
  if (operationBundles.length > 5) lines.push(`... +${operationBundles.length - 5} more operations`);

  const executorRows = operationBundles.map((x: any) => {
    const taskPayload = x?.operation_bundle?.task?.payload ?? {};
    const receiptPayload = x?.operation_bundle?.receipt?.payload ?? {};
    const executor = taskPayload?.executor_label ?? taskPayload?.executor_id ?? receiptPayload?.executor_label ?? receiptPayload?.operator_id ?? "UNKNOWN";
    return String(executor);
  }).filter((x: string) => x && x !== "UNKNOWN");
  const uniqueExecutors = Array.from(new Set(executorRows));
  lines.push("");
  lines.push("[执行者 / Executors]");
  lines.push(`Count: ${uniqueExecutors.length}`);
  if (uniqueExecutors.length > 0) lines.push(`Top: ${uniqueExecutors.slice(0, 6).join(", ")}`);

  const receiptFacts = facts.filter((f: any) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(f?.record_json?.type ?? "")));
  lines.push("");
  lines.push("[证据 / Evidence]");
  lines.push(`Facts exported: ${facts.length}`);
  lines.push(`Receipt evidence count: ${receiptFacts.length}`);
  lines.push(`Acceptance records: ${acceptanceResults.length}`);

  lines.push("");
  lines.push("[验收结果 / Acceptance]");
  const passCount = acceptanceResults.filter((x: any) => String(x?.record_json?.payload?.verdict ?? "").toUpperCase() === "PASS").length;
  const failCount = acceptanceResults.filter((x: any) => String(x?.record_json?.payload?.verdict ?? "").toUpperCase() === "FAIL").length;
  const pendingCount = Math.max(0, operationBundles.length - passCount - failCount);
  lines.push(`PASS=${passCount} FAIL=${failCount} PENDING=${pendingCount}`);

  lines.push("");
  lines.push("[时间线 / Timeline]");
  let timelineAdded = 0;
  for (const row of operationBundles) {
    const operationId = String(row?.operation_plan_id ?? "-");
    const timeline = Array.isArray(row?.operation_bundle?.timeline) ? row.operation_bundle.timeline : [];
    for (const t of timeline.slice(0, 4)) {
      lines.push(`${operationId} | ${t?.ts ?? "-"} | ${t?.type ?? "-"} ${t?.status ?? t?.decision ?? ""}`.trim());
      timelineAdded += 1;
      if (timelineAdded >= 16) break;
    }
    if (timelineAdded >= 16) break;
  }
  if (timelineAdded === 0) lines.push("No timeline events");

  return lines;
}

function buildEvidencePdf(bundle: any, scope: ExportScope, from_ts_ms: number, to_ts_ms: number, export_language: ExportLanguage): Buffer { // Helper: generate a minimal customer-facing PDF report.
  const lines = buildCommercialReportLines(bundle, scope, from_ts_ms, to_ts_ms, export_language); // Expand report sections for business handoff.
  const maxLines = 42; // Keep one-page simple layout for now.
  const renderLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) renderLines.push(`...truncated, total lines=${lines.length}`);

  const streamLines: string[] = ["BT", "/F1 12 Tf", "40 780 Td"]; // PDF text operators.
  for (let i = 0; i < renderLines.length; i += 1) { // Emit lines top-to-bottom.
    const text = pdfEscapeText(String(renderLines[i] ?? "")); // Escape text for PDF literal string.
    if (i > 0) streamLines.push("0 -16 Td"); // Move down for each next line.
    streamLines.push(`(${text}) Tj`); // Draw one text line.
  }
  streamLines.push("ET"); // End text block.
  const stream = streamLines.join("\n"); // Final page content stream.

  const objects = [ // Minimal PDF object list.
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj`,
  ]; // End object list.

  let pdf = "%PDF-1.4\n"; // PDF header.
  const offsets: number[] = [0]; // xref requires object offsets with index 0 reserved.
  for (const obj of objects) { // Append each object and capture its byte offset.
    offsets.push(Buffer.byteLength(pdf, "utf8")); // Offset before appending current object.
    pdf += `${obj}\n`; // Append object body.
  } // End append loop.
  const xrefOffset = Buffer.byteLength(pdf, "utf8"); // Offset where xref starts.
  pdf += `xref\n0 ${objects.length + 1}\n`; // Cross-reference header.
  pdf += "0000000000 65535 f \n"; // Free object 0 entry.
  for (let i = 1; i < offsets.length; i += 1) { // Emit each xref entry.
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`; // Fixed-width xref row.
  } // End xref loop.
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`; // Trailer.
  return Buffer.from(pdf, "utf8"); // Return PDF bytes.
} // End helper.

async function runJob(pool: Pool, tenant_id: string, job_id: string, scope: ExportScope, from_ts_ms: number, to_ts_ms: number, export_format: ExportFormat, export_language: ExportLanguage, program_id: string | null = null, field_id: string | null = null, season_id: string | null = null): Promise<void> { // Execute job in-process.
  const started_ms = Date.now(); // Start time.

  // Transition job to RUNNING.
  await pool.query(
    `UPDATE evidence_export_job_index_v1
        SET status = 'RUNNING', updated_ts_ms = $3, error = NULL
      WHERE tenant_id = $1 AND job_id = $2`,
    [tenant_id, job_id, started_ms]
  ); // End update.

  const RUNTIME_DIR = path.resolve(process.cwd(), "runtime", "evidence_exports_v1"); // Runtime artifact directory.
  ensureDir(RUNTIME_DIR); // Ensure directory exists.

  try { // Job execution.
    const bundle = await buildEvidenceBundle(pool, tenant_id, scope, from_ts_ms, to_ts_ms); // Build evidence bundle.
    const operationPlanIds = Array.isArray(bundle?.operation_bundles)
      ? bundle.operation_bundles.map((x: any) => String(x?.operation_plan_id ?? "").trim()).filter(Boolean)
      : [];
    const factTaskIds = Array.isArray(bundle?.facts)
      ? bundle.facts
        .filter((f: any) => String(f?.record_json?.type ?? "") === "ao_act_task_v0")
        .map((f: any) => String(f?.record_json?.payload?.act_task_id ?? "").trim())
        .filter(Boolean)
      : [];
    const actTaskIds = Array.from(new Set(factTaskIds));

    const pack_dir = path.join(RUNTIME_DIR, job_id); // Evidence pack directory (self-describing bundle).
    ensureDir(pack_dir); // Ensure pack directory exists.

    const bundle_name = bundleFileNameForFormat(export_format); // Primary artifact filename by format.
    const bundle_path = path.join(pack_dir, bundle_name); // Canonical bundle payload.
    if (export_format === "CSV") { // CSV delivery view.
      fs.writeFileSync(bundle_path, buildEvidenceCsv(bundle), "utf8"); // Write CSV artifact.
    } else if (export_format === "PDF") { // PDF delivery view.
      fs.writeFileSync(bundle_path, buildEvidencePdf(bundle, scope, from_ts_ms, to_ts_ms, export_language)); // Write PDF artifact.
    } else { // JSON delivery view.
      fs.writeFileSync(bundle_path, JSON.stringify(bundle, null, 2), "utf8"); // Write JSON artifact.
    }
    const bundle_sha256 = sha256FileHex(bundle_path); // Compute digest for bundle.

    const files = [ // File list used by manifest.json and downstream verification.
      { name: bundle_name, sha256: bundle_sha256, content_type: bundleContentTypeForFormat(export_format) },
    ];

    const manifest = { // Self-describing evidence pack manifest.
      format: export_format === "CSV" ? "geox_evidence_pack_csv_v1" : export_format === "PDF" ? "geox_evidence_pack_pdf_v1" : "geox_evidence_pack_v1",
      export_format,
      export_language,
      job_id,
      tenant_id,
      scope,
      from_ts_ms,
      to_ts_ms,
      started_ts_ms: started_ms,
      built_at_ts_ms: Date.now(),
      files,
    };

    const manifest_path = path.join(pack_dir, "manifest.json"); // Manifest file path.
    fs.writeFileSync(manifest_path, JSON.stringify(manifest, null, 2), "utf8"); // Write manifest.
    const manifest_sha256 = sha256FileHex(manifest_path); // Digest after write.

        const checksums_text = [ // Sidecar checksums file (compatible with common sha256sum tooling).
      `${bundle_sha256}  ${bundle_name}`,
      `${manifest_sha256}  manifest.json`,
    ].join("\n") + "\n";
    const checksums_path = path.join(pack_dir, "sha256.txt"); // Checksums file path.
    fs.writeFileSync(checksums_path, checksums_text, "utf8"); // Write checksums.
    const checksums_sha256 = sha256TextHex(checksums_text); // Digest for checksums file content.

    const object_store_key = deriveObjectStoreKey(tenant_id, job_id, export_format); // Stable object-store key contract.
    const storage_mode = getEvidenceStorageMode(); // Effective storage mode.
    const s3cfg = storage_mode === "S3_COMPAT" ? getS3CompatConfig() : null; // S3-compatible config for object storage mode.
    if (storage_mode === "S3_COMPAT" && !s3cfg) throw new Error("S3_CONFIG_MISSING"); // Fail fast on invalid object storage config.
    let object_store_bundle_path: string | null = null; // Mirrored bundle path when enabled.
    let object_store_manifest_path: string | null = null; // Mirrored manifest path when enabled.
    let object_store_checksums_path: string | null = null; // Mirrored checksums path when enabled.
    if (storage_mode === "LOCAL_MIRROR") { // Optional local mirror backend for object-storage-like delivery.
      const object_root = getEvidenceObjectRootDir(); // Mirror root.
      object_store_bundle_path = path.join(object_root, object_store_key); // Bundle mirror path.
      object_store_manifest_path = path.join(path.dirname(object_store_bundle_path), "manifest.json"); // Manifest mirror path.
      object_store_checksums_path = path.join(path.dirname(object_store_bundle_path), "sha256.txt"); // Checksums mirror path.
      copyFileWithParents(bundle_path, object_store_bundle_path); // Mirror bundle.
      copyFileWithParents(manifest_path, object_store_manifest_path); // Mirror manifest.
      copyFileWithParents(checksums_path, object_store_checksums_path); // Mirror checksums.
    } else if (storage_mode === "S3_COMPAT" && s3cfg) { // Upload evidence pack files to S3-compatible object storage.
      const bundleKey = normalizeObjectStoreKey(object_store_key, s3cfg.bucket) || deriveObjectStoreKey(tenant_id, job_id, export_format);
      const keyPrefix = bundleKey.split("/").slice(0, -1).join("/"); // Prefix for sidecar files.
      const manifestKey = `${keyPrefix}/manifest.json`;
      const checksumsKey = `${keyPrefix}/sha256.txt`;
      console.info(`[evidence-export][s3] upload target bucket=${s3cfg.bucket} endpoint=${s3cfg.endpoint} job_id=${job_id}`);
      await s3PutObjectFromFile(s3cfg, bundleKey, bundle_path, bundleContentTypeForFormat(export_format));
      await s3PutObjectFromFile(s3cfg, manifestKey, manifest_path, "application/json");
      await s3PutObjectFromFile(s3cfg, checksumsKey, checksums_path, "text/plain; charset=utf-8");
      object_store_bundle_path = `s3://${s3cfg.bucket}/${bundleKey}`;
      object_store_manifest_path = `s3://${s3cfg.bucket}/${manifestKey}`;
      object_store_checksums_path = `s3://${s3cfg.bucket}/${checksumsKey}`;
    }

    const pack_summary = { // Summary exposed through job projection/facts.
      pack_dir,
      bundle_path,
      manifest_path,
      checksums_path,
      storage_mode,
      object_store_key,
      object_store_bundle_path,
      object_store_manifest_path,
      object_store_checksums_path,
      files: [
        { name: bundle_name, sha256: bundle_sha256 },
        { name: "manifest.json", sha256: manifest_sha256 },
        { name: "sha256.txt", sha256: checksums_sha256 },
      ],
    };

    const artifact_path = bundle_path; // Backward-compatible primary artifact path.
    const digest = bundle_sha256; // Preserve existing meaning for artifact_sha256.
    const done_ms = Date.now(); // Completion time.

    const fact_id = `evexp_done_${randomUUID()}`; // Completion fact id.
    const record = { // Completion fact record.
      type: "evidence_export_job_completed_v1", // Fact type.
      entity: { tenant_id, job_id }, // Entity.
      payload: { // Payload.
        scope, // Export scope.
        program_id, // Optional program binding.
        field_id, // Optional field binding.
        season_id, // Optional season binding.
        from_ts_ms, // Window start.
        to_ts_ms, // Window end.
        status: "DONE", // Status.
        artifact_path, // Artifact path.
        artifact_sha256: digest, // Artifact digest.
        evidence_pack: pack_summary, // Self-describing pack outputs.
        export_format, // Requested export format.
        export_language, // Requested export language.
        operation_plan_ids: operationPlanIds, // Operation-plan bridge for productized evidence lookup.
        operation_plan_id: operationPlanIds[0] ?? null, // Single primary bridge (compat).
        act_task_ids: actTaskIds, // Task bridge for backfill lookup.
        act_task_id: actTaskIds[0] ?? null, // Single primary task bridge (compat).
        completed_ts_ms: done_ms, // Completion time.
        started_ts_ms: started_ms, // Start time.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Connection for atomic write.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.
      await clientConn.query( // Insert completion fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(done_ms), "system", JSON.stringify(record)]
      ); // End insert.
      await clientConn.query( // Update job projection to DONE.
        `UPDATE evidence_export_job_index_v1
            SET status = 'DONE',
                updated_ts_ms = $3,
                artifact_path = $4,
                artifact_sha256 = $5,
                error = NULL
          WHERE tenant_id = $1 AND job_id = $2`,
        [tenant_id, job_id, done_ms, artifact_path, digest]
      ); // End update.
      await clientConn.query( // Upsert evidence pack delivery index.
        `INSERT INTO evidence_pack_index_v1
          (tenant_id, job_id, storage_mode, object_store_key, object_store_bundle_path, object_store_manifest_path, object_store_checksums_path, export_format, export_language, built_at_ts_ms, bundle_sha256, manifest_sha256, checksums_sha256)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (tenant_id, job_id)
         DO UPDATE SET
           storage_mode = EXCLUDED.storage_mode,
           object_store_key = EXCLUDED.object_store_key,
           object_store_bundle_path = EXCLUDED.object_store_bundle_path,
           object_store_manifest_path = EXCLUDED.object_store_manifest_path,
           object_store_checksums_path = EXCLUDED.object_store_checksums_path,
           export_format = EXCLUDED.export_format,
           export_language = EXCLUDED.export_language,
           built_at_ts_ms = EXCLUDED.built_at_ts_ms,
           bundle_sha256 = EXCLUDED.bundle_sha256,
           manifest_sha256 = EXCLUDED.manifest_sha256,
           checksums_sha256 = EXCLUDED.checksums_sha256`,
        [tenant_id, job_id, storage_mode, object_store_key, object_store_bundle_path, object_store_manifest_path, object_store_checksums_path, export_format, export_language, done_ms, bundle_sha256, manifest_sha256, checksums_sha256]
      ); // End pack index upsert.
      await clientConn.query("COMMIT"); // Commit.
    } catch { // Ignore.
      await clientConn.query("ROLLBACK"); // Rollback.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.
  } catch (e: any) { // Error path.
    const err_ms = Date.now(); // Error time.
    const msg = String(e?.message ?? e); // Error message.

    const fact_id = `evexp_err_${randomUUID()}`; // Error fact id.
    const record = { // Error fact record.
      type: "evidence_export_job_completed_v1", // Reuse completed fact type with ERROR status for MVP.
      entity: { tenant_id, job_id }, // Entity.
      payload: { scope, program_id, field_id, season_id, from_ts_ms, to_ts_ms, status: "ERROR", error: msg, completed_ts_ms: err_ms, started_ts_ms: started_ms, operation_plan_ids: [], act_task_ids: [] }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Connection for atomic error update.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.
      await clientConn.query( // Insert error fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(err_ms), "system", JSON.stringify(record)]
      ); // End insert.
      await clientConn.query( // Update job projection to ERROR.
        `UPDATE evidence_export_job_index_v1
            SET status = 'ERROR', updated_ts_ms = $3, error = $4
          WHERE tenant_id = $1 AND job_id = $2`,
        [tenant_id, job_id, err_ms, msg]
      ); // End update.
      await clientConn.query("COMMIT"); // Commit.
    } catch { // Ignore.
      await clientConn.query("ROLLBACK"); // Rollback.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.
  } // End try/catch.
} // End runJob.

const running = new Set<string>(); // In-memory guard to prevent duplicate in-process execution per (tenant_id, job_id).
function relLabel(tsMs: number | null | undefined): string { if (!Number.isFinite(Number(tsMs))) return "-"; const d = Date.now() - Number(tsMs); if (d < 60_000) return "刚刚"; if (d < 3_600_000) return `${Math.max(1, Math.floor(d / 60_000))} 分钟前`; if (d < 86_400_000) return `${Math.max(1, Math.floor(d / 3_600_000))} 小时前`; return `${Math.max(1, Math.floor(d / 86_400_000))} 天前`; }
function toneByStatus(status: string): "success" | "info" | "warning" | "neutral" { const s = String(status ?? "").toUpperCase(); if (["DONE", "EXECUTED", "SUCCESS"].includes(s)) return "success"; if (["RUNNING", "ACKED", "DISPATCHED"].includes(s)) return "info"; if (["ERROR", "FAILED", "PENDING"].includes(s)) return "warning"; return "neutral"; }

export function registerEvidenceExportJobsV1Routes(app: FastifyInstance, pool: Pool) { // Register evidence export routes.
  // Schema-compat: make sure evidence_export_job_index_v1 and evidence_pack_index_v1 exist and have required columns.
  void ensureEvidenceExportJobIndexV1Schema(pool);
  void ensureEvidencePackIndexV1Schema(pool);

  app.post("/api/v1/evidence-export/jobs", async (req, reply) => { // Create a new export job.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "evidence_export.write"); // Require write scope.
    if (!auth) return; // Auth responded.

    const body: any = (req as any).body ?? {}; // Parse body.
    const scope_type_raw = String(body.scope_type ?? "").trim().toUpperCase(); // Normalize scope type.
    const scope_type = (scope_type_raw === "TENANT" || scope_type_raw === "DEVICE" || scope_type_raw === "FIELD") ? scope_type_raw : null; // Validate.
    if (!scope_type) return badRequest(reply, "MISSING_OR_INVALID:scope_type"); // Validate.
    if (scope_type === "TENANT" && !requireAoActAdminV0(req, reply, { deniedError: "ROLE_EVIDENCE_TENANT_ADMIN_REQUIRED" })) return;

    const scope_id = scope_type === "TENANT" ? null : normalizeId(body.scope_id); // Normalize scope id.
    if (scope_type !== "TENANT" && !scope_id) return badRequest(reply, "MISSING_OR_INVALID:scope_id"); // Validate.

    const from_ts_ms = (typeof body.from_ts_ms === "number" && Number.isFinite(body.from_ts_ms)) ? Math.trunc(body.from_ts_ms) : null; // Parse window.
    const to_ts_ms = (typeof body.to_ts_ms === "number" && Number.isFinite(body.to_ts_ms)) ? Math.trunc(body.to_ts_ms) : null; // Parse window.
    const export_format = normalizeExportFormat(body.export_format); // Optional requested artifact format.
    const export_language = normalizeExportLanguage(body.export_language); // Optional requested artifact language.
    const program_id = normalizeId(body.program_id); // Optional program binding.
    const field_id = normalizeId(body.field_id); // Optional field binding.
    const season_id = normalizeId(body.season_id); // Optional season binding.
    if (from_ts_ms == null || to_ts_ms == null || to_ts_ms <= from_ts_ms) return badRequest(reply, "MISSING_OR_INVALID:from_ts_ms|to_ts_ms"); // Validate.

    // Validate referenced resources exist within tenant (best-effort).
    if (scope_type === "DEVICE" && scope_id) { // Device.
      const q = await pool.query(`SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2`, [auth.tenant_id, scope_id]); // Query.
      if (q.rowCount === 0) return notFound(reply); // Missing device.
    } // End device validation.
    if (scope_type === "FIELD" && scope_id) { // Field.
      const q = await pool.query(`SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`, [auth.tenant_id, scope_id]); // Query.
      if (q.rowCount === 0) return notFound(reply); // Missing field.
    } // End field validation.

    const now_ms = Date.now(); // Server time.
    const job_id = `job_${randomUUID()}`; // Job id.
    const fact_id = `evexp_create_${randomUUID()}`; // Fact id.

    const scope: ExportScope = { scope_type: scope_type as any, scope_id }; // Scope object.
    const record = { // Job created fact.
      type: "evidence_export_job_created_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, job_id }, // Entity.
      payload: { // Payload.
        scope, // Export scope.
        program_id, // Optional program binding.
        field_id, // Optional field binding.
        season_id, // Optional season binding.
        from_ts_ms, // Window start.
        to_ts_ms, // Window end.
        status: "QUEUED", // Initial status.
        created_ts_ms: now_ms, // Creation time.
        export_format, // Requested export format.
        export_language, // Requested export language.
        actor_id: auth.actor_id, // Audit: actor.
        token_id: auth.token_id, // Audit: token.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.
      await clientConn.query( // Insert created fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(now_ms), "control", JSON.stringify(record)]
      ); // End insert.
      await clientConn.query( // Insert job projection.
        `INSERT INTO evidence_export_job_index_v1
          (tenant_id, job_id, scope_type, scope_id, from_ts_ms, to_ts_ms, status, created_ts_ms, updated_ts_ms, artifact_path, artifact_sha256, error, export_format, export_language)
         VALUES ($1,$2,$3,$4,$5,$6,'QUEUED',$7,$7,NULL,NULL,NULL,$8,$9)`,
        [auth.tenant_id, job_id, scope.scope_type, scope.scope_id, from_ts_ms, to_ts_ms, now_ms, export_format, export_language]
      ); // End insert.
      await clientConn.query("COMMIT"); // Commit.
    } catch (e: any) { // Error.
      await clientConn.query("ROLLBACK"); // Rollback.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // 500.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.

    // Start job in-process (MVP): this does not guarantee execution if process restarts.
    const key = `${auth.tenant_id}:${job_id}`; // Unique key.
    if (!running.has(key)) { // Guard.
      running.add(key); // Mark running.
      setTimeout(() => { // Defer to event loop to return response first.
        runJob(pool, auth.tenant_id, job_id, scope, from_ts_ms, to_ts_ms, export_format, export_language, program_id, field_id, season_id)
          .catch(() => void 0)
          .finally(() => { running.delete(key); }); // Clear running flag.
      }, 0); // Immediate.
    } // End start.

    return reply.send({ ok: true, job_id }); // Return job id.
  }); // End POST create job.

  app.get("/api/v1/evidence-export/jobs", async (req, reply) => { // List jobs.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "evidence_export.read"); // Require read scope.
    if (!auth) return; // Auth responded.

    const limit = 200; // Fixed limit for MVP.
    const q = await pool.query(
      `SELECT j.tenant_id, j.job_id, j.scope_type, j.scope_id, j.from_ts_ms, j.to_ts_ms, j.status, j.created_ts_ms, j.updated_ts_ms, j.artifact_path, j.artifact_sha256, j.error, j.export_format, j.export_language,
              p.storage_mode AS pack_storage_mode,
              p.object_store_key AS pack_object_store_key,
              p.object_store_bundle_path,
              p.object_store_manifest_path,
              p.object_store_checksums_path
         FROM evidence_export_job_index_v1 j
         LEFT JOIN evidence_pack_index_v1 p
           ON p.tenant_id = j.tenant_id AND p.job_id = j.job_id
        WHERE j.tenant_id = $1
        ORDER BY j.updated_ts_ms DESC
        LIMIT $2`,
      [auth.tenant_id, limit]
    ); // End query.

    return reply.send({ ok: true, jobs: q.rows.map((row: any) => enrichJobRow(row)) }); // Return enriched rows.
  }); // End GET list.

  app.get("/api/v1/evidence/control-plane", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "evidence_export.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const limit = Math.max(1, Math.min(Number(q.limit ?? 20) || 20, 100));
    const program_id = normalizeId(q.program_id);
    const operation_plan_id = normalizeId(q.operation_plan_id);
    const nowTs = Date.now();

    const jobsQ = await pool.query(
      `SELECT job_id, status, created_ts_ms, updated_ts_ms, scope_id, artifact_sha256
         FROM evidence_export_job_index_v1
        WHERE tenant_id = $1
        ORDER BY updated_ts_ms DESC
        LIMIT $2`,
      [auth.tenant_id, limit]
    ).catch(() => ({ rows: [] }));

    const receiptsQ = await pool.query(
      `SELECT fact_id, occurred_at, (record_json::jsonb #>> '{payload,status}') AS status,
              (record_json::jsonb #>> '{payload,operation_plan_id}') AS operation_plan_id,
              (record_json::jsonb #>> '{payload,act_task_id}') AS act_task_id,
              (record_json::jsonb #>> '{payload,program_id}') AS program_id
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND ($2::text IS NULL OR (record_json::jsonb #>> '{payload,program_id}') = $2)
          AND ($3::text IS NULL OR (record_json::jsonb #>> '{payload,operation_plan_id}') = $3)
        ORDER BY occurred_at DESC
        LIMIT $4`,
      [auth.tenant_id, program_id, operation_plan_id, limit]
    ).catch(() => ({ rows: [] }));

    const recentEvidenceItems = (receiptsQ.rows ?? []).map((row: any) => ({
      evidence_id: `receipt_${String(row.fact_id).slice(0, 8)}`,
      kind: "receipt",
      title: "灌溉执行回执",
      subtitle: row.operation_plan_id ? `关联作业计划 ${row.operation_plan_id}` : "关联作业计划待补充",
      status: { code: String(row.status ?? "EXECUTED").toUpperCase(), label: "已回执", tone: toneByStatus(String(row.status ?? "EXECUTED")) },
      program: { program_id: row.program_id ?? null, title: row.program_id ? "经营 Program" : "未关联 Program" },
      operation_plan_id: row.operation_plan_id ?? null,
      act_task_id: row.act_task_id ?? null,
      updated_at_label: relLabel(Date.parse(String(row.occurred_at ?? "")) || nowTs),
      summary: "本轮作业执行结果已记录，可用于审计与复核。",
      resource_usage: { water_l: null, electric_kwh: null },
      href: `/evidence?focus=receipt_${String(row.fact_id).slice(0, 8)}`
    }));

    const exportJobs = (jobsQ.rows ?? []).map((row: any) => ({
      job_id: String(row.job_id),
      title: "证据包导出任务",
      status: { code: String(row.status ?? "DONE").toUpperCase(), label: String(row.status ?? "DONE").toUpperCase() === "DONE" ? "已生成" : "处理中", tone: toneByStatus(String(row.status ?? "DONE")) },
      created_at_label: relLabel(Number(row.created_ts_ms ?? nowTs)),
      summary: "可用于审计与下载的证据导出任务。",
      download: { available: String(row.status ?? "").toUpperCase() === "DONE", label: "下载证据包", url: null },
      refs: { program_id: row.scope_id ?? null, operation_plan_id: null }
    }));

    const selected = recentEvidenceItems[0] ?? null;
    return reply.send({
      ok: true,
      item: {
        meta: { page_title: "证据页", page_subtitle: "集中查看执行回执、证据包与导出任务。", updated_ts_ms: nowTs, updated_at_label: relLabel(nowTs) },
        headline_cards: [
          { key: "recent_receipts", title: "最近回执", value: recentEvidenceItems.length, description: "最近产生的执行回执记录", tone: "neutral" },
          { key: "export_jobs", title: "导出任务", value: exportJobs.length, description: "证据导出任务总数", tone: "neutral" },
          { key: "ready_downloads", title: "可下载证据", value: exportJobs.filter((x: any) => x.download.available).length, description: "已生成且可下载的证据包", tone: "success" },
          { key: "failed_jobs", title: "异常任务", value: exportJobs.filter((x: any) => x.status.code === "ERROR").length, description: "最近导出失败或异常的任务", tone: "warning" }
        ],
        recent_evidence_items: recentEvidenceItems,
        export_jobs: exportJobs,
        selected_detail: selected ? {
          kind: selected.kind,
          title: selected.title,
          status: selected.status,
          summary: selected.summary,
          timeline: [{ title: "生成作业计划", ts_label: "近期" }, { title: "执行任务下发", ts_label: "近期" }, { title: "写入执行回执", ts_label: selected.updated_at_label }],
          files: [{ kind: "log_ref", label: "执行日志引用", value: selected.act_task_id || "-" }],
          integrity: { manifest_present: true, sha256_present: true, label: "完整性信息可用" }
        } : null,
        technical_details: {
          receipt_fact_id: receiptsQ.rows?.[0]?.fact_id ?? null,
          job_id: jobsQ.rows?.[0]?.job_id ?? null,
          operation_plan_id: receiptsQ.rows?.[0]?.operation_plan_id ?? null,
          act_task_id: receiptsQ.rows?.[0]?.act_task_id ?? null
        }
      }
    });
  });

  app.get("/api/v1/evidence-export/jobs/:job_id", async (req, reply) => { // Get job status.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "evidence_export.read"); // Require read scope.
    if (!auth) return; // Auth responded.

    const job_id = normalizeId((req.params as any)?.job_id); // Parse.
    if (!job_id) return notFound(reply); // Invalid.

    const q = await pool.query(
      `SELECT j.tenant_id, j.job_id, j.scope_type, j.scope_id, j.from_ts_ms, j.to_ts_ms, j.status, j.created_ts_ms, j.updated_ts_ms, j.artifact_path, j.artifact_sha256, j.error, j.export_format, j.export_language,
              p.storage_mode AS pack_storage_mode,
              p.object_store_key AS pack_object_store_key,
              p.object_store_bundle_path,
              p.object_store_manifest_path,
              p.object_store_checksums_path
         FROM evidence_export_job_index_v1 j
         LEFT JOIN evidence_pack_index_v1 p
           ON p.tenant_id = j.tenant_id AND p.job_id = j.job_id
        WHERE j.tenant_id = $1 AND j.job_id = $2`,
      [auth.tenant_id, job_id]
    ); // End query.
    if (q.rowCount === 0) return notFound(reply); // Missing.

    return reply.send({ ok: true, job: enrichJobRow(q.rows[0]) }); // Return enriched row.
  }); // End GET job.

  app.get("/api/v1/evidence-export/jobs/:job_id/download", async (req, reply) => { // Download artifact or pack sidecar file.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "evidence_export.read"); // Require read scope.
    if (!auth) return; // Auth responded.

    const job_id = normalizeId((req.params as any)?.job_id); // Parse.
    if (!job_id) return notFound(reply); // Invalid.

    const q = await pool.query(
      `SELECT j.artifact_path, j.status,
              p.storage_mode AS pack_storage_mode,
              p.object_store_key AS pack_object_store_key,
              p.object_store_bundle_path,
              p.object_store_manifest_path,
              p.object_store_checksums_path
         FROM evidence_export_job_index_v1 j
         LEFT JOIN evidence_pack_index_v1 p
           ON p.tenant_id = j.tenant_id AND p.job_id = j.job_id
        WHERE j.tenant_id = $1 AND j.job_id = $2`,
      [auth.tenant_id, job_id]
    ); // End query.
    if (q.rowCount === 0) return notFound(reply); // Missing.
    const artifact_path = q.rows[0]?.artifact_path; // Path.
    const status = String(q.rows[0]?.status ?? ""); // Status.
    if (status !== "DONE" || !artifact_path) return reply.status(409).send({ ok: false, error: "NOT_READY" }); // Not ready.

    const partRaw = String((req.query as any)?.part ?? "bundle").trim().toLowerCase(); // Requested file within the evidence pack.
    const sourceRaw = String((req.query as any)?.source ?? "local").trim().toLowerCase(); // Optional source selector.
    const pack_dir = path.dirname(String(artifact_path)); // Pack directory for sidecar files.
    const storage_mode = String(q.rows[0]?.pack_storage_mode ?? "").trim().toUpperCase(); // Delivery backend for this job.
    const export_format = normalizeExportFormat(path.extname(String(artifact_path)).replace(/^\./, "")); // Infer format from bundle extension.

    if (storage_mode === "S3_COMPAT") { // Commercial delivery: issue presigned object-store URL for all parts.
      const s3cfg = getS3CompatConfig(); // Load runtime S3 config.
      if (!s3cfg) return reply.status(503).send({ ok: false, error: "S3_CONFIG_MISSING" }); // Missing env contract.
      const { bundleKey, manifestKey, checksumsKey } = objectStorePartKeysFromRow(q.rows[0], export_format); // Resolve all part keys.
      const key = partRaw === "manifest" ? manifestKey : (partRaw === "checksums" || partRaw === "sha256") ? checksumsKey : bundleKey; // Target part key.
      return reply.redirect(302, buildS3PresignedGetUrl(s3cfg, key)); // Redirect client to object storage for download.
    }

    const useObjectStore = sourceRaw === "object_store" && String(q.rows[0]?.pack_storage_mode ?? "") === "LOCAL_MIRROR"; // Mirror path allowed when configured.

    let download_path = useObjectStore ? String(q.rows[0]?.object_store_bundle_path ?? artifact_path) : String(artifact_path); // Default keeps backward compatibility (bundle.*).
    const bundle_ext = path.extname(download_path).toLowerCase(); // Infer artifact extension.
    let content_type = bundle_ext === ".csv" ? "text/csv; charset=utf-8" : bundle_ext === ".pdf" ? "application/pdf" : "application/json"; // Default content type.
    let filename = `evidence_${job_id}${bundle_ext || ".json"}`; // Default download name.

    if (partRaw === "manifest") { // Download manifest.json explicitly.
      download_path = useObjectStore ? String(q.rows[0]?.object_store_manifest_path ?? path.join(pack_dir, "manifest.json")) : path.join(pack_dir, "manifest.json");
      content_type = "application/json";
      filename = `evidence_${job_id}_manifest.json`;
    } else if (partRaw === "checksums" || partRaw === "sha256") { // Download sha256 sidecar file explicitly.
      download_path = useObjectStore ? String(q.rows[0]?.object_store_checksums_path ?? path.join(pack_dir, "sha256.txt")) : path.join(pack_dir, "sha256.txt");
      content_type = "text/plain; charset=utf-8";
      filename = `evidence_${job_id}_sha256.txt`;
    }

    if (!fs.existsSync(download_path)) return reply.status(410).send({ ok: false, error: "GONE" }); // Artifact missing.

    reply.header("Content-Type", content_type); // Set content type.
    reply.header("Content-Disposition", `attachment; filename="${filename}"`); // Download name.

    const stream = fs.createReadStream(download_path); // Create read stream.
    return reply.send(stream); // Stream to client.
  }); // End download.
} // End registerEvidenceExportJobsV1Routes.
