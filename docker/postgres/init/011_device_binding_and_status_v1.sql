-- GEOX/docker/postgres/init/011_device_binding_and_status_v1.sql
-- Sprint C1: Device binding (device -> field) and device status projections (v1).

CREATE TABLE IF NOT EXISTS device_binding_index_v1 ( -- Current binding of device to a field.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  device_id text NOT NULL, -- Device identifier within tenant.
  field_id  text NOT NULL, -- Bound field identifier.
  bound_ts_ms bigint NOT NULL, -- Binding timestamp in ms.
  PRIMARY KEY (tenant_id, device_id) -- One current binding per device in v1.
);

CREATE INDEX IF NOT EXISTS device_binding_index_v1_field_idx -- For listing devices by field.
  ON device_binding_index_v1 (tenant_id, field_id, bound_ts_ms DESC);

CREATE TABLE IF NOT EXISTS device_status_index_v1 ( -- Latest-known device status projection.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  device_id text NOT NULL, -- Device identifier within tenant.
  last_telemetry_ts_ms bigint NULL, -- Last telemetry ts_ms seen (from raw_telemetry_v1 payload).
  last_heartbeat_ts_ms bigint NULL, -- Last heartbeat ts_ms seen (from device_heartbeat_v1 payload).
  battery_percent integer NULL, -- Last reported battery percent (0-100).
  rssi_dbm integer NULL, -- Last reported RSSI in dBm (negative).
  fw_ver text NULL, -- Last reported firmware version.
  updated_ts_ms bigint NOT NULL, -- Last update time in ms (server time).
  PRIMARY KEY (tenant_id, device_id) -- One row per device.
);

CREATE INDEX IF NOT EXISTS device_status_index_v1_updated_idx -- For listing devices by freshness.
  ON device_status_index_v1 (tenant_id, updated_ts_ms DESC);
