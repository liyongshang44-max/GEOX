// MCFT-CAP-09 Phase 5 qualification Evidence process entrypoint.
//
// This module substitutes only controlled raw acquisition data and target selection.
// It calls the production Evidence process factory; Phase3 host/cycle/persistence/lease,
// raw retention, canonicalizer, fenced COMMIT, visibility and EvidenceSupplyCursor remain
// production-owned. Fixture inputs are data-only files bound by SHA-256; executable
// fixture modules, provider fallback and direct canonical writes are intentionally absent.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  runMcftCap09EvidenceRuntimeProcessV1,
  readMcftCap09EvidenceRuntimeProcessConfigV1,
} from "../mcft_cap09_evidence_runtime_process_v1.js";
import type {
  EvidenceRuntimeAcquisitionTargetPlannerV1,
  EvidenceRuntimeAcquisitionTargetV1,
} from "../mcft_cap09_evidence_runtime_composition_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
} from "../s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  Phase5ControlledProviderWorkItemFactoryV1,
  type Phase5ControlledEvidenceFixturePortV1,
  type Phase5ControlledRawFixtureRequestV1,
  type Phase5ControlledRawFixtureResponseV1,
} from "./mcft_cap09_phase5_controlled_evidence_work_items_v1.js";

export const MCFT_CAP09_PHASE5_EVIDENCE_QUALIFICATION_ENTRYPOINT_ID_V1 =
  "MCFT_CAP09_PHASE5_EVIDENCE_QUALIFICATION_ENTRYPOINT_V1" as const;

export const MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1 =
  "geox_mcft_cap09_phase5_controlled_fixture_manifest_v1" as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

export type Phase5QualificationTargetV1 = EvidenceRuntimeAcquisitionTargetV1 & {
  gfs_cycle: string;
};

export type Phase5ControlledFixtureManifestResponseV1 = {
  kind: Phase5ControlledRawFixtureRequestV1["kind"];
  target_logical_time: string;
  cycle?: string;
  lead?: number;
  locator: string;
  file: string;
  status: number;
  content_type: string;
  retrieved_at: string;
  available_at: string;
  response_headers?: Readonly<Record<string, string>>;
  sha256: string;
};

export type Phase5ControlledFixtureManifestV1 = {
  schema_version: typeof MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1;
  targets: readonly Phase5QualificationTargetV1[];
  responses: readonly Phase5ControlledFixtureManifestResponseV1[];
};

function requiredEnvV1(env: EnvironmentV1, name: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`PHASE5_QUALIFICATION_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV1(value: string, code: string): string {
  const canonical = canonicalIsoV1(value, code);
  if (!canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}

function canonicalCycleV1(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("PHASE5_QUALIFICATION_GFS_CYCLE_INVALID");
  return new Date(parsed).toISOString().replace(".000Z", "Z");
}

function sha256V1(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixtureLocatorV1(input: Phase5ControlledRawFixtureRequestV1): string {
  switch (input.kind) {
    case "KBS_SOIL":
    case "KBS_RAW_HOURLY":
      return input.request.locator;
    case "GFS_DIRECTORY":
    case "GFS_PGRB2":
    case "GFS_SFLUX_INDEX":
    case "GFS_SFLUX_MESSAGE":
      return input.locator;
    default:
      throw new Error("PHASE5_QUALIFICATION_FIXTURE_KIND_INVALID");
  }
}

function fixtureCycleV1(input: Phase5ControlledRawFixtureRequestV1): string {
  return "cycle" in input ? canonicalCycleV1(input.cycle) : "";
}

function fixtureLeadV1(input: Phase5ControlledRawFixtureRequestV1): string {
  return "lead" in input ? String(input.lead) : "";
}

function responseKeyV1(input: {
  kind: string;
  target_logical_time: string;
  cycle?: string;
  lead?: number;
  locator: string;
}): string {
  return [
    input.kind,
    canonicalHourV1(input.target_logical_time, "PHASE5_QUALIFICATION_TARGET_HOUR_INVALID"),
    input.cycle ? canonicalCycleV1(input.cycle) : "",
    input.lead === undefined ? "" : String(input.lead),
    input.locator,
  ].join("|");
}

function parseManifestV1(file: string): Phase5ControlledFixtureManifestV1 {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`PHASE5_QUALIFICATION_FIXTURE_MANIFEST_UNREADABLE:${
      error instanceof Error ? error.message : String(error)
    }`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PHASE5_QUALIFICATION_FIXTURE_MANIFEST_OBJECT_REQUIRED");
  }
  const raw = value as Record<string, unknown>;
  if (raw.schema_version !== MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1) {
    throw new Error("PHASE5_QUALIFICATION_FIXTURE_MANIFEST_SCHEMA_INVALID");
  }
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
    throw new Error("PHASE5_QUALIFICATION_TARGETS_REQUIRED");
  }
  if (!Array.isArray(raw.responses) || raw.responses.length === 0) {
    throw new Error("PHASE5_QUALIFICATION_RESPONSES_REQUIRED");
  }

  const targets = raw.targets.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`PHASE5_QUALIFICATION_TARGET_INVALID:${index}`);
    }
    const item = row as Record<string, unknown>;
    const target_logical_time = canonicalHourV1(
      String(item.target_logical_time ?? ""),
      `PHASE5_QUALIFICATION_TARGET_HOUR_INVALID:${index}`,
    );
    const requested_at = canonicalIsoV1(
      String(item.requested_at ?? ""),
      `PHASE5_QUALIFICATION_REQUESTED_AT_INVALID:${index}`,
    );
    const request_id_prefix = String(item.request_id_prefix ?? "").trim();
    if (!request_id_prefix || !/^[0-9A-Za-z_.:-]+$/.test(request_id_prefix)) {
      throw new Error(`PHASE5_QUALIFICATION_REQUEST_PREFIX_INVALID:${index}`);
    }
    if (Date.parse(requested_at) > Date.parse(target_logical_time)) {
      throw new Error(`PHASE5_QUALIFICATION_REQUESTED_AFTER_TARGET:${index}`);
    }
    return {
      target_logical_time,
      requested_at,
      request_id_prefix,
      gfs_cycle: canonicalCycleV1(String(item.gfs_cycle ?? "")),
    };
  });

  const targetTimes = new Set(targets.map((row) => row.target_logical_time));
  if (targetTimes.size !== targets.length) {
    throw new Error("PHASE5_QUALIFICATION_DUPLICATE_TARGET_FORBIDDEN");
  }
  for (let index = 1; index < targets.length; index += 1) {
    if (Date.parse(targets[index - 1]!.target_logical_time) >= Date.parse(targets[index]!.target_logical_time)) {
      throw new Error("PHASE5_QUALIFICATION_TARGET_ORDER_INVALID");
    }
  }

  const responses = raw.responses.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_INVALID:${index}`);
    }
    const item = row as Record<string, unknown>;
    const kind = String(item.kind ?? "") as Phase5ControlledRawFixtureRequestV1["kind"];
    if (!["KBS_SOIL", "KBS_RAW_HOURLY", "GFS_DIRECTORY", "GFS_PGRB2", "GFS_SFLUX_INDEX", "GFS_SFLUX_MESSAGE"].includes(kind)) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_KIND_INVALID:${index}`);
    }
    const target_logical_time = canonicalHourV1(
      String(item.target_logical_time ?? ""),
      `PHASE5_QUALIFICATION_RESPONSE_TARGET_INVALID:${index}`,
    );
    if (!targetTimes.has(target_logical_time)) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_TARGET_NOT_DECLARED:${index}`);
    }
    const locator = String(item.locator ?? "").trim();
    const relativeFile = String(item.file ?? "").trim();
    const contentType = String(item.content_type ?? "").trim();
    const digest = String(item.sha256 ?? "").trim();
    const status = Number(item.status);
    if (!locator || !relativeFile || !contentType) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_REQUIRED_FIELD_MISSING:${index}`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_SHA256_INVALID:${index}`);
    }
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_STATUS_INVALID:${index}`);
    }
    const cycle = item.cycle === undefined ? undefined : canonicalCycleV1(String(item.cycle));
    const lead = item.lead === undefined ? undefined : Number(item.lead);
    if (lead !== undefined && (!Number.isInteger(lead) || lead < 0 || lead > 384)) {
      throw new Error(`PHASE5_QUALIFICATION_RESPONSE_LEAD_INVALID:${index}`);
    }
    if (kind.startsWith("GFS_") && !cycle) {
      throw new Error(`PHASE5_QUALIFICATION_GFS_RESPONSE_CYCLE_REQUIRED:${index}`);
    }
    return {
      kind,
      target_logical_time,
      cycle,
      lead,
      locator,
      file: relativeFile,
      status,
      content_type: contentType,
      retrieved_at: canonicalIsoV1(
        String(item.retrieved_at ?? ""),
        `PHASE5_QUALIFICATION_RESPONSE_RETRIEVED_AT_INVALID:${index}`,
      ),
      available_at: canonicalIsoV1(
        String(item.available_at ?? ""),
        `PHASE5_QUALIFICATION_RESPONSE_AVAILABLE_AT_INVALID:${index}`,
      ),
      response_headers:
        item.response_headers && typeof item.response_headers === "object" && !Array.isArray(item.response_headers)
          ? Object.fromEntries(Object.entries(item.response_headers as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
          : undefined,
      sha256: digest,
    };
  });

  const keys = responses.map((row) => responseKeyV1(row));
  if (new Set(keys).size !== keys.length) {
    throw new Error("PHASE5_QUALIFICATION_DUPLICATE_RESPONSE_KEY_FORBIDDEN");
  }

  return {
    schema_version: MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1,
    targets,
    responses,
  };
}

export class FileBackedPhase5ControlledEvidenceFixtureV1
implements Phase5ControlledEvidenceFixturePortV1 {
  readonly manifest: Phase5ControlledFixtureManifestV1;
  private readonly root: string;
  private readonly targetCycles: Map<string, string>;
  private readonly responses: Map<string, Phase5ControlledFixtureManifestResponseV1>;

  constructor(input: { manifest_path: string; fixture_root: string }) {
    this.manifest = parseManifestV1(path.resolve(input.manifest_path));
    this.root = path.resolve(input.fixture_root);
    this.targetCycles = new Map(
      this.manifest.targets.map((row) => [row.target_logical_time, row.gfs_cycle]),
    );
    this.responses = new Map(
      this.manifest.responses.map((row) => [responseKeyV1(row), row]),
    );
  }

  createTargetPlanner(): EvidenceRuntimeAcquisitionTargetPlannerV1 {
    const targets = this.manifest.targets;
    return {
      async nextTarget(state): Promise<EvidenceRuntimeAcquisitionTargetV1 | null> {
        const row = targets[state.successful_cycle_count];
        if (!row) return null;
        return {
          target_logical_time: row.target_logical_time,
          requested_at: row.requested_at,
          request_id_prefix: row.request_id_prefix,
        };
      },
    };
  }

  selectGfsCycle(input: { target_logical_time: string }): string {
    const target = canonicalHourV1(
      input.target_logical_time,
      "PHASE5_QUALIFICATION_GFS_TARGET_INVALID",
    );
    const cycle = this.targetCycles.get(target);
    if (!cycle) throw new Error("PHASE5_QUALIFICATION_GFS_CYCLE_NOT_DECLARED");
    return cycle;
  }

  async loadRaw(
    input: Phase5ControlledRawFixtureRequestV1,
  ): Promise<Phase5ControlledRawFixtureResponseV1> {
    const key = [
      input.kind,
      canonicalHourV1(input.target_logical_time, "PHASE5_QUALIFICATION_REQUEST_TARGET_INVALID"),
      fixtureCycleV1(input),
      fixtureLeadV1(input),
      fixtureLocatorV1(input),
    ].join("|");
    const row = this.responses.get(key);
    if (!row) throw new Error(`PHASE5_QUALIFICATION_FIXTURE_RESPONSE_NOT_DECLARED:${key}`);

    const resolved = path.resolve(this.root, row.file);
    const relative = path.relative(this.root, resolved);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("PHASE5_QUALIFICATION_FIXTURE_PATH_ESCAPE_FORBIDDEN");
    }
    const bytes = new Uint8Array(await fs.promises.readFile(resolved));
    if (bytes.byteLength === 0) throw new Error("PHASE5_QUALIFICATION_FIXTURE_BYTES_REQUIRED");
    const digest = sha256V1(bytes);
    if (digest !== row.sha256) {
      throw new Error(`PHASE5_QUALIFICATION_FIXTURE_SHA256_MISMATCH:${key}`);
    }
    return {
      status: row.status,
      content_type: row.content_type,
      retrieved_at: row.retrieved_at,
      available_at: row.available_at,
      response_headers: row.response_headers,
      bytes,
    };
  }
}

export async function runMcftCap09Phase5EvidenceRuntimeQualificationV1(input?: {
  env?: EnvironmentV1;
}): Promise<void> {
  const env = input?.env ?? process.env;
  const processConfig = readMcftCap09EvidenceRuntimeProcessConfigV1(env);
  const fixture = new FileBackedPhase5ControlledEvidenceFixtureV1({
    manifest_path: requiredEnvV1(env, "GEOX_MCFT_CAP09_PHASE5_FIXTURE_MANIFEST_PATH"),
    fixture_root: requiredEnvV1(env, "GEOX_MCFT_CAP09_PHASE5_FIXTURE_ROOT"),
  });

  // The controlled GFS composer uses the same production raw-retention adapter class
  // and exact S3 authority as the process composition. A second adapter instance is
  // stateless and does not create a second storage authority.
  const controlledRetention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
    endpoint: processConfig.s3_endpoint,
    bucket: processConfig.s3_bucket,
    region: processConfig.s3_region,
    access_key_id: processConfig.s3_access_key_id,
    secret_access_key: processConfig.s3_secret_access_key,
    allow_insecure_http_for_test: processConfig.s3_allow_insecure_http_for_test,
  });

  const controlledFactory = new Phase5ControlledProviderWorkItemFactoryV1({
    fixture,
    retention: controlledRetention,
    python_executable: String(env.GEOX_MCFT_CAP09_PHASE5_PYTHON_EXECUTABLE ?? "python").trim() || "python",
    gfs_product_decoder_path:
      String(env.GEOX_MCFT_CAP09_PHASE5_GFS_PRODUCT_DECODER_PATH ?? "").trim() || undefined,
  });

  await runMcftCap09EvidenceRuntimeProcessV1({
    env,
    target_planner: fixture.createTargetPlanner(),
    work_item_factory: controlledFactory,
  });
}
