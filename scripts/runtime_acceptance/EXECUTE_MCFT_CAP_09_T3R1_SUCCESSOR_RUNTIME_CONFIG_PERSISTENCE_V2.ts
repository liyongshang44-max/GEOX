import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  buildExternalFormalSuccessorRuntimeConfigBundleV2,
  MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2,
  MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_O00_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_O23_V2,
  type ExternalFormalSuccessorSlotContextV2,
} from "../../apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v2.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ExternalFormalWindowEpochRebasePersistenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_window_epoch_rebase_persistence_service_v1.js";

const SELECTION_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json";
const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2_RESULT.json");
const READINESS_DEADLINE = "2026-08-17T08:00:00.000Z";

type BuilderProofV2 = {
  status: string;
  selected_epoch_id: string;
  selected_o00: string;
  selected_o23: string;
  exact_successor_runtime_config_count: number;
  runtime_config_refs: string[];
  runtime_config_hashes: string[];
  exact_parent_chain_verified: boolean;
  persisted_ref_hash_collision_count: number;
  successor_runtime_configs_persisted: boolean;
};

type SelectionAuthorityV2 = {
  selection_rule: { selected_epoch_id: string; selected_o00: string; selected_o23: string };
  slot_contexts: ExternalFormalSuccessorSlotContextV2[];
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`T3R1_SUCCESSOR_PERSISTENCE_ENV_REQUIRED:${name}`);
  return value;
}

async function main(): Promise<void> {
  if ((process.env.GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED ?? "false") === "true") {
    throw new Error("T3R1_SUCCESSOR_PERSISTENCE_FORMAL_WINDOW_MUST_REMAIN_DISABLED");
  }
  if (Date.now() >= Date.parse(READINESS_DEADLINE)) throw new Error("T3R1_SUCCESSOR_PERSISTENCE_EA5E3_READINESS_DEADLINE_EXPIRED");
  if (Date.now() >= Date.parse(MCFT_CAP09_T3R1_SUCCESSOR_O00_V2)) throw new Error("T3R1_SUCCESSOR_PERSISTENCE_O00_ALREADY_PASSED");

  const selection = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8")) as SelectionAuthorityV2;
  const proof = JSON.parse(fs.readFileSync(required("T3R1_SUCCESSOR_BUILDER_PROOF_PATH"), "utf8")) as BuilderProofV2;
  if (selection.selection_rule.selected_epoch_id !== MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2
    || selection.selection_rule.selected_o00 !== MCFT_CAP09_T3R1_SUCCESSOR_O00_V2
    || selection.selection_rule.selected_o23 !== MCFT_CAP09_T3R1_SUCCESSOR_O23_V2
    || selection.slot_contexts.length !== 24) throw new Error("T3R1_SUCCESSOR_PERSISTENCE_SELECTION_AUTHORITY_MISMATCH");
  if (proof.status !== "PASS"
    || proof.selected_epoch_id !== MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2
    || proof.selected_o00 !== MCFT_CAP09_T3R1_SUCCESSOR_O00_V2
    || proof.selected_o23 !== MCFT_CAP09_T3R1_SUCCESSOR_O23_V2
    || proof.exact_successor_runtime_config_count !== 24
    || proof.runtime_config_refs.length !== 24
    || proof.runtime_config_hashes.length !== 24
    || proof.exact_parent_chain_verified !== true
    || proof.persisted_ref_hash_collision_count !== 0
    || proof.successor_runtime_configs_persisted !== false) throw new Error("T3R1_SUCCESSOR_PERSISTENCE_BUILDER_PROOF_INVALID");

  const pool = new Pool({ connectionString: required("GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL"), max: 3 });
  try {
    const repo = new PostgresRuntimeRepositoryV1(pool);
    const a0 = await repo.readRuntimeConfig(MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2);
    if (!a0 || a0.determinism_hash !== MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2) {
      throw new Error("T3R1_SUCCESSOR_PERSISTENCE_A0_NOT_FOUND_OR_HASH_MISMATCH");
    }
    const bundle = buildExternalFormalSuccessorRuntimeConfigBundleV2({
      selected_epoch_id: selection.selection_rule.selected_epoch_id,
      slots: selection.slot_contexts,
      persisted_a0_runtime_config: a0,
    });
    if (JSON.stringify(bundle.runtime_config_refs) !== JSON.stringify(proof.runtime_config_refs)
      || JSON.stringify(bundle.runtime_config_hashes) !== JSON.stringify(proof.runtime_config_hashes)) {
      throw new Error("T3R1_SUCCESSOR_PERSISTENCE_BUILDER_OUTPUT_DOES_NOT_MATCH_FROZEN_PROOF");
    }

    const persisted = await new ExternalFormalWindowEpochRebasePersistenceServiceV1(repo).execute({
      runtime_configs: bundle.runtime_configs,
    });
    const result = {
      schema_version: "geox_mcft_cap09_t3r1_successor_runtime_config_persistence_v2_result",
      status: "PASS",
      subject_head_sha: process.env.GITHUB_SHA ?? null,
      selected_epoch_id: MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2,
      selected_o00: MCFT_CAP09_T3R1_SUCCESSOR_O00_V2,
      selected_o23: MCFT_CAP09_T3R1_SUCCESSOR_O23_V2,
      ea5e3_readiness_deadline: READINESS_DEADLINE,
      ...persisted,
      state_lineage_checkpoint_forecast_write_count: 0,
      recommendation_write_count: 0,
      approval_write_count: 0,
      ao_act_write_count: 0,
      dispatch_count: 0,
      model_activation_count: 0,
      successor_runtime_configs_persisted: true,
      ea5e3_authorized: false,
      formal_o00_start_authorized: false,
      formal_window_started: false,
      formal_execution_count: "0/24",
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
