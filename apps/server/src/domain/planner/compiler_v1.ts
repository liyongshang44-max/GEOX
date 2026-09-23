import type { Pool } from "pg";
import { projectProgramStateV1, type ProgramStateV1 } from "../../projections/program_state_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type ActionType = "IRRIGATE" | "INSPECT" | "SPRAY" | "MANUAL";
type ActionMode = "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED";

type FactCandidate = {
  fact_id: string;
  occurred_at: string;
  payload: Record<string, any>;
};

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
  season_id: string;
  crop_code: string;
  program_fact_id: string;
  program_lineage_root: string;
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

export class PlannerPredecessorAmbiguityError extends Error {
  readonly code = "PLANNER_PREDECESSOR_AMBIGUOUS";
  readonly blocker_id = "PLANNER-LATEST-01";
  readonly predecessor_type: string;
  readonly candidate_fact_ids: string[];
  readonly reason: string;

  constructor(predecessor_type: string, candidates: FactCandidate[], reason: string) {
    super(`${predecessor_type}: ${reason}`);
    this.name = "PlannerPredecessorAmbiguityError";
    this.predecessor_type = predecessor_type;
    this.candidate_fact_ids = candidates.map((row) => row.fact_id);
    this.reason = reason;
  }
}

function str(v: any): string {
  return String(v ?? "").trim();
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toMs(v: any): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function payloadDigest(payload: Record<string, any>): string {
  const sorted = Object.keys(payload ?? {}).sort().reduce<Record<string, any>>((out, key) => {
    out[key] = payload[key];
    return out;
  }, {});
  return JSON.stringify(sorted);
}

async function loadPayloadCandidatesByType(
  pool: Pool,
  tenant: TenantTriple,
  type: string,
  program_id: string
): Promise<FactCandidate[]> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, (record_json::jsonb #> '{payload}') AS payload
       FROM facts
      WHERE (record_json::jsonb ->> 'type') = $1
        AND (record_json::jsonb #>> '{payload,tenant_id}') = $2
        AND (record_json::jsonb #>> '{payload,project_id}') = $3
        AND (record_json::jsonb #>> '{payload,group_id}') = $4
        AND (record_json::jsonb #>> '{payload,program_id}') = $5
      ORDER BY occurred_at ASC, fact_id ASC`,
    [type, tenant.tenant_id, tenant.project_id, tenant.group_id, program_id]
  );
  return (q.rows ?? []).map((row: any) => ({
    fact_id: str(row.fact_id),
    occurred_at: String(row.occurred_at ?? ""),
    payload: (row.payload ?? {}) as Record<string, any>
  }));
}

function stableProgramLineageRoot(payload: Record<string, any>): string | null {
  const field_id = str(payload.field_id);
  const season_id = str(payload.season_id);
  const crop_code = str(payload.crop_code);
  const created_ts = toNum(payload.created_ts);
  if (!field_id || !season_id || !crop_code || created_ts == null) return null;
  return JSON.stringify({ field_id, season_id, crop_code, created_ts });
}

function selectProgramVersion(candidates: FactCandidate[]): FactCandidate | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const roots = candidates.map((row) => stableProgramLineageRoot(row.payload));
  if (roots.some((root) => root == null)) {
    throw new PlannerPredecessorAmbiguityError(
      "field_program_v1",
      candidates,
      "multiple program facts exist but at least one lacks stable field/season/crop/created_ts lineage identity"
    );
  }
  const uniqueRoots = new Set(roots as string[]);
  if (uniqueRoots.size !== 1) {
    throw new PlannerPredecessorAmbiguityError(
      "field_program_v1",
      candidates,
      "same program_id resolves to multiple stable program lineage roots"
    );
  }

  const ranked = [...candidates].sort((a, b) => {
    const au = toNum(a.payload.updated_ts) ?? toMs(a.occurred_at);
    const bu = toNum(b.payload.updated_ts) ?? toMs(b.occurred_at);
    if (au !== bu) return bu - au;
    const am = toMs(a.occurred_at);
    const bm = toMs(b.occurred_at);
    if (am !== bm) return bm - am;
    return b.fact_id.localeCompare(a.fact_id);
  });
  const first = ranked[0];
  const firstVersion = toNum(first.payload.updated_ts) ?? toMs(first.occurred_at);
  const tied = ranked.filter((row) => (toNum(row.payload.updated_ts) ?? toMs(row.occurred_at)) === firstVersion);
  if (tied.length > 1) {
    const distinctPayloads = new Set(tied.map((row) => payloadDigest(row.payload)));
    if (distinctPayloads.size > 1) {
      throw new PlannerPredecessorAmbiguityError(
        "field_program_v1",
        tied,
        "multiple different program versions share the same maximum version timestamp"
      );
    }
  }
  return first;
}

function mapProgramPolicy(row: FactCandidate): ProgramPolicy {
  const payload = row.payload;
  const root = stableProgramLineageRoot(payload);
  if (!root) {
    throw new PlannerPredecessorAmbiguityError(
      "field_program_v1",
      [row],
      "selected program fact lacks stable field/season/crop/created_ts lineage identity"
    );
  }
  const executionMode = str(payload?.execution_policy?.mode).toLowerCase() === "auto_allowed" ? "auto_allowed" : "approval_required";
  const autoTypes = Array.isArray(payload?.execution_policy?.auto_execute_allowed_task_types)
    ? payload.execution_policy.auto_execute_allowed_task_types.map((x: any) => str(x).toUpperCase()).filter(Boolean)
    : [];
  return {
    status: str(payload.status).toUpperCase() || "DRAFT",
    field_id: str(payload.field_id),
    season_id: str(payload.season_id),
    crop_code: str(payload.crop_code),
    program_fact_id: row.fact_id,
    program_lineage_root: root,
    acceptance_policy_ref: str(payload.acceptance_policy_ref) || null,
    execution_policy: { mode: executionMode, auto_execute_allowed_task_types: autoTypes },
    constraints: {
      max_irrigation_mm_per_day: toNum(payload?.constraints?.max_irrigation_mm_per_day)
    }
  };
}

function selectAcceptance(candidates: FactCandidate[], program: ProgramPolicy): FactCandidate | null {
  if (!candidates.length) return null;
  const matchingField = candidates.filter((row) => str(row.payload.field_id) === program.field_id);
  if (!matchingField.length) {
    throw new PlannerPredecessorAmbiguityError(
      "acceptance_result_v1",
      candidates,
      "program_id candidates exist but none match the exact program field lineage"
    );
  }
  if (matchingField.length === 1) return matchingField[0];
  throw new PlannerPredecessorAmbiguityError(
    "acceptance_result_v1",
    matchingField,
    "multiple acceptance histories match program_id and field_id without an exact current acceptance/task/operation predecessor identity"
  );
}

function selectResourceUsage(candidates: FactCandidate[], acceptance: FactCandidate | null): FactCandidate | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) {
    const resourceTask = str(candidates[0].payload.act_task_id);
    const acceptanceTask = str(acceptance?.payload?.act_task_id);
    if (resourceTask && acceptanceTask && resourceTask !== acceptanceTask) {
      throw new PlannerPredecessorAmbiguityError(
        "resource_usage_v1",
        candidates,
        "the only resource usage fact is bound to a different act_task_id than the exact selected acceptance"
      );
    }
    return candidates[0];
  }

  const acceptanceTask = str(acceptance?.payload?.act_task_id);
  if (acceptanceTask) {
    const exactTask = candidates.filter((row) => str(row.payload.act_task_id) === acceptanceTask);
    if (exactTask.length === 1) return exactTask[0];
    if (exactTask.length > 1) {
      throw new PlannerPredecessorAmbiguityError(
        "resource_usage_v1",
        exactTask,
        "multiple resource usage facts share the exact selected acceptance act_task_id without revision lineage"
      );
    }
  }
  throw new PlannerPredecessorAmbiguityError(
    "resource_usage_v1",
    candidates,
    "multiple program-level resource histories cannot be reduced to one execution chain by timestamp"
  );
}

function selectSlaEvaluation(candidates: FactCandidate[]): Record<string, any> | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].payload;

  const byName = new Map<string, FactCandidate[]>();
  for (const row of candidates) {
    const name = str(row.payload.sla_name);
    if (!name) {
      throw new PlannerPredecessorAmbiguityError(
        "sla_evaluation_v1",
        candidates,
        "multiple SLA candidates exist and at least one lacks sla_name identity"
      );
    }
    const rows = byName.get(name) ?? [];
    rows.push(row);
    byName.set(name, rows);
  }
  for (const rows of byName.values()) {
    if (rows.length > 1) {
      throw new PlannerPredecessorAmbiguityError(
        "sla_evaluation_v1",
        rows,
        "multiple versions of the same SLA name have no exact revision/predecessor identity"
      );
    }
  }

  const statuses = candidates.map((row) => str(row.payload.status).toUpperCase());
  return {
    status: statuses.includes("BREACH") ? "BREACH" : statuses.every((status) => status === "MET") ? "MET" : "UNKNOWN",
    sla_name: candidates.map((row) => str(row.payload.sla_name)).join(","),
    predecessor_fact_ids: candidates.map((row) => row.fact_id)
  };
}

async function loadExactCompilerInputs(
  pool: Pool,
  tenant: TenantTriple,
  program_id: string
): Promise<{ program: ProgramPolicy; acceptance_result: Record<string, any> | null; resource_usage: Record<string, any> | null; sla_evaluation: Record<string, any> | null } | null> {
  const [programFacts, acceptanceFacts, resourceFacts, slaFacts] = await Promise.all([
    loadPayloadCandidatesByType(pool, tenant, "field_program_v1", program_id),
    loadPayloadCandidatesByType(pool, tenant, "acceptance_result_v1", program_id),
    loadPayloadCandidatesByType(pool, tenant, "resource_usage_v1", program_id),
    loadPayloadCandidatesByType(pool, tenant, "sla_evaluation_v1", program_id)
  ]);

  const selectedProgram = selectProgramVersion(programFacts);
  if (!selectedProgram) return null;
  const program = mapProgramPolicy(selectedProgram);
  const acceptance = selectAcceptance(acceptanceFacts, program);
  const resource = selectResourceUsage(resourceFacts, acceptance);
  const sla = selectSlaEvaluation(slaFacts);
  return {
    program,
    acceptance_result: acceptance?.payload ?? null,
    resource_usage: resource?.payload ?? null,
    sla_evaluation: sla
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
  const slaBlockedReason = slaStatus === "BREACH" ? "SLA evaluation is BREACH" : null;

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
  const exactInputs = await loadExactCompilerInputs(pool, tenant, program_id);
  if (!exactInputs) return null;

  const programStates = await projectProgramStateV1(pool, tenant);
  const program_state = programStates.find((x) => x.program_id === program_id) ?? null;
  return {
    candidate_actions: compileCandidateActions({
      ...exactInputs,
      program_state
    })
  };
}
