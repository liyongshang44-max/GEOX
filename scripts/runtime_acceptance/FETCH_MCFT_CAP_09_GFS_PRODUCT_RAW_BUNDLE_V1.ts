import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
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

type RetainedMember = {
  name: string;
  kind: GfsNomadsRawObjectV1["kind"];
  lead?: number;
  identity_sha256?: string;
  sha256: string;
  bytes: number;
  path: string;
};

function sha256(bytes: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`MCFT_CAP09_GFS_BRIDGE_ARG_REQUIRED:${name}`);
  return process.argv[index + 1]!;
}

function optionalArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : null;
}

function canonicalHour(value: string, code: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error(code);
  }
  return date;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

function canonicalJsonSha256(value: unknown): string {
  return sha256(canonicalJson(value));
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
  options: { lead?: number; include_identity?: boolean } = {},
): Promise<RetainedMember> {
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
    ...(options.lead === undefined ? {} : { lead: options.lead }),
    ...(options.include_identity ? { identity_sha256: sha256(raw.identity) } : {}),
    sha256: raw.sha256,
    bytes: reread.byteLength,
    path: absolute,
  };
}

function tarOctal(value: number, width: number): Buffer {
  const text = value.toString(8).padStart(width - 1, "0") + "\0";
  return Buffer.from(text, "ascii");
}

function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  const nameBytes = Buffer.from(name, "utf8");
  assert.ok(nameBytes.length <= 100, `MCFT_CAP09_GFS_BRIDGE_TAR_NAME_TOO_LONG:${name}`);
  nameBytes.copy(header, 0);
  tarOctal(0o600, 8).copy(header, 100);
  tarOctal(0, 8).copy(header, 108);
  tarOctal(0, 8).copy(header, 116);
  tarOctal(size, 12).copy(header, 124);
  tarOctal(0, 12).copy(header, 136);
  Buffer.from("        ", "ascii").copy(header, 148);
  header[156] = "0".charCodeAt(0);
  Buffer.from("ustar\0", "ascii").copy(header, 257);
  Buffer.from("00", "ascii").copy(header, 263);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const checksumText = checksum.toString(8).padStart(6, "0") + "\0 ";
  Buffer.from(checksumText, "ascii").copy(header, 148);
  return header;
}

function tarArchive(entries: readonly { name: string; body: Uint8Array }[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body);
    chunks.push(tarHeader(entry.name, body.byteLength));
    chunks.push(body);
    const remainder = body.byteLength % 512;
    if (remainder !== 0) chunks.push(Buffer.alloc(512 - remainder, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

function publicMember(member: RetainedMember): Record<string, unknown> {
  return {
    name: member.name,
    kind: member.kind,
    ...(member.lead === undefined ? {} : { lead: member.lead }),
    ...(member.identity_sha256 === undefined ? {} : { identity_sha256: member.identity_sha256 }),
    sha256: member.sha256,
    bytes: member.bytes,
  };
}

async function main(): Promise<void> {
  const target = canonicalHour(arg("--target"), "MCFT_CAP09_GFS_BRIDGE_TARGET_INVALID");
  const output = path.resolve(arg("--output"));
  const meta = path.resolve(arg("--meta"));
  const suppliedPrivateRoot = optionalArg("--private-root");
  const privateRoot = suppliedPrivateRoot ? path.resolve(suppliedPrivateRoot) : await fs.mkdtemp(path.join(os.tmpdir(), "mcft-cap09-gfs-product-bridge-"));
  const ownsPrivateRoot = suppliedPrivateRoot === null;
  const requestedAt = new Date().toISOString();
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(path.dirname(meta), { recursive: true });

  try {
    const byteClient = new ControlledHttpsByteClientV1({
      user_agent: USER_AGENT,
      max_raw_bytes: 20_000_000,
      timeout_ms: 90_000,
    });
    const provider = new GfsNomadsLiveProviderV1({ byte_client: byteClient });

    let providerRequestCount = 0;
    const directoryMembers: RetainedMember[] = [];
    const selection = await provider.selectLatestCompleteCycle(target, async (raw) => {
      providerRequestCount += 1;
      const name = `selection/${String(directoryMembers.length).padStart(2, "0")}_gfs_directory_listing.raw`;
      const retained = await retainRaw(privateRoot, raw, name, { include_identity: true });
      directoryMembers.push(retained);
      return parseGfsDirectoryInventoryV1(new Uint8Array(await fs.readFile(retained.path)));
    });

    const members: RetainedMember[] = [...directoryMembers];
    const idxSelectedLines: Array<{ lead: number; line_sha256: string }> = [];
    const leads = Array.from({ length: selection.lead_end - selection.support_lead + 1 }, (_, i) => selection.support_lead + i);

    for (const lead of leads) {
      const raw = await provider.fetchPgrb2FilteredRaw(selection.cycle, lead);
      providerRequestCount += 1;
      members.push(await retainRaw(privateRoot, raw, safeMemberName(raw.kind, lead), { lead }));
    }

    for (const lead of leads) {
      const idxRaw = await provider.fetchSfluxIndexRaw(selection.cycle, lead, target);
      providerRequestCount += 1;
      const idxRetained = await retainRaw(privateRoot, idxRaw, safeMemberName(idxRaw.kind, lead), { lead });
      members.push(idxRetained);
      const selectedRange = parseGfsSfluxIndexV1(new Uint8Array(await fs.readFile(idxRetained.path)), lead);
      idxSelectedLines.push({ lead, line_sha256: selectedRange.line_sha256 });

      const messageRaw = await provider.fetchSfluxMessageRaw(selection.cycle, lead, target, selectedRange);
      providerRequestCount += 1;
      members.push(await retainRaw(privateRoot, messageRaw, safeMemberName(messageRaw.kind, lead), { lead }));
    }

    members.sort((a, b) => a.name.localeCompare(b.name));
    idxSelectedLines.sort((a, b) => a.lead - b.lead);
    const publicMembers = members.map(publicMember);
    const retrievedAt = new Date().toISOString();
    const manifest = {
      schema_version: "geox_mcft_cap09_ea5e2_gfs_raw_bundle_v1",
      target_logical_time: target.toISOString().replace(".000Z", "Z"),
      selected_cycle: selection.cycle,
      lead_start: selection.lead_start,
      lead_end: selection.lead_end,
      support_lead: selection.support_lead,
      requested_at: requestedAt,
      retrieved_at: retrievedAt,
      provider_request_count: providerRequestCount,
      directory_rejection_count: selection.rejected_cycles.length,
      member_count: publicMembers.length,
      member_chain_sha256: canonicalJsonSha256(publicMembers),
      idx_selected_line_chain_sha256: canonicalJsonSha256(idxSelectedLines),
      members: publicMembers,
      product_acquisition_provider_used: true,
      product_provider_id: provider.provider_id,
      retention_before_directory_parse: true,
      retention_before_sflux_idx_parse: true,
      retention_before_scientific_decode: true,
    };

    const tarEntries: Array<{ name: string; body: Uint8Array }> = [
      { name: "manifest.json", body: new TextEncoder().encode(canonicalJson(manifest)) },
    ];
    for (const member of members) tarEntries.push({ name: member.name, body: new Uint8Array(await fs.readFile(member.path)) });
    const bundle = tarArchive(tarEntries);
    await fs.writeFile(output, bundle, { mode: 0o600 });

    const safe = {
      status: "PASS",
      target_logical_time: manifest.target_logical_time,
      selected_cycle: manifest.selected_cycle,
      lead_start: manifest.lead_start,
      lead_end: manifest.lead_end,
      support_lead: manifest.support_lead,
      requested_at: requestedAt,
      retrieved_at: retrievedAt,
      provider_request_count: providerRequestCount,
      raw_provider_object_count: publicMembers.length,
      raw_bundle_sha256: sha256(bundle),
      raw_bundle_bytes: bundle.byteLength,
      raw_member_chain_sha256: manifest.member_chain_sha256,
      product_acquisition_provider_used: true,
      product_provider_id: provider.provider_id,
      retention_before_directory_parse: true,
      retention_before_sflux_idx_parse: true,
      retention_before_scientific_decode: true,
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
    await fs.writeFile(meta, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({
      status: safe.status,
      selected_cycle: safe.selected_cycle,
      provider_request_count: safe.provider_request_count,
      raw_provider_object_count: safe.raw_provider_object_count,
      product_acquisition_provider_used: true,
      raw_values_emitted: false,
    })}\n`);
  } finally {
    if (ownsPrivateRoot) await fs.rm(privateRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
