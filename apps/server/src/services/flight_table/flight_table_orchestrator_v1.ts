import fs from "node:fs/promises";
import path from "node:path";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import {
  createEmptyFlightTableManifestV1,
  sanitizeFlightTableManifestV1,
  type FlightTableLaneV1,
  type FlightTableRunV1,
  type FlightTableStepV1,
} from "./flight_table_manifest_v1.js";
import { buildInitialFlightTableStepsV1, isFlightTableLaneV1 } from "./flight_table_lanes_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import {
  ensureFlightTableRunDirV1,
  flightTableRunDirV1,
  flightTableRuntimeRootV1,
  snapshotRefFromSnapshotV1,
  writeFlightTableApiSnapshotV1,
} from "./flight_table_snapshots_v1.js";
import { cleanFlightTableRunStorageV1 } from "./flight_table_cleanup_v1.js";

export type CreateFlightTableRunInputV1 = {
  run_id?: string;
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  lane?: FlightTableLaneV1;
};

export type FlightTableFieldManifestUpdateV1 = {
  field_id: string;
  field_name: string;
  season_id: string;
  crop: string;
  crop_stage: string;
  customer_visible: boolean;
  report_visible: boolean;
  customer_scope: "FALLBACK_OR_UNCONFIRMED" | "CONFIRMED";
};

export type FlightTableGeometryManifestUpdateV1 = {
  field_id: string;
  geometry_id: string;
  geometry_status: string;
  geometry_format: "GEOJSON";
  centroid: { lat: number; lng: number } | null;
  area_m2: number | null;
  area_mu: number | null;
  weather_location: { lat: number; lng: number } | null;
  weather_provider_status: "UNAVAILABLE";
  weather_location_status: "LOCATION_RECORDED" | "LOCATION_UNAVAILABLE";
};

type MutateRunFn = (run: FlightTableRunV1) => FlightTableRunV1 | Promise<FlightTableRunV1>;

function runFilePath(run_id: string): string {
  return path.join(flightTableRunDirV1(run_id), "run.json");
}

function isSafeId(input: unknown): input is string {
  return typeof input === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(input.trim());
}

export function normalizeFlightTableRunIdV1(input: unknown): string | null {
  if (!isSafeId(input)) return null;
  const run_id = input.trim();
  return run_id.startsWith("ft_") ? run_id : null;
}

function normalizeScopeValue(input: unknown): string | null {
  if (!isSafeId(input)) return null;
  return input.trim();
}

function scopeFromInputOrAuth(input: unknown, fallback: string): string {
  return normalizeScopeValue(input) ?? fallback;
}

function assertScopeMatchesAuth(input: CreateFlightTableRunInputV1, auth: AoActAuthContextV0): void {
  const tenant_id = scopeFromInputOrAuth(input.tenant_id, auth.tenant_id);
  const project_id = scopeFromInputOrAuth(input.project_id, auth.project_id);
  const group_id = scopeFromInputOrAuth(input.group_id, auth.group_id);
  if (tenant_id !== auth.tenant_id || project_id !== auth.project_id || group_id !== auth.group_id) {
    throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  }
}

function sanitizeRun(raw: any): FlightTableRunV1 {
  const nowIso = new Date().toISOString();
  const steps: FlightTableStepV1[] = Array.isArray(raw?.steps)
    ? raw.steps.map((step: any) => ({
      step_key: String(step?.step_key ?? "").trim(),
      label: String(step?.label ?? "").trim(),
      status: ["PENDING", "RUNNING", "PASS", "FAIL", "SKIPPED"].includes(String(step?.status)) ? step.status : "PENDING",
      verify_result: ["PASS", "FAIL", "PENDING", "SKIPPED"].includes(String(step?.verify_result)) ? step.verify_result : "PENDING",
      message: typeof step?.message === "string" ? step.message : undefined,
      started_at: typeof step?.started_at === "string" ? step.started_at : undefined,
      finished_at: typeof step?.finished_at === "string" ? step.finished_at : undefined,
      updated_at: typeof step?.updated_at === "string" ? step.updated_at : nowIso,
    })).filter((step: FlightTableStepV1) => step.step_key && step.label)
    : buildInitialFlightTableStepsV1(nowIso);
  const run: FlightTableRunV1 = {
    run_id: String(raw?.run_id ?? ""),
    status: ["DRAFT", "READY", "RUNNING", "PASS", "FAIL", "CLEANED"].includes(String(raw?.status)) ? raw.status : "DRAFT",
    lane: isFlightTableLaneV1(raw?.lane) ? raw.lane : "success",
    tenant_id: String(raw?.tenant_id ?? ""),
    project_id: String(raw?.project_id ?? ""),
    group_id: String(raw?.group_id ?? ""),
    created_at: typeof raw?.created_at === "string" ? raw.created_at : nowIso,
    updated_at: typeof raw?.updated_at === "string" ? raw.updated_at : nowIso,
    started_at: typeof raw?.started_at === "string" ? raw.started_at : undefined,
    finished_at: typeof raw?.finished_at === "string" ? raw.finished_at : undefined,
    current_step: typeof raw?.current_step === "string" ? raw.current_step : undefined,
    steps,
    manifest: sanitizeFlightTableManifestV1(raw?.manifest ?? createEmptyFlightTableManifestV1()),
    verify_summary: raw?.verify_summary ?? buildFlightVerifySummaryV1({ status: "DRAFT", steps }),
  };
  return { ...run, verify_summary: buildFlightVerifySummaryV1(run) };
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next = sanitizeRun({ ...run, updated_at: new Date().toISOString() });
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function readFlightTableRunV1(run_id: string): Promise<FlightTableRunV1 | null> {
  const normalized = normalizeFlightTableRunIdV1(run_id);
  if (!normalized) return null;
  try {
    const raw = await fs.readFile(runFilePath(normalized), "utf8");
    return sanitizeRun(JSON.parse(raw));
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function listFlightTableRunsV1(): Promise<FlightTableRunV1[]> {
  try {
    const entries = await fs.readdir(flightTableRuntimeRootV1(), { withFileTypes: true });
    const runs = await Promise.all(entries
      .filter((entry) => entry.isDirectory() && normalizeFlightTableRunIdV1(entry.name))
      .map((entry) => readFlightTableRunV1(entry.name)));
    return runs
      .filter((run): run is FlightTableRunV1 => Boolean(run))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

async function mutateFlightTableRunV1(run_id: string, mutate: MutateRunFn): Promise<FlightTableRunV1 | null> {
  const current = await readFlightTableRunV1(run_id);
  if (!current) return null;
  const next = await mutate(current);
  return writeRun(next);
}

export async function createFlightTableRunV1(input: CreateFlightTableRunInputV1, auth: AoActAuthContextV0): Promise<FlightTableRunV1> {
  assertScopeMatchesAuth(input, auth);
  const run_id = normalizeFlightTableRunIdV1(input.run_id);
  if (!run_id) throw new Error("FLIGHT_TABLE_INVALID_RUN_ID");
  const lane = isFlightTableLaneV1(input.lane) ? input.lane : "success";
  const existed = await readFlightTableRunV1(run_id);
  if (existed && existed.status !== "CLEANED") throw new Error("FLIGHT_TABLE_RUN_EXISTS");
  const nowIso = new Date().toISOString();
  const run: FlightTableRunV1 = {
    run_id,
    status: "READY",
    lane,
    tenant_id: auth.tenant_id,
    project_id: auth.project_id,
    group_id: auth.group_id,
    created_at: nowIso,
    updated_at: nowIso,
    current_step: "A",
    steps: buildInitialFlightTableStepsV1(nowIso),
    manifest: createEmptyFlightTableManifestV1(),
    verify_summary: buildFlightVerifySummaryV1({ status: "READY", steps: buildInitialFlightTableStepsV1(nowIso) }),
  };
  let saved = await writeRun(run);
  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id,
    method: "POST",
    path: "/api/v1/dev/flight-table/runs",
    ok: true,
    status_code: 200,
    label: "create run",
    request: { run_id, tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id, lane },
    response: { ok: true, run_id, status: saved.status, lane: saved.lane },
  });
  saved = await writeRun({
    ...saved,
    manifest: {
      ...saved.manifest,
      api_snapshot_refs: [...saved.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
    },
  });
  return saved;
}

export async function verifyFlightTableRunV1(run_id: string): Promise<FlightTableRunV1 | null> {
  return mutateFlightTableRunV1(run_id, async (run) => {
    const summary = buildFlightVerifySummaryV1(run);
    const snapshot = await writeFlightTableApiSnapshotV1({
      run_id: run.run_id,
      method: "POST",
      path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/verify`,
      ok: summary.ok,
      status_code: 200,
      label: "verify run",
      response: { verify_summary: summary },
    });
    return {
      ...run,
      verify_summary: summary,
      manifest: {
        ...run.manifest,
        api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      },
    };
  });
}

export async function updateFlightTableRunAfterFieldV1(
  run_id: string,
  field: FlightTableFieldManifestUpdateV1,
): Promise<FlightTableRunV1 | null> {
  return mutateFlightTableRunV1(run_id, async (run) => {
    const nowIso = new Date().toISOString();
    const fieldUrl = `/customer/fields/${encodeURIComponent(field.field_id)}`;
    const snapshot = await writeFlightTableApiSnapshotV1({
      run_id: run.run_id,
      method: "POST",
      path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/field`,
      ok: field.customer_visible && field.report_visible,
      status_code: 200,
      label: "create field",
      request: {
        field_id: field.field_id,
        field_name: field.field_name,
        season_id: field.season_id,
        crop: field.crop,
        crop_stage: field.crop_stage,
      },
      response: {
        field_id: field.field_id,
        field_name: field.field_name,
        customer_visible: field.customer_visible,
        report_visible: field.report_visible,
        customer_scope: field.customer_scope,
      },
    });
    const steps = run.steps.map((step) => step.step_key === "A"
      ? {
        ...step,
        status: field.customer_visible && field.report_visible ? "PASS" as const : "FAIL" as const,
        verify_result: field.customer_visible && field.report_visible ? "PASS" as const : "FAIL" as const,
        message: `field_id=${field.field_id}; customer_visible=${field.customer_visible}; report_visible=${field.report_visible}; customer_scope=${field.customer_scope}`,
        finished_at: nowIso,
        updated_at: nowIso,
      }
      : step);
    const next = {
      ...run,
      current_step: "A1",
      steps,
      manifest: {
        ...run.manifest,
        field_id: field.field_id,
        season_id: field.season_id,
        crop: field.crop,
        crop_stage: field.crop_stage,
        api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
        ui_urls: Array.from(new Set([...run.manifest.ui_urls, fieldUrl])),
      },
    };
    return { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  });
}

export async function updateFlightTableRunAfterGeometryV1(
  run_id: string,
  geometry: FlightTableGeometryManifestUpdateV1,
): Promise<FlightTableRunV1 | null> {
  return mutateFlightTableRunV1(run_id, async (run) => {
    const nowIso = new Date().toISOString();
    const fieldUrl = `/customer/fields/${encodeURIComponent(geometry.field_id)}`;
    const ok = geometry.geometry_status !== "MISSING" && geometry.geometry_status !== "INVALID" && Boolean(geometry.centroid);
    const snapshot = await writeFlightTableApiSnapshotV1({
      run_id: run.run_id,
      method: "POST",
      path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/field-geometry`,
      ok,
      status_code: 200,
      label: "create field geometry",
      request: {
        field_id: geometry.field_id,
        geometry_format: geometry.geometry_format,
        weather_location: geometry.weather_location,
      },
      response: {
        field_id: geometry.field_id,
        geometry_id: geometry.geometry_id,
        geometry_status: geometry.geometry_status,
        centroid: geometry.centroid,
        area_m2: geometry.area_m2,
        area_mu: geometry.area_mu,
        weather_provider_status: geometry.weather_provider_status,
        weather_location_status: geometry.weather_location_status,
      },
    });
    const steps = run.steps.map((step) => step.step_key === "A1"
      ? {
        ...step,
        status: ok ? "PASS" as const : "FAIL" as const,
        verify_result: ok ? "PASS" as const : "FAIL" as const,
        message: `geometry_id=${geometry.geometry_id}; geometry_status=${geometry.geometry_status}; weather_provider_status=${geometry.weather_provider_status}`,
        finished_at: nowIso,
        updated_at: nowIso,
      }
      : step);
    const next = {
      ...run,
      current_step: "B",
      steps,
      manifest: {
        ...run.manifest,
        field_id: run.manifest.field_id ?? geometry.field_id,
        geometry_id: geometry.geometry_id,
        api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
        ui_urls: Array.from(new Set([...run.manifest.ui_urls, fieldUrl])),
      },
    };
    return { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  });
}

export async function retryFlightTableStepV1(run_id: string, step_key: string): Promise<FlightTableRunV1 | null> {
  const normalizedStep = String(step_key ?? "").trim();
  return mutateFlightTableRunV1(run_id, async (run) => {
    const nowIso = new Date().toISOString();
    const steps = run.steps.map((step) => step.step_key === normalizedStep
      ? {
        ...step,
        status: "PENDING" as const,
        verify_result: "PENDING" as const,
        message: "Step reset by FT-A0 retry control. Execution is implemented in later FT phases.",
        started_at: undefined,
        finished_at: undefined,
        updated_at: nowIso,
      }
      : step);
    const found = steps.some((step) => step.step_key === normalizedStep);
    if (!found) throw new Error("FLIGHT_TABLE_STEP_NOT_FOUND");
    const snapshot = await writeFlightTableApiSnapshotV1({
      run_id: run.run_id,
      method: "POST",
      path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/steps/${encodeURIComponent(normalizedStep)}/retry`,
      ok: true,
      status_code: 200,
      label: "retry step",
      request: { step_key: normalizedStep },
      response: { ok: true, step_key: normalizedStep },
    });
    const next = { ...run, current_step: normalizedStep, status: "READY" as const, steps };
    return {
      ...next,
      verify_summary: buildFlightVerifySummaryV1(next),
      manifest: {
        ...next.manifest,
        api_snapshot_refs: [...next.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
      },
    };
  });
}

export async function cleanFlightTableRunV1(run_id: string): Promise<FlightTableRunV1 | null> {
  const run = await readFlightTableRunV1(run_id);
  if (!run) return null;
  await cleanFlightTableRunStorageV1(run.run_id);
  const nowIso = new Date().toISOString();
  const cleaned: FlightTableRunV1 = {
    ...run,
    status: "CLEANED",
    current_step: undefined,
    finished_at: nowIso,
    updated_at: nowIso,
    steps: run.steps.map((step) => ({
      ...step,
      status: step.status === "PASS" || step.status === "FAIL" ? step.status : "SKIPPED",
      verify_result: step.verify_result === "PASS" || step.verify_result === "FAIL" ? step.verify_result : "SKIPPED",
      message: step.message ?? "Run cleaned by flight table cleanup.",
      updated_at: nowIso,
    })),
    manifest: {
      ...createEmptyFlightTableManifestV1(),
      ui_urls: run.manifest.ui_urls,
    },
  };
  return writeRun({ ...cleaned, verify_summary: buildFlightVerifySummaryV1(cleaned) });
}
