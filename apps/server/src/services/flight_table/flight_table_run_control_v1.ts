import fs from "node:fs/promises";
import path from "node:path";

import {
  sanitizeFlightTableManifestV1,
  type FlightTableLaneV1,
  type FlightTableRunV1,
  type FlightTableStepV1,
} from "./flight_table_manifest_v1.js";
import { FLIGHT_TABLE_A0_STEPS_V1, isFlightTableLaneV1 } from "./flight_table_lanes_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import {
  ensureFlightTableRunDirV1,
  flightTableRunDirV1,
  snapshotRefFromSnapshotV1,
  writeFlightTableApiSnapshotV1,
} from "./flight_table_snapshots_v1.js";

export type FlightTableStartInputV1 = {
  lane?: FlightTableLaneV1;
  field_id?: string;
  device_set?: string;
  skill_policy?: string;
  weather_policy?: string;
  evidence_policy?: string;
};

const LANE_FAILURE_STEP: Record<Exclude<FlightTableLaneV1, "success" | "all">, { step_key: string; message: string }> = {
  evidence_insufficient: {
    step_key: "G",
    message: "evidence_policy produced evidence_insufficient; acceptance package is intentionally incomplete.",
  },
  weather_interference: {
    step_key: "H",
    message: "weather_policy detected weather_interference; weather provider is unavailable or conflicts with execution evidence.",
  },
  skill_failure: {
    step_key: "C0",
    message: "skill_policy produced skill_failure; operator skill trace should contain the injected failure reason.",
  },
};

function runFilePath(run_id: string): string {
  return path.join(flightTableRunDirV1(run_id), "run.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePolicy(input: unknown, fallback: string): string {
  const v = typeof input === "string" ? input.trim() : "";
  return v || fallback;
}

function existingStep(run: FlightTableRunV1, step_key: string): FlightTableStepV1 | null {
  return run.steps.find((step) => step.step_key === step_key) ?? null;
}

function deriveLane(input: FlightTableStartInputV1, run: FlightTableRunV1): FlightTableLaneV1 {
  return isFlightTableLaneV1(input.lane) ? input.lane : run.lane;
}

function stepMessage(step_key: string, lane: FlightTableLaneV1, failure: { step_key: string; message: string } | null): string {
  if (failure?.step_key === step_key) return failure.message;
  if (failure && FLIGHT_TABLE_A0_STEPS_V1.findIndex((s) => s.step_key === step_key) > FLIGHT_TABLE_A0_STEPS_V1.findIndex((s) => s.step_key === failure.step_key)) {
    return `Skipped because lane ${lane} failed at ${failure.step_key}.`;
  }
  return `FT-E lane ${lane} run-control marked this stage as complete.`;
}

function buildLaneSteps(run: FlightTableRunV1, lane: FlightTableLaneV1, ts: string): FlightTableStepV1[] {
  const effectiveLane = lane === "all" ? "evidence_insufficient" : lane;
  const failure = effectiveLane === "success" ? null : LANE_FAILURE_STEP[effectiveLane];
  const failureIndex = failure ? FLIGHT_TABLE_A0_STEPS_V1.findIndex((step) => step.step_key === failure.step_key) : -1;
  return FLIGHT_TABLE_A0_STEPS_V1.map((def, index) => {
    const prev = existingStep(run, def.step_key);
    const base: FlightTableStepV1 = {
      step_key: def.step_key,
      label: prev?.label ?? def.label,
      status: "PENDING",
      verify_result: "PENDING",
      updated_at: ts,
    };
    if (!failure) {
      return {
        ...base,
        status: "PASS",
        verify_result: "PASS",
        message: stepMessage(def.step_key, lane, null),
        started_at: prev?.started_at ?? ts,
        finished_at: ts,
      };
    }
    if (index < failureIndex) {
      return {
        ...base,
        status: prev?.status === "PASS" ? "PASS" : "PASS",
        verify_result: "PASS",
        message: stepMessage(def.step_key, lane, failure),
        started_at: prev?.started_at ?? ts,
        finished_at: ts,
      };
    }
    if (index === failureIndex) {
      return {
        ...base,
        status: "FAIL",
        verify_result: "FAIL",
        message: failure.message,
        started_at: prev?.started_at ?? ts,
        finished_at: ts,
      };
    }
    return {
      ...base,
      status: "SKIPPED",
      verify_result: "SKIPPED",
      message: stepMessage(def.step_key, lane, failure),
      updated_at: ts,
    };
  });
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next: FlightTableRunV1 = {
    ...run,
    updated_at: nowIso(),
    manifest: sanitizeFlightTableManifestV1(run.manifest),
  };
  const withSummary = { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(withSummary, null, 2)}\n`, "utf8");
  return withSummary;
}

export async function startFlightTableRunV1(run: FlightTableRunV1, input: FlightTableStartInputV1): Promise<FlightTableRunV1> {
  const lane = deriveLane(input, run);
  const ts = nowIso();
  const field_id = normalizePolicy(input.field_id, run.manifest.field_id ?? "UNBOUND_FIELD");
  const device_set = normalizePolicy(input.device_set, run.manifest.device_ids.length ? run.manifest.device_ids.join(",") : "DEFAULT_DEVICE_SET");
  const skill_policy = normalizePolicy(input.skill_policy, lane === "skill_failure" || lane === "all" ? "inject_skill_failure" : "require_all_bound");
  const weather_policy = normalizePolicy(input.weather_policy, lane === "weather_interference" || lane === "all" ? "simulate_weather_interference" : "observe_only");
  const evidence_policy = normalizePolicy(input.evidence_policy, lane === "evidence_insufficient" || lane === "all" ? "insufficient" : "complete");
  const steps = buildLaneSteps(run, lane, ts);
  const hasFail = steps.some((step) => step.status === "FAIL");
  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/start`,
    ok: !hasFail,
    status_code: 200,
    label: "start lane run-control",
    request: { lane, field_id, device_set, skill_policy, weather_policy, evidence_policy },
    response: {
      previous_status: run.status,
      next_status: hasFail ? "FAIL" : "PASS",
      lane,
      failed_steps: steps.filter((step) => step.status === "FAIL").map((step) => ({ step_key: step.step_key, message: step.message })),
    },
  });
  const next: FlightTableRunV1 = {
    ...run,
    status: hasFail ? "FAIL" : "PASS",
    lane,
    started_at: run.started_at ?? ts,
    finished_at: ts,
    current_step: steps.find((step) => step.status === "FAIL")?.step_key ?? "I",
    steps,
    manifest: {
      ...run.manifest,
      field_id: run.manifest.field_id ?? (field_id === "UNBOUND_FIELD" ? null : field_id),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
    },
  };
  return writeRun(next);
}
