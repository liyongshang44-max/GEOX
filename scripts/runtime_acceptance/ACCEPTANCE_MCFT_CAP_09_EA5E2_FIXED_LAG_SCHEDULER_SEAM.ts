import assert from "node:assert/strict";

import {
  FixedLagSchedulerAdapterV1,
  createExternalFormalFixedLagSchedulerAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.js";
import type {
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineTerminalSlotResultV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const SCOPE: TwinScopeKeyV1 = {
  tenant_id: "tenant_external_research_v1",
  project_id: "project_kbs_lter_v1",
  group_id: "group_kbs_lter_v1",
  field_id: "field_kbs_lter_main_v1",
  season_id: "season_2026_corn_v1",
  zone_id: "zone_kbs_lter_main_v1",
};

class FakeSchedulerV1 implements SchedulerPortV1 {
  listThrough: string | null = null;
  claimed: ShadowOnlineBoundaryV1 | null = null;

  async claimDueSlot(input: { boundary: ShadowOnlineBoundaryV1; lease_owner: string; lease_duration_seconds: number }): Promise<ShadowOnlineSlotClaimV1> {
    this.claimed = input.boundary;
    return { boundary: input.boundary, lease_owner: input.lease_owner, fencing_token: 1n, state: "CLAIMED", idempotency_key: "fake" };
  }

  async listMissedSlots(input: { scope: TwinScopeKeyV1; through_logical_time: string }): Promise<readonly ShadowOnlineBoundaryV1[]> {
    this.listThrough = input.through_logical_time;
    return [{
      scope: input.scope,
      slot_id: "O00",
      logical_time: "2026-08-11T17:00:00.000Z",
      scheduler_wall_clock_observed_at: input.through_logical_time,
      interval_seconds: 3600,
    }];
  }

  async recordTerminalResult(_input: { claim: ShadowOnlineSlotClaimV1; result: ShadowOnlineTerminalSlotResultV1 }): Promise<void> {}
}

async function main(): Promise<void> {
  const now = () => new Date("2026-08-12T00:17:00.000Z");

  const historicalInner = new FakeSchedulerV1();
  const historical = new FixedLagSchedulerAdapterV1(historicalInner, { now });
  const historicalRows = await historical.listMissedSlots({ scope: SCOPE, through_logical_time: "2026-08-12T00:00:00.000Z" });
  assert.equal(historicalInner.listThrough, "2026-08-12T00:00:00.000Z", "DEFAULT_ZERO_LAG_MUST_BE_PRESERVED");
  assert.equal(historicalRows[0].scheduler_wall_clock_observed_at, "2026-08-12T00:17:00.000Z");

  const externalInner = new FakeSchedulerV1();
  const external = createExternalFormalFixedLagSchedulerAdapterV1(externalInner, now);
  const externalRows = await external.listMissedSlots({ scope: SCOPE, through_logical_time: "2026-08-12T00:00:00.000Z" });
  assert.equal(externalInner.listThrough, "2026-08-11T17:00:00.000Z", "EXTERNAL_FORMAL_LIST_MUST_CLAMP_TO_NOW_MINUS_7H");
  assert.equal(externalRows[0].scheduler_wall_clock_observed_at, "2026-08-12T00:17:00.000Z");

  await assert.rejects(
    () => external.claimDueSlot({
      boundary: {
        scope: SCOPE,
        slot_id: "O00",
        logical_time: "2026-08-11T17:00:00.000Z",
        scheduler_wall_clock_observed_at: "2026-08-11T23:59:59.999Z",
        interval_seconds: 3600,
      },
      lease_owner: "owner",
      lease_duration_seconds: 300,
    }),
    /FIXED_LAG_BOUNDARY_NOT_YET_ELIGIBLE/,
  );
  assert.equal(externalInner.claimed, null, "EARLY_CLAIM_MUST_NOT_REACH_INNER_SCHEDULER");

  const claim = await external.claimDueSlot({
    boundary: externalRows[0],
    lease_owner: "owner",
    lease_duration_seconds: 300,
  });
  assert.equal(claim.boundary.logical_time, "2026-08-11T17:00:00.000Z");
  assert.equal(externalInner.claimed?.logical_time, "2026-08-11T17:00:00.000Z");

  console.log(JSON.stringify({
    status: "PASS",
    default_lag_hours: 0,
    external_formal_lag_hours: 7,
    early_claim_rejected: true,
    external_eligible_through: externalInner.listThrough,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
