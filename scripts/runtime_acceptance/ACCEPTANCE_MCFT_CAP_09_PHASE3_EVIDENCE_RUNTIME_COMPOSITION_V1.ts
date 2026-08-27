import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

import {
  composeEvidenceRuntimeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.js";
import {
  ProductionEvidenceWorkItemFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import type {
  RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_COMPOSITION_V1_RESULT.json");
const TARGET = "2026-08-27T12:00:00.000Z";
const REQUESTED = "2026-08-27T11:50:00.000Z";

async function main(): Promise<void> {
  const retention: RawEvidenceRetentionPortV1 = {
    async retainRawEvidence() {
      throw new Error("PHASE3_COMPOSITION_FACTORY_RETENTION_MUST_NOT_EXECUTE");
    },
  };
  const workFactory = new ProductionEvidenceWorkItemFactoryV1({
    retention,
    fetch_impl: async () => { throw new Error("PHASE3_COMPOSITION_FACTORY_FETCH_MUST_NOT_EXECUTE"); },
    clock: () => new Date(REQUESTED),
  });
  const items = workFactory.buildForTarget({
    target_logical_time: TARGET,
    requested_at: REQUESTED,
    request_id_prefix: "phase3-composition",
  });
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((item) => item.work_item_id), [
    "phase3-composition:soil",
    "phase3-composition:kbs-raw-hourly",
    "phase3-composition:gfs-bundle",
  ]);
  assert.deepEqual(items.map((item) => item.request.provider_id), [
    "KBS_LTER",
    "KBS_LTER",
    "MCFT_CAP09_GFS_NOMADS_BUNDLE_PROVIDER_V1",
  ]);
  assert.deepEqual(items.map((item) => item.decoder.decoder_id), [
    "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1",
    "MCFT_CAP09_KBS_RAW_HOURLY_EXACT_INTERVAL_DECODER_V1",
    "MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_V1",
  ]);
  assert.equal(items[1].request.source_event_time, TARGET);
  assert.equal(items[2].request.source_event_time, TARGET);

  let plannerCalls = 0;
  let healthCalls = 0;
  const fakePool = {
    connect() { throw new Error("PHASE3_COMPOSITION_STOPPED_HOST_DB_CONNECT_FORBIDDEN"); },
    query() { throw new Error("PHASE3_COMPOSITION_STOPPED_HOST_DB_QUERY_FORBIDDEN"); },
  } as unknown as Pool;

  const composition = composeEvidenceRuntimeV1({
    pool: fakePool,
    scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "field_e3r1",
      season_id: "season_2026",
      zone_id: "zone_root",
    },
    raw_retention: {
      endpoint: "https://s3.example.invalid",
      bucket: "phase3-evidence-private",
      region: "us-test-1",
      access_key_id: "qualification-access",
      secret_access_key: "qualification-secret",
      clock: () => new Date(REQUESTED),
    },
    target_planner: {
      async nextTarget() {
        plannerCalls += 1;
        throw new Error("PHASE3_COMPOSITION_STOPPED_HOST_TARGET_PLANNER_FORBIDDEN");
      },
    },
    wait: {
      async waitAfterAttempt() {
        throw new Error("PHASE3_COMPOSITION_STOPPED_HOST_WAIT_FORBIDDEN");
      },
    },
    health: {
      async recordHealth() { healthCalls += 1; },
    },
    stop: { stopRequested: () => true },
    failure_classifier: { classify: () => "FATAL" },
    completion_clock: () => REQUESTED,
    work_item_config: {
      fetch_impl: async () => { throw new Error("PHASE3_COMPOSITION_STOPPED_HOST_FETCH_FORBIDDEN"); },
      clock: () => new Date(REQUESTED),
    },
  });
  assert.equal(composition.composition_id, "MCFT_CAP09_EVIDENCE_RUNTIME_COMPOSITION_V1");

  const stopped = await composition.host.run({
    scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "field_e3r1",
      season_id: "season_2026",
      zone_id: "zone_root",
    },
    lease_owner: "phase3-composition-test",
    lease_duration_seconds: 300,
  });
  assert.equal(stopped.status, "STOPPED");
  assert.equal(stopped.stop_reason, "STOP_REQUESTED");
  assert.equal(plannerCalls, 0);
  assert.equal(healthCalls, 2);

  const productionFiles = [
    "apps/server/src/external_evidence/mcft_cap09_evidence_runtime_composition_v1.ts",
    "apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.ts",
    "apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.ts",
  ].map((file) => fs.readFileSync(path.resolve(file), "utf8")).join("\n");
  for (const forbidden of [
    "scripts/runtime_acceptance",
    "process.env",
    "setInterval(",
    "setTimeout(",
    "twin_runtime_lease_v1",
    "twin_shadow_online_scheduler",
    "RuntimeTickCursorPort",
  ]) {
    assert.equal(productionFiles.includes(forbidden), false, `PHASE3_COMPOSITION_FORBIDDEN_DEPENDENCY:${forbidden}`);
  }

  const proof = {
    schema_version: "geox_mcft_cap09_phase3_evidence_runtime_composition_qualification_v1",
    status: "PASS",
    production_work_item_count: items.length,
    product_provider_ids: items.map((item) => item.request.provider_id),
    product_decoder_ids: items.map((item) => item.decoder.decoder_id),
    explicit_target_required: true,
    target_selection_owned_by_composition: false,
    stopped_host_target_planner_calls: plannerCalls,
    stopped_host_database_calls: 0,
    stopped_host_provider_calls: 0,
    stopped_host_s3_calls: 0,
    same_canonical_cycle_service_path: true,
    production_activation: false,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(proof, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
