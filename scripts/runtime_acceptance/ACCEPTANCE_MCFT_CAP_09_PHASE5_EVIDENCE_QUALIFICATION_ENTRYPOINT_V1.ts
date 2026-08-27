import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.js";
import {
  FileBackedPhase5ControlledEvidenceFixtureV1,
  MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1,
} from "../../apps/server/src/external_evidence/qualification/mcft_cap09_phase5_evidence_runtime_qualification_v1.js";
import {
  buildKbsVariate25SoilFetchRequestV1,
} from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";

function digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-phase5-entrypoint-"));
  try {
    const target0 = "2026-08-27T08:00:00.000Z";
    const target1 = "2026-08-27T09:00:00.000Z";
    const requestedAt = "2026-08-27T07:55:00.000Z";
    const cycle = "2026-08-27T06:00:00Z";
    const request = buildKbsVariate25SoilFetchRequestV1({
      request_id: "phase5-entrypoint:soil",
      requested_at: requestedAt,
    });
    const bytes = new TextEncoder().encode('{"fixture":"raw-data-only"}\n');
    fs.writeFileSync(path.join(root, "soil.json"), bytes);

    const manifestPath = path.join(root, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({
      schema_version: MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1,
      targets: [
        {
          target_logical_time: target0,
          requested_at: requestedAt,
          request_id_prefix: "phase5.entrypoint.o00",
          gfs_cycle: cycle,
        },
        {
          target_logical_time: target1,
          requested_at: "2026-08-27T08:55:00.000Z",
          request_id_prefix: "phase5.entrypoint.o01",
          source_families: ["KBS_RAW_HOURLY"],
        },
      ],
      responses: [
        {
          kind: "KBS_SOIL",
          target_logical_time: target0,
          locator: request.locator,
          file: "soil.json",
          status: 200,
          content_type: "application/json",
          retrieved_at: requestedAt,
          available_at: "2026-08-27T07:50:00.000Z",
          sha256: digest(bytes),
        },
      ],
    }, null, 2) + "\n");

    const fixture = new FileBackedPhase5ControlledEvidenceFixtureV1({
      manifest_path: manifestPath,
      fixture_root: root,
    });
    const planner = fixture.createTargetPlanner();
    const first = await planner.nextTarget({
      cycle_attempt: 0,
      successful_cycle_count: 0,
      consecutive_failure_count: 0,
      previous_result: null,
    });
    assert.deepEqual(first, {
      target_logical_time: target0,
      requested_at: requestedAt,
      request_id_prefix: "phase5.entrypoint.o00",
    });
    const second = await planner.nextTarget({
      cycle_attempt: 1,
      successful_cycle_count: 1,
      consecutive_failure_count: 0,
      previous_result: null,
    });
    assert.equal(second?.target_logical_time, target1);
    assert.deepEqual(second?.source_families, ["KBS_RAW_HOURLY"]);
    assert.throws(
      () => fixture.selectGfsCycle({ target_logical_time: target1 }),
      /PHASE5_QUALIFICATION_GFS_CYCLE_NOT_DECLARED/,
    );
    const exhausted = await planner.nextTarget({
      cycle_attempt: 2,
      successful_cycle_count: 2,
      consecutive_failure_count: 0,
      previous_result: null,
    });
    assert.equal(exhausted, null);
    assert.equal(fixture.selectGfsCycle({ target_logical_time: target0 }), cycle);

    const loaded = await fixture.loadRaw({
      kind: "KBS_SOIL",
      target_logical_time: target0,
      request,
    });
    assert.equal(new TextDecoder().decode(loaded.bytes), new TextDecoder().decode(bytes));

    fs.writeFileSync(path.join(root, "soil.json"), new TextEncoder().encode("tampered"));
    await assert.rejects(
      fixture.loadRaw({
        kind: "KBS_SOIL",
        target_logical_time: target0,
        request,
      }),
      /PHASE5_QUALIFICATION_FIXTURE_SHA256_MISMATCH/,
    );

    const outside = path.join(path.dirname(root), "phase5-entrypoint-outside.bin");
    fs.writeFileSync(outside, bytes);
    const escapeManifest = path.join(root, "escape-manifest.json");
    fs.writeFileSync(escapeManifest, JSON.stringify({
      schema_version: MCFT_CAP09_PHASE5_CONTROLLED_FIXTURE_MANIFEST_SCHEMA_V1,
      targets: [{
        target_logical_time: target0,
        requested_at: requestedAt,
        request_id_prefix: "phase5.entrypoint.escape",
        gfs_cycle: cycle,
      }],
      responses: [{
        kind: "KBS_SOIL",
        target_logical_time: target0,
        locator: request.locator,
        file: "../" + path.basename(outside),
        status: 200,
        content_type: "application/json",
        retrieved_at: requestedAt,
        available_at: "2026-08-27T07:50:00.000Z",
        sha256: digest(bytes),
      }],
    }, null, 2));
    const escapeFixture = new FileBackedPhase5ControlledEvidenceFixtureV1({
      manifest_path: escapeManifest,
      fixture_root: root,
    });
    await assert.rejects(
      escapeFixture.loadRaw({
        kind: "KBS_SOIL",
        target_logical_time: target0,
        request,
      }),
      /PHASE5_QUALIFICATION_FIXTURE_PATH_ESCAPE_FORBIDDEN/,
    );
    fs.rmSync(outside, { force: true });

    assert.equal(
      MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1.qualification_provider_boundary,
      "EXPLICIT_WORK_ITEM_FACTORY_INJECTION_WITH_PRODUCTION_DEFAULT",
    );

    const source = fs.readFileSync(
      path.resolve("apps/server/src/external_evidence/qualification/mcft_cap09_phase5_evidence_runtime_qualification_v1.ts"),
      "utf8",
    );
    for (const forbidden of [
      "composeEvidenceRuntimeV1(",
      "PostgresEvidenceRuntimeGovernedIngressV1",
      "PostgresEvidenceSupplyCursorV1",
      "PostgresExternalFormalEvidenceVisibilityV1",
      "public.facts",
      "scripts/runtime_acceptance",
    ]) {
      assert.equal(source.includes(forbidden), false, `qualification entrypoint must not own ${forbidden}`);
    }
    for (const required of [
      "runMcftCap09EvidenceRuntimeProcessV1",
      "Phase5ControlledProviderWorkItemFactoryV1",
      "S3CompatiblePrivateRawEvidenceRetentionAdapterV1",
      "sha256",
    ]) {
      assert.equal(source.includes(required), true, `qualification entrypoint must preserve ${required}`);
    }

    const proof = {
      status: "PASS",
      acceptance_id: "MCFT_CAP09_PHASE5_EVIDENCE_QUALIFICATION_ENTRYPOINT_V1",
      data_only_fixture_manifest: true,
      fixture_sha256_bound: true,
      fixture_path_escape_rejected: true,
      ordered_target_planner: true,
      per_target_source_family_selection: true,
      gfs_cycle_required_only_for_gfs_targets: true,
      production_process_factory_reused: true,
      direct_canonical_persistence_owned_by_entrypoint: false,
      phase5_durable_evidence_registered: false,
      formal_v5_armed: false,
      production_owner_cutover: false,
    };
    fs.mkdirSync("acceptance-output", { recursive: true });
    fs.writeFileSync(
      "acceptance-output/MCFT_CAP_09_PHASE5_EVIDENCE_QUALIFICATION_ENTRYPOINT_V1_RESULT.json",
      JSON.stringify(proof, null, 2) + "\n",
    );
    process.stdout.write(JSON.stringify(proof, null, 2) + "\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
