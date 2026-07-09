// apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts
// Purpose: load deterministic MCFT-CAP-01 Canonical Replay records for one explicit logical tick and verify every source-record semantic hash.
// Boundary: filesystem adapter only; no Evidence selection, State mathematics, Runtime orchestration, database access, wall-clock reads, or canonical writes.

import fs from "node:fs/promises";
import path from "node:path";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

const DAILY_DIRECTORIES_V1 = ["soil_moisture", "rainfall", "historical_et0", "future_weather", "future_et0"] as const;
const GLOBAL_FILES_V1 = ["irrigation_plan/plans.jsonl", "irrigation_execution/executions.jsonl"] as const;

function requireLogicalTimeV1(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("LOGICAL_TIME_INVALID");
  return parsed;
}

function sourceRecordHashV1(record: Record<string, unknown>): string {
  const semantic = { ...record };
  delete semantic.source_record_hash;
  delete semantic.materialized_file_location;
  return semanticHashV1(semantic);
}

function assertStringV1(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !value) throw new Error(code);
}

function validateReplayRecordV1(value: unknown): CanonicalReplayEvidenceRecordV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("REPLAY_RECORD_OBJECT_REQUIRED");
  const record = value as Record<string, unknown>;
  for (const field of ["dataset_id", "source_record_id", "source_record_hash", "record_type", "binding_id", "epistemic_class", "available_to_runtime_at", "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    assertStringV1(record[field], `REPLAY_RECORD_${field.toUpperCase()}_REQUIRED`);
  }
  if (!record.role_time || typeof record.role_time !== "object" || Array.isArray(record.role_time)) throw new Error("REPLAY_RECORD_ROLE_TIME_REQUIRED");
  if (!record.quality || typeof record.quality !== "object" || Array.isArray(record.quality)) throw new Error("REPLAY_RECORD_QUALITY_REQUIRED");
  if (!record.canonical_payload || typeof record.canonical_payload !== "object" || Array.isArray(record.canonical_payload)) throw new Error("REPLAY_RECORD_CANONICAL_PAYLOAD_REQUIRED");
  if (!Array.isArray(record.limitations)) throw new Error("REPLAY_RECORD_LIMITATIONS_REQUIRED");
  if (sourceRecordHashV1(record) !== record.source_record_hash) throw new Error(`SOURCE_RECORD_HASH_MISMATCH:${record.source_record_id}`);
  return record as unknown as CanonicalReplayEvidenceRecordV1;
}

async function readJsonlV1(filePath: string): Promise<CanonicalReplayEvidenceRecordV1[]> {
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (!text.endsWith("\n")) throw new Error(`JSONL_TRAILING_NEWLINE_REQUIRED:${filePath}`);
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line, index) => {
    try {
      return validateReplayRecordV1(JSON.parse(line));
    } catch (error) {
      throw new Error(`INVALID_REPLAY_JSONL_RECORD:${filePath}:${index + 1}:${(error as Error).message}`);
    }
  });
}

function sameScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

export class CanonicalReplayFileSourceV1 implements ReplayEvidenceSourcePortV1 {
  constructor(private readonly replayRootDirectory: string) {}

  async loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const logicalMs = requireLogicalTimeV1(input.logical_time);
    const intervalDate = new Date(logicalMs - 1).toISOString().slice(0, 10);
    const relativePaths = [
      ...DAILY_DIRECTORIES_V1.map((directory) => `${directory}/${intervalDate}.jsonl`),
      ...GLOBAL_FILES_V1,
    ];
    const batches = await Promise.all(relativePaths.map((relativePath) => readJsonlV1(path.join(this.replayRootDirectory, relativePath))));
    return batches.flat()
      .filter((record) => sameScopeV1(record, input.scope))
      .sort((a, b) => a.source_record_id.localeCompare(b.source_record_id));
  }
}
