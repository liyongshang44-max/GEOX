// Disposable development diagnostic for the exact MCFT-CAP-08.S5 case-excitation surface.
// No Candidate, Shadow, Model Activation, active Config switch, effectiveness, or final formal run authority.

import fs from "node:fs";
import path from "node:path";

import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresCap08S5ExactSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js";
import { parseFixedDecimalV1 } from "../../apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.js";
import { runner, admin } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S5SlicePredecessorV1 } from "./mcft_cap08_s5_acceptance_support_v1.js";

if (process.env.MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE_1");
}

const OUT = "acceptance-output/MCFT_CAP_08_S5_CASE_EXCITATION_DIAGNOSTIC.json";

async function main(): Promise<void> {
  try {
    const established = await establishCap08S5SlicePredecessorV1(path.resolve("."));
    const source = new PostgresCap08S5ExactSourceV1(
      runner,
      new PostgresFeedbackPersistenceRepositoryV1(runner),
    );
    const cases = [];
    for (const obligation of established.obligations) {
      const resolved = await source.resolveExactObligation({
        scope: established.predecessor.fixture.scope,
        formal_run_id: established.predecessor.fixture.formal_run_id,
        obligation,
        created_at: "2026-07-26T00:00:00.000Z",
      });
      cases.push({
        residual_id: obligation.residual_id,
        residual_ref: resolved.residual.object_id,
        forecast_ref: obligation.forecast_ref,
        fvo_ref: obligation.observation.source_record_id,
        commit_phase: obligation.commit_phase,
        forecast_target_time: resolved.case_source.forecast_target_time,
        previous_storage_mm: resolved.replay_authority.source_forecast_point.previous_storage_mm,
        next_storage_mm: resolved.replay_authority.source_forecast_point.storage_mean_mm,
        drainage_mm: resolved.replay_authority.source_forecast_point.drainage_mm,
        overflow_mm: resolved.replay_authority.source_forecast_point.saturation_overflow_mm,
        excess_above_field_capacity_mm: resolved.case_source.excess_above_field_capacity_mm,
        saturation_minus_field_capacity_mm: resolved.case_source.saturation_minus_field_capacity_mm,
        positive_excess: parseFixedDecimalV1(
          resolved.case_source.excess_above_field_capacity_mm,
          6,
        ) > 0n,
      });
    }
    const result = {
      schema_version: "geox_mcft_cap08_s5_case_excitation_diagnostic_v1",
      status: "DIAGNOSTIC_ONLY",
      case_count: cases.length,
      positive_excess_count: cases.filter((item) => item.positive_excess).length,
      non_positive_excess_count: cases.filter((item) => !item.positive_excess).length,
      non_positive_cases: cases.filter((item) => !item.positive_excess),
      cases,
      candidate_created: false,
      shadow_created: false,
      s5_effective: false,
      final_formal_run_id: null,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
