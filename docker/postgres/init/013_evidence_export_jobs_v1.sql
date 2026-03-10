-- GEOX/docker/postgres/init/013_evidence_export_jobs_v1.sql
-- Sprint C1: Evidence export jobs projection (v1).
-- Notes:
-- - Jobs are persisted (unlike earlier in-memory jobs).
-- - Artifacts are stored on filesystem in v1 (runtime/evidence_exports_v1).

CREATE TABLE IF NOT EXISTS evidence_export_job_index_v1 ( -- Evidence export jobs projection.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  job_id text NOT NULL, -- Job identifier.
  scope_type text NOT NULL, -- FIELD | DEVICE | TENANT.
  scope_id text NULL, -- field_id/device_id depending on scope_type; null for TENANT.
  from_ts_ms bigint NOT NULL, -- Inclusive time window start (ms).
  to_ts_ms bigint NOT NULL, -- Exclusive time window end (ms).
  status text NOT NULL, -- QUEUED | RUNNING | DONE | ERROR.
  created_ts_ms bigint NOT NULL, -- Created time (ms).
  updated_ts_ms bigint NOT NULL, -- Updated time (ms).
  artifact_path text NULL, -- Filesystem path of artifact.
  artifact_sha256 text NULL, -- SHA-256 hex of artifact bytes.
  error text NULL, -- Terminal error message if any.
  PRIMARY KEY (tenant_id, job_id)
);

CREATE INDEX IF NOT EXISTS evidence_export_job_index_v1_status_idx -- List recent jobs by status.
  ON evidence_export_job_index_v1 (tenant_id, status, updated_ts_ms DESC);
