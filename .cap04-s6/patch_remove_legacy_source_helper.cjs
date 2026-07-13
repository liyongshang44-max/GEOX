// .cap04-s6/patch_remove_legacy_source_helper.cjs
// Purpose: remove the obsolete CAP-03 record-set extraction helper after S6 adopted the dedicated CAP-04 source-member builder.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts';
let text = fs.readFileSync(file, 'utf8');
const start = text.indexOf('function sourceMembersV1(');
if (start >= 0) {
  const endMarker = '\nfunction executionCandidatesV1(';
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error('S6_LEGACY_SOURCE_HELPER_END_NOT_FOUND');
  text = `${text.slice(0, start)}${text.slice(end + 1)}`;
  fs.writeFileSync(file, text, 'utf8');
  console.log('removed obsolete sourceMembersV1 helper');
} else {
  console.log('obsolete sourceMembersV1 helper already removed');
}
