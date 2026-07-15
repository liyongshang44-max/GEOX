// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts
// Purpose: prove that Replay binding conversion-rule version metadata is derived only from the frozen binding_version when absent, preserves source Evidence identity, and fails closed on explicit version conflict.
// Boundary: temporary filesystem acceptance only; no database, canonical write, source fixture mutation, source-matrix mutation, Runtime tick, active binding, Model Activation, calibration, or CAP-06 authority.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  CanonicalReplayFileSourceV1,
  SOURCE_BINDING_CONVERSION_RULE_EXECUTION_METADATA_POLICY_ID_V1,
} from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const scope: TwinScopeKeyV1 = {
  tenant_id: "tenant_cap05_binding_metadata",
  project_id: "project_cap05_binding_metadata",
  group_id: "group_cap05_binding_metadata",
  field_id: "field_cap05_binding_metadata",
  season_id: "season_cap05_binding_metadata",
  zone_id: "zone_cap05_binding_metadata",
};

function replayRecordV1(): Record<string, unknown> {
  const record: Record<string, unknown> = {
    ...scope,
    dataset_id: "dataset_cap05_binding_metadata",
    source_record_id: "source_record_cap05_binding_metadata",
    source_record_hash: "",
    record_type: "soil_moisture_observation_v1",
    binding_id: "soil_obs_cap05_binding_metadata_v1",
    origin_source_kind: "DEVICE",
    origin_source_id: "device_cap05_binding_metadata",
    epistemic_class: "OBSERVED",
    available_to_runtime_at: "2026-06-04T06:55:00.000Z",
    role_time: {
      observed_at: "2026-06-04T06:50:00.000Z",
      ingested_at: "2026-06-04T06:55:00.000Z",
    },
    quality: { status: "PASS" },
    source_payload: {
      unit: "percent_vwc",
      value: 18.42,
      source_version: "1",
    },
    canonical_payload: {
      unit: "fraction",
      value: 0.1842,
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    },
    limitations: ["controlled acceptance Evidence"],
  };
  record.source_record_hash = semanticHashV1(record);
  return record;
}

function sourceMatrixV1(input: {
  binding_version?: number;
  conversion_version?: string;
} = {}): Record<string, unknown> {
  const conversionRule: Record<string, unknown> = {
    id: "PERCENT_TO_FRACTION_V1",
    expression: "canonical_value = source_value / 100",
  };
  if (input.conversion_version !== undefined) conversionRule.version = input.conversion_version;
  const binding: Record<string, unknown> = {
    binding_id: "soil_obs_cap05_binding_metadata_v1",
    source_unit: "percent_vwc",
    canonical_unit: "fraction",
    conversion_rule: conversionRule,
  };
  if (input.binding_version !== undefined) binding.binding_version = input.binding_version;
  return { bindings: [binding] };
}

async function writeMatrixV1(matrixPath: string, value: Record<string, unknown>): Promise<void> {
  await fs.writeFile(matrixPath, `${JSON.stringify(value)}\n`, "utf8");
}

async function main(): Promise<void> {
  let pass = 0;
  const ok = (label: string): void => {
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
  };
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mcft-cap05-binding-metadata-"));
  const replayRoot = path.join(root, "replay");
  const soilDirectory = path.join(replayRoot, "soil_moisture");
  const replayPath = path.join(soilDirectory, "2026-06-04.jsonl");
  const matrixPath = path.join(root, "source-binding-matrix.json");

  try {
    assert.equal(
      SOURCE_BINDING_CONVERSION_RULE_EXECUTION_METADATA_POLICY_ID_V1,
      "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1",
    );
    ok("execution metadata derivation policy identity is frozen");

    await fs.mkdir(soilDirectory, { recursive: true });
    const record = replayRecordV1();
    const originalReplayText = `${JSON.stringify(record)}\n`;
    await fs.writeFile(replayPath, originalReplayText, "utf8");
    await writeMatrixV1(matrixPath, sourceMatrixV1({ binding_version: 1 }));

    const source = new CanonicalReplayFileSourceV1(replayRoot, matrixPath);
    const loaded = await source.loadCandidateRecords({
      scope,
      logical_time: "2026-06-04T07:00:00.000Z",
    });
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].conversion_rule, {
      id: "PERCENT_TO_FRACTION_V1",
      expression: "canonical_value = source_value / 100",
      version: "1",
    });
    ok("missing conversion-rule version is derived from frozen binding_version");

    assert.equal(loaded[0].source_record_hash, record.source_record_hash);
    assert.equal(await fs.readFile(replayPath, "utf8"), originalReplayText);
    ok("derived execution metadata does not mutate Replay Evidence identity or file bytes");

    await writeMatrixV1(matrixPath, sourceMatrixV1({
      binding_version: 1,
      conversion_version: "1",
    }));
    const explicitMatch = await source.loadCandidateRecords({
      scope,
      logical_time: "2026-06-04T07:00:00.000Z",
    });
    assert.equal(explicitMatch[0].conversion_rule.version, "1");
    ok("matching explicit conversion-rule version remains valid");

    await writeMatrixV1(matrixPath, sourceMatrixV1({
      binding_version: 1,
      conversion_version: "2",
    }));
    await assert.rejects(
      source.loadCandidateRecords({ scope, logical_time: "2026-06-04T07:00:00.000Z" }),
      /CONVERSION_RULE_VERSION_BINDING_VERSION_MISMATCH/,
    );
    ok("explicit conversion-rule version conflict fails closed");

    await writeMatrixV1(matrixPath, sourceMatrixV1());
    await assert.rejects(
      source.loadCandidateRecords({ scope, logical_time: "2026-06-04T07:00:00.000Z" }),
      /SOURCE_BINDING_VERSION_REQUIRED/,
    );
    ok("missing binding_version fails closed");

    assert.equal(pass, 6);
    process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
