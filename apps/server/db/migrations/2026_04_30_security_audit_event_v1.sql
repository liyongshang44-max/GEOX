CREATE TABLE IF NOT EXISTS security_audit_event_v1 (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  actor_id TEXT NULL,
  token_id TEXT NULL,
  role TEXT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NULL,
  field_id TEXT NULL,
  request_id TEXT NULL,
  route TEXT NULL,
  method TEXT NULL,
  result TEXT NOT NULL,
  reason TEXT NULL,
  error_code TEXT NULL,
  source TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_audit_scope_time ON security_audit_event_v1(tenant_id, project_id, group_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor_time ON security_audit_event_v1(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_token_time ON security_audit_event_v1(token_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_action_time ON security_audit_event_v1(action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_target ON security_audit_event_v1(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_field ON security_audit_event_v1(field_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_result ON security_audit_event_v1(result, occurred_at DESC);
