// .cap04-s5b/fix_canonical_scenario_equality.cjs
// Purpose: replace order-sensitive JSON serialization equality with canonical JSON equality for NO_ACTION persistence readback, then self-delete.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts';
let text = fs.readFileSync(file, 'utf8');

const importMarker = 'import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";';
const importReplacement = `import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import { canonicalJsonV1 } from "./canonical_json_v1.js";`;
if (!text.includes(importMarker)) throw new Error('S5B_CANONICAL_JSON_IMPORT_MARKER_NOT_FOUND');
text = text.replace(importMarker, importReplacement);

const equalityMarker = '    if (JSON.stringify(option.trajectory_points) !== JSON.stringify(sourceForecast.points)) throw new Error("CAP04_NO_ACTION_TRAJECTORY_NOT_DEEP_COPY_EQUIVALENT");';
const equalityReplacement = '    if (canonicalJsonV1(option.trajectory_points) !== canonicalJsonV1(sourceForecast.points)) throw new Error("CAP04_NO_ACTION_TRAJECTORY_NOT_DEEP_COPY_EQUIVALENT");';
if (!text.includes(equalityMarker)) throw new Error('S5B_NO_ACTION_EQUALITY_MARKER_NOT_FOUND');
text = text.replace(equalityMarker, equalityReplacement);

fs.writeFileSync(file, text, 'utf8');
fs.unlinkSync(__filename);
console.log('applied canonical Scenario equality fix');
