import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  resolveUnifiedOperationFinalStatus,
  toDashboardEvidenceGroup,
  toOperationDetailStatusLabel,
  toOperationsListGroup,
} from "../src/lib/operationStatusUnified.ts";

function buildDisplaySnapshot(input: Record<string, unknown>) {
  const normalized = resolveUnifiedOperationFinalStatus(input as any);
  return {
    input,
    normalized,
    dashboard: toDashboardEvidenceGroup(normalized),
    list: toOperationsListGroup(normalized),
    detail: toOperationDetailStatusLabel(normalized),
  };
}

const cases = [
  { final_status: "SUCCESS" },
  { final_status: "PENDING_ACCEPTANCE" },
  { final_status: "INVALID_EXECUTION" },
  { final_status: "EVIDENCE_MISSING" },
  { final_status: "UNKNOWN_STATUS" },
  { operation_state_v1: { final_status: "PENDING_ACCEPTANCE" } },
];

const actual = cases.map(buildDisplaySnapshot);
const snapshotPath = join(process.cwd(), "scripts/__snapshots__/operation-status.snapshot.json");
const expected = JSON.parse(readFileSync(snapshotPath, "utf-8"));

assert.deepStrictEqual(actual, expected);
console.log("operation-status snapshot matched");
