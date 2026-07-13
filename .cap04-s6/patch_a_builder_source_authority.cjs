// .cap04-s6/patch_a_builder_source_authority.cjs
// Purpose: allow Forecast input to be bound to either the validated source template State or its deterministic canonical remap.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const oldPrecheck = `  const sourceState = input.source_members.twin_state_estimate_v1;\n  if (input.forecast_payload.source_posterior_ref !== sourceState.object_id\n    || input.forecast_payload.source_posterior_hash !== sourceState.determinism_hash) {\n    throw new Error("CAP04_BUILDER_FORECAST_SOURCE_STATE_MISMATCH");\n  }\n\n`;
if (text.includes(oldPrecheck)) text = text.replace(oldPrecheck, '  const sourceState = input.source_members.twin_state_estimate_v1;\n\n');
const marker = `  const state = firstFour.find((member) => member.object_type === "twin_state_estimate_v1");\n  if (!state) throw new Error("CAP04_BUILDER_POSTERIOR_STATE_MEMBER_MISSING");\n\n  const forecastPayload: Cap04ForecastRunPayloadV1 = {`;
const replacement = `  const state = firstFour.find((member) => member.object_type === "twin_state_estimate_v1");\n  if (!state) throw new Error("CAP04_BUILDER_POSTERIOR_STATE_MEMBER_MISSING");\n  const boundToSourceTemplate = input.forecast_payload.source_posterior_ref === sourceState.object_id\n    && input.forecast_payload.source_posterior_hash === sourceState.determinism_hash;\n  const boundToCanonicalState = input.forecast_payload.source_posterior_ref === state.object_id\n    && input.forecast_payload.source_posterior_hash === state.determinism_hash;\n  if (!boundToSourceTemplate && !boundToCanonicalState) {\n    throw new Error("CAP04_BUILDER_FORECAST_SOURCE_STATE_MISMATCH");\n  }\n\n  const forecastPayload: Cap04ForecastRunPayloadV1 = {`;
if (!text.includes(replacement)) {
  if (!text.includes(marker)) throw new Error('S6_A_BUILDER_SOURCE_AUTHORITY_MARKER_NOT_FOUND');
  text = text.replace(marker, replacement);
}
fs.writeFileSync(file, text, 'utf8');
console.log('patched A-builder Forecast source-State authority');
