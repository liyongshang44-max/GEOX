import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  ControlledHttpsByteClientV1,
} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {
  GfsNomadsLiveProviderV1,
  parseGfsDirectoryInventoryV1,
  parseGfsSfluxIndexV1,
  type GfsNomadsRawObjectV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";

const USER_AGENT = "GEOX-MCFT-CAP09-EA5E2-PRODUCT-GFS-BRIDGE/1.0";

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`MCFT_CAP09_GFS_BRIDGE_ARG_REQUIRED:${name}`);
  return process.argv[index + 1]!;
}

function canonicalHour(value: string, code: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return date;
}

function safeMemberName(kind: GfsNomadsRawObjectV1["kind"], lead?: number): string {
  if (kind === "GFS_PGRB2_FILTER_RESPONSE") return `pgrb2/f${String(lead).padStart(3, "0")}.grib2`;
  if (kind === "GFS_SFLUX_IDX") return `sflux/f${String(lead).padStart(3, "0")}.idx`;
  if (kind === "GFS_SFLUX_EXACT_GRIB_MESSAGE") return `sflux/f${String(lead).padStart(3, "0")}.grib2`;
  throw new Error(`MCFT_CAP09_GFS_BRIDGE_UNEXPECTED_MEMBER_KIND:${kind}`);
}

async function retainRaw(
  privateRoot: string,
  raw: GfsNomadsRawObjectV1,
  relativeName: string,
  lead?: number,
): Promise<{ name: string; kind: string; lead?: number; identity_sha256: string; sha256: string; bytes: number; path: string }> {
  const absolute = path.resolve(privateRoot, relativeName);
  const root = path.resolve(privateRoot);
  assert.ok(absolute.startsWith(`${root}${path.sep}`), "MCFT_CAP09_GFS_BRIDGE_PRIVATE_PATH_ESCAPE");
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolute, raw.response.bytes, { mode: 0o600 });
  const reread = new Uint8Array(await fs.readFile(absolute));
  assert.equal(reread.byteLength, raw.response.bytes.byteLength, `MCFT_CAP09_GFS_BRIDGE_RETENTION_BYTES:${relativeName}`);
  assert.equal(sha256(reread), raw.sha256, `MCFT_CAP09_GFS_BRIDGE_RETENTION_DIGEST:${relativeName}`);
  return {
    name: relativeName,
    kind: raw.kind,
    ...(lead === undefined ? {} : { lead }),
    identity_sha256: sha256(new TextEncoder().encode(raw.identity)),
    sha256: raw.sha256,
    bytes: reread.byteLength,
    path: absolute,
  };
}

async function main(): Promise<void> {
  const target = canonicalHour(arg("--target"), "MCFT_CAP09_GFS_BRIDGE_TARGET_INVALID");
  const privateRoot = path.resolve(arg("--private-root"));
  const output = path.resolve(arg("--output"));
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.dirname(output), { recursive: true });

  const byteClient = new ControlledHttpsByteClientV1({
    user_agent: USER_AGENT,
    max_raw_bytes: 20_000_000,
    timeout_ms: 90_000,
  });
  const provider = new GfsNomadsLiveProviderV1({ byte_client: byteClient });

  let providerRequestCount = 0;
  const directoryMembers: Array<{ name: string; kind: string; identity_sha256: string; sha256: string; bytes: number; path: string }> = [];
  const selection = await provider.selectLatestCompleteCycle(target, async (raw) => {
    providerRequestCount += 1;
    const name = `selection/${String(directoryMembers.length).padStart(2, "0")}_gfs_directory_listing.raw`;
    const retained = await retainRaw(privateRoot, raw, name);
    directoryMembers.push(retained);
    return parseGfsDirectoryInventoryV1(new Uint8Array(await fs.readFile(retained.path)));
  });

  const members: Array<{ name: string; kind: string; lead?: number; identity_sha256: string; sha256: string; bytes: number; path: string }> = [...directoryMembers];
  const idxSelectedLines: Array<{ lead: number; line_sha256: string }> = [];
  const leads = Array.from({ length: selection.lead_end - selection.support_lead + 1 }, (_, i) => selection.support_lead + i);

  for (const lead of leads) {
    const raw = await provider.fetchPgrb2FilteredRaw(selection.cycle, lead);
    providerRequestCount += 1;
    members.push(await retainRaw(privateRoot, raw, safeMemberName(raw.kind, lead), lead));
  }

  for (const lead of leads) {
    const idxRaw = await provider.fetchSfluxIndexRaw(selection.cycle, lead, target);
    providerRequestCount += 1;
    const idxRetained = await retainRaw(privateRoot, idxRaw, safeMemberName(idxRaw.kind, lead), lead);
    members.push(idxRetained);
    const selectedRange = parseGfsSfluxIndexV1(new Uint8Array(await fs.readFile(idxRetained.path)), lead);
    idxSelectedLines.push({ lead, line_sha256: selectedRange.line_sha256 });

    const messageRaw = await provider.fetchSfluxMessageRaw(selection.cycle, lead, target, selectedRange);
    providerRequestCount += 1;
    members.push(await retainRaw(privateRoot, messageRaw, safeMemberName(messageRaw.kind, lead), lead));
  }

  const result = {
    schema_version: "geox_mcft_cap09_gfs_product_raw_bundle_bridge_v1",
    status: "PASS",
    target_logical_time: target.toISOString().replace(".000Z", "Z"),
    selected_cycle: selection.cycle,
    lead_start: selection.lead_start,
    lead_end: selection.lead_end,
    support_lead: selection.support_lead,
    directory_rejection_count: selection.rejected_cycles.length,
    provider_request_count: providerRequestCount,
    product_provider_id: provider.provider_id,
    product_acquisition_provider_used: true,
    retention_before_directory_parse: true,
    retention_before_sflux_idx_parse: true,
    retention_before_scientific_decode: true,
    members: members.sort((a, b) => a.name.localeCompare(b.name)),
    idx_selected_lines: idxSelectedLines.sort((a, b) => a.lead - b.lead),
    raw_values_emitted: false,
    database_write_count: 0,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    production_cadence_activation: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    selected_cycle: result.selected_cycle,
    provider_request_count: result.provider_request_count,
    raw_provider_object_count: result.members.length,
    product_acquisition_provider_used: true,
    raw_values_emitted: false,
  })}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
