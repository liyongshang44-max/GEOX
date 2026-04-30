CREATE TABLE IF NOT EXISTS fail_safe_event_v1 (
  fail_safe_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, group_id TEXT NOT NULL,
  field_id TEXT NULL, device_id TEXT NULL, act_task_id TEXT NULL, prescription_id TEXT NULL, approval_request_id TEXT NULL,
  trigger_type TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
  reason_code TEXT NOT NULL, reason_detail TEXT NULL, blocked_action TEXT NULL,
  requires_manual_takeover BOOLEAN NOT NULL DEFAULT TRUE, source TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL, resolved_at BIGINT NULL, resolved_by_actor_id TEXT NULL, resolved_by_token_id TEXT NULL, resolution_note TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_fail_safe_scope_time ON fail_safe_event_v1(tenant_id, project_id, group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fail_safe_task ON fail_safe_event_v1(act_task_id);
CREATE INDEX IF NOT EXISTS idx_fail_safe_device ON fail_safe_event_v1(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fail_safe_field ON fail_safe_event_v1(field_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fail_safe_status ON fail_safe_event_v1(status, created_at DESC);

CREATE TABLE IF NOT EXISTS manual_takeover_v1 (
  takeover_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, group_id TEXT NOT NULL,
  fail_safe_event_id TEXT NOT NULL, field_id TEXT NULL, device_id TEXT NULL, act_task_id TEXT NULL,
  requested_by_actor_id TEXT NULL, requested_by_token_id TEXT NULL, assigned_to_actor_id TEXT NULL,
  status TEXT NOT NULL, reason_code TEXT NOT NULL, note TEXT NULL,
  created_at BIGINT NOT NULL, acknowledged_at BIGINT NULL, completed_at BIGINT NULL,
  completed_by_actor_id TEXT NULL, completed_by_token_id TEXT NULL, completion_note TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_manual_takeover_scope_time ON manual_takeover_v1(tenant_id, project_id, group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_takeover_fail_safe ON manual_takeover_v1(fail_safe_event_id);
CREATE INDEX IF NOT EXISTS idx_manual_takeover_task ON manual_takeover_v1(act_task_id);
CREATE INDEX IF NOT EXISTS idx_manual_takeover_status ON manual_takeover_v1(status, created_at DESC);
