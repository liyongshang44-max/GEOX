-- 004: Config tables for groups (stable input for UI/Judge)
-- NOTE: README previously referenced public.groups; v1 canonical tables are sensor_groups + sensor_group_members.

CREATE TABLE IF NOT EXISTS sensor_groups (
  group_id    text PRIMARY KEY,
  project_id  text NOT NULL,
  plot_id     text NULL,
  block_id    text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensor_group_members (
  group_id    text NOT NULL,
  sensor_id   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, sensor_id),
  CONSTRAINT sgm_group_fk
    FOREIGN KEY (group_id) REFERENCES sensor_groups (group_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sgm_sensor_id
  ON sensor_group_members (sensor_id);
