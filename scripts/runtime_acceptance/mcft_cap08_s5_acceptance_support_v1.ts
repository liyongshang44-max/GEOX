// Purpose: establish the exact MCFT-CAP-08.S3 and S4 predecessor authorities in a caller-provisioned fresh PostgreSQL database for S5 acceptance.
// Boundary: acceptance support only; no formal candidate signal, S5 implementation logic, migration, route, scheduler, production Runtime authority or MCFT-CAP-09 authority.

import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import { CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import { CAP08_S1_CREATED_AT_V1 } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S3FormalPredecessorV1 } from "./mcft_cap08_s4_acceptance_support_v1.js";
import { runner } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";

export async function establishCap08S4FormalPredecessorV1(root: string) {
  const s3 = await establishCap08S3FormalPredecessorV1(root);
  const service = new Cap08S4AppendForwardServiceV1(runner, s3.fixture.formal_evidence_source);
  const input = {
    formal_run_id: s3.fixture.formal_run_id,
    scope: s3.fixture.scope,
    created_at: CAP08_S1_CREATED_AT_V1,
    phase_engine_source_digest: s3.source_manifest.manifest_digest,
  };
  const first = await service.execute(input);
  if (first.status !== "COMPLETED" || first.write_delta !== 7
    || first.authority.residual_commit_status !== "PENDING_S5_C_PROVIDER"
    || first.authority.residual_obligations.length !== 2
    || first.authority.ordinary_state_assimilation_for_fvo16 !== false) {
    throw new Error("CAP08_S5_S4_PREDECESSOR_NOT_EXACT");
  }
  const rerun = await service.execute(input);
  if (rerun.status !== "ALREADY_COMPLETE" || rerun.write_delta !== 0
    || rerun.authority.determinism_hash !== first.authority.determinism_hash) {
    throw new Error("CAP08_S5_S4_PREDECESSOR_RERUN_NOT_EXACT");
  }
  return {
    ...s3,
    s4_service: service,
    s4_input: input,
    s4_result: first,
    phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  };
}
