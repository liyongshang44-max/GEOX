import type { Pool } from "pg";
import { projectProgramStateV1, type ProgramStateV1 } from "../../projections/program_state_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type ActionType = "IRRIGATE" | "INSPECT" | "SPRAY" | "MANUAL";
type ActionMode = "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED";

export type CandidateActionV1 = {
  action_type: ActionType;
  target: { field_id: string };
  mode: ActionMode;
  reason: string;
  expected_effect: string;
};

type ProgramPolicy = {
  status: string;
  field_id: string;
  execution_policy: {
    mode: "approval_required" | "auto_allowed";
    auto_execute_allowed_task_types: string[];
  };
  acceptance_policy_ref: string | null;
  constraints: {
    max_irrigation_mm_per_day: number | null;
  };
};

type CompilerInputs = {
  program: ProgramPolicy;
  program_state: ProgramStateV1 | null;
  acceptance_result: Record<string, any> | null;
  resource_usage: Record<string, any> | null;
  sla_evaluation: Record<string, any> | null;
};

function str(v: any): string {
  return String(v ?? "").trim();
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadLatestPayloadByType(
  pool: Pool,
  tenant: TenantTriple,
  type: string,
  program_id: string
): Promise<Record<string, any> | null> {
  const q = await pool.query(
    `SELECT (record_json::jsonb #> '{payload}') AS payload
       FROM facts
      WHERE (record_json::jsonb ->> 'type') = $1
        AND (record_json::jsonb #>> '{payload,tenant_id}') = $2
        AND (record_json::jsonb #>> '{payload,project_id}') = $3
        AND (record_json::jsonb #>> '{payload,group_id}') = $4
        AND (record_json::jsonb #>> '{payload,program_id}') = $5
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [type, tenant.tenant_id, tenant.project_id, tenant.group_id, program_id]
  );
  if (!q.rows?.length) return null;
  return (q.rows[0].payload ?? null) as Record<string, any> | null;
}

async function loadProgramPolicy(pool: Pool, tenant: TenantTriple, program_id: string): Promise<ProgramPolicy | null> {
  const payload = await loadLatestPayloadByType(pool, tenant, "field_program_v1", program_id);
  if (!payload) return null;
  const executionMode = str(payload?.execution_policy?.mode).toLowerCase() === "auto_allowed" ? "auto_allowed" : "approval_required";
  const autoTypes = Array.isArray(payload?.execution_policy?.auto_execute_allowed_task_types)
    ? payload.execution_policy.auto_execute_allowed_task_types.map((x: any) => str(x).toUpperCase()).filter(Boolean)
    : [];
  return {
    status: str(payload.status).toUpperCase() || "DRAFT",
    field_id: str(payload.field_id),
    acceptance_policy_ref: str(payload.acceptance_policy_ref) || null,
    execution_policy: { mode: executionMode, auto_execute_allowed_task_types: autoTypes },
    constraints: {
      max_irrigation_mm_per_day: toNum(payload?.constraints?.max_irrigation_mm_per_day)
    }
  };
}

function deriveActionMode(action: ActionType, inputs: CompilerInputs, blockedReason: string | null): ActionMode {
  if (blockedReason) return "BLOCKED";
  if (inputs.program.execution_policy.mode !== "auto_allowed") return "APPROVAL_REQUIRED";
  const allowed = inputs.program.execution_policy.auto_execute_allowed_task_types.includes(action);
  return allowed ? "AUTO" : "APPROVAL_REQUIRED";
}

function buildReason(action: ActionType, inputs: CompilerInputs, blockedReason: string | null): string {
  if (blockedReason) return blockedReason;
  const latestAcceptance = str(inputs.acceptance_result?.verdict).toUpperCase();
  if (action === "INSPECT" && (!latestAcceptance || latestAcceptance === "PARTIAL" || latestAcceptance === "INCONCLUSIVE")) {
    return "Recent acceptance is inconclusive; inspect to improve certainty";
  }
  if (action === "IRRIGATE" && latestAcceptance === "FAIL") {
    return "Latest acceptance failed; irrigation retry recommended";
  }
  return `Action aligned with policy ${inputs.program.acceptance_policy_ref ?? "default"}`;
}

function compileCandidateActions(inputs: CompilerInputs): CandidateActionV1[] {
  const candidates: ActionType[] = ["IRRIGATE", "INSPECT", "SPRAY"];
  const globalBlockedReason = inputs.program.status !== "ACTIVE"
    ? `Program status ${inputs.program.status} does not allow execution`
    : null;

  const slaStatus = str(inputs.sla_evaluation?.status).toUpperCase();
  const slaBlockedReason = slaStatus === "BREACH" ? "Latest SLA evaluation is BREACH" : null;

  const waterUsedL = toNum(inputs.resource_usage?.resource_usage?.water_l ?? inputs.resource_usage?.water_l) ?? 0;
  const waterCapMm = inputs.program.constraints.max_irrigation_mm_per_day;
  const irrigationBlockedReason = waterCapMm != null && waterUsedL > waterCapMm * 1000
    ? `Water usage ${waterUsedL}L exceeds policy cap` : null;

  return candidates.map((action): CandidateActionV1 => {
    const blockedReason = globalBlockedReason ?? slaBlockedReason ?? (action === "IRRIGATE" ? irrigationBlockedReason : null);
    const mode = deriveActionMode(action, inputs, blockedReason);
    return {
      action_type: action,
      target: { field_id: inputs.program.field_id || "unknown_field" },
      mode,
      reason: buildReason(action, inputs, blockedReason),
      expected_effect:
        action === "IRRIGATE"
          ? "Improve water balance and increase execution reliability"
          : action === "INSPECT"
            ? "Increase observability and reduce acceptance uncertainty"
            : "Improve crop protection coverage"
    };
  });
}

export async function compileProgramActionsV1(
  pool: Pool,
  tenant: TenantTriple,
  program_id: string
): Promise<{ candidate_actions: CandidateActionV1[] } | null> {
  const program = await loadProgramPolicy(pool, tenant, program_id);
  if (!program) return null;

  const [programStates, acceptance_result, resource_usage, sla_evaluation] = await Promise.all([
    projectProgramStateV1(pool, tenant),
    loadLatestPayloadByType(pool, tenant, "acceptance_result_v1", program_id),
    loadLatestPayloadByType(pool, tenant, "resource_usage_v1", program_id),
    loadLatestPayloadByType(pool, tenant, "sla_evaluation_v1", program_id)
  ]);

  const program_state = programStates.find((x) => x.program_id === program_id) ?? null;
  return {
    candidate_actions: compileCandidateActions({
      program,
      program_state,
      acceptance_result,
      resource_usage,
      sla_evaluation
    })
  };
}
