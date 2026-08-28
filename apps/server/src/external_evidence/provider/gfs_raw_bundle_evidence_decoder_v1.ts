// MCFT-CAP-09 Phase 3 product GFS raw-bundle Evidence decoder.
// Boundary: retained deterministic bundle -> governed drafts through the product-owned Python driver.
// No qualification-script dependency, provider fetch, raw retention, database, scheduler,
// online runtime-cursor authority, Twin state, environment, timer, or production activation.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type {
  ExternalEvidenceDecoderInputV1,
  ExternalEvidenceDecoderPortV1,
  GovernedDecodedEvidenceDraftV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";

const execFileAsync = promisify(execFile);

export const MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1 =
  "MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_V1" as const;
export const MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1 = "1" as const;
export const MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_RELATIVE_PATH_V1 =
  "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py" as const;

function canonicalHourV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return value;
}

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function exactDraftPairV1(value: unknown): readonly GovernedDecodedEvidenceDraftV1[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PHASE3_GFS_PRODUCT_DECODER_OUTPUT_OBJECT_REQUIRED");
  }
  const drafts = (value as { drafts?: unknown }).drafts;
  if (!Array.isArray(drafts) || drafts.length !== 2) {
    throw new Error("PHASE3_GFS_PRODUCT_DECODER_DRAFT_PAIR_REQUIRED");
  }
  const roles = drafts.map((draft) =>
    draft && typeof draft === "object" && !Array.isArray(draft)
      ? String((draft as Record<string, unknown>).role ?? "")
      : "",
  );
  if (JSON.stringify(roles) !== JSON.stringify(["FUTURE_WEATHER_ASSUMPTION", "FUTURE_ET0_ASSUMPTION"])) {
    throw new Error("PHASE3_GFS_PRODUCT_DECODER_DRAFT_ROLE_ORDER_INVALID");
  }
  return drafts as GovernedDecodedEvidenceDraftV1[];
}

export type GfsRawBundleEvidenceDecoderConfigV1 = {
  python_executable?: string;
  product_decoder_path?: string;
  normalize_et0?: boolean;
  restored_ingested_at?: string;
};

export class GfsRawBundleEvidenceDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1;
  readonly decoder_version = MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1;
  private readonly target: string;
  private readonly pythonExecutable: string;
  private readonly productDecoderPath: string;
  private readonly normalizeEt0: boolean;
  private readonly restoredIngestedAt: string | null;

  constructor(target: string, config: GfsRawBundleEvidenceDecoderConfigV1 = {}) {
    this.target = canonicalHourV1(target, "PHASE3_GFS_PRODUCT_DECODER_TARGET_INVALID");
    this.pythonExecutable = config.python_executable?.trim() || "python3";
    this.productDecoderPath = path.resolve(
      config.product_decoder_path?.trim() || MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_RELATIVE_PATH_V1,
    );
    this.normalizeEt0 = config.normalize_et0 !== false;
    this.restoredIngestedAt = config.restored_ingested_at
      ? canonicalIsoV1(config.restored_ingested_at, "PHASE3_GFS_PRODUCT_DECODER_RESTORED_INGESTED_AT_INVALID")
      : null;
  }

  async decodeRetainedEvidence(
    input: ExternalEvidenceDecoderInputV1,
  ): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const availableAt = canonicalIsoV1(
      input.provenance.available_at,
      "PHASE3_GFS_PRODUCT_DECODER_AVAILABLE_AT_INVALID",
    );
    if (!(input.raw_bytes instanceof Uint8Array) || input.raw_bytes.byteLength <= 0) {
      throw new Error("PHASE3_GFS_PRODUCT_DECODER_BUNDLE_BYTES_REQUIRED");
    }
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-gfs-product-decode-"));
    const bundlePath = path.join(temp, "gfs.tar");
    const outputPath = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundlePath, Buffer.from(input.raw_bytes), { mode: 0o600 });
      const args = [
        this.productDecoderPath,
        "decode-bundle",
        "--target", this.target,
        "--available-at", availableAt,
        "--input", bundlePath,
        "--output", outputPath,
      ];
      if (this.normalizeEt0) args.push("--normalize-et0");
      await execFileAsync(this.pythonExecutable, args, {
        cwd: process.cwd(),
        maxBuffer: 32 * 1024 * 1024,
        timeout: 20 * 60_000,
      });
      const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as unknown;
      const drafts = exactDraftPairV1(parsed);
      if (!this.restoredIngestedAt) return drafts;
      return drafts.map((draft) => ({
        ...draft,
        role_time: {
          ...draft.role_time,
          ingested_at: this.restoredIngestedAt!,
        },
      }));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}
