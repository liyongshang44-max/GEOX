import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  buildExternalFormalSuccessorRuntimeConfigBundleV2,
  MCFT_CAP09_T3R1_PERSISTED_A0_LOGICAL_TIME_V2,
  MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2,
  MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_O00_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_O23_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_AUTHORITY_BLOB_V2,
  MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_EFFECTIVE_AT_V2,
  type ExternalFormalSuccessorSlotContextV2,
} from "../../apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v2.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";

const AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json";
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2_RESULT.json");
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h";
const EXPECTED_PROJECT = "delicate-glade-62464340";
const EXPECTED_BRANCH = "br-cold-dust-a6j6aymz";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`T3R1_SUCCESSOR_BUILDER_ENV_REQUIRED:${name}`);
  return value;
}

async function loadPersistedAuthority(pool: Pool): Promise<{
  a0: CanonicalObjectEnvelopeV1;
  persistedRefs: Set<string>;
  persistedHashes: Set<string>;
  runtimeConfigCount: number;
}> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const identity = (await client.query(
      `SELECT current_database() AS database_name,
              current_setting('neon.project_id', true) AS neon_project_id,
              current_setting('neon.branch_id', true) AS neon_branch_id`,
    )).rows[0];
    assert.equal(identity?.database_name, EXPECTED_DATABASE, "T3R1_SUCCESSOR_BUILDER_DATABASE_MISMATCH");
    assert.equal(identity?.neon_project_id, EXPECTED_PROJECT, "T3R1_SUCCESSOR_BUILDER_PROJECT_MISMATCH");
    assert.equal(identity?.neon_branch_id, EXPECTED_BRANCH, "T3R1_SUCCESSOR_BUILDER_BRANCH_MISMATCH");

    const scheduler = (await client.query(
      `SELECT (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS slots,
              (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) AS cursors`,
    )).rows[0];
    assert.equal(Number(scheduler?.slots), 0, "T3R1_SUCCESSOR_BUILDER_SCHEDULER_SLOT_ZERO_REQUIRED");
    assert.equal(Number(scheduler?.cursors), 0, "T3R1_SUCCESSOR_BUILDER_SCHEDULER_CURSOR_ZERO_REQUIRED");

    const configs = (await client.query(
      `SELECT record_json->'payload' AS config
         FROM facts
        WHERE record_json->>'type'='twin_runtime_config_v1'
        ORDER BY occurred_at ASC, fact_id ASC`,
    )).rows.map((row) => row.config as CanonicalObjectEnvelopeV1);
    assert.equal(configs.length, 25, "T3R1_SUCCESSOR_BUILDER_EXPECTS_FRESH_BOOTSTRAP_25_CONFIG_BASELINE");
    for (const config of configs) validateCanonicalObjectV1(config);
    const a0Matches = configs.filter((config) => config.object_id === MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2);
    assert.equal(a0Matches.length, 1, "T3R1_SUCCESSOR_BUILDER_EXACT_A0_REQUIRED");
    const a0 = a0Matches[0]!;
    assert.equal(a0.determinism_hash, MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2, "T3R1_SUCCESSOR_BUILDER_A0_HASH_DRIFT");
    assert.equal(a0.logical_time, MCFT_CAP09_T3R1_PERSISTED_A0_LOGICAL_TIME_V2, "T3R1_SUCCESSOR_BUILDER_A0_TIME_DRIFT");
    await client.query("COMMIT");
    return {
      a0,
      persistedRefs: new Set(configs.map((config) => config.object_id)),
      persistedHashes: new Set(configs.map((config) => config.determinism_hash)),
      runtimeConfigCount: configs.length,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8")) as {
    selection_rule: {
      selected_epoch_id: string;
      selected_o00: string;
      selected_o23: string;
      ea5e3_readiness_deadline: string;
    };
    slot_contexts: ExternalFormalSuccessorSlotContextV2[];
    effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline: {
      successor_epoch_selection_effective: boolean;
      successor_runtime_config_builder_qualification_authorized: boolean;
      successor_runtime_config_persistence_authorized: boolean;
      formal_window_started: boolean;
    };
  };
  assert.equal(authority.selection_rule.selected_epoch_id, MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2);
  assert.equal(authority.selection_rule.selected_o00, MCFT_CAP09_T3R1_SUCCESSOR_O00_V2);
  assert.equal(authority.selection_rule.selected_o23, MCFT_CAP09_T3R1_SUCCESSOR_O23_V2);
  assert.equal(authority.selection_rule.ea5e3_readiness_deadline, "2026-08-17T08:00:00.000Z");
  assert.equal(authority.slot_contexts.length, 24);
  assert.equal(authority.effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline.successor_epoch_selection_effective, true);
  assert.equal(authority.effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline.successor_runtime_config_builder_qualification_authorized, true);
  assert.equal(authority.effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline.successor_runtime_config_persistence_authorized, false);
  assert.equal(authority.effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline.formal_window_started, false);
  assert.equal(MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_AUTHORITY_BLOB_V2, "9c12e31b0a9a3d33e027f0677ad1cf2d92a5097f");
  assert.equal(MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_EFFECTIVE_AT_V2, "2026-08-16T07:40:52.000Z");

  const pool = new Pool({ connectionString: required("GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL"), max: 2 });
  try {
    const persisted = await loadPersistedAuthority(pool);
    const first = buildExternalFormalSuccessorRuntimeConfigBundleV2({
      selected_epoch_id: authority.selection_rule.selected_epoch_id,
      slots: authority.slot_contexts,
      persisted_a0_runtime_config: persisted.a0,
    });
    const second = buildExternalFormalSuccessorRuntimeConfigBundleV2({
      selected_epoch_id: authority.selection_rule.selected_epoch_id,
      slots: structuredClone(authority.slot_contexts),
      persisted_a0_runtime_config: structuredClone(persisted.a0),
    });
    assert.deepEqual(second, first, "T3R1_SUCCESSOR_BUILDER_DETERMINISTIC_DOUBLE_BUILD_REQUIRED");
    assert.equal(first.runtime_config_count, 24);
    assert.equal(first.selected_o00, MCFT_CAP09_T3R1_SUCCESSOR_O00_V2);
    assert.equal(first.selected_o23, MCFT_CAP09_T3R1_SUCCESSOR_O23_V2);
    assert.equal(first.persisted_a0_runtime_config_ref, MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2);
    assert.equal(first.persisted_a0_runtime_config_hash, MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2);

    const refs = new Set<string>();
    const hashes = new Set<string>();
    for (let index = 0; index < first.runtime_configs.length; index += 1) {
      const config = first.runtime_configs[index]!;
      const slot = authority.slot_contexts[index]!;
      validateCanonicalObjectV1(config);
      validateExternalFormalRuntimeConfigPayloadV1(config.payload);
      const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
      assert.equal(config.object_type, "twin_runtime_config_v1");
      assert.equal(config.logical_time, slot.logical_time);
      assert.equal(config.as_of, slot.logical_time);
      assert.equal(payload.config_role, "HOURLY_CAP04");
      assert.equal(payload.effective_logical_time, slot.logical_time);
      assert.equal(payload.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY");
      assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY");
      assert.equal(payload.crop_stage_context_authority.context_hash, slot.crop_stage_context_hash);
      if (index === 0) {
        assert.equal(payload.parent_runtime_config_ref, persisted.a0.object_id);
        assert.equal(payload.parent_runtime_config_hash, persisted.a0.determinism_hash);
      } else {
        const parent = first.runtime_configs[index - 1]!;
        assert.equal(payload.parent_runtime_config_ref, parent.object_id);
        assert.equal(payload.parent_runtime_config_hash, parent.determinism_hash);
      }
      assert.equal(persisted.persistedRefs.has(config.object_id), false, `T3R1_SUCCESSOR_BUILDER_REF_COLLIDES_WITH_PERSISTED:${index}`);
      assert.equal(persisted.persistedHashes.has(config.determinism_hash), false, `T3R1_SUCCESSOR_BUILDER_HASH_COLLIDES_WITH_PERSISTED:${index}`);
      refs.add(config.object_id);
      hashes.add(config.determinism_hash);
    }
    assert.equal(refs.size, 24, "T3R1_SUCCESSOR_BUILDER_EXACT_24_DISTINCT_REFS_REQUIRED");
    assert.equal(hashes.size, 24, "T3R1_SUCCESSOR_BUILDER_EXACT_24_DISTINCT_HASHES_REQUIRED");
    assert.deepEqual(first.slot_crop_stage_context_hashes, authority.slot_contexts.map((slot) => slot.crop_stage_context_hash));
    assert.equal(first.database_write_count, 0);
    assert.equal(first.raw_object_write_count, 0);
    assert.equal(first.provider_request_count, 0);
    assert.equal(first.scheduler_slot_write_count, 0);
    assert.equal(first.scheduler_cursor_write_count, 0);
    assert.equal(first.formal_window_started, false);

    const result = {
      schema_version: "geox_mcft_cap09_t3r1_successor_runtime_config_builder_v2_result",
      status: "PASS",
      selected_epoch_id: first.selected_epoch_id,
      selected_o00: first.selected_o00,
      selected_o23: first.selected_o23,
      selection_effective_at: MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_EFFECTIVE_AT_V2,
      ea5e3_readiness_deadline: authority.selection_rule.ea5e3_readiness_deadline,
      persisted_a0_runtime_config_ref: first.persisted_a0_runtime_config_ref,
      persisted_a0_runtime_config_hash: first.persisted_a0_runtime_config_hash,
      persisted_runtime_config_baseline_count: persisted.runtimeConfigCount,
      exact_successor_runtime_config_count: first.runtime_config_count,
      runtime_config_refs: first.runtime_config_refs,
      runtime_config_hashes: first.runtime_config_hashes,
      slot_crop_stage_context_hashes: first.slot_crop_stage_context_hashes,
      exact_parent_chain_verified: true,
      persisted_ref_hash_collision_count: 0,
      deterministic_double_build_verified: true,
      database_access_mode: "READ_ONLY_A0_AND_BASELINE_VERIFICATION",
      builder_database_write_count: 0,
      builder_raw_object_write_count: 0,
      builder_provider_request_count: 0,
      builder_scheduler_slot_write_count: 0,
      builder_scheduler_cursor_write_count: 0,
      successor_runtime_configs_persisted: false,
      ea5e3_authorized: false,
      formal_o00_start_authorized: false,
      formal_window_started: false,
      formal_execution_count: "0/24",
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
