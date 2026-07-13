// .cap04-s6/patch_idempotent_pin.cjs
// Purpose: require the requested Runtime Config identity even on the completed A1+B idempotent short path.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const marker = `    if (aRecordSet) {\n      validateCap04ARecordSetV1(aRecordSet);\n      const existingForecast = memberV1(aRecordSet, "twin_forecast_run_v1");`;
const replacement = `    if (aRecordSet) {\n      validateCap04ARecordSetV1(aRecordSet);\n      if (aRecordSet.aggregate_identity_input.runtime_config_ref !== runtimeConfigRef) {\n        throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_REF_PIN_MISMATCH");\n      }\n      if (aRecordSet.aggregate_identity_input.runtime_config_hash !== runtimeConfigHash) {\n        throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH");\n      }\n      const existingForecast = memberV1(aRecordSet, "twin_forecast_run_v1");`;
if (text.includes(replacement)) {
  console.log('completed-idempotent config pin already patched');
} else {
  if (!text.includes(marker)) throw new Error('S6_COMPLETED_IDEMPOTENT_PIN_MARKER_NOT_FOUND');
  text = text.replace(marker, replacement);
  fs.writeFileSync(file, text, 'utf8');
  console.log('patched completed-idempotent config pin');
}
