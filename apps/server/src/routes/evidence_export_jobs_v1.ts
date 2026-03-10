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
// - artifact format: JSON bundle file (not zip) to avoid extra dependencies.
// - Filtering: performed in application layer by parsing facts.record_json JSON (source of truth).
// 
// Security:
// - Tenant isolation uses AoActAuthContextV0; all job reads/writes filter by auth.tenant_id.
// - Download endpoint only serves artifacts belonging to tenant.

import fs from "node:fs"; // Filesystem for writing and streaming artifacts.
import path from "node:path"; // Path utilities for safe joins.
import crypto from "node:crypto"; // Crypto for sha256.
import { randomUUID } from "node:crypto"; // UUIDs for job ids and fact ids.
import type { FastifyInstance } from "fastify"; // Fastify instance.
import type { Pool } from "pg"; // Postgres pool.

import { requireAoActScopeV0, requireAoActAdminV0 } from "../auth/ao_act_authz_v0"; // Auth helper.
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Auth context.

type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "ERROR"; // Job status enum.

type ExportFormat = "JSON" | "CSV"; // Supported export file formats for v1.1.
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
  return s === "CSV" ? "CSV" : "JSON"; // Only CSV is newly added in v1.1.
} // End helper.

function normalizeExportLanguage(v: any): ExportLanguage { // Helper: normalize requested export language.
  const s = String(v ?? "zh-CN").trim(); // Normalize text.
  return s === "en-US" ? "en-US" : "zh-CN"; // Default to Chinese commercial console.
} // End helper.

function bundleFileNameForFormat(export_format: ExportFormat): string { // Helper: bundle filename by format.
  return export_format === "CSV" ? "bundle.csv" : "bundle.json"; // Stable filenames per format.
} // End helper.

function bundleContentTypeForFormat(export_format: ExportFormat): string { // Helper: content type by format.
  return export_format === "CSV" ? "text/csv; charset=utf-8" : "application/json"; // Supported content types.
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


type ExportScope = { scope_type: "TENANT" | "DEVICE" | "FIELD"; scope_id: string | null }; // Scope descriptor.


type EvidencePackFileSummary = { // Evidence pack file summary for API responses.
  name: string;
  sha256: string | null;
  content_type: string;
  size_bytes: number | null;
  download_part: "bundle" | "manifest" | "checksums";
};

type EvidencePackSummary = { // Evidence pack summary exposed via list/detail endpoints.
  format: string;
  export_format: ExportFormat;
  export_language: ExportLanguage;
  pack_dir: string;
  files: EvidencePackFileSummary[];
};

function getFileSizeMaybe(fp: string): number | null { // Helper: return file size when file exists.
  try { return fs.statSync(fp).size; } catch { return null; }
} // End helper.

function buildPackSummaryFromArtifactPath(artifact_path: string | null | undefined, export_format_raw?: string | null, export_language_raw?: string | null): EvidencePackSummary | null { // Helper: derive evidence pack summary from the canonical artifact path.
  if (!artifact_path || typeof artifact_path !== "string") return null; // Missing path => no summary.
  const pack_dir = path.dirname(artifact_path); // Pack directory is the parent of bundle.json.
  const bundle_path = artifact_path; // Canonical artifact path may be bundle.json or bundle.csv.
  const bundle_name = path.basename(bundle_path); // Runtime primary artifact filename.
  const manifest_path = path.join(pack_dir, "manifest.json"); // Manifest sidecar.
  const checksums_path = path.join(pack_dir, "sha256.txt"); // Checksums sidecar.
  if (!fs.existsSync(bundle_path) || !fs.existsSync(manifest_path) || !fs.existsSync(checksums_path)) return null; // Pack incomplete.

  let format = "geox_evidence_pack_v1"; // Default format for Sprint C3/C4 packs.
  let export_format: ExportFormat = normalizeExportFormat(export_format_raw); // Default export format from job row.
  let export_language: ExportLanguage = normalizeExportLanguage(export_language_raw); // Default export language from job row.
  try { // Best-effort parse manifest for explicit format.
    const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf8"));
    if (typeof manifest?.format === "string" && manifest.format.trim()) format = manifest.format.trim();
    if (typeof manifest?.export_format === "string") export_format = normalizeExportFormat(manifest.export_format);
    if (typeof manifest?.export_language === "string") export_language = normalizeExportLanguage(manifest.export_language);
  } catch {
    // Ignore parse errors and fall back to default format.
  }

  return {
    format,
    export_format,
    export_language,
    pack_dir,
    files: [
      { name: bundle_name, sha256: sha256FileHex(bundle_path), content_type: bundleContentTypeForFormat(export_format), size_bytes: getFileSizeMaybe(bundle_path), download_part: "bundle" },
      { name: "manifest.json", sha256: sha256FileHex(manifest_path), content_type: "application/json", size_bytes: getFileSizeMaybe(manifest_path), download_part: "manifest" },
      { name: "sha256.txt", sha256: sha256FileHex(checksums_path), content_type: "text/plain; charset=utf-8", size_bytes: getFileSizeMaybe(checksums_path), download_part: "checksums" },
    ],
  };
} // End helper.

function enrichJobRow(row: any): any { // Helper: attach evidence pack summary and download urls to a job row.
  const pack = buildPackSummaryFromArtifactPath(row?.artifact_path, row?.export_format, row?.export_language); // Derive pack metadata from runtime files.
  const out = { ...row }; // Shallow clone row.
  if (!pack) return out; // Return row unchanged when files are unavailable.
  return {
    ...out,
    evidence_pack: {
      format: pack.format,
      export_format: pack.export_format,
      export_language: pack.export_language,
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
        WHERE record_json LIKE '%"type":"evidence_export_job_created_v1"%'
          AND record_json LIKE '%' || $1 || '%'
        ORDER BY occurred_at DESC
        LIMIT 5`,
      [`"tenant_id":"${tenant_id}"`]
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
        WHERE record_json LIKE '%"type":"evidence_export_job_completed_v1"%'
          AND record_json LIKE '%' || $1 || '%'
        ORDER BY occurred_at DESC
        LIMIT 5`,
      [`"tenant_id":"${tenant_id}"`]
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

  return { // Return bundle.
    meta: { tenant_id, scope, from_ts_ms, to_ts_ms, built_at_ts_ms: Date.now() }, // Metadata.
    snapshot, // Projection snapshot (best-effort).
    facts, // Facts array (source of truth).
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

async function runJob(pool: Pool, tenant_id: string, job_id: string, scope: ExportScope, from_ts_ms: number, to_ts_ms: number, export_format: ExportFormat, export_language: ExportLanguage): Promise<void> { // Execute job in-process.
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

    const pack_dir = path.join(RUNTIME_DIR, job_id); // Evidence pack directory (self-describing bundle).
    ensureDir(pack_dir); // Ensure pack directory exists.

    const bundle_name = bundleFileNameForFormat(export_format); // Primary artifact filename by format.
    const bundle_path = path.join(pack_dir, bundle_name); // Canonical bundle payload.
    if (export_format === "CSV") { // CSV delivery view.
      fs.writeFileSync(bundle_path, buildEvidenceCsv(bundle), "utf8"); // Write CSV artifact.
    } else { // JSON delivery view.
      fs.writeFileSync(bundle_path, JSON.stringify(bundle, null, 2), "utf8"); // Write JSON artifact.
    }
    const bundle_sha256 = sha256FileHex(bundle_path); // Compute digest for bundle.

    const files = [ // File list used by manifest.json and downstream verification.
      { name: bundle_name, sha256: bundle_sha256, content_type: bundleContentTypeForFormat(export_format) },
    ];

    const manifest = { // Self-describing evidence pack manifest.
      format: export_format === "CSV" ? "geox_evidence_pack_csv_v1" : "geox_evidence_pack_v1",
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

    const pack_summary = { // Summary exposed through job projection/facts.
      pack_dir,
      bundle_path,
      manifest_path,
      checksums_path,
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
        from_ts_ms, // Window start.
        to_ts_ms, // Window end.
        status: "DONE", // Status.
        artifact_path, // Artifact path.
        artifact_sha256: digest, // Artifact digest.
        evidence_pack: pack_summary, // Self-describing pack outputs.
        export_format, // Requested export format.
        export_language, // Requested export language.
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
      payload: { scope, from_ts_ms, to_ts_ms, status: "ERROR", error: msg, completed_ts_ms: err_ms, started_ts_ms: started_ms }, // Payload.
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

export function registerEvidenceExportJobsV1Routes(app: FastifyInstance, pool: Pool) { // Register evidence export routes.
  // Schema-compat: make sure evidence_export_job_index_v1 exists and has required columns.
  void ensureEvidenceExportJobIndexV1Schema(pool);

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
        runJob(pool, auth.tenant_id, job_id, scope, from_ts_ms, to_ts_ms, export_format, export_language)
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
      `SELECT job_id, scope_type, scope_id, from_ts_ms, to_ts_ms, status, created_ts_ms, updated_ts_ms, artifact_path, artifact_sha256, error, export_format, export_language
         FROM evidence_export_job_index_v1
        WHERE tenant_id = $1
        ORDER BY updated_ts_ms DESC
        LIMIT $2`,
      [auth.tenant_id, limit]
    ); // End query.

    return reply.send({ ok: true, jobs: q.rows.map((row: any) => enrichJobRow(row)) }); // Return enriched rows.
  }); // End GET list.

  app.get("/api/v1/evidence-export/jobs/:job_id", async (req, reply) => { // Get job status.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "evidence_export.read"); // Require read scope.
    if (!auth) return; // Auth responded.

    const job_id = normalizeId((req.params as any)?.job_id); // Parse.
    if (!job_id) return notFound(reply); // Invalid.

    const q = await pool.query(
      `SELECT job_id, scope_type, scope_id, from_ts_ms, to_ts_ms, status, created_ts_ms, updated_ts_ms, artifact_path, artifact_sha256, error, export_format, export_language
         FROM evidence_export_job_index_v1
        WHERE tenant_id = $1 AND job_id = $2`,
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
      `SELECT artifact_path, status
         FROM evidence_export_job_index_v1
        WHERE tenant_id = $1 AND job_id = $2`,
      [auth.tenant_id, job_id]
    ); // End query.
    if (q.rowCount === 0) return notFound(reply); // Missing.
    const artifact_path = q.rows[0]?.artifact_path; // Path.
    const status = String(q.rows[0]?.status ?? ""); // Status.
    if (status !== "DONE" || !artifact_path) return reply.status(409).send({ ok: false, error: "NOT_READY" }); // Not ready.

    const partRaw = String((req.query as any)?.part ?? "bundle").trim().toLowerCase(); // Requested file within the evidence pack.
    const pack_dir = path.dirname(String(artifact_path)); // Pack directory for sidecar files.

    let download_path = String(artifact_path); // Default keeps backward compatibility (bundle.*).
    const bundle_ext = path.extname(download_path).toLowerCase(); // Infer artifact extension.
    let content_type = bundle_ext === ".csv" ? "text/csv; charset=utf-8" : "application/json"; // Default content type.
    let filename = `evidence_${job_id}${bundle_ext || ".json"}`; // Default download name.

    if (partRaw === "manifest") { // Download manifest.json explicitly.
      download_path = path.join(pack_dir, "manifest.json");
      content_type = "application/json";
      filename = `evidence_${job_id}_manifest.json`;
    } else if (partRaw === "checksums" || partRaw === "sha256") { // Download sha256 sidecar file explicitly.
      download_path = path.join(pack_dir, "sha256.txt");
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