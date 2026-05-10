import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import type { FlightTableApiSnapshotRefV1 } from "./flight_table_manifest_v1.js";

export type FlightTableApiSnapshotV1 = FlightTableApiSnapshotRefV1 & {
  run_id: string;
  request?: unknown;
  response?: unknown;
  error?: string;
};

export function flightTableRuntimeRootV1(): string {
  return path.resolve(process.cwd(), "tmp", "flight_table");
}

export function flightTableRunDirV1(run_id: string): string {
  return path.join(flightTableRuntimeRootV1(), run_id);
}

export function flightTableSnapshotDirV1(run_id: string): string {
  return path.join(flightTableRunDirV1(run_id), "api_snapshots");
}

export async function ensureFlightTableRunDirV1(run_id: string): Promise<void> {
  await fs.mkdir(flightTableSnapshotDirV1(run_id), { recursive: true });
}

export function buildSnapshotIdV1(method: string, routePath: string): string {
  const seed = `${method.toUpperCase()}|${routePath}|${Date.now()}|${Math.random()}`;
  return `fts_${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

export async function writeFlightTableApiSnapshotV1(input: {
  run_id: string;
  method: string;
  path: string;
  ok: boolean;
  status_code?: number;
  label?: string;
  request?: unknown;
  response?: unknown;
  error?: string;
}): Promise<FlightTableApiSnapshotV1> {
  await ensureFlightTableRunDirV1(input.run_id);
  const created_at = new Date().toISOString();
  const snapshot: FlightTableApiSnapshotV1 = {
    run_id: input.run_id,
    snapshot_id: buildSnapshotIdV1(input.method, input.path),
    method: input.method.toUpperCase(),
    path: input.path,
    ok: input.ok,
    status_code: input.status_code,
    created_at,
    label: input.label,
    request: input.request,
    response: input.response,
    error: input.error,
  };
  const filePath = path.join(flightTableSnapshotDirV1(input.run_id), `${snapshot.snapshot_id}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

export async function listFlightTableApiSnapshotsV1(run_id: string): Promise<FlightTableApiSnapshotV1[]> {
  const dir = flightTableSnapshotDirV1(run_id);
  try {
    const entries = await fs.readdir(dir);
    const items = await Promise.all(entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const raw = await fs.readFile(path.join(dir, name), "utf8");
        return JSON.parse(raw) as FlightTableApiSnapshotV1;
      }));
    return items.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

export function snapshotRefFromSnapshotV1(snapshot: FlightTableApiSnapshotV1): FlightTableApiSnapshotRefV1 {
  return {
    snapshot_id: snapshot.snapshot_id,
    method: snapshot.method,
    path: snapshot.path,
    ok: snapshot.ok,
    status_code: snapshot.status_code,
    created_at: snapshot.created_at,
    label: snapshot.label,
  };
}
