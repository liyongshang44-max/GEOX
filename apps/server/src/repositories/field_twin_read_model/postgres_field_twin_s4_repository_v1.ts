// Purpose: expose corrected S4 collection, optional attachment, Replay Evidence, and Timeline reads over the frozen S2 root repository.
// Boundary: SELECT-only composition over one caller-owned snapshot; no DDL/DML, root inference, or write-capable dependency.

import type {
  FieldTwinCollectionItemV1,
  FieldTwinTimelineEventV1,
  SemanticHashTextV1,
} from "../../domain/field_twin_read_model/index.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_COLLECTION_SOURCE_SPECS_V1,
  PostgresFieldTwinReadRepositoryV1,
  type McftCollectionSourceSpecV1,
  type ResolvedRuntimeRootV1,
} from "./postgres_field_twin_read_repository_v1.js";
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";
import {
  PostgresFieldTwinS4ReplayRepositoryV1,
  type ResolvedReplayEvidenceObjectV1,
} from "./postgres_field_twin_s4_replay_repository_v1.js";
import { PostgresFieldTwinS4TimelineRepositoryV1 } from "./postgres_field_twin_s4_timeline_repository_v1.js";

export { MCFT_COLLECTION_SOURCE_SPECS_V1 };
export type { McftCollectionSourceSpecV1, ResolvedRuntimeRootV1, ResolvedReplayEvidenceObjectV1 };
type ExactObjectV1 = Awaited<ReturnType<PostgresFieldTwinReadRepositoryV1["readExactObjectByRef"]>>;

export class PostgresFieldTwinS4RepositoryV1 {
  private readonly base = new PostgresFieldTwinReadRepositoryV1();
  private readonly replay = new PostgresFieldTwinS4ReplayRepositoryV1(this.base);
  private readonly timeline = new PostgresFieldTwinS4TimelineRepositoryV1(this.base);

  resolveCurrentRuntimeRoot(context: PostgresFieldTwinSnapshotContextV1): Promise<ResolvedRuntimeRootV1> {
    return this.base.resolveCurrentRuntimeRoot(context);
  }
  resolveHistoricalRuntimeRoot(context: PostgresFieldTwinSnapshotContextV1, checkpointRef: string): Promise<ResolvedRuntimeRootV1> {
    return this.base.resolveHistoricalRuntimeRoot(context, checkpointRef);
  }
  readCollectionItems(
    context: PostgresFieldTwinSnapshotContextV1,
    spec: McftCollectionSourceSpecV1,
    limitPlusOne: number,
    boundary: { logical_time: string; object_ref: string } | null,
  ): Promise<readonly FieldTwinCollectionItemV1[]> {
    return this.base.readCollectionItems(context, spec, limitPlusOne, boundary);
  }
  readExactObjectByRef(context: PostgresFieldTwinSnapshotContextV1, objectRef: string, expectedType?: string): Promise<ExactObjectV1> {
    return this.base.readExactObjectByRef(context, objectRef, expectedType);
  }
  readOptionalScopePointerObject(
    context: PostgresFieldTwinSnapshotContextV1,
    input: { relation: string; ref_column: string; hash_column?: string | null; expected_type: string },
  ): ReturnType<PostgresFieldTwinReadRepositoryV1["readOptionalScopePointerObject"]> {
    return this.base.readOptionalScopePointerObject(context, input);
  }
  readLatestOperationalHealth(
    context: PostgresFieldTwinSnapshotContextV1,
    root: ResolvedRuntimeRootV1,
  ): ReturnType<PostgresFieldTwinReadRepositoryV1["readLatestOperationalHealth"]> {
    return this.base.readLatestOperationalHealth(context, root);
  }
  async readCollectionSummary(
    context: PostgresFieldTwinSnapshotContextV1,
    spec: McftCollectionSourceSpecV1,
  ): Promise<{ latest_item: FieldTwinCollectionItemV1 | null }> {
    const items = await this.base.readCollectionItems(context, spec, 2, null);
    return { latest_item: items[0] ?? null };
  }
  readReplayEvidenceBySourceRef(
    context: PostgresFieldTwinSnapshotContextV1,
    sourceRecordRef: string,
    expectedHash?: SemanticHashTextV1 | null,
  ): Promise<ResolvedReplayEvidenceObjectV1> {
    return this.replay.readBySourceRef(context, sourceRecordRef, expectedHash);
  }
  readDecisionForScenario(
    context: PostgresFieldTwinSnapshotContextV1,
    scenarioRef: string,
    scenarioHash: SemanticHashTextV1,
  ): ReturnType<PostgresFieldTwinS4ReplayRepositoryV1["readDecisionForScenario"]> {
    return this.replay.readDecisionForScenario(context, scenarioRef, scenarioHash);
  }
  readApprovedPlanForDecision(
    context: PostgresFieldTwinSnapshotContextV1,
    decision: CanonicalObjectEnvelopeV1,
  ): ReturnType<PostgresFieldTwinS4ReplayRepositoryV1["readApprovedPlanForDecision"]> {
    return this.replay.readApprovedPlanForDecision(context, decision);
  }
  readTimelineEvents(
    context: PostgresFieldTwinSnapshotContextV1,
    limitPlusOne: number,
    filter: { from_logical_time: string | null; until_logical_time: string | null },
    boundary: { logical_time: string; event_rank: number; object_ref: string } | null,
  ): Promise<readonly FieldTwinTimelineEventV1[]> {
    return this.timeline.read(context, limitPlusOne, filter, boundary);
  }
}
