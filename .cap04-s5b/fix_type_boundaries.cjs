// .cap04-s5b/fix_type_boundaries.cjs
// Purpose: apply the diagnosed CAP-04 Scenario-envelope union and optional-scope TypeScript fixes, then remove this temporary script.

'use strict';

const fs = require('node:fs');

function replace(file, oldText, newText, label) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(oldText)) throw new Error(`S5B_FIX_MARKER_NOT_FOUND:${label}`);
  text = text.replace(oldText, newText);
  fs.writeFileSync(file, text, 'utf8');
}

const repository = 'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts';
const projection = 'apps/server/src/projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.ts';

replace(
  repository,
  '  type Cap04ForecastRunPayloadV1,\n} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";',
  '  type Cap04ForecastRunPayloadV1,\n  type Cap04ScenarioSetEnvelopeV1,\n} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";',
  'scenario-envelope-import',
);
replace(
  repository,
  'function recordJsonV1(object: CanonicalObjectEnvelopeV1): string {',
  'function recordJsonV1(object: CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1): string {',
  'record-json-union',
);
replace(
  repository,
  'function parseFactObjectV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 {',
  'function parseFactObjectV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1 {',
  'parse-union',
);
replace(
  repository,
  '    return parseFactObjectV1(result.rows[0].record_json);',
  '    const object = parseFactObjectV1(result.rows[0].record_json);\n    if (object.object_type === "twin_scenario_set_v1") throw new Error("CANONICAL_OBJECT_TYPE_UNEXPECTED_SCENARIO_SET");\n    return object;',
  'canonical-reader-narrow',
);
replace(
  repository,
  '    const membersUnordered = facts.rows.map((row) => parseFactObjectV1(row.record_json));',
  '    const membersUnordered = facts.rows.map((row) => {\n      const object = parseFactObjectV1(row.record_json);\n      if (object.object_type === "twin_scenario_set_v1") throw new Error("CAP04_A_MEMBER_SCENARIO_SET_FORBIDDEN");\n      return object;\n    });',
  'a-reader-narrow',
);
replace(
  repository,
  '      scenario_set: scenarioSet as Cap04ScenarioSetRecordV1["scenario_set"],',
  '      scenario_set: scenarioSet,',
  'scenario-readback-cast',
);
replace(
  projection,
  'function scopeStringV1(value: string | null, code: string): string {',
  'function scopeStringV1(value: string | null | undefined, code: string): string {',
  'optional-scope',
);

fs.unlinkSync(__filename);
console.log('applied S5B TypeScript boundary fixes');
