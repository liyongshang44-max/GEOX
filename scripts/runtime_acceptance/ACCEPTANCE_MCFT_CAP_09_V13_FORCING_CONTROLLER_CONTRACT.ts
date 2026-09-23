import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1,
  decideExternalFormalForcingSupplyV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_supply_controller_v1.js";
import type { ExternalFormalForcingBaseCursorSnapshotV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";

const OUT = path.resolve(process.cwd(), "acceptance-output/MCFT_CAP_09_V13_FORCING_CONTROLLER_CONTRACT_RESULT.json");

const budget: FormalForcingAcquisitionBudgetAdjudicationV1 = {
  authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  status: "PASS",
  real_sample_count: 3,
  controlled_delay_case_count: 6,
  maximum_real_end_to_end_ms: 1_800_000,
  maximum_controlled_end_to_end_ms: 2_100_000,
  measured_envelope_ms: 2_100_000,
  selected_budget_ms: 2_700_000,
  safety_margin_ms: 600_000,
  hardcoded_default_budget_minutes: null,
  selection_basis: "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN",
};

function cursor(next: string | null, completed = false): ExternalFormalForcingBaseCursorSnapshotV1 {
  return {
    cursor_id: "FORMAL_FORCING_BASE_CONTINUITY_CURSOR_V1",
    scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      season_id: "seasonA",
      zone_id: "zoneA",
    },
    epoch_id: "v13-controller-contract",
    subject_sha: "a".repeat(40),
    first_required_base: "2026-08-26T01:00:00.000Z",
    last_required_base: "2026-08-26T23:00:00.000Z",
    last_contiguous_eligible_base: completed ? "2026-08-26T23:00:00.000Z" : "2026-08-26T10:00:00.000Z",
    next_missing_required_base: next,
    completed,
  };
}

function main(): void {
  const base = "2026-08-26T11:00:00.000Z";
  const acquire = decideExternalFormalForcingSupplyV1({
    cursor: cursor(base),
    database_now: "2026-08-26T09:42:00.000Z",
    qualified_budget: budget,
  });
  assert.equal(acquire.status, "ACQUIRE_NEXT_MISSING_BASE");
  if (acquire.status !== "ACQUIRE_NEXT_MISSING_BASE") throw new Error("V13_CONTROLLER_ACQUIRE_REQUIRED");
  assert.equal(acquire.base_target_t, base);
  assert.equal(acquire.acquisition_start_deadline, "2026-08-26T10:15:00.000Z");
  assert.equal(acquire.wall_clock_rounding_target_used, false);
  assert.equal(acquire.arbitrary_future_base_skip_allowed, false);

  // A delayed wake after the qualified acquisition-start deadline must fail on the
  // same required base. It must never silently ceil/roll from 11:00 to 12:00.
  const late = decideExternalFormalForcingSupplyV1({
    cursor: cursor(base),
    database_now: "2026-08-26T10:16:00.000Z",
    qualified_budget: budget,
  });
  assert.equal(late.status, "TERMINAL_LATE_WAKE");
  if (late.status !== "TERMINAL_LATE_WAKE") throw new Error("V13_CONTROLLER_LATE_WAKE_REQUIRED");
  assert.equal(late.base_target_t, base);
  assert.equal(late.failure_class, MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1);
  assert.notEqual(late.base_target_t, "2026-08-26T12:00:00.000Z");

  const afterBase = decideExternalFormalForcingSupplyV1({
    cursor: cursor(base),
    database_now: "2026-08-26T11:00:00.000Z",
    qualified_budget: budget,
  });
  assert.equal(afterBase.status, "TERMINAL_LATE_WAKE");
  if (afterBase.status !== "TERMINAL_LATE_WAKE") throw new Error("V13_CONTROLLER_BASE_DEADLINE_REQUIRED");
  assert.equal(afterBase.failure_class, "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED");
  assert.equal(afterBase.base_target_t, base);

  const advanced = decideExternalFormalForcingSupplyV1({
    cursor: {
      ...cursor("2026-08-26T12:00:00.000Z"),
      last_contiguous_eligible_base: base,
    },
    database_now: "2026-08-26T10:20:00.000Z",
    qualified_budget: budget,
  });
  assert.equal(advanced.status, "ACQUIRE_NEXT_MISSING_BASE");
  if (advanced.status !== "ACQUIRE_NEXT_MISSING_BASE") throw new Error("V13_CONTROLLER_ADVANCED_CURSOR_REQUIRED");
  assert.equal(advanced.base_target_t, "2026-08-26T12:00:00.000Z");

  const done = decideExternalFormalForcingSupplyV1({
    cursor: cursor(null, true),
    database_now: "2026-08-27T00:00:00.000Z",
    qualified_budget: budget,
  });
  assert.equal(done.status, "NO_WORK");

  assert.throws(
    () => decideExternalFormalForcingSupplyV1({
      cursor: cursor(base),
      database_now: "2026-08-26T09:42:00.000Z",
      qualified_budget: { ...budget, hardcoded_default_budget_minutes: 35 } as FormalForcingAcquisitionBudgetAdjudicationV1,
    }),
    /FORMAL_FORCING_CONTROLLER_HARDCODED_DEFAULT_BUDGET_FORBIDDEN/,
  );

  const result = {
    status: "PASS",
    acceptance_mode: "V13_CURSOR_DRIVEN_FORCING_CONTROLLER_CONTRACT",
    next_missing_required_base_is_only_target_authority: true,
    wall_clock_now_plus_lead_rounding_removed_from_controller: true,
    delayed_wake_cannot_skip_required_base: true,
    acquisition_start_deadline_fail_closed: true,
    physical_visibility_deadline_fail_closed: true,
    qualified_budget_required: true,
    hardcoded_35_minute_budget_authorized: false,
    production_workflow_effect: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}

main();
