-- GEOX/docker/postgres/init/010_field_index_v1.sql
-- Sprint C1: Field (farm plot) projections (v1).
-- Notes:
-- - These tables are projections (mutable) derived from append-only facts.
-- - The source of truth remains facts(record_json).
-- - tenant_id is always part of the primary key for hard isolation.

CREATE TABLE IF NOT EXISTS field_index_v1 ( -- Field master projection.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  field_id  text NOT NULL, -- Field identifier within tenant.
  name      text NOT NULL, -- Human readable field name.
  area_ha   numeric NULL,  -- Optional area in hectares.
  status    text NOT NULL, -- ACTIVE | ARCHIVED (v1 allows minimal states).
  created_ts_ms bigint NOT NULL, -- Creation timestamp (ms since epoch) from fact payload.
  updated_ts_ms bigint NOT NULL, -- Last update timestamp (ms since epoch) from latest fact.
  PRIMARY KEY (tenant_id, field_id) -- Hard tenant boundary key.
);

CREATE INDEX IF NOT EXISTS field_index_v1_status_idx -- For listing active fields.
  ON field_index_v1 (tenant_id, status, updated_ts_ms DESC);

CREATE TABLE IF NOT EXISTS field_polygon_v1 ( -- Field GIS boundary projection (GeoJSON).
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  field_id  text NOT NULL, -- Field identifier within tenant.
  geojson   text NOT NULL, -- Raw GeoJSON string (validated at API boundary).
  updated_ts_ms bigint NOT NULL, -- Updated time in ms.
  PRIMARY KEY (tenant_id, field_id) -- One polygon per field in v1.
);
