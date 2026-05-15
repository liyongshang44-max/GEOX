import type { Pool, PoolClient } from "pg";
import { appendProblemStateAndUncertaintyFactsV1 } from "../domain/sensing/problem_state_uncertainty_v1.js";
import { refreshFieldReadModelsWithObservabilityV1 } from "./field_read_model_refresh_v1.js";

type DbConn = Pool | PoolClient;

export type AppleIIProblemStatePipelineInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  device_id: string;
};

export type AppleIIProblemStatePipelineOutputV1 = {
  stage1_summary: Record<string, any>;
  problem_state_output: Awaited<ReturnType<typeof appendProblemStateAndUncertaintyFactsV1>>;
};

/**
 * Apple II sensing/judge pipeline boundary.
 *
 * This is the formal producer path for ProblemState / UncertaintyEnvelope facts.
 * Decision routes may call this pipeline as a compatibility bridge, but they must
 * not append ProblemState / UncertaintyEnvelope facts directly.
 *
 * Intended callers:
 * - sensing update orchestration
 * - scheduled Apple II judge jobs
 * - decision admission preflight compatibility path
 */
export async function runAppleIIProblemStatePipelineV1(db: DbConn, input: AppleIIProblemStatePipelineInputV1): Promise<AppleIIProblemStatePipelineOutputV1 | null> {
  const refreshed = await refreshFieldReadModelsWithObservabilityV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    device_id: input.device_id,
  });
  const stage1Summary = refreshed.sensing_summary_stage1.payload;
  if (!stage1Summary || typeof stage1Summary !== "object") return null;

  const problemStateOutput = await appendProblemStateAndUncertaintyFactsV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    device_id: input.device_id,
    stage1Summary: stage1Summary as Record<string, any>,
  });

  return {
    stage1_summary: stage1Summary as Record<string, any>,
    problem_state_output: problemStateOutput,
  };
}
