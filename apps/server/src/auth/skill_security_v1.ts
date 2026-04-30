export type SkillCategoryV1 = "SENSING" | "AGRONOMY" | "DEVICE" | "ACCEPTANCE" | "OPS" | "CONTROL" | "OBSERVABILITY";
export type SkillTriggerStageV1 = "before_recommendation" | "after_recommendation" | "before_dispatch" | "before_acceptance" | "after_acceptance";

const FORBIDDEN_OUTPUT_KEYS = new Set([
  "approval_decision", "act_task_id", "dispatch_command", "device_command", "acceptance_result_override", "roi_override",
  "tenant_id_override", "project_id_override", "group_id_override",
]);

export function assertSkillCategoryBoundaryV1(input: { category: string; trigger_stage: string; requested_action?: string | null; }): void {
  const category = String(input.category ?? "").trim().toUpperCase();
  const stage = String(input.trigger_stage ?? "").trim();
  const action = String(input.requested_action ?? "").trim().toLowerCase();
  if (category === "AGRONOMY" && stage === "before_dispatch") throw new Error("SKILL_CATEGORY_BOUNDARY_VIOLATION");
  if (category === "AGRONOMY" && ["dispatch_command", "device_command", "approval_decision"].includes(action)) throw new Error("SKILL_CATEGORY_BOUNDARY_VIOLATION");
  if (category === "DEVICE" && ["approval_decision", "acceptance_result", "roi_ledger"].includes(action)) throw new Error("SKILL_CATEGORY_BOUNDARY_VIOLATION");
  if (category === "ACCEPTANCE" && ["task_mutation", "receipt_mutation", "prescription_mutation", "field_memory_mutation", "roi_mutation"].includes(action)) throw new Error("SKILL_CATEGORY_BOUNDARY_VIOLATION");
  if (["SENSING", "OBSERVABILITY"].includes(category) && ["device_command", "approval_decision", "recommendation_approval"].includes(action)) throw new Error("SKILL_CATEGORY_BOUNDARY_VIOLATION");
}

export function assertSkillOutputBoundaryV1(input: { category: string; trigger_stage: string; outputs: any; }): void {
  const outputs = input.outputs && typeof input.outputs === "object" ? input.outputs : {};
  for (const k of Object.keys(outputs)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(k)) throw new Error("SKILL_OUTPUT_FORBIDDEN_ACTION");
  }
}

export function assertSkillBindingWriteAllowedV1(input: { auth: { role: string; scopes: string[] }; category: string; trigger_stage: string; rollout_mode: string; }): void {
  const role = String(input.auth?.role ?? "").trim();
  if (!(role === "admin" || role === "support")) throw new Error("SKILL_BINDING_ROLE_DENIED");
  const stage = String(input.trigger_stage ?? "").trim();
  if (!["before_recommendation", "after_recommendation", "before_dispatch", "before_acceptance", "after_acceptance"].includes(stage)) throw new Error("SKILL_BINDING_TRIGGER_STAGE_DENIED");
  const rollout = String(input.rollout_mode ?? "").trim().toUpperCase();
  if (!["DIRECT", "CANARY", "DRY_RUN"].includes(rollout)) throw new Error("SKILL_ROLLOUT_MODE_DENIED");
}
