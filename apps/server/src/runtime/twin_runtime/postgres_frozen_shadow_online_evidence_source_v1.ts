// MCFT-CAP-09.S5 selected Evidence readback for Shadow-online canonical integration.
// Boundary: read the exact S2-frozen source_record_id/hash set from facts.
// No eligibility reselection, clock, scheduler, canonical write, route, or action.

import type { Pool } from "pg";

import type {
  CanonicalReplayEvidenceRecordV1,
  FrozenShadowOnlineEvidenceV1,
  ReplayEvidenceSourcePortV1,
  ShadowOnlineEvidenceCandidateV1,
  TwinScopeKeyV1,
} from "./ports.js";

type EvidencePoolV1 = Pick<Pool, "query">;

function exactScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function roleTimeV1(record: CanonicalReplayEvidenceRecordV1): string {
  const value = record.role_time.observed_at
    ?? record.role_time.interval_end
    ?? record.role_time.issued_at
    ?? record.available_to_runtime_at;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("S5_SELECTED_EVIDENCE_ROLE_TIME_INVALID");
  }
  return new Date(value).toISOString();
}

function assertSelectedRecordV1(input: {
  selected: ShadowOnlineEvidenceCandidateV1;
  record: CanonicalReplayEvidenceRecordV1;
  scope: TwinScopeKeyV1;
  boundary: string;
}): void {
  if (!exactScopeV1(input.record, input.scope)) {
    throw new Error("S5_SELECTED_EVIDENCE_SCOPE_MISMATCH");
  }
  if (input.record.source_record_id !== input.selected.evidence_ref) {
    throw new Error("S5_SELECTED_EVIDENCE_REF_MISMATCH");
  }
  if (input.record.source_record_hash !== input.selected.evidence_hash) {
    throw new Error("S5_SELECTED_EVIDENCE_HASH_MISMATCH");
  }
  if (input.record.record_type !== input.selected.evidence_kind) {
    throw new Error("S5_SELECTED_EVIDENCE_KIND_MISMATCH");
  }
  if (roleTimeV1(input.record) !== input.selected.observed_at) {
    throw new Error("S5_SELECTED_EVIDENCE_ROLE_TIME_MISMATCH");
  }
  if (new Date(input.record.available_to_runtime_at).toISOString()
      !== input.selected.available_to_runtime_at) {
    throw new Error("S5_SELECTED_EVIDENCE_AVAILABILITY_MISMATCH");
  }
  if (String(input.record.quality.status) !== input.selected.quality_status) {
    throw new Error("S5_SELECTED_EVIDENCE_QUALITY_MISMATCH");
  }
  if (Date.parse(input.record.available_to_runtime_at) > Date.parse(input.boundary)) {
    throw new Error("S5_SELECTED_EVIDENCE_FUTURE_LEAKAGE");
  }
}

export class PostgresFrozenShadowOnlineEvidenceSourceV1
implements ReplayEvidenceSourcePortV1 {
  constructor(
    private readonly pool: EvidencePoolV1,
    private readonly frozen: FrozenShadowOnlineEvidenceV1,
  ) {}

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (!exactScopeV1(input.scope, this.frozen.boundary.scope)) {
      throw new Error("S5_FROZEN_EVIDENCE_REQUEST_SCOPE_MISMATCH");
    }
    if (new Date(input.logical_time).toISOString()
        !== this.frozen.boundary.logical_time) {
      throw new Error("S5_FROZEN_EVIDENCE_REQUEST_TIME_MISMATCH");
    }
    if (this.frozen.future_evidence_leakage !== false) {
      throw new Error("S5_FROZEN_EVIDENCE_FUTURE_LEAKAGE_FLAG");
    }

    const selected = [...this.frozen.selected];
    if (selected.length === 0) {
      throw new Error("S5_CANONICAL_INTEGRATION_SELECTED_EVIDENCE_REQUIRED");
    }
    const refs = selected.map((item) => item.evidence_ref);
    if (new Set(refs).size !== refs.length) {
      throw new Error("S5_SELECTED_EVIDENCE_DUPLICATE_REF");
    }

    const result = await this.pool.query<{ record_json: unknown }>(
      `SELECT record_json
         FROM facts
        WHERE record_json->'payload'->>'source_record_id' = ANY($1::text[])
        ORDER BY record_json->'payload'->>'source_record_id', fact_id`,
      [refs],
    );

    const byRef = new Map<string, CanonicalReplayEvidenceRecordV1>();
    for (const row of result.rows) {
      const wrapper = row.record_json as { payload?: CanonicalReplayEvidenceRecordV1 };
      const record = wrapper?.payload;
      if (!record || typeof record.source_record_id !== "string") {
        throw new Error("S5_SELECTED_EVIDENCE_FACT_PAYLOAD_INVALID");
      }
      if (byRef.has(record.source_record_id)) {
        throw new Error("S5_SELECTED_EVIDENCE_FACT_CARDINALITY");
      }
      byRef.set(record.source_record_id, structuredClone(record));
    }

    const records = selected.map((item) => {
      const record = byRef.get(item.evidence_ref);
      if (!record) throw new Error(`S5_SELECTED_EVIDENCE_FACT_MISSING:${item.evidence_ref}`);
      assertSelectedRecordV1({
        selected: item,
        record,
        scope: input.scope,
        boundary: this.frozen.boundary.logical_time,
      });
      return structuredClone(record);
    });
    if (records.length !== selected.length) {
      throw new Error("S5_SELECTED_EVIDENCE_EXACT_SET_REQUIRED");
    }
    return records;
  }
}
