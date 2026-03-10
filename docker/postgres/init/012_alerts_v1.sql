-- GEOX/docker/postgres/init/012_alerts_v1.sql
-- Sprint C1: Alert rules + events projections (v1).
-- Notes:
-- - Rules and events are stored as projections for fast query.
-- - All creations/updates still emit append-only facts for audit.

CREATE TABLE IF NOT EXISTS alert_rule_index_v1 ( -- Alert rule definition projection.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  rule_id text NOT NULL, -- Rule identifier.
  status text NOT NULL, -- ACTIVE | DISABLED.
  object_type text NOT NULL, -- DEVICE | FIELD (v1 may start with DEVICE only).
  object_id text NOT NULL, -- device_id or field_id (depending on object_type).
  metric text NOT NULL, -- Metric name OR reserved metric DEVICE_OFFLINE.
  operator text NOT NULL, -- LT | GT | LTE | GTE | EQ (string codes).
  threshold_num double precision NULL, -- Numeric threshold (for scalar telemetry).
  threshold_ms bigint NULL, -- Millisecond threshold (for DEVICE_OFFLINE, interpreted as offline_after_ms).
  window_sec integer NULL, -- Optional evaluation window (v1 can ignore for instant rules).
  notify_channels_json text NULL, -- Minimal notification channels configuration (json array string).
  created_ts_ms bigint NOT NULL, -- Created time in ms.
  updated_ts_ms bigint NOT NULL, -- Updated time in ms.
  PRIMARY KEY (tenant_id, rule_id)
);

CREATE INDEX IF NOT EXISTS alert_rule_index_v1_lookup_idx -- Lookup rules by object/metric.
  ON alert_rule_index_v1 (tenant_id, status, object_type, object_id, metric);

CREATE TABLE IF NOT EXISTS alert_event_index_v1 ( -- Raised alert events projection.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  event_id text NOT NULL, -- Event identifier.
  rule_id text NOT NULL, -- Source rule id.
  object_type text NOT NULL, -- DEVICE | FIELD.
  object_id text NOT NULL, -- device_id or field_id.
  metric text NOT NULL, -- Metric name.
  status text NOT NULL, -- OPEN | ACKED | CLOSED.
  raised_ts_ms bigint NOT NULL, -- Raised time (ms).
  acked_ts_ms bigint NULL, -- Ack time (ms).
  closed_ts_ms bigint NULL, -- Closed time (ms).
  last_value_json text NULL, -- Snapshot of last triggering value (json string).
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS alert_event_index_v1_open_idx -- Quick lookup of open events.
  ON alert_event_index_v1 (tenant_id, status, rule_id, object_id, raised_ts_ms DESC);


CREATE TABLE IF NOT EXISTS alert_notification_index_v1 ( -- Minimal notification record projection.
  tenant_id text NOT NULL, -- Tenant identifier (hard isolation).
  notification_id text NOT NULL, -- Notification identifier.
  event_id text NOT NULL, -- Source event id.
  rule_id text NOT NULL, -- Source rule id.
  channel text NOT NULL, -- INAPP | WEBHOOK (v1 minimal).
  status text NOT NULL, -- RECORDED.
  detail_json text NULL, -- Minimal detail payload for audit/UI.
  created_ts_ms bigint NOT NULL, -- Created time (ms).
  delivered_ts_ms bigint NULL, -- Future external delivery time (unused in v1).
  error text NULL, -- Future delivery error (unused in v1).
  PRIMARY KEY (tenant_id, notification_id)
);

CREATE INDEX IF NOT EXISTS alert_notification_index_v1_lookup_idx -- Quick lookup by event/rule/channel.
  ON alert_notification_index_v1 (tenant_id, event_id, rule_id, channel, created_ts_ms DESC);
