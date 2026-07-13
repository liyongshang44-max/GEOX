// .cap04-s6/patch_scenario_builder_canonical_compare.cjs
// Purpose: compare Forecast payload semantics canonically after PostgreSQL jsonb readback.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const importMarker = 'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";\n';
const canonicalImport = `${importMarker}import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";\n`;
if (!text.includes('canonicalJsonV1')) {
  if (!text.includes(importMarker)) throw new Error('S6_SCENARIO_CANONICAL_IMPORT_MARKER_NOT_FOUND');
  text = text.replace(importMarker, canonicalImport);
}
const oldCompare = '  if (JSON.stringify(math.source_forecast_payload) !== JSON.stringify(payload)) {';
const newCompare = '  if (canonicalJsonV1(math.source_forecast_payload) !== canonicalJsonV1(payload)) {';
if (!text.includes(newCompare)) {
  if (!text.includes(oldCompare)) throw new Error('S6_SCENARIO_CANONICAL_COMPARE_MARKER_NOT_FOUND');
  text = text.replace(oldCompare, newCompare);
}
fs.writeFileSync(file, text, 'utf8');
console.log('patched Scenario builder canonical Forecast payload comparison');
