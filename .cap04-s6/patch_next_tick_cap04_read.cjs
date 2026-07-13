// .cap04-s6/patch_next_tick_cap04_read.cjs
// Purpose: route CAP-04 continuation-shaped State/checkpoint/tick objects through canonical validation instead of the historical CAP-02 continuation validator.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const marker = `function isContinuationReadObjectV1(object: CanonicalObjectEnvelopeV1): boolean {`;
const helper = `function isCap04ContinuationReadObjectV1(object: CanonicalObjectEnvelopeV1): boolean {\n  const payload = object.payload;\n  if (object.object_type === "twin_runtime_tick_v1") {\n    return payload.operation_variant === "A1_COMPLETED_FORECAST"\n      || payload.operation_variant === "A2_BLOCKED_FORECAST"\n      || (typeof payload.record_set_contract_id === "string"\n        && payload.record_set_contract_id.startsWith("MCFT_CAP_04_"));\n  }\n  if (object.object_type === "twin_runtime_checkpoint_v1") {\n    return typeof payload.successful_forecast_ref === "string"\n      && payload.successful_forecast_ref.length > 0;\n  }\n  if (object.object_type === "twin_state_estimate_v1") {\n    const basis = payload.computation_basis;\n    return Boolean(basis && typeof basis === "object" && !Array.isArray(basis)\n      && (basis as Record<string, unknown>).basis_origin === "CAP04_CURRENT_TICK_ASSIMILATED_POSTERIOR");\n  }\n  return false;\n}\n\n${marker}`;
if (!text.includes('function isCap04ContinuationReadObjectV1(')) {
  if (!text.includes(marker)) throw new Error('S6_NEXT_TICK_CAP04_HELPER_MARKER_NOT_FOUND');
  text = text.replace(marker, helper);
}
const oldParse = `  if (isAssimilatedContinuationTickV1(object)) validateCanonicalObjectV1(object);\n  else if (isContinuationReadObjectV1(object)) validateContinuationMemberV1(object);\n  else validateCanonicalObjectV1(object);`;
const newParse = `  if (isCap04ContinuationReadObjectV1(object)) validateCanonicalObjectV1(object);\n  else if (isAssimilatedContinuationTickV1(object)) validateCanonicalObjectV1(object);\n  else if (isContinuationReadObjectV1(object)) validateContinuationMemberV1(object);\n  else validateCanonicalObjectV1(object);`;
if (!text.includes(newParse)) {
  if (!text.includes(oldParse)) throw new Error('S6_NEXT_TICK_CAP04_PARSE_MARKER_NOT_FOUND');
  text = text.replace(oldParse, newParse);
}
fs.writeFileSync(file, text, 'utf8');
console.log('patched CAP-04 next-tick canonical read classification');
