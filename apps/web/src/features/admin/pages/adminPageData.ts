export const boundaryRules = [
  "No customer report rendering.",
  "No Operator Twin forecast or scenario workspace rendering.",
  "No recommendation authoring, approval bypass, task creation, or execution dispatch.",
  "No ROI ledger, Field Memory, facts, receipt, as-executed, or acceptance-result writes.",
];

export const dashboardRows = [
  ["system_health", "observable"], ["db_health", "observable"], ["worker_status", "observable"], ["queue_status", "observable"],
  ["device_status_summary", "observable"], ["operation_status_summary", "observable"], ["evidence_pipeline_summary", "observable"], ["acceptance_summary", "observable"], ["boundary_summary", "enforced"],
];
