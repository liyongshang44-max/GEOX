// apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts
// Purpose: provide the explicit operator-invokable entry for one controlled Replay A0 water-State bootstrap and persisted next-tick input reconstruction.
// Boundary: manual one-shot runner only; no scheduler, propagation, successful Forecast, Scenario, Recommendation, Decision, AO-ACT, restart/backfill, late-Evidence revision, or production claim.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CanonicalReplayFileSourceV1 } from "../../src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../src/domain/twin_runtime/physical_bounds_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  realityBindingRuntimeSnapshotFromAuthorityArtifactV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../src/runtime/twin_runtime/ports.js";

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{ configuration_source_id: string; parameters: Record<string, { value: unknown }> }>;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function requiredArgV1(args: Map<string, string>, name: string): string {
  const value = args.get(name);
  if (!value) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return value;
}

function parseArgsV1(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`INVALID_ARGUMENT_SEQUENCE:${key ?? "END"}`);
    args.set(key.slice(2), value);
  }
  return args;
}

function subtractOneHourIsoV1(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("LOGICAL_TIME_INVALID");
  return new Date(parsed - 60 * 60 * 1000).toISOString();
}

function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!definition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const numberValue = (name: string): number => {
    const value = definition.parameters[name]?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return value;
  };
  return {
    wilting_point_fraction: numberValue("wilting_point_fraction"),
    field_capacity_fraction: numberValue("field_capacity_fraction"),
    saturation_fraction: numberValue("saturation_fraction"),
    root_zone_depth_mm: numberValue("root_zone_depth_mm"),
  };
}

async function main(): Promise<void> {
  const args = parseArgsV1(process.argv.slice(2));
  const logicalTime = requiredArgV1(args, "logical-time");
  const createdAt = args.get("created-at") ?? logicalTime;
  const runtimeConfigLogicalTime = args.get("runtime-config-logical-time") ?? subtractOneHourIsoV1(logicalTime);
  const databaseUrl = args.get("database-url") ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");

  const reality = readJsonV1<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
  const configurationMatrix = readJsonV1<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
  const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
  const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: runtimeConfigLogicalTime,
    created_at: runtimeConfigLogicalTime,
  });
  const realitySnapshot = realityBindingRuntimeSnapshotFromAuthorityArtifactV1(reality);
  const replayRoot = args.get("replay-root") ?? path.join(ROOT, "fixtures/mcft/water_state/replay_v1");
  const sourceMatrixPath = args.get("source-matrix") ?? path.join(ROOT, "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const handoffRepository = new PostgresNextTickRepositoryV1(pool);
    const evidenceSource = new CanonicalReplayFileSourceV1(replayRoot, sourceMatrixPath);
    const runtimeService = new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, evidenceSource);
    const handoffService = new PrepareNextTickInputServiceV1(handoffRepository);

    const authorityStatus = await handoffRepository.commitRealityBindingSnapshot(realitySnapshot);
    const execution = await runtimeService.execute({
      scope,
      logical_time: logicalTime,
      created_at: createdAt,
      runtime_config: runtimeConfig,
      hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      lease_owner: args.get("lease-owner") ?? "mcft-1-manual-runner",
      lease_duration_seconds: Number(args.get("lease-duration-seconds") ?? "300"),
    });
    const nextTickInput = await handoffService.prepareNextTickInput(scope);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      authority_snapshot_status: authorityStatus.status,
      execution_status: execution.status,
      a0_record_set_id: execution.record_set.a0_record_set_id,
      posterior_state_ref: nextTickInput.previous_posterior_ref,
      checkpoint_ref: nextTickInput.previous_checkpoint_ref,
      lineage_id: nextTickInput.lineage_id,
      posterior_mean: nextTickInput.prior_mean,
      posterior_variance: nextTickInput.prior_variance,
      next_logical_tick_time: nextTickInput.next_logical_tick_time,
      runtime_config_ref: nextTickInput.runtime_config_ref,
      reality_binding_ref: nextTickInput.reality_binding_ref,
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
