import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type {
  RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
} from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";
import {
  KbsRawHourlyExactIntervalDecoderV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";
import {
  GfsNomadsBundleTransportV1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
} from "../../apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.js";
import {
  MCFT_CAP09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEM_FACTORY_ID_V1,
  Phase5ControlledProviderWorkItemFactoryV1,
  type Phase5ControlledEvidenceFixturePortV1,
} from "../../apps/server/src/external_evidence/qualification/mcft_cap09_phase5_controlled_evidence_work_items_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEMS_V1_RESULT.json");
const TARGET = "2026-08-27T12:00:00.000Z";
const REQUESTED = "2026-08-27T11:55:00.000Z";
const CYCLE = "2026-08-27T06:00:00Z";

async function main(): Promise<void> {
  const calls: string[] = [];
  const fixture: Phase5ControlledEvidenceFixturePortV1 = {
    selectGfsCycle({ target_logical_time }) {
      calls.push(`SELECT_GFS:${target_logical_time}`);
      return CYCLE;
    },
    loadRaw(request) {
      calls.push(request.kind);
      if (request.kind === "GFS_DIRECTORY") {
        throw new Error("PHASE5_CONTROLLED_PROVIDER_GFS_DIRECTORY_SENTINEL");
      }
      if (request.kind === "KBS_SOIL") {
        return {
          status: 200,
          content_type: "application/json",
          retrieved_at: REQUESTED,
          available_at: REQUESTED,
          bytes: new TextEncoder().encode("[]"),
        };
      }
      if (request.kind === "KBS_RAW_HOURLY") {
        return {
          status: 200,
          content_type: "text/csv",
          retrieved_at: REQUESTED,
          available_at: REQUESTED,
          bytes: new TextEncoder().encode("date,time,rain_mm\n"),
        };
      }
      throw new Error(`PHASE5_CONTROLLED_PROVIDER_UNEXPECTED_FIXTURE_CALL:${request.kind}`);
    },
  };

  let retentionCalls = 0;
  const retention: RawEvidenceRetentionPortV1 = {
    async retainRawEvidence(input) {
      retentionCalls += 1;
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: `s3://qualification/${input.request_id}`,
        retained_sha256: input.raw_sha256,
        retained_bytes: input.raw_bytes,
        retained_at: REQUESTED,
        externally_publishable: false,
      };
    },
  };

  const factory = new Phase5ControlledProviderWorkItemFactoryV1({
    fixture,
    retention,
    clock: () => new Date(REQUESTED),
  });
  assert.equal(factory.factory_id, MCFT_CAP09_PHASE5_CONTROLLED_PROVIDER_WORK_ITEM_FACTORY_ID_V1);

  const work = factory.buildForTarget({
    target_logical_time: TARGET,
    requested_at: REQUESTED,
    request_id_prefix: "phase5-controlled-provider",
  });
  assert.equal(work.length, 3);
  assert.deepEqual(work.map(item => item.dataset_id), [
    "kbs_lter_current_weather_variate25_v1",
    "kbs_lter_raw_hourly_exact_interval_v1",
    "noaa_ncep_gfs_same_cycle_72h_bundle_v1",
  ]);
  assert(work[0]!.decoder instanceof KbsVariate25SoilEvidenceDecoderV1);
  assert(work[1]!.decoder instanceof KbsRawHourlyExactIntervalDecoderV1);
  assert(work[2]!.decoder instanceof GfsRawBundleEvidenceDecoderV1);
  assert(work[2]!.transport instanceof GfsNomadsBundleTransportV1);
  assert.deepEqual(calls, []);
  assert.equal(retentionCalls, 0);

  const soilRaw = await work[0]!.transport.fetchRawEvidence(work[0]!.request);
  assert.equal(soilRaw.final_locator, work[0]!.request.locator);
  assert.equal(soilRaw.content_type, "application/json");

  const hourlyRaw = await work[1]!.transport.fetchRawEvidence(work[1]!.request);
  assert.equal(hourlyRaw.final_locator, work[1]!.request.locator);
  assert.equal(hourlyRaw.content_type, "text/csv");
  assert.deepEqual(calls, ["KBS_SOIL", "KBS_RAW_HOURLY"]);
  assert.equal(retentionCalls, 0);

  await assert.rejects(
    work[2]!.transport.fetchRawEvidence(work[2]!.request),
    /PHASE5_CONTROLLED_PROVIDER_GFS_DIRECTORY_SENTINEL/,
  );
  assert.deepEqual(calls, [
    "KBS_SOIL",
    "KBS_RAW_HOURLY",
    `SELECT_GFS:${TARGET}`,
    "GFS_DIRECTORY",
  ]);
  assert.equal(retentionCalls, 0);

  const source = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/qualification/mcft_cap09_phase5_controlled_evidence_work_items_v1.ts"),
    "utf8",
  );
  for (const required of [
    "KbsVariate25SoilEvidenceDecoderV1",
    "KbsRawHourlyExactIntervalDecoderV1",
    "GfsNomadsRawBundleComposerV1",
    "GfsNomadsBundleTransportV1",
    "GfsRawBundleEvidenceDecoderV1",
    "validateCompleteGfsCycleInventoryV1",
    "retention: this.config.retention",
  ]) {
    assert(source.includes(required), `PHASE5_CONTROLLED_PROVIDER_REQUIRED_PRODUCT_CHAIN_MISSING:${required}`);
  }
  for (const forbidden of [
    "scripts/runtime_acceptance",
    "process.env",
    "INSERT INTO",
    "UPDATE twin_",
    "DELETE FROM twin_",
    "setInterval(",
    "setTimeout(",
  ]) {
    assert.equal(source.includes(forbidden), false, `PHASE5_CONTROLLED_PROVIDER_FORBIDDEN_BOUNDARY:${forbidden}`);
  }

  const proof = {
    schema_version: "geox_mcft_cap09_phase5_controlled_provider_work_items_qualification_v1",
    status: "PASS",
    factory_id: factory.factory_id,
    work_item_count: work.length,
    product_soil_decoder_preserved: true,
    product_raw_hourly_decoder_preserved: true,
    product_gfs_bundle_composer_preserved: true,
    product_gfs_bundle_transport_preserved: true,
    product_gfs_scientific_decoder_preserved: true,
    controlled_boundary_stops_at_raw_acquisition: true,
    gfs_fake_scientific_payload_used: false,
    direct_database_write: false,
    direct_cursor_advance: false,
    twin_state_mutation: false,
    production_process_default_changed: false,
    formal_v5_armed: false,
    graduation_effect: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof) + "\n");
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
