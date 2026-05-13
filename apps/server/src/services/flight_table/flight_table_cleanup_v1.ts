import fs from "node:fs/promises";

import { flightTableRunDirV1 } from "./flight_table_snapshots_v1.js";

export async function cleanFlightTableRunStorageV1(run_id: string): Promise<{ ok: true; cleaned_path: string }> {
  const dir = flightTableRunDirV1(run_id);
  await fs.rm(dir, { recursive: true, force: true });
  return { ok: true, cleaned_path: dir };
}
