// .cap04-s6/patch_source_time_authority.cjs
// Purpose: keep source-member time authority on the Evidence Window because HourlyWaterBalanceResultV1 does not carry interval timestamps.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const oldText = '  if (input.dynamics.interval_end_inclusive !== logicalTime) throw new Error("CAP04_SOURCE_DYNAMICS_TIME_MISMATCH");\n';
if (text.includes(oldText)) {
  text = text.replace(oldText, '');
  fs.writeFileSync(file, text, 'utf8');
  console.log('removed non-existent Dynamics interval authority');
} else {
  console.log('Dynamics interval authority already aligned');
}
