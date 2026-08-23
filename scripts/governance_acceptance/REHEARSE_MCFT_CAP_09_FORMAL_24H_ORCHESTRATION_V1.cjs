#!/usr/bin/env node
"use strict";

function iso(ms) { return new Date(ms).toISOString(); }
function addHours(t, h) { return iso(Date.parse(t) + h * 3600000); }
function need(ok, code) { if (!ok) throw new Error(code); }

const a0 = "2030-01-01T00:00:00.000Z";
const o00 = addHours(a0, 1);
const o23 = addHours(a0, 24);

const rollingBases = Array.from({ length: 23 }, (_, i) => addHours(a0, i));
const forcingTargets = rollingBases.map((base) => addHours(base, 1));
const expectedTargets = Array.from({ length: 23 }, (_, i) => addHours(o00, i));
need(JSON.stringify(forcingTargets) === JSON.stringify(expectedTargets), "MCFT_CAP09_REHEARSAL_ROLLING_TO_FORCING_MAPPING_DRIFT");
need(forcingTargets[0] === o00, "MCFT_CAP09_REHEARSAL_A0_TO_O00_REQUIRED");
need(forcingTargets[22] === addHours(o00, 22), "MCFT_CAP09_REHEARSAL_O22_TO_O23_PREP_REQUIRED");

const runtimeSlots = Array.from({ length: 24 }, (_, i) => ({
  slot_id: `O${String(i).padStart(2, "0")}`,
  logical_time: addHours(o00, i),
  base_time: addHours(a0, i),
  forcing_mode_candidates: ["EXACT_PROVIDER_INTERVAL_PAIR", "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"],
}));
need(runtimeSlots[0].logical_time === o00, "MCFT_CAP09_REHEARSAL_O00_REQUIRED");
need(runtimeSlots[23].logical_time === o23, "MCFT_CAP09_REHEARSAL_O23_REQUIRED");
for (let i = 0; i < runtimeSlots.length; i++) {
  need(runtimeSlots[i].slot_id === `O${String(i).padStart(2, "0")}`, `MCFT_CAP09_REHEARSAL_SLOT_ID_DRIFT:${i}`);
  need(runtimeSlots[i].base_time === addHours(a0, i), `MCFT_CAP09_REHEARSAL_BASE_MAPPING_DRIFT:${i}`);
  need(runtimeSlots[i].logical_time === addHours(runtimeSlots[i].base_time, 1), `MCFT_CAP09_REHEARSAL_NEXT_SLOT_MAPPING_DRIFT:${i}`);
}

const orchestration = [
  { phase: "ROLLING_A0", base: a0, prepares: o00 },
  { phase: "A0_BOOTSTRAP", logical_time: a0 },
  ...runtimeSlots.map((s, i) => ({ phase: "RUNTIME", slot_id: s.slot_id, logical_time: s.logical_time, requires_base: s.base_time, hourly_promotion_required_before_next_slot: i < 23 })),
  { phase: "FINAL_READBACK", earliest_time: o23, required_base_snapshots: 24, required_hourly_promotions_after_a0: 23, required_terminal_ticks: 24 },
];

const promotionEdges = runtimeSlots.slice(0, 23).map((slot, i) => ({
  completed_slot: slot.slot_id,
  completed_logical_time: slot.logical_time,
  rolling_base: slot.logical_time,
  prepares_next_slot: runtimeSlots[i + 1].slot_id,
  prepares_next_logical_time: runtimeSlots[i + 1].logical_time,
}));
for (const edge of promotionEdges) need(addHours(edge.rolling_base, 1) === edge.prepares_next_logical_time, `MCFT_CAP09_REHEARSAL_PROMOTION_EDGE_DRIFT:${edge.completed_slot}`);

need(promotionEdges.length === 23, "MCFT_CAP09_REHEARSAL_EXACT_23_PROMOTIONS_REQUIRED");
need(runtimeSlots.length === 24, "MCFT_CAP09_REHEARSAL_EXACT_24_RUNTIME_SLOTS_REQUIRED");
need(orchestration.at(-1).required_base_snapshots === 24, "MCFT_CAP09_REHEARSAL_FINAL_24_BASES_REQUIRED");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_formal_24h_orchestration_rehearsal_v1",
  status: "PASS",
  simulation_only: true,
  provider_access: false,
  database_access: false,
  formal_database_write_count: 0,
  formal_completion_claimed: false,
  a0,
  o00,
  o23,
  rolling_to_runtime_edges: 23,
  runtime_slot_count: 24,
  hourly_promotion_count: 23,
  final_readback_required: true,
  forcing_modes: ["EXACT_PROVIDER_INTERVAL_PAIR", "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"],
  orchestration,
}));
