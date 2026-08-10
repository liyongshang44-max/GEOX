import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(
  root,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1.json",
);
const a06aPath = path.join(
  root,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json",
);
const outputPath = path.join(
  root,
  "acceptance-output/MCFT_CAP_09_EA5E1_POST_REBASE_FORMAL_DB_PREFLIGHT_RESULT.json",
);

const EXACT_SCOPE = [
  "tenant_mcft_external",
  "project_mcft_cap09",
  "group_public_research",
  "field_kbs_mcse_t1r1",
  "season_2026_corn",
  "zone_kbs_mcse_t1r1_formal_v1",
] as const;

type ManifestSlotV1 = {
  slot_id: string;
  logical_time: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  crop_stage_context_hash: string;
};

type FormalWindowInputManifestV1 = {
  schema_version: string;
  manifest_id: string;
  record_status: string;
  selection_mode: string;
  immutable_for_formal_window: boolean;
  selected_epoch: {
    epoch_id: string;
    o00: string;
    o23: string;
    ea5e_v3_readiness_deadline: string;
  };
  existing_a0_predecessor_authority: {
    logical_time: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
  };
  slot_count: number;
  slots: ManifestSlotV1[];
  expired_epoch_exclusion: {
    expired_o00: string;
    expired_o23: string;
    expired_config_ref_hash_allowed: boolean;
    implicit_latest_config_selection_allowed: boolean;
  };
  formal_database_binding: {
    neon_project_id: string;
    neon_project_name: string;
    neon_branch_id: string;
    neon_branch_name: string;
    neon_compute_endpoint_id: string;
    allowed_database_hosts: string[];
    database_name: string;
    minimum_postgres_version_num: number;
  };
};

type A06aAuthorityV1 = {
  selection_rule: {
    selected_epoch_id: string;
    selected_o00: string;
    selected_o23: string;
    ea5e_v3_readiness_deadline: string;
  };
  existing_a0_parent_anchor: {
    logical_time: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
  };
  slot_contexts: Array<{
    slot_id: string;
    logical_time: string;
    crop_stage_context_hash: string;
  }>;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`EA5E1_REQUIRED_ENV_MISSING:${name}`);
  return value;
}

function assertCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function exactIsoHour(base: string, index: number): string {
  return new Date(Date.parse(base) + index * 60 * 60 * 1000).toISOString();
}

async function main(): Promise<void> {
  if ((process.env.GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED ?? "false") === "true") {
    throw new Error("EA5E1_FORMAL_WINDOW_MUST_REMAIN_DISABLED");
  }

  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as FormalWindowInputManifestV1;
  const a06a = JSON.parse(fs.readFileSync(a06aPath, "utf8")) as A06aAuthorityV1;

  assertCondition(
    manifest.schema_version === "geox_mcft_cap09_formal_window_input_manifest_v1",
    "EA5E1_MANIFEST_SCHEMA_INVALID",
  );
  assertCondition(
    manifest.manifest_id === "GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1",
    "EA5E1_MANIFEST_ID_INVALID",
  );
  assertCondition(
    manifest.record_status === "EA5E1_FORMAL_WINDOW_INPUT_MANIFEST_CANDIDATE_NOT_EFFECTIVE",
    "EA5E1_MANIFEST_STATUS_INVALID",
  );
  assertCondition(manifest.selection_mode === "EXPLICIT_REF_HASH_PIN_ONLY", "EA5E1_EXPLICIT_PIN_SELECTION_REQUIRED");
  assertCondition(manifest.immutable_for_formal_window === true, "EA5E1_MANIFEST_IMMUTABILITY_REQUIRED");
  assertCondition(manifest.slot_count === 24 && manifest.slots.length === 24, "EA5E1_EXACT_24_MANIFEST_SLOTS_REQUIRED");
  assertCondition(
    manifest.selected_epoch.epoch_id === a06a.selection_rule.selected_epoch_id
      && manifest.selected_epoch.o00 === a06a.selection_rule.selected_o00
      && manifest.selected_epoch.o23 === a06a.selection_rule.selected_o23
      && manifest.selected_epoch.ea5e_v3_readiness_deadline === a06a.selection_rule.ea5e_v3_readiness_deadline,
    "EA5E1_A06A_EPOCH_BINDING_MISMATCH",
  );
  assertCondition(
    manifest.existing_a0_predecessor_authority.logical_time === a06a.existing_a0_parent_anchor.logical_time
      && manifest.existing_a0_predecessor_authority.runtime_config_ref === a06a.existing_a0_parent_anchor.runtime_config_ref
      && manifest.existing_a0_predecessor_authority.runtime_config_hash === a06a.existing_a0_parent_anchor.runtime_config_hash,
    "EA5E1_A0_PREDECESSOR_BINDING_MISMATCH",
  );
  assertCondition(manifest.expired_epoch_exclusion.expired_config_ref_hash_allowed === false, "EA5E1_EXPIRED_CONFIG_SELECTION_FORBIDDEN");
  assertCondition(manifest.expired_epoch_exclusion.implicit_latest_config_selection_allowed === false, "EA5E1_IMPLICIT_LATEST_SELECTION_FORBIDDEN");

  if (Date.now() >= Date.parse(manifest.selected_epoch.ea5e_v3_readiness_deadline)) {
    throw new Error("EA5E1_SELECTED_EPOCH_READINESS_DEADLINE_ALREADY_PASSED");
  }
  if (Date.now() >= Date.parse(manifest.selected_epoch.o00)) {
    throw new Error("EA5E1_SELECTED_O00_ALREADY_PASSED");
  }

  const refs = new Set<string>();
  const hashes = new Set<string>();
  for (let index = 0; index < manifest.slots.length; index += 1) {
    const slot = manifest.slots[index]!;
    const a06aSlot = a06a.slot_contexts[index]!;
    assertCondition(slot.slot_id === `O${String(index).padStart(2, "0")}`, `EA5E1_SLOT_ID_INVALID:${index}`);
    assertCondition(slot.logical_time === exactIsoHour(manifest.selected_epoch.o00, index), `EA5E1_SLOT_TIME_INVALID:${index}`);
    assertCondition(
      slot.slot_id === a06aSlot.slot_id
        && slot.logical_time === a06aSlot.logical_time
        && slot.crop_stage_context_hash === a06aSlot.crop_stage_context_hash,
      `EA5E1_SLOT_CROP_CONTEXT_MISMATCH:${index}`,
    );
    assertCondition(!refs.has(slot.runtime_config_ref), `EA5E1_DUPLICATE_RUNTIME_CONFIG_REF:${index}`);
    assertCondition(!hashes.has(slot.runtime_config_hash), `EA5E1_DUPLICATE_RUNTIME_CONFIG_HASH:${index}`);
    refs.add(slot.runtime_config_ref);
    hashes.add(slot.runtime_config_hash);

    if (index === 0) {
      assertCondition(
        slot.parent_runtime_config_ref === manifest.existing_a0_predecessor_authority.runtime_config_ref
          && slot.parent_runtime_config_hash === manifest.existing_a0_predecessor_authority.runtime_config_hash,
        "EA5E1_O00_PARENT_MUST_EQUAL_EXISTING_A0",
      );
    } else {
      const parent = manifest.slots[index - 1]!;
      assertCondition(
        slot.parent_runtime_config_ref === parent.runtime_config_ref
          && slot.parent_runtime_config_hash === parent.runtime_config_hash,
        `EA5E1_PARENT_CHAIN_MISMATCH:${index}`,
      );
    }
  }

  const databaseUrl = requiredEnv("GEOX_MCFT_CAP09_S6_DATABASE_URL");
  const databaseHost = new URL(databaseUrl).hostname;
  assertCondition(
    manifest.formal_database_binding.allowed_database_hosts.includes(databaseHost),
    "EA5E1_FORMAL_NEON_BRANCH_ENDPOINT_MISMATCH",
  );

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");

      const identity = await client.query(
        "SELECT current_database() AS database_name,current_setting('server_version_num')::int AS server_version_num",
      );
      const identityRow = identity.rows[0];
      assertCondition(
        identityRow?.database_name === manifest.formal_database_binding.database_name,
        "EA5E1_FORMAL_DATABASE_NAME_MISMATCH",
      );
      assertCondition(
        Number(identityRow?.server_version_num) >= manifest.formal_database_binding.minimum_postgres_version_num,
        "EA5E1_FORMAL_DATABASE_POSTGRES_VERSION_MISMATCH",
      );

      const counts = await client.query(
        `WITH s AS (
          SELECT record_json
          FROM public.facts
          WHERE record_json#>>'{payload,tenant_id}'=$1
            AND record_json#>>'{payload,project_id}'=$2
            AND record_json#>>'{payload,group_id}'=$3
            AND record_json#>>'{payload,field_id}'=$4
            AND record_json#>>'{payload,season_id}'=$5
            AND record_json#>>'{payload,zone_id}'=$6
        )
        SELECT
          (SELECT count(*)::int FROM public.facts) AS total,
          count(*)::int AS scoped,
          count(*) FILTER(WHERE record_json->>'type'='soil_moisture_observation_v1')::int AS soil,
          count(*) FILTER(WHERE record_json->>'type' LIKE 'twin_%')::int AS canonical,
          count(*) FILTER(WHERE record_json->>'type'='twin_runtime_config_v1')::int AS configs,
          count(*) FILTER(WHERE record_json->>'type'='twin_state_estimate_v1')::int AS states,
          count(*) FILTER(
            WHERE record_json->>'type'='twin_runtime_config_v1'
              AND (record_json#>>'{payload,logical_time}')::timestamptz
                BETWEEN $7::timestamptz AND $8::timestamptz
          )::int AS expired_configs,
          count(*) FILTER(
            WHERE record_json->>'type'='twin_runtime_config_v1'
              AND (record_json#>>'{payload,logical_time}')::timestamptz
                BETWEEN $9::timestamptz AND $10::timestamptz
          )::int AS rebased_configs
        FROM s`,
        [
          ...EXACT_SCOPE,
          manifest.expired_epoch_exclusion.expired_o00,
          manifest.expired_epoch_exclusion.expired_o23,
          manifest.selected_epoch.o00,
          manifest.selected_epoch.o23,
        ],
      );
      const c = counts.rows[0];
      assertCondition(
        Number(c?.total) === 60
          && Number(c?.scoped) === 60
          && Number(c?.soil) === 2
          && Number(c?.canonical) === 58
          && Number(c?.configs) === 49
          && Number(c?.states) === 1
          && Number(c?.expired_configs) === 24
          && Number(c?.rebased_configs) === 24,
        "EA5E1_FORMAL_DB_INVENTORY_MISMATCH",
      );

      const selected = await client.query(
        `SELECT record_json->'payload' AS o
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_config_v1'
           AND record_json#>>'{payload,tenant_id}'=$1
           AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3
           AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5
           AND record_json#>>'{payload,zone_id}'=$6
           AND record_json#>>'{payload,object_id}'=ANY($7::text[])`,
        [...EXACT_SCOPE, manifest.slots.map((slot) => slot.runtime_config_ref)],
      );
      assertCondition(selected.rows.length === 24, "EA5E1_SELECTED_CONFIG_CARDINALITY_MISMATCH");
      const selectedByRef = new Map<string, any>(selected.rows.map((row) => [row.o.object_id, row.o]));
      for (let index = 0; index < manifest.slots.length; index += 1) {
        const pin = manifest.slots[index]!;
        const object = selectedByRef.get(pin.runtime_config_ref);
        assertCondition(object, `EA5E1_SELECTED_CONFIG_MISSING:${index}`);
        assertCondition(object.determinism_hash === pin.runtime_config_hash, `EA5E1_SELECTED_CONFIG_HASH_MISMATCH:${index}`);
        assertCondition(object.logical_time === pin.logical_time, `EA5E1_SELECTED_CONFIG_TIME_MISMATCH:${index}`);
        assertCondition(object.payload?.parent_runtime_config_ref === pin.parent_runtime_config_ref, `EA5E1_SELECTED_CONFIG_PARENT_REF_MISMATCH:${index}`);
        assertCondition(object.payload?.parent_runtime_config_hash === pin.parent_runtime_config_hash, `EA5E1_SELECTED_CONFIG_PARENT_HASH_MISMATCH:${index}`);
        assertCondition(object.payload?.crop_stage_context_authority?.context_hash === pin.crop_stage_context_hash, `EA5E1_SELECTED_CONFIG_CROP_CONTEXT_MISMATCH:${index}`);
        assertCondition(object.payload?.runtime_mode === "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", `EA5E1_RUNTIME_MODE_MISMATCH:${index}`);
        assertCondition(object.payload?.config_selection_mode === "EXPLICIT_REF_HASH_PIN_ONLY", `EA5E1_CONFIG_SELECTION_MODE_MISMATCH:${index}`);
      }

      const selectedRange = await client.query(
        `SELECT record_json#>>'{payload,object_id}' AS object_id,
                record_json#>>'{payload,determinism_hash}' AS determinism_hash
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_config_v1'
           AND record_json#>>'{payload,tenant_id}'=$1
           AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3
           AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5
           AND record_json#>>'{payload,zone_id}'=$6
           AND (record_json#>>'{payload,logical_time}')::timestamptz
             BETWEEN $7::timestamptz AND $8::timestamptz`,
        [...EXACT_SCOPE, manifest.selected_epoch.o00, manifest.selected_epoch.o23],
      );
      assertCondition(selectedRange.rows.length === 24, "EA5E1_SELECTED_EPOCH_RANGE_CARDINALITY_MISMATCH");
      for (const row of selectedRange.rows) {
        assertCondition(refs.has(row.object_id) && hashes.has(row.determinism_hash), "EA5E1_FOREIGN_SELECTED_EPOCH_CONFIG_FORBIDDEN");
      }

      const expiredRange = await client.query(
        `SELECT record_json#>>'{payload,object_id}' AS object_id,
                record_json#>>'{payload,determinism_hash}' AS determinism_hash
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_config_v1'
           AND record_json#>>'{payload,tenant_id}'=$1
           AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3
           AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5
           AND record_json#>>'{payload,zone_id}'=$6
           AND (record_json#>>'{payload,logical_time}')::timestamptz
             BETWEEN $7::timestamptz AND $8::timestamptz`,
        [...EXACT_SCOPE, manifest.expired_epoch_exclusion.expired_o00, manifest.expired_epoch_exclusion.expired_o23],
      );
      assertCondition(expiredRange.rows.length === 24, "EA5E1_EXPIRED_EPOCH_CARDINALITY_MISMATCH");
      for (const row of expiredRange.rows) {
        assertCondition(!refs.has(row.object_id) && !hashes.has(row.determinism_hash), "EA5E1_EXPIRED_CONFIG_PRESENT_IN_MANIFEST");
      }

      const state = await client.query(
        `SELECT record_json->'payload' AS o
         FROM public.facts
         WHERE record_json->>'type'='twin_state_estimate_v1'
           AND record_json#>>'{payload,tenant_id}'=$1
           AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3
           AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5
           AND record_json#>>'{payload,zone_id}'=$6`,
        [...EXACT_SCOPE],
      );
      assertCondition(state.rows.length === 1, "EA5E1_EXACT_ONE_PREWINDOW_STATE_REQUIRED");
      const stateObject = state.rows[0]?.o;
      assertCondition(
        stateObject?.logical_time === manifest.existing_a0_predecessor_authority.logical_time
          && stateObject?.runtime_config_ref === manifest.existing_a0_predecessor_authority.runtime_config_ref
          && stateObject?.runtime_config_hash === manifest.existing_a0_predecessor_authority.runtime_config_hash,
        "EA5E1_A0_STATE_ANCHOR_DRIFT",
      );

      const sched = await client.query(
        `SELECT
          (SELECT count(*)::int FROM public.twin_shadow_online_scheduler_slot_v1) AS slots,
          (SELECT count(*)::int FROM public.twin_shadow_online_scheduler_cursor_v1) AS cursors`,
      );
      assertCondition(Number(sched.rows[0]?.slots) === 0, "EA5E1_SCHEDULER_SLOT_ALREADY_EXISTS");
      assertCondition(Number(sched.rows[0]?.cursors) === 0, "EA5E1_SCHEDULER_CURSOR_ALREADY_EXISTS");

      const foreign = await client.query(
        `SELECT count(*)::int AS n
         FROM public.facts
         WHERE (record_json->>'type' LIKE 'twin_%' OR record_json->>'type'='soil_moisture_observation_v1')
           AND NOT(
             record_json#>>'{payload,tenant_id}'=$1
             AND record_json#>>'{payload,project_id}'=$2
             AND record_json#>>'{payload,group_id}'=$3
             AND record_json#>>'{payload,field_id}'=$4
             AND record_json#>>'{payload,season_id}'=$5
             AND record_json#>>'{payload,zone_id}'=$6
           )`,
        [...EXACT_SCOPE],
      );
      assertCondition(Number(foreign.rows[0]?.n) === 0, "EA5E1_FOREIGN_SCOPE_RELEVANT_FACT_FORBIDDEN");

      const forbidden = await client.query(
        `SELECT count(*)::int AS n
         FROM public.facts
         WHERE record_json::text LIKE '%field_c8_demo%'
            OR record_json::text LIKE '%CONTROLLED_SYNTHETIC_REPLAY_PROXY%'
            OR record_json::text LIKE '%POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1%'`,
      );
      assertCondition(Number(forbidden.rows[0]?.n) === 0, "EA5E1_C8_REPLAY_200MM_MARKER_FORBIDDEN");

      await client.query("COMMIT");

      const manifestContentSha256 = `sha256:${createHash("sha256").update(manifestBytes).digest("hex")}`;
      const result = {
        schema_version: "geox_mcft_cap09_ea5e1_post_rebase_formal_db_preflight_result_v1",
        status: "PASS",
        subject_head_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        manifest_id: manifest.manifest_id,
        manifest_content_sha256: manifestContentSha256,
        selected_epoch_id: manifest.selected_epoch.epoch_id,
        selected_o00: manifest.selected_epoch.o00,
        selected_o23: manifest.selected_epoch.o23,
        ea5e_v3_readiness_deadline: manifest.selected_epoch.ea5e_v3_readiness_deadline,
        neon_project_id: manifest.formal_database_binding.neon_project_id,
        neon_branch_id: manifest.formal_database_binding.neon_branch_id,
        neon_compute_endpoint_id: manifest.formal_database_binding.neon_compute_endpoint_id,
        database_host: databaseHost,
        database_name: identityRow.database_name,
        postgres_version_num: Number(identityRow.server_version_num),
        total_fact_count: 60,
        exact_scope_fact_count: 60,
        external_soil_evidence_count: 2,
        canonical_twin_fact_count: 58,
        runtime_config_count: 49,
        expired_historical_runtime_config_count: 24,
        rebased_future_runtime_config_count: 24,
        manifest_slot_count: 24,
        exact_manifest_ref_hash_parent_crop_chain_verified: true,
        existing_a0_state_anchor_preserved: true,
        scheduler_slot_count: 0,
        scheduler_cursor_count: 0,
        foreign_scope_relevant_fact_count: 0,
        forbidden_c8_replay_200mm_marker_fact_count: 0,
        database_write_count: 0,
        provider_request_count: 0,
        raw_object_write_count: 0,
        formal_window_started: false,
        formal_o00_start_authorized: false,
        ea5e1_effective_only_after_exact_head_proof_and_merge: true,
        ea5e2_schedule_readiness_authorized_only_after_merge: true,
        ea5e_complete: false,
        formal_execution_count: "0/24",
        mcft_cap09_completed: false,
      };
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`EA5E1_EXECUTOR_FAILED:${message}`);
  process.exitCode = 1;
});
