// Purpose: compute one deterministic source manifest for the bounded MCFT-CAP-08.S3 implementation and its inherited execution/authority seams.
// Boundary: acceptance evidence helper only; no database, Runtime execution, candidate declaration, network, or production authority.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const CAP08_S3_SOURCE_MANIFEST_PATHS_V1 = [
  "apps/server/src/domain/twin_runtime/canonical_json_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_s3_completion_authority_pair_contracts_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_s3_completion_tuple_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.ts",
  "apps/server/src/domain/twin_runtime/cap08_s3_phase_contracts_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.ts",
  "apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.ts",
  "apps/server/src/runtime/twin_runtime/human_decision_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_completion_tuple_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_formal_runtime_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_receipt_consuming_tick_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.ts",
  "apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts",
].sort() as readonly string[];

export type Cap08S3SourceManifestV1 = {
  schema_version: "geox_mcft_cap08_s3_source_manifest_v1";
  paths: readonly string[];
  file_sha256_by_path: Record<string, string>;
  manifest_digest: string;
};

export function computeCap08S3SourceManifestV1(root: string): Cap08S3SourceManifestV1 {
  const fileSha256ByPath: Record<string, string> = {};
  const manifestHash = crypto.createHash("sha256");
  for (const relativePath of CAP08_S3_SOURCE_MANIFEST_PATHS_V1) {
    const bytes = fs.readFileSync(path.join(root, relativePath));
    const fileDigest = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
    fileSha256ByPath[relativePath] = fileDigest;
    manifestHash.update(relativePath, "utf8");
    manifestHash.update("\0", "utf8");
    manifestHash.update(fileDigest, "utf8");
    manifestHash.update("\0", "utf8");
  }
  return {
    schema_version: "geox_mcft_cap08_s3_source_manifest_v1",
    paths: [...CAP08_S3_SOURCE_MANIFEST_PATHS_V1],
    file_sha256_by_path: fileSha256ByPath,
    manifest_digest: `sha256:${manifestHash.digest("hex")}`,
  };
}
