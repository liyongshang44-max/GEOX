CREATE TABLE IF NOT EXISTS crop_context_v1 (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  status TEXT NOT NULL,
  crop_code TEXT NULL,
  variety_code TEXT NULL,
  crop_stage TEXT NULL,
  planting_date TIMESTAMPTZ NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'USER_DECLARED',
  allowed_actions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_crop_context_v1_field
  ON crop_context_v1 (tenant_id, project_id, group_id, field_id);

CREATE TABLE IF NOT EXISTS crop_plan_candidate_v1 (
  candidate_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  season_id TEXT NULL,
  crop_code TEXT NOT NULL,
  suitability_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  expected_yield_range_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_revenue_range_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_margin_range_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_devices_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_plan_candidate_v1_field
  ON crop_plan_candidate_v1 (tenant_id, project_id, group_id, field_id, season_id);

CREATE TABLE IF NOT EXISTS season_result_v1 (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  crop_code TEXT NULL,
  harvest_date TIMESTAMPTZ NULL,
  actual_yield DOUBLE PRECISION NULL,
  yield_unit TEXT NULL,
  market_price DOUBLE PRECISION NULL,
  revenue DOUBLE PRECISION NULL,
  input_cost DOUBLE PRECISION NULL,
  operation_cost DOUBLE PRECISION NULL,
  net_margin DOUBLE PRECISION NULL,
  evidence_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, project_id, group_id, field_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_season_result_v1_field
  ON season_result_v1 (tenant_id, project_id, group_id, field_id);
