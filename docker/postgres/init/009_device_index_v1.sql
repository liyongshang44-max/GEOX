-- GEOX/docker/postgres/init/009_device_index_v1.sql
-- Sprint A2: Device registration + credentials projections (P0).
-- Notes:
-- - These are projections (mutable) derived from append-only facts.
-- - Ledger facts remain in facts(record_json) and are the source of truth.

CREATE TABLE device_index_v1 (
  tenant_id text NOT NULL,
  device_id text NOT NULL,
  display_name text NULL,
  created_ts_ms bigint NOT NULL,
  last_credential_id text NULL,
  last_credential_status text NULL,
  PRIMARY KEY (tenant_id, device_id)
);

CREATE TABLE device_credential_index_v1 (
  tenant_id text NOT NULL,
  device_id text NOT NULL,
  credential_id text NOT NULL,
  credential_hash text NOT NULL,
  status text NOT NULL, -- ACTIVE | REVOKED
  issued_ts_ms bigint NOT NULL,
  revoked_ts_ms bigint NULL,
  PRIMARY KEY (tenant_id, device_id, credential_id)
);

CREATE INDEX device_credential_index_v1_active_idx
  ON device_credential_index_v1 (tenant_id, device_id, status, issued_ts_ms DESC);
