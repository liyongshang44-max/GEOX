// .cap04-s6/patch_cap04_forecast_read_classification.cjs
// Purpose: classify CAP-04 Forecast envelopes for the dedicated CAP-04 semantic validator during next-tick PostgreSQL reads.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const marker = `  if (object.object_type === "twin_runtime_checkpoint_v1") {`;
const forecastBlock = `  if (object.object_type === "twin_forecast_run_v1") {\n    return payload.record_set_contract_id === "MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1"\n      || payload.record_set_contract_id === "MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1"\n      || (payload.status === "COMPLETED"\n        && payload.scenario_eligible === true\n        && Array.isArray(payload.points)\n        && payload.points.length === 72);\n  }\n`;
if (!text.includes('MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1')) {
  if (!text.includes(marker)) throw new Error('S6_CAP04_FORECAST_CLASSIFICATION_MARKER_NOT_FOUND');
  text = text.replace(marker, `${forecastBlock}${marker}`);
  fs.writeFileSync(file, text, 'utf8');
  console.log('patched CAP-04 Forecast read classification');
} else {
  console.log('CAP-04 Forecast read classification already patched');
}
