export type AsAppliedMapV1 = {
  as_applied_id: string;
  as_executed_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id: string;
  prescription_id?: string | null;
  field_id?: string | null;
  zone_id?: string | null;
  geometry: Record<string, unknown>;
  coverage: Record<string, unknown>;
  application: Record<string, unknown>;
  evidence_refs: unknown[];
  log_refs: unknown[];
  created_at: string;
  updated_at: string;
};
