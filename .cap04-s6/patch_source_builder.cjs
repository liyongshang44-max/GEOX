// .cap04-s6/patch_source_builder.cjs
// Purpose: replace CAP-03 record-set construction with the dedicated CAP-04 State source-member builder.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts';
let text = fs.readFileSync(file, 'utf8');

function replaceOnce(oldText, newText, marker) {
  if (text.includes(newText)) return;
  if (!text.includes(oldText)) throw new Error(`S6_SOURCE_BUILDER_PATCH_MARKER_NOT_FOUND:${marker}`);
  text = text.replace(oldText, newText);
}

replaceOnce(
  'import { buildAssimilatedContinuationRecordSetV2 } from "./assimilated_continuation_record_set_builder_v2.js";',
  'import { buildCap04StateSourceMembersV1 } from "./forecast_scenario_state_source_builder_v1.js";',
  'import',
);
replaceOnce(
  `import {\n  buildCap04CompletedForecastRecordSetV1,\n  type Cap04ARecordSetBuilderSourceMembersV1,\n} from "./forecast_continuation_record_set_builder_v1.js";`,
  `import { buildCap04CompletedForecastRecordSetV1 } from "./forecast_continuation_record_set_builder_v1.js";`,
  'forecast-builder-import',
);
replaceOnce(
  `function sourceMembersV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }): Cap04ARecordSetBuilderSourceMembersV1 {\n  const required = [\n    "twin_evidence_window_v1",\n    "twin_state_transition_v1",\n    "twin_assimilation_update_v1",\n    "twin_state_estimate_v1",\n  ] as const;\n  return Object.fromEntries(required.map((type) => {\n    const matches = recordSet.members.filter((member) => member.object_type === type);\n    if (matches.length !== 1) throw new Error(\`CAP04_SINGLE_TICK_SOURCE_MEMBER_CARDINALITY:\${type}\`);\n    return [type, matches[0]];\n  })) as Cap04ARecordSetBuilderSourceMembersV1;\n}\n\n`,
  '',
  'sourceMembersV1',
);
replaceOnce(
  `      const sourceCandidate = buildAssimilatedContinuationRecordSetV2({\n        scope: input.scope,\n        logical_time: logicalTime,\n        created_at: input.created_at,\n        handoff: initialHandoff,\n        previous_forecast_result_hash: requiredStringV1(initialHandoff.previous_forecast_result_hash, "CAP04_SINGLE_TICK_PREDECESSOR_FORECAST_HASH_REQUIRED"),\n        runtime_config: runtimeConfig,\n        evidence_window: evidenceWindow,\n        dynamics,\n        assimilation,\n      });\n      const sources = sourceMembersV1(sourceCandidate);`,
  `      const sources = buildCap04StateSourceMembersV1({\n        scope: input.scope,\n        logical_time: logicalTime,\n        created_at: input.created_at,\n        handoff: initialHandoff,\n        runtime_config: runtimeConfig,\n        evidence_window: evidenceWindow,\n        dynamics,\n        assimilation,\n      });`,
  'source-builder-call',
);

fs.writeFileSync(file, text, 'utf8');
console.log('patched CAP-04 State source-member builder');
