// apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.ts
// Purpose: establish one explicit S1 E-phase Evidence snapshot and serve the exact frozen bytes to the mature CAP-04 A provider.
// Boundary: caller-owned in-process cache only; no database, filesystem, wall clock, scheduler, canonical write, or Evidence reselection.

import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "./ports.js";

function exactScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function cacheKeyV1(scope: TwinScopeKeyV1, logicalTime: string): string {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, logicalTime].join("|");
}

export class Cap08FrozenEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  private readonly snapshots = new Map<string, readonly CanonicalReplayEvidenceRecordV1[]>();
  private loadCount = 0;

  constructor(private readonly source: ReplayEvidenceSourcePortV1) {}

  async freeze(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const key = cacheKeyV1(input.scope, input.logical_time);
    const existing = this.snapshots.get(key);
    if (existing) return structuredClone(existing);
    const records = await this.source.loadCandidateRecords(input);
    for (const record of records) {
      if (!exactScopeV1(record, input.scope)) throw new Error("CAP08_EVIDENCE_SCOPE_MISMATCH");
    }
    const frozen = structuredClone(records);
    this.snapshots.set(key, frozen);
    this.loadCount += 1;
    return structuredClone(frozen);
  }

  hasFrozenSnapshot(input: { scope: TwinScopeKeyV1; logical_time: string }): boolean {
    return this.snapshots.has(cacheKeyV1(input.scope, input.logical_time));
  }

  getSourceLoadCount(): number {
    return this.loadCount;
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const frozen = this.snapshots.get(cacheKeyV1(input.scope, input.logical_time));
    if (!frozen) throw new Error("CAP08_E_PHASE_FROZEN_EVIDENCE_REQUIRED_BEFORE_A");
    return structuredClone(frozen);
  }
}
