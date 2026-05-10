import fs from "node:fs/promises";
import path from "node:path";

import {
  sanitizeFlightTableManifestV1,
  type FlightTableRunV1,
} from "./flight_table_manifest_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import {
  ensureFlightTableRunDirV1,
  flightTableRunDirV1,
  snapshotRefFromSnapshotV1,
  writeFlightTableApiSnapshotV1,
} from "./flight_table_snapshots_v1.js";
import type { FlightTableSkillAssemblyResponseV1 } from "./flight_table_skills_v1.js";

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function runFilePath(run_id: string): string {
  return path.join(flightTableRunDirV1(run_id), "run.json");
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next: FlightTableRunV1 = {
    ...run,
    updated_at: new Date().toISOString(),
    manifest: sanitizeFlightTableManifestV1(run.manifest),
  };
  const withSummary = { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(withSummary, null, 2)}\n`, "utf8");
  return withSummary;
}

export async function updateFlightTableRunAfterSkillsV1(
  run: FlightTableRunV1,
  result: FlightTableSkillAssemblyResponseV1,
  action: "bind" | "fail-one" | "restore",
): Promise<FlightTableRunV1> {
  const nowIso = new Date().toISOString();
  const ok = result.verify.bindings_visible && result.verify.trace_visible && result.verify.performance_visible && (action !== "bind" || !result.failure);
  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/skills/${action}`,
    ok,
    status_code: 200,
    label: `skills ${action}`,
    request: { action, operation_id: result.operation_id },
    response: {
      operation_id: result.operation_id,
      binding_ids: result.binding_ids,
      skill_run_ids: result.skill_run_ids,
      missing_required_observation_skills: result.missing_required_observation_skills,
      failure: result.failure ?? null,
      verify: result.verify,
    },
  });
  const stepPass = action === "fail-one" ? Boolean(result.failure?.trace_visible) : ok;
  const steps = run.steps.map((step) => step.step_key === "C0"
    ? {
      ...step,
      status: stepPass ? "PASS" as const : "FAIL" as const,
      verify_result: stepPass ? "PASS" as const : "FAIL" as const,
      message: action === "fail-one"
        ? `skill failure lane injected; reason=${result.failure?.failure_reason ?? "unknown"}; operator_trace=${result.failure?.trace_visible ?? false}`
        : `skills=${result.binding_ids.length}; traces=${result.verify.trace_visible}; performance=${result.verify.performance_visible}`,
      finished_at: nowIso,
      updated_at: nowIso,
    }
    : step);
  const next: FlightTableRunV1 = {
    ...run,
    lane: action === "fail-one" ? "skill_failure" : run.lane,
    current_step: action === "fail-one" ? "C0" : "C",
    steps,
    manifest: {
      ...run.manifest,
      operation_plan_ids: uniqueStrings([...run.manifest.operation_plan_ids, result.operation_id]),
      skill_binding_ids: uniqueStrings([...run.manifest.skill_binding_ids, ...result.binding_ids]),
      skill_run_ids: uniqueStrings([...run.manifest.skill_run_ids, ...result.skill_run_ids]),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      ui_urls: uniqueStrings([
        ...run.manifest.ui_urls,
        result.verify.operator_trace_url,
        result.verify.operator_performance_url,
      ]),
    },
  };
  return writeRun(next);
}
