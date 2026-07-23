// apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.ts
// Purpose: qualify one S2 E-phase input against the frozen T00-T23 due-obligation map before forwarding only dynamics, forcing, and selected State observations to the mature A provider.
// Boundary: caller-owned read/filter/trace adapter only; no persistence, historical rewrite, late correction application, Residual write, Decision, Action Feedback, route, scheduler, or live ingestion.

import {
  CAP08_S2_FORMAL_FORCING_BINDING_IDS_V1,
  CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
  CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
  buildCap08S2FormalDueObligationV1,
  type Cap08S2EvidenceQualificationTraceV1,
} from "../../domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "./ports.js";

const DYNAMICS_RECORD_TYPES_V1 = ["observed_rainfall_v1", "historical_et0_estimate_v1"] as const;
const FORCING_RECORD_TYPES_V1 = ["future_weather_assumption_v1", "future_et0_assumption_v1"] as const;

function exactScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function keyV1(scope: TwinScopeKeyV1, logicalTime: string): string {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, logicalTime].join("|");
}

function sortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function exactRecordTypeCountV1(records: readonly CanonicalReplayEvidenceRecordV1[], recordType: string): void {
  const count = records.filter((record) => record.record_type === recordType).length;
  if (count !== 1) throw new Error(`CAP08_S2_EVIDENCE_RECORD_TYPE_CARDINALITY:${recordType}:${count}`);
}

function availableAtV1(record: CanonicalReplayEvidenceRecordV1): string {
  const value = record.available_to_runtime_at;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`CAP08_S2_EVIDENCE_AVAILABLE_AT_INVALID:${record.source_record_id}`);
  }
  return value;
}

export class Cap08S2QualifiedEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  private readonly traces = new Map<string, Cap08S2EvidenceQualificationTraceV1>();

  constructor(private readonly source: ReplayEvidenceSourcePortV1) {}

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const due = buildCap08S2FormalDueObligationV1(input.logical_time);
    const records = structuredClone(await this.source.loadCandidateRecords(input));

    for (const record of records) {
      if (!exactScopeV1(record, input.scope)) throw new Error(`CAP08_S2_EVIDENCE_SCOPE_MISMATCH:${record.source_record_id}`);
      if (Date.parse(availableAtV1(record)) > Date.parse(input.logical_time)) {
        throw new Error(`CAP08_S2_EVIDENCE_FUTURE_LEAKAGE:${record.source_record_id}`);
      }
    }

    const recordIds = records.map((record) => record.source_record_id);
    if (recordIds.some((value) => typeof value !== "string" || !value.trim())) throw new Error("CAP08_S2_EVIDENCE_RECORD_ID_REQUIRED");
    if (new Set(recordIds).size !== recordIds.length) throw new Error("CAP08_S2_EVIDENCE_DUPLICATE_RECORD_ID");

    const observations = records.filter((record) => record.record_type === "soil_moisture_observation_v1");
    const nonObservations = records.filter((record) => record.record_type !== "soil_moisture_observation_v1");
    const observationIds = sortedV1(observations.map((record) => record.source_record_id));
    if (JSON.stringify(observationIds) !== JSON.stringify(due.due_fvo_ids)) {
      throw new Error("CAP08_S2_EVIDENCE_DUE_FVO_SET_MISMATCH");
    }

    for (const recordType of [...DYNAMICS_RECORD_TYPES_V1, ...FORCING_RECORD_TYPES_V1]) {
      exactRecordTypeCountV1(nonObservations, recordType);
    }
    if (nonObservations.length !== 4) throw new Error("CAP08_S2_EVIDENCE_NON_OBSERVATION_CARDINALITY");

    const weather = nonObservations.find((record) => record.record_type === "future_weather_assumption_v1");
    const et0 = nonObservations.find((record) => record.record_type === "future_et0_assumption_v1");
    if (!weather || !et0) throw new Error("CAP08_S2_FORCING_PAIR_REQUIRED");
    if (weather.binding_id !== CAP08_S2_FORMAL_FORCING_BINDING_IDS_V1[0]) {
      throw new Error("CAP08_S2_WEATHER_BINDING_MISMATCH");
    }
    if (et0.binding_id !== CAP08_S2_FORMAL_FORCING_BINDING_IDS_V1[1]) {
      throw new Error("CAP08_S2_ET0_BINDING_MISMATCH");
    }

    const dueById = new Map(observations.map((record) => [record.source_record_id, record]));
    for (const observationId of due.selected_state_observation_ids) {
      const record = dueById.get(observationId);
      if (!record) throw new Error(`CAP08_S2_SELECTED_OBSERVATION_MISSING:${observationId}`);
      if (record.binding_id !== CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1) {
        throw new Error(`CAP08_S2_STATE_OBSERVATION_BINDING_MISMATCH:${observationId}`);
      }
      if (!["PASS", "LIMITED"].includes(String(record.quality?.status))) {
        throw new Error(`CAP08_S2_SELECTED_OBSERVATION_QUALITY_INVALID:${observationId}`);
      }
    }

    for (const unavailableId of due.observed_but_not_available_ids) {
      if (dueById.has(unavailableId)) throw new Error(`CAP08_S2_OBSERVED_NOT_AVAILABLE_LEAKAGE:${unavailableId}`);
    }

    const selected = observations.filter((record) => due.selected_state_observation_ids.includes(record.source_record_id));
    const forwarded = [...nonObservations, ...selected];
    const dynamicsIds = sortedV1(nonObservations
      .filter((record) => (DYNAMICS_RECORD_TYPES_V1 as readonly string[]).includes(record.record_type))
      .map((record) => record.source_record_id));
    const forcingIds = sortedV1([weather.source_record_id, et0.source_record_id]);
    const traceWithoutDigest = {
      schema_version: "geox_mcft_cap08_s2_evidence_qualification_trace_v1" as const,
      provider_profile_id: CAP08_S2_FORMAL_PROVIDER_PROFILE_ID_V1,
      scope: structuredClone(input.scope),
      tick_id: due.tick_id,
      logical_time: due.logical_time,
      received_record_ids: sortedV1(recordIds),
      dynamics_evidence_ids: dynamicsIds,
      forcing_evidence_ids: forcingIds,
      received_due_fvo_ids: observationIds,
      forwarded_state_observation_ids: sortedV1(selected.map((record) => record.source_record_id)),
      quarantined_residual_only_ids: [...due.residual_only_observation_ids],
      quarantined_late_state_correction_ids: [...due.late_state_correction_observation_ids],
      observed_but_not_available_ids_confirmed_absent: [...due.observed_but_not_available_ids],
      forwarded_record_ids: sortedV1(forwarded.map((record) => record.source_record_id)),
    };
    const trace: Cap08S2EvidenceQualificationTraceV1 = {
      ...traceWithoutDigest,
      trace_digest: semanticHashV1(traceWithoutDigest),
    };
    this.traces.set(keyV1(input.scope, input.logical_time), trace);
    return structuredClone(forwarded);
  }

  readTrace(input: { scope: TwinScopeKeyV1; logical_time: string }): Cap08S2EvidenceQualificationTraceV1 {
    const trace = this.traces.get(keyV1(input.scope, input.logical_time));
    if (!trace) throw new Error(`CAP08_S2_EVIDENCE_TRACE_NOT_FOUND:${input.logical_time}`);
    return structuredClone(trace);
  }

  getTraceCount(): number {
    return this.traces.size;
  }
}
