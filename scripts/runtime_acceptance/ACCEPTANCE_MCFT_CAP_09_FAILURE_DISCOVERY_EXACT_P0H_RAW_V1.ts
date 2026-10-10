import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  KbsRawHourlyPublicationSnapshotInspectorV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";
import {
  McftCap09ProductionEvidenceFailureClassifierV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_process_lifecycle_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_EXACT_P0H_RAW_V1_RESULT.json",
);
const CORPUS = path.resolve(
  "scripts/runtime_acceptance/fixtures/mcft_cap09_failure_corpus_v1.json",
);

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function main(): Promise<void> {
  const rawPath = String(process.env.GEOX_MCFT_CAP09_P0H_RAW_PATH ?? "").trim();
  if (!rawPath) throw new Error("GEOX_MCFT_CAP09_P0H_RAW_PATH_REQUIRED");
  if (!fs.existsSync(rawPath)) throw new Error("MCFT_CAP09_P0H_CONTROLLED_RAW_NOT_FOUND");

  const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf8")) as {
    entries?: Array<{
      id?: string;
      raw_sha256?: string;
      raw_bytes?: number;
      exact_raw_preserved_external_control_tree?: boolean;
    }>;
  };
  const p0h = corpus.entries?.find((row) => row.id === "P0_H_KBS_CSV_FIELD_TOO_LARGE");
  if (!p0h?.raw_sha256 || !Number.isSafeInteger(p0h.raw_bytes)) {
    throw new Error("MCFT_CAP09_P0H_CORPUS_METADATA_INVALID");
  }
  assert.equal(
    p0h.exact_raw_preserved_external_control_tree,
    true,
    "MCFT_CAP09_P0H_CONTROLLED_PRESERVATION_DECLARATION_REQUIRED",
  );

  const bytes = fs.readFileSync(rawPath);
  const digest = sha256(bytes);
  assert.equal(bytes.byteLength, p0h.raw_bytes, "MCFT_CAP09_P0H_EXACT_BYTES_MISMATCH");
  assert.equal(digest, p0h.raw_sha256, "MCFT_CAP09_P0H_EXACT_SHA256_MISMATCH");

  const inspector = new KbsRawHourlyPublicationSnapshotInspectorV1();
  let observed: unknown = null;
  try {
    await inspector.inspectSnapshot({
      raw_bytes: bytes,
      available_at: "2026-09-26T02:19:39.000Z",
    });
  } catch (error) {
    observed = error;
  }
  assert.ok(observed, "MCFT_CAP09_P0H_EXACT_REPLAY_MUST_REJECT");
  const row = observed as {
    code?: unknown;
    diagnostic_token?: unknown;
    failure_token?: unknown;
  };
  assert.equal(row.code, "MCFT_CAP09_KBS_SCIENTIFIC_SUBPROCESS_FAILED");
  assert.equal(row.diagnostic_token, "MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE");

  const classifier = new McftCap09ProductionEvidenceFailureClassifierV1();
  assert.equal(
    classifier.classify(observed),
    "ATTEMPT_REJECTED",
    "MCFT_CAP09_P0H_EXACT_REPLAY_MUST_BE_ATTEMPT_REJECTED",
  );

  const result = {
    schema_version: "geox_mcft_cap09_failure_discovery_exact_p0h_raw_v1",
    status: "PASS",
    subject_sha: String(process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT ?? "").trim() || null,
    corpus_id: "P0_H_KBS_CSV_FIELD_TOO_LARGE",
    materialization_class: "CONTROLLED_EXTERNAL_FIXTURE",
    raw_sha256: digest,
    raw_bytes: bytes.byteLength,
    raw_values_emitted: false,
    raw_path_emitted: false,
    exact_replay_count: 1,
    normalized_scientific_failure: "MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE",
    runtime_disposition: "ATTEMPT_REJECTED",
    evidence_promotion_authorized: false,
    host_survival_required: true,
    repository_raw_publication_required: false,
    production_database_mutation: false,
    production_raw_namespace_mutation: false,
    formal_v5_armed: false,
    final_24h_admitted: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    schema_version: "geox_mcft_cap09_failure_discovery_exact_p0h_raw_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    raw_values_emitted: false,
    production_database_mutation: false,
    formal_v5_armed: false,
    final_24h_admitted: false,
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
