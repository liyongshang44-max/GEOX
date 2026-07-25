// Purpose: establish the exact MCFT-CAP-08.S3 and S4 predecessor authorities and the frozen G00/FVO-24 Evidence source for S5 acceptance.
// Boundary: acceptance support only; no formal candidate signal, S5 implementation logic, migration, route, scheduler, production Runtime authority or MCFT-CAP-09 authority.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUNTIME_START_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S2_FORMAL_DATASET_ID_V1,
  CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { CAP08_S1_CREATED_AT_V1, runner } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S3FormalPredecessorV1 } from "./mcft_cap08_s4_acceptance_support_v1.js";

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function fvo24(scope: TwinScopeKeyV1): CanonicalReplayEvidenceRecordV1 {
  const id = "FVO-24";
  const observedAt = addHours(CAP08_S1_RUNTIME_START_V1, 24);
  const canonicalPayload = {
    value: Number((0.309 - 24 * 0.00045).toFixed(6)),
    unit: "fraction",
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    forecast_verification_observation_id: id,
  };
  const roleTime = { observed_at: observedAt, ingested_at: observedAt };
  const semantic = {
    dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
    source_record_id: id,
    binding_id: CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
    scope,
    role_time: roleTime,
    canonical_payload: canonicalPayload,
    quality_status: "PASS",
  };
  return {
    ...scope,
    dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
    source_record_id: id,
    source_record_hash: semanticHashV1(semantic),
    record_type: "soil_moisture_observation_v1",
    binding_id: CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: "mcft_cap08_stage1a_fvo_source_v1",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: observedAt,
    role_time: roleTime,
    quality: { status: "PASS" },
    source_payload: { ...canonicalPayload, source_version: "1" },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "S5_SLICE_ACCEPTANCE_ONLY"],
  };
}

function extendThroughG00(base: ReplayEvidenceSourcePortV1): ReplayEvidenceSourcePortV1 {
  const g00 = addHours(CAP08_S1_RUNTIME_START_V1, 24);
  return {
    async loadCandidateRecords(input) {
      if (input.logical_time === g00) return [fvo24(input.scope)];
      return structuredClone(await base.loadCandidateRecords(input));
    },
  };
}

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
    s5_evidence_source: extendThroughG00(s3.fixture.formal_evidence_source),
    phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  };
}
