import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(
  root,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-WINDOW-INPUT-MANIFEST-V2.json",
);
const selectionAuthorityPath = path.join(
  root,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json",
);
const outputPath = path.join(
  root,
  "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_WINDOW_INPUT_MANIFEST_V2_RESULT.json",
);

type ManifestSlotV2 = {
  slot_id: string;
  logical_time: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  crop_stage_context_hash: string;
};

type ManifestV2 = {
  schema_version: string;
  manifest_id: string;
  record_status: string;
  selection_mode: string;
  immutable_for_formal_window: boolean;
  selected_epoch: {
    epoch_id: string;
    o00: string;
    o23: string;
    ea5e3_readiness_deadline: string;
    formal_slot_count: number;
    actual_hourly_utc_boundaries_required: boolean;
  };
  existing_a0_predecessor_authority: {
    logical_time: string;
    runtime_config_ref: string;
    runtime_config_hash: string;
    must_remain_prewindow_state_authority: boolean;
  };
  formal_database_binding: {
    neon_project_id: string;
    neon_branch_id: string;
    database_name: string;
    minimum_postgres_version_num: number;
    transaction_mode_for_this_frontier: string;
    scope: {
      tenant_id: string;
      project_id: string;
      group_id: string;
      field_id: string;
      season_id: string;
      zone_id: string;
    };
  };
  amendment_11_temporal_authority: {
    provider_availability_watermark: string;
    observation_resolution: string;
    provider_publication_cadence: string;
    historical_online_freshness_diagnostic_hours: number;
    freshness_is_late_authoritative_admission_gate: boolean;
    raw_retention_before_canonicalization: boolean;
    fixed_t_plus_432_normative_cutoff: boolean;
    no_future_leakage: boolean;
    no_interpolation: boolean;
    no_persistence_fill: boolean;
    no_source_substitution: boolean;
  };
  required_prewindow_state: {
    total_fact_count: number;
    exact_scope_fact_count: number;
    external_soil_evidence_count: number;
    canonical_twin_fact_count: number;
    runtime_config_count: number;
    successor_hourly_runtime_config_count: number;
    state_count: number;
    existing_a0_state_anchor_preserved: boolean;
    state_latest_logical_time: string;
    scheduler_slot_count: number;
    scheduler_cursor_count: number;
    formal_window_runtime_tick_count: number;
    formal_execution_count: string;
    foreign_scope_relevant_fact_count: number;
    formal_window_started: boolean;
  };
  slot_count: number;
  slots: ManifestSlotV2[];
};

type SelectionAuthorityV2 = {
  selection_rule: {
    selected_epoch_id: string;
    selected_o00: string;
    selected_o23: string;
    ea5e3_readiness_deadline: string;
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
  if (!value?.trim()) throw new Error(`T3R1_MANIFEST_V2_REQUIRED_ENV_MISSING:${name}`);
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
    throw new Error("T3R1_MANIFEST_V2_FORMAL_WINDOW_MUST_REMAIN_DISABLED");
  }

  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as ManifestV2;
  const selection = JSON.parse(fs.readFileSync(selectionAuthorityPath, "utf8")) as SelectionAuthorityV2;

  assertCondition(
    manifest.schema_version === "geox_mcft_cap09_t3r1_successor_formal_window_input_manifest_v2",
    "T3R1_MANIFEST_V2_SCHEMA_INVALID",
  );
  assertCondition(
    manifest.manifest_id === "GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-WINDOW-INPUT-MANIFEST-V2",
    "T3R1_MANIFEST_V2_ID_INVALID",
  );
  assertCondition(
    manifest.record_status === "T3R1_SUCCESSOR_FORMAL_WINDOW_INPUT_MANIFEST_CANDIDATE_NOT_EFFECTIVE",
    "T3R1_MANIFEST_V2_STATUS_INVALID",
  );
  assertCondition(manifest.selection_mode === "EXPLICIT_REF_HASH_PIN_ONLY", "T3R1_MANIFEST_V2_EXPLICIT_PIN_REQUIRED");
  assertCondition(manifest.immutable_for_formal_window === true, "T3R1_MANIFEST_V2_IMMUTABLE_REQUIRED");
  assertCondition(manifest.slot_count === 24 && manifest.slots.length === 24, "T3R1_MANIFEST_V2_EXACT_24_REQUIRED");

  assertCondition(
    manifest.selected_epoch.epoch_id === selection.selection_rule.selected_epoch_id
      && manifest.selected_epoch.o00 === selection.selection_rule.selected_o00
      && manifest.selected_epoch.o23 === selection.selection_rule.selected_o23
      && manifest.selected_epoch.ea5e3_readiness_deadline === selection.selection_rule.ea5e3_readiness_deadline,
    "T3R1_MANIFEST_V2_EPOCH_SELECTION_BINDING_MISMATCH",
  );
  assertCondition(
    manifest.existing_a0_predecessor_authority.logical_time === selection.existing_a0_parent_anchor.logical_time
      && manifest.existing_a0_predecessor_authority.runtime_config_ref === selection.existing_a0_parent_anchor.runtime_config_ref
      && manifest.existing_a0_predecessor_authority.runtime_config_hash === selection.existing_a0_parent_anchor.runtime_config_hash,
    "T3R1_MANIFEST_V2_A0_BINDING_MISMATCH",
  );

  if (Date.now() >= Date.parse(manifest.selected_epoch.ea5e3_readiness_deadline)) {
    throw new Error("T3R1_MANIFEST_V2_EA5E3_READINESS_DEADLINE_EXPIRED");
  }
  if (Date.now() >= Date.parse(manifest.selected_epoch.o00)) {
    throw new Error("T3R1_MANIFEST_V2_O00_ALREADY_PASSED");
  }

  const refs = new Set<string>();
  const hashes = new Set<string>();
  for (let index = 0; index < manifest.slots.length; index += 1) {
    const slot = manifest.slots[index]!;
    const source = selection.slot_contexts[index]!;
    assertCondition(slot.slot_id === `O${String(index).padStart(2, "0")}`, `T3R1_MANIFEST_V2_SLOT_ID:${index}`);
    assertCondition(slot.logical_time === exactIsoHour(manifest.selected_epoch.o00, index), `T3R1_MANIFEST_V2_SLOT_TIME:${index}`);
    assertCondition(
      slot.slot_id === source.slot_id
        && slot.logical_time === source.logical_time
        && slot.crop_stage_context_hash === source.crop_stage_context_hash,
      `T3R1_MANIFEST_V2_CROP_CONTEXT:${index}`,
    );
    assertCondition(!refs.has(slot.runtime_config_ref), `T3R1_MANIFEST_V2_DUPLICATE_REF:${index}`);
    assertCondition(!hashes.has(slot.runtime_config_hash), `T3R1_MANIFEST_V2_DUPLICATE_HASH:${index}`);
    refs.add(slot.runtime_config_ref);
    hashes.add(slot.runtime_config_hash);
    if (index === 0) {
      assertCondition(
        slot.parent_runtime_config_ref === manifest.existing_a0_predecessor_authority.runtime_config_ref
          && slot.parent_runtime_config_hash === manifest.existing_a0_predecessor_authority.runtime_config_hash,
        "T3R1_MANIFEST_V2_O00_PARENT_NOT_A0",
      );
    } else {
      const parent = manifest.slots[index - 1]!;
      assertCondition(
        slot.parent_runtime_config_ref === parent.runtime_config_ref
          && slot.parent_runtime_config_hash === parent.runtime_config_hash,
        `T3R1_MANIFEST_V2_PARENT_CHAIN:${index}`,
      );
    }
  }

  const temporal = manifest.amendment_11_temporal_authority;
  assertCondition(temporal.provider_availability_watermark === "PROVIDER_AVAILABILITY_WATERMARK_V1", "T3R1_MANIFEST_V2_WATERMARK_REQUIRED");
  assertCondition(temporal.observation_resolution === "hourly", "T3R1_MANIFEST_V2_HOURLY_RESOLUTION_REQUIRED");
  assertCondition(temporal.provider_publication_cadence === "daily_batch", "T3R1_MANIFEST_V2_DAILY_BATCH_REQUIRED");
  assertCondition(temporal.historical_online_freshness_diagnostic_hours === 6, "T3R1_MANIFEST_V2_HISTORICAL_6H_REQUIRED");
  assertCondition(temporal.freshness_is_late_authoritative_admission_gate === false, "T3R1_MANIFEST_V2_6H_GATE_FORBIDDEN");
  assertCondition(temporal.fixed_t_plus_432_normative_cutoff === false, "T3R1_MANIFEST_V2_T432_FORBIDDEN");
  assertCondition(
    temporal.raw_retention_before_canonicalization
      && temporal.no_future_leakage
      && temporal.no_interpolation
      && temporal.no_persistence_fill
      && temporal.no_source_substitution,
    "T3R1_MANIFEST_V2_TEMPORAL_INVARIANTS_REQUIRED",
  );

  const databaseUrl = requiredEnv("GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL");
  const scope = manifest.formal_database_binding.scope;
  const scopeArgs = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");

      const identity = (await client.query(
        `SELECT current_database() AS database_name,
                current_setting('server_version_num')::int AS server_version_num,
                current_setting('neon.project_id', true) AS neon_project_id,
                current_setting('neon.branch_id', true) AS neon_branch_id,
                current_setting('transaction_read_only') AS transaction_read_only`,
      )).rows[0];
      assertCondition(identity?.database_name === manifest.formal_database_binding.database_name, "T3R1_MANIFEST_V2_DATABASE_NAME_MISMATCH");
      assertCondition(identity?.neon_project_id === manifest.formal_database_binding.neon_project_id, "T3R1_MANIFEST_V2_NEON_PROJECT_MISMATCH");
      assertCondition(identity?.neon_branch_id === manifest.formal_database_binding.neon_branch_id, "T3R1_MANIFEST_V2_NEON_BRANCH_MISMATCH");
      assertCondition(Number(identity?.server_version_num) >= manifest.formal_database_binding.minimum_postgres_version_num, "T3R1_MANIFEST_V2_POSTGRES_VERSION_MISMATCH");
      assertCondition(identity?.transaction_read_only === "on", "T3R1_MANIFEST_V2_TRANSACTION_NOT_READ_ONLY");

      const counts = (await client.query(
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
              AND (record_json#>>'{payload,logical_time}')::timestamptz BETWEEN $7::timestamptz AND $8::timestamptz
          )::int AS successor_configs
        FROM s`,
        [...scopeArgs, manifest.selected_epoch.o00, manifest.selected_epoch.o23],
      )).rows[0];

      const required = manifest.required_prewindow_state;
      assertCondition(
        Number(counts?.total) === required.total_fact_count
          && Number(counts?.scoped) === required.exact_scope_fact_count
          && Number(counts?.soil) === required.external_soil_evidence_count
          && Number(counts?.canonical) === required.canonical_twin_fact_count
          && Number(counts?.configs) === required.runtime_config_count
          && Number(counts?.states) === required.state_count
          && Number(counts?.successor_configs) === required.successor_hourly_runtime_config_count,
        "T3R1_MANIFEST_V2_FORMAL_DB_INVENTORY_MISMATCH",
      );
      assertCondition(Number(counts?.total) === Number(counts?.scoped), "T3R1_MANIFEST_V2_FOREIGN_SCOPE_FACT_FORBIDDEN");

      const a0 = (await client.query(
        `SELECT record_json->'payload' AS o
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_config_v1'
           AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3 AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
           AND record_json#>>'{payload,object_id}'=$7`,
        [...scopeArgs, manifest.existing_a0_predecessor_authority.runtime_config_ref],
      )).rows;
      assertCondition(a0.length === 1, "T3R1_MANIFEST_V2_A0_CONFIG_CARDINALITY");
      assertCondition(
        a0[0]?.o?.determinism_hash === manifest.existing_a0_predecessor_authority.runtime_config_hash
          && a0[0]?.o?.logical_time === manifest.existing_a0_predecessor_authority.logical_time,
        "T3R1_MANIFEST_V2_A0_CONFIG_MISMATCH",
      );

      const selected = (await client.query(
        `SELECT record_json->'payload' AS o
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_config_v1'
           AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3 AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
           AND record_json#>>'{payload,object_id}'=ANY($7::text[])`,
        [...scopeArgs, manifest.slots.map((slot) => slot.runtime_config_ref)],
      )).rows;
      assertCondition(selected.length === 24, "T3R1_MANIFEST_V2_SELECTED_CONFIG_CARDINALITY");
      const selectedByRef = new Map<string, any>(selected.map((row) => [row.o.object_id, row.o]));
      for (let index = 0; index < manifest.slots.length; index += 1) {
        const pin = manifest.slots[index]!;
        const object = selectedByRef.get(pin.runtime_config_ref);
        assertCondition(object, `T3R1_MANIFEST_V2_CONFIG_MISSING:${index}`);
        assertCondition(object.determinism_hash === pin.runtime_config_hash, `T3R1_MANIFEST_V2_CONFIG_HASH:${index}`);
        assertCondition(object.logical_time === pin.logical_time, `T3R1_MANIFEST_V2_CONFIG_TIME:${index}`);
        assertCondition(object.payload?.parent_runtime_config_ref === pin.parent_runtime_config_ref, `T3R1_MANIFEST_V2_PARENT_REF:${index}`);
        assertCondition(object.payload?.parent_runtime_config_hash === pin.parent_runtime_config_hash, `T3R1_MANIFEST_V2_PARENT_HASH:${index}`);
        assertCondition(object.payload?.crop_stage_context_authority?.context_hash === pin.crop_stage_context_hash, `T3R1_MANIFEST_V2_CROP_HASH:${index}`);
        assertCondition(object.payload?.runtime_mode === "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", `T3R1_MANIFEST_V2_RUNTIME_MODE:${index}`);
        assertCondition(object.payload?.config_selection_mode === "EXPLICIT_REF_HASH_PIN_ONLY", `T3R1_MANIFEST_V2_CONFIG_SELECTION_MODE:${index}`);
      }

      const range = (await client.query(
        `SELECT record_json#>>'{payload,object_id}' AS object_id, record_json#>>'{payload,determinism_hash}' AS determinism_hash
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_config_v1'
           AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3 AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
           AND (record_json#>>'{payload,logical_time}')::timestamptz BETWEEN $7::timestamptz AND $8::timestamptz`,
        [...scopeArgs, manifest.selected_epoch.o00, manifest.selected_epoch.o23],
      )).rows;
      assertCondition(range.length === 24, "T3R1_MANIFEST_V2_SELECTED_RANGE_CARDINALITY");
      for (const row of range) {
        assertCondition(refs.has(row.object_id) && hashes.has(row.determinism_hash), "T3R1_MANIFEST_V2_FOREIGN_CONFIG_IN_SELECTED_RANGE");
      }

      const state = (await client.query(
        `SELECT record_json->'payload' AS o
         FROM public.facts
         WHERE record_json->>'type'='twin_state_estimate_v1'
           AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3 AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6`,
        scopeArgs,
      )).rows;
      assertCondition(state.length === 1, "T3R1_MANIFEST_V2_STATE_CARDINALITY");
      assertCondition(
        state[0]?.o?.logical_time === manifest.existing_a0_predecessor_authority.logical_time
          && state[0]?.o?.runtime_config_ref === manifest.existing_a0_predecessor_authority.runtime_config_ref
          && state[0]?.o?.runtime_config_hash === manifest.existing_a0_predecessor_authority.runtime_config_hash,
        "T3R1_MANIFEST_V2_A0_STATE_ANCHOR_MISMATCH",
      );

      const scheduler = (await client.query(
        `SELECT (SELECT count(*)::int FROM public.twin_shadow_online_scheduler_slot_v1) AS slots,
                (SELECT count(*)::int FROM public.twin_shadow_online_scheduler_cursor_v1) AS cursors`,
      )).rows[0];
      assertCondition(
        Number(scheduler?.slots) === required.scheduler_slot_count && Number(scheduler?.cursors) === required.scheduler_cursor_count,
        "T3R1_MANIFEST_V2_SCHEDULER_NOT_ZERO",
      );

      const formalTicks = (await client.query(
        `SELECT count(*)::int AS n
         FROM public.facts
         WHERE record_json->>'type'='twin_runtime_tick_v1'
           AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2
           AND record_json#>>'{payload,group_id}'=$3 AND record_json#>>'{payload,field_id}'=$4
           AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
           AND (record_json#>>'{payload,logical_time}')::timestamptz BETWEEN $7::timestamptz AND $8::timestamptz`,
        [...scopeArgs, manifest.selected_epoch.o00, manifest.selected_epoch.o23],
      )).rows[0]?.n;
      assertCondition(Number(formalTicks) === required.formal_window_runtime_tick_count, "T3R1_MANIFEST_V2_FORMAL_TICK_ALREADY_EXISTS");

      await client.query("COMMIT");

      const manifestContentSha256 = `sha256:${createHash("sha256").update(manifestBytes).digest("hex")}`;
      const result = {
        schema_version: "geox_mcft_cap09_t3r1_successor_formal_db_preflight_window_input_manifest_v2_result",
        status: "PASS",
        manifest_id: manifest.manifest_id,
        manifest_content_sha256: manifestContentSha256,
        selected_epoch_id: manifest.selected_epoch.epoch_id,
        selected_o00: manifest.selected_epoch.o00,
        selected_o23: manifest.selected_epoch.o23,
        ea5e3_readiness_deadline: manifest.selected_epoch.ea5e3_readiness_deadline,
        neon_project_id: manifest.formal_database_binding.neon_project_id,
        neon_branch_id: manifest.formal_database_binding.neon_branch_id,
        database_name: manifest.formal_database_binding.database_name,
        transaction_mode: "READ_ONLY",
        total_fact_count: Number(counts.total),
        exact_scope_fact_count: Number(counts.scoped),
        external_soil_evidence_count: Number(counts.soil),
        canonical_twin_fact_count: Number(counts.canonical),
        runtime_config_count: Number(counts.configs),
        successor_runtime_config_count: Number(counts.successor_configs),
        manifest_slot_count: manifest.slots.length,
        exact_manifest_ref_hash_parent_crop_chain_verified: true,
        existing_a0_state_anchor_preserved: true,
        state_latest_logical_time: state[0]?.o?.logical_time,
        scheduler_slot_count: Number(scheduler.slots),
        scheduler_cursor_count: Number(scheduler.cursors),
        formal_window_runtime_tick_count: Number(formalTicks),
        foreign_scope_relevant_fact_count: Number(counts.total) - Number(counts.scoped),
        provider_availability_watermark: temporal.provider_availability_watermark,
        freshness_is_late_authoritative_admission_gate: temporal.freshness_is_late_authoritative_admission_gate,
        database_write_count: 0,
        provider_request_count: 0,
        raw_object_write_count: 0,
        scheduler_write_count: 0,
        runtime_tick_write_count: 0,
        ea5e3_authorized: false,
        formal_o00_start_authorized: false,
        formal_window_started: false,
        formal_execution_count: "0/24",
        mcft_cap09_completed: false,
      };
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      console.log(JSON.stringify(result));
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
