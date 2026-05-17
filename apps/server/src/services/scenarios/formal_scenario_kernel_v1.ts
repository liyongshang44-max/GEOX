import { randomUUID } from "node:crypto";

import {
  createFormalScenarioManifestV1,
  mergeFormalScenarioManifestV1,
  type FormalScenarioApiSnapshotV1,
  type FormalScenarioLaneV1,
  type FormalScenarioManifestV1,
  type FormalScenarioRunV1,
  type FormalScenarioTypeV1,
} from "./formal_scenario_manifest_v1.js";
import { buildFormalScenarioFixtureV1, type FormalScenarioFixtureV1 } from "./formal_scenario_fixtures_v1.js";
import { buildFormalScenarioVerifyV1, type FormalScenarioVerifyEvidenceV1, type FormalScenarioVerifyV1 } from "./formal_scenario_verify_v1.js";
import { getFormalScenarioLaneDefinitionV1 } from "./formal_scenario_lanes_v1.js";

export type FormalScenarioKernelContextV1 = {
  run: FormalScenarioRunV1;
  fixture: FormalScenarioFixtureV1;
  manifest: FormalScenarioManifestV1;
  recordApiSnapshot: (input: Omit<FormalScenarioApiSnapshotV1, "snapshot_id" | "created_at"> & { snapshot_id?: string; created_at?: number }) => FormalScenarioApiSnapshotV1;
  updateManifest: (patch: Partial<FormalScenarioManifestV1>) => FormalScenarioManifestV1;
  setVerifyEvidence: (patch: FormalScenarioVerifyEvidenceV1) => FormalScenarioVerifyEvidenceV1;
};

export type FormalScenarioKernelDriverV1 = (ctx: FormalScenarioKernelContextV1) => Promise<void> | void;

export type RunFormalScenarioKernelInputV1 = {
  run_id?: string;
  scenario_type: FormalScenarioTypeV1;
  lane: FormalScenarioLaneV1;
  tenant_id: string;
  project_id: string;
  group_id: string;
  driver?: FormalScenarioKernelDriverV1;
};

export type RunFormalScenarioKernelResultV1 = {
  run: FormalScenarioRunV1;
  fixture: FormalScenarioFixtureV1;
  manifest: FormalScenarioManifestV1;
  verify: FormalScenarioVerifyV1;
};

export class FormalScenarioKernelErrorV1 extends Error {
  constructor(public code: string, message = code) {
    super(message);
  }
}

function normalizeSafeId(input: unknown): string | null {
  const value = String(input ?? "").trim();
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) return null;
  return value;
}

export function createFormalScenarioRunIdV1(): string {
  return `fsr_${randomUUID().replace(/-/g, "")}`;
}

export function createFormalScenarioRunV1(input: RunFormalScenarioKernelInputV1): FormalScenarioRunV1 {
  const laneDefinition = getFormalScenarioLaneDefinitionV1(input.scenario_type, input.lane);
  if (!laneDefinition) throw new FormalScenarioKernelErrorV1("FORMAL_SCENARIO_LANE_NOT_DEFINED");
  const run_id = normalizeSafeId(input.run_id) ?? createFormalScenarioRunIdV1();
  if (!run_id.startsWith("fsr_")) throw new FormalScenarioKernelErrorV1("FORMAL_SCENARIO_RUN_ID_MUST_START_WITH_FSR");
  for (const key of ["tenant_id", "project_id", "group_id"] as const) {
    if (!normalizeSafeId(input[key])) throw new FormalScenarioKernelErrorV1(`FORMAL_SCENARIO_INVALID_${key.toUpperCase()}`);
  }
  return {
    run_id,
    scenario_type: input.scenario_type,
    lane: input.lane,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    created_at: Date.now(),
    status: "RUNNING",
  };
}

export async function runFormalScenarioKernelV1(input: RunFormalScenarioKernelInputV1): Promise<RunFormalScenarioKernelResultV1> {
  const run = createFormalScenarioRunV1(input);
  const fixture = buildFormalScenarioFixtureV1(run);
  let manifest = createFormalScenarioManifestV1(run.run_id);
  let verifyEvidence: FormalScenarioVerifyEvidenceV1 = {};

  const ctx: FormalScenarioKernelContextV1 = {
    run,
    fixture,
    get manifest() {
      return manifest;
    },
    recordApiSnapshot(snapshotInput) {
      const snapshot: FormalScenarioApiSnapshotV1 = {
        snapshot_id: snapshotInput.snapshot_id ?? `snap_${randomUUID().replace(/-/g, "")}`,
        method: String(snapshotInput.method ?? "GET").trim().toUpperCase(),
        path: String(snapshotInput.path ?? "").trim(),
        ok: Boolean(snapshotInput.ok),
        status_code: snapshotInput.status_code,
        created_at: Number.isFinite(Number(snapshotInput.created_at)) ? Number(snapshotInput.created_at) : Date.now(),
        label: snapshotInput.label,
        request: snapshotInput.request,
        response: snapshotInput.response,
      };
      manifest = mergeFormalScenarioManifestV1(manifest, { api_snapshots: [snapshot] });
      return snapshot;
    },
    updateManifest(patch) {
      manifest = mergeFormalScenarioManifestV1(manifest, patch);
      return manifest;
    },
    setVerifyEvidence(patch) {
      verifyEvidence = { ...verifyEvidence, ...patch };
      return verifyEvidence;
    },
  };

  try {
    await input.driver?.(ctx);
  } catch (error) {
    run.status = "FAILED";
    const verify = buildFormalScenarioVerifyV1({ run, manifest, evidence: verifyEvidence });
    verify.blocking_reasons.push(`KERNEL_DRIVER_FAILED:${String((error as Error)?.message ?? error ?? "UNKNOWN")}`);
    verify.passed = false;
    return { run, fixture, manifest, verify };
  }

  const verify = buildFormalScenarioVerifyV1({ run, manifest, evidence: verifyEvidence });
  run.status = verify.passed ? "PASSED" : "FAILED";
  return { run, fixture, manifest, verify };
}



export type FormalScenarioKernelMigrationPlanV1 = {
  scenario_type: FormalScenarioTypeV1;
  target_kernel: "runFormalScenarioKernelV1";
  status: "done" | "in_progress" | "planned";
  debt_class: "P0.6-post";
  notes: string;
};

export function listFormalScenarioKernelMigrationPlanV1(): FormalScenarioKernelMigrationPlanV1[] {
  return [
    { scenario_type: "FORMAL_IRRIGATION", target_kernel: "runFormalScenarioKernelV1", status: "done", debt_class: "P0.6-post", notes: "Already migrated." },
    { scenario_type: "DEVICE_ANOMALY", target_kernel: "runFormalScenarioKernelV1", status: "planned", debt_class: "P0.6-post", notes: "Migrate run/fixture/manifest/snapshot/verify from standalone mini-kernel." },
    { scenario_type: "FORMAL_VARIABLE_OPERATION", target_kernel: "runFormalScenarioKernelV1", status: "planned", debt_class: "P0.6-post", notes: "Migrate run/fixture/manifest/snapshot/verify from standalone mini-kernel." },
  ];
}
export function cleanFormalScenarioRunV1(run_id: string): { ok: true; run_id: string; cleaned: true } {
  const normalized = normalizeSafeId(run_id);
  if (!normalized || !normalized.startsWith("fsr_")) throw new FormalScenarioKernelErrorV1("FORMAL_SCENARIO_INVALID_RUN_ID");
  return { ok: true, run_id: normalized, cleaned: true };
}
