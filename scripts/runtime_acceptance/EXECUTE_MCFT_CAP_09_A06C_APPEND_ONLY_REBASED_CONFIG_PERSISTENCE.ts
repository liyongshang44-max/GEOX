import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  buildExternalFormalWindowEpochRebaseBundleV1,
  MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1,
  MCFT_CAP09_A06A_SELECTED_O00_V1,
  MCFT_CAP09_A06A_SELECTED_O23_V1,
  MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1,
  MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1,
  type ExternalFormalRebaseSlotContextV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ExternalFormalWindowEpochRebasePersistenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_window_epoch_rebase_persistence_service_v1.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const a06aPath = path.join(root, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json");
const outputPath = path.join(root, "acceptance-output/MCFT_CAP_09_A06C_APPEND_ONLY_REBASED_CONFIG_PERSISTENCE_RESULT.json");
const readinessDeadline = "2026-08-11T05:00:00.000Z";

type A06aAuthorityV1 = {
  selection_rule: { selected_epoch_id: string; selected_o00: string; selected_o23: string };
  slot_contexts: ExternalFormalRebaseSlotContextV1[];
};
type A06bProofV1 = {
  status: string;
  selected_epoch_id: string;
  selected_o00: string;
  selected_o23: string;
  exact_rebased_runtime_config_count: number;
  runtime_config_refs: string[];
  runtime_config_hashes: string[];
  exact_parent_chain_verified: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`A06C_REQUIRED_ENV_MISSING:${name}`);
  return value;
}

async function main(): Promise<void> {
  if ((process.env.GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED ?? "false") === "true") {
    throw new Error("A06C_FORMAL_WINDOW_MUST_REMAIN_DISABLED");
  }
  if (Date.now() >= Date.parse(readinessDeadline)) throw new Error("A06C_SELECTED_EPOCH_READINESS_DEADLINE_ALREADY_PASSED");
  if (Date.now() >= Date.parse(MCFT_CAP09_A06A_SELECTED_O00_V1)) throw new Error("A06C_SELECTED_O00_ALREADY_PASSED");

  const a06a = JSON.parse(fs.readFileSync(a06aPath, "utf8")) as A06aAuthorityV1;
  const proof = JSON.parse(fs.readFileSync(requiredEnv("A06B_PROOF_RESULT_PATH"), "utf8")) as A06bProofV1;
  if (a06a.selection_rule.selected_epoch_id !== MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1
    || a06a.selection_rule.selected_o00 !== MCFT_CAP09_A06A_SELECTED_O00_V1
    || a06a.selection_rule.selected_o23 !== MCFT_CAP09_A06A_SELECTED_O23_V1
    || a06a.slot_contexts.length !== 24) throw new Error("A06C_A06A_AUTHORITY_MISMATCH");
  if (proof.status !== "PASS"
    || proof.selected_epoch_id !== MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1
    || proof.selected_o00 !== MCFT_CAP09_A06A_SELECTED_O00_V1
    || proof.selected_o23 !== MCFT_CAP09_A06A_SELECTED_O23_V1
    || proof.exact_rebased_runtime_config_count !== 24
    || proof.runtime_config_refs.length !== 24
    || proof.runtime_config_hashes.length !== 24
    || proof.exact_parent_chain_verified !== true) throw new Error("A06C_A06B_PROOF_INVALID");

  const pool = new Pool({ connectionString: requiredEnv("GEOX_MCFT_CAP09_S6_DATABASE_URL"), max: 3 });
  try {
    const repo = new PostgresRuntimeRepositoryV1(pool);
    const a0 = await repo.readRuntimeConfig(MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1);
    if (!a0 || a0.determinism_hash !== MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1) {
      throw new Error("A06C_EXISTING_A0_RUNTIME_CONFIG_NOT_FOUND_OR_HASH_MISMATCH");
    }
    const bundle = buildExternalFormalWindowEpochRebaseBundleV1({
      selected_epoch_id: a06a.selection_rule.selected_epoch_id,
      slots: a06a.slot_contexts,
      existing_a0_runtime_config: a0,
    });
    if (JSON.stringify(bundle.runtime_config_refs) !== JSON.stringify(proof.runtime_config_refs)
      || JSON.stringify(bundle.runtime_config_hashes) !== JSON.stringify(proof.runtime_config_hashes)) {
      throw new Error("A06C_BUILDER_OUTPUT_DOES_NOT_MATCH_FROZEN_A06B_PROOF");
    }

    const persisted = await new ExternalFormalWindowEpochRebasePersistenceServiceV1(repo).execute({
      runtime_configs: bundle.runtime_configs,
    });
    const result = {
      schema_version: "geox_mcft_cap09_a06c_append_only_rebased_config_persistence_result_v1",
      status: "PASS",
      subject_head_sha: process.env.GITHUB_SHA ?? null,
      selected_epoch_id: MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1,
      selected_o00: MCFT_CAP09_A06A_SELECTED_O00_V1,
      selected_o23: MCFT_CAP09_A06A_SELECTED_O23_V1,
      readiness_deadline: readinessDeadline,
      ...persisted,
      state_lineage_checkpoint_forecast_write_count: 0,
      recommendation_write_count: 0,
      approval_write_count: 0,
      ao_act_write_count: 0,
      dispatch_count: 0,
      model_activation_count: 0,
      formal_o00_start_authorized: false,
      ea5e_complete: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

await main();
