-- GEOX/docker/postgres/init/015_field_season_index_v1.sql
-- Sprint F1: Field season projection (v1).
-- Notes:
-- - This table is a mutable projection built from append-only field season facts.
-- - Existing upgraded repos also create this table at server boot via ensureFieldSeasonProjectionV1().

CREATE TABLE IF NOT EXISTS field_season_index_v1 ( -- Minimal field season projection.
  tenant_id text NOT NULL, -- Tenant identifier.
  field_id text NOT NULL, -- Parent field id.
  season_id text NOT NULL, -- Season identifier within field.
  name text NOT NULL, -- Human-readable season name.
  crop text NULL, -- Optional crop label.
  start_date text NULL, -- Optional YYYY-MM-DD start date.
  end_date text NULL, -- Optional YYYY-MM-DD end date.
  status text NOT NULL, -- PLANNED | ACTIVE | CLOSED.
  created_ts_ms bigint NOT NULL, -- Creation time.
  updated_ts_ms bigint NOT NULL, -- Last update time.
  PRIMARY KEY (tenant_id, field_id, season_id) -- Hard isolation + parent scope.
);

CREATE INDEX IF NOT EXISTS field_season_index_v1_lookup_idx -- Fast lookup by tenant/field.
  ON field_season_index_v1 (tenant_id, field_id, updated_ts_ms DESC);
