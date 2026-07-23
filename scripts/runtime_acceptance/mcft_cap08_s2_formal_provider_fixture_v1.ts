// scripts/runtime_acceptance/mcft_cap08_s2_formal_provider_fixture_v1.ts
// Purpose: derive the formal S2 replay Evidence stream by combining the frozen S1 dynamics/forcing fixture with exact FVO due-obligation records from the Stage-1A run contract.
// Boundary: acceptance support only; no database, canonical write, Decision, Action Feedback, late correction application, Residual, Calibration, scheduler, or production claim.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP08_S2_FORMAL_DATASET_ID_V1,
  CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
  buildCap08S2FormalDueObligationV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import {
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildCap08S1FixtureV1,
  type Cap08S1FixtureV1,
} from "./mcft_cap_08_s1_fixture_v1.js";

export type Cap08S2FormalProviderFixtureV1 =
  Omit<Cap08S1FixtureV1, "formal_run_id" | "evidence_source" | "evidence_source_load_count"> & {
    formal_run_id: string;
    bootstrap_evidence_source: ReplayEvidenceSourcePortV1;
    formal_evidence_source: ReplayEvidenceSourcePortV1;
    formal_evidence_source_load_count: () => number;
  };

function fvoIndexV1(fvoId: string): number {
  const match = /^FVO-(\d{2})$/.exec(fvoId);
  if (!match) throw new Error(`CAP08_S2_FIXTURE_FVO_ID_INVALID:${fvoId}`);
  return Number(match[1]);
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function fvoRecordV1(scope: TwinScopeKeyV1, fvoId: string): CanonicalReplayEvidenceRecordV1 {
  const index = fvoIndexV1(fvoId);
  const observedAt = addHoursV1(CAP08_S1_RUNTIME_START_V1, index);
  const availableAt = index === 1 ? addHoursV1(CAP08_S1_RUNTIME_START_V1, 16) : observedAt;
  const qualityStatus = index === 3 ? "LIMITED" : "PASS";
  const canonicalPayload = {
    value: Number((0.309 - index * 0.00045).toFixed(6)),
    unit: "fraction",
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    forecast_verification_observation_id: fvoId,
  };
  const roleTime = { observed_at: observedAt, ingested_at: availableAt };
  const semantic = {
    dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
    source_record_id: fvoId,
    binding_id: CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
    scope,
    role_time: roleTime,
    canonical_payload: canonicalPayload,
    quality_status: qualityStatus,
  };
  return {
    ...scope,
    dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
    source_record_id: fvoId,
    source_record_hash: semanticHashV1(semantic),
    record_type: "soil_moisture_observation_v1",
    binding_id: CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: "mcft_cap08_stage1a_fvo_source_v1",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: availableAt,
    role_time: roleTime,
    quality: { status: qualityStatus },
    source_payload: { ...canonicalPayload, source_version: "1" },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "S2_SLICE_ACCEPTANCE_ONLY"],
  };
}

export function buildCap08S2FormalProviderFixtureV1(): Cap08S2FormalProviderFixtureV1 {
  const base = buildCap08S1FixtureV1();
  let formalLoadCount = 0;
  const formalEvidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      formalLoadCount += 1;
      const due = buildCap08S2FormalDueObligationV1(input.logical_time);
      const baseRecords = structuredClone(await base.evidence_source.loadCandidateRecords(input));
      const withoutS1Observation = baseRecords.filter((record) => record.record_type !== "soil_moisture_observation_v1");
      const dueObservations = due.due_fvo_ids.map((fvoId) => fvoRecordV1(input.scope, fvoId));
      return [...withoutS1Observation, ...dueObservations];
    },
  };

  const formalRunHash = semanticHashV1({
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    scope: base.scope,
    dataset_id: CAP08_S2_FORMAL_DATASET_ID_V1,
    bootstrap_runtime_config_hash: base.bootstrap_runtime_config.determinism_hash,
    runtime_config_chain_hashes: base.runtime_configs.map((config) => config.determinism_hash),
  });

  return {
    scope: structuredClone(base.scope),
    formal_run_id: `cap08_${formalRunHash.slice(7, 39)}`,
    bootstrap_runtime_config: structuredClone(base.bootstrap_runtime_config),
    runtime_configs: structuredClone(base.runtime_configs),
    runtime_config_refs_by_logical_time: structuredClone(base.runtime_config_refs_by_logical_time),
    runtime_config_hashes_by_logical_time: structuredClone(base.runtime_config_hashes_by_logical_time),
    hydraulic: structuredClone(base.hydraulic),
    crop_stage_context: structuredClone(base.crop_stage_context),
    reality_binding_snapshot: structuredClone(base.reality_binding_snapshot),
    bootstrap_evidence_source: base.evidence_source,
    formal_evidence_source: formalEvidenceSource,
    formal_evidence_source_load_count: () => formalLoadCount,
  };
}

export function buildCap08S2MutatedEvidenceSourceV1(input: {
  base: ReplayEvidenceSourcePortV1;
  mutate: (records: CanonicalReplayEvidenceRecordV1[], logicalTime: string) => CanonicalReplayEvidenceRecordV1[];
}): ReplayEvidenceSourcePortV1 {
  return {
    async loadCandidateRecords(request) {
      const records = structuredClone(await input.base.loadCandidateRecords(request));
      return input.mutate(records, request.logical_time);
    },
  };
}
