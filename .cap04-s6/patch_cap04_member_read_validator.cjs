// .cap04-s6/patch_cap04_member_read_validator.cjs
// Purpose: export the CAP-04 semantic envelope validator and use it for individual CAP-04 State/checkpoint/tick PostgreSQL reads.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');

const validatorFile = 'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.ts';
let validator = fs.readFileSync(validatorFile, 'utf8');
validator = validator.replace(
  'function validateBaseEnvelopeV1(member: CanonicalObjectEnvelopeV1): void {',
  'export function validateCap04CanonicalEnvelopeV1(member: CanonicalObjectEnvelopeV1): void {',
);
validator = validator.replaceAll('validateBaseEnvelopeV1(', 'validateCap04CanonicalEnvelopeV1(');
if (!validator.includes('export function validateCap04CanonicalEnvelopeV1(')) {
  throw new Error('S6_CAP04_MEMBER_VALIDATOR_EXPORT_FAILED');
}
fs.writeFileSync(validatorFile, validator, 'utf8');

const repositoryFile = 'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts';
let repository = fs.readFileSync(repositoryFile, 'utf8');
const importMarker = 'import { validateContinuationMemberV1 } from "../../domain/twin_runtime/continuation_contracts_v1.js";\n';
const validatorImport = `${importMarker}import { validateCap04CanonicalEnvelopeV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";\n`;
if (!repository.includes('validateCap04CanonicalEnvelopeV1')) {
  if (!repository.includes(importMarker)) throw new Error('S6_CAP04_MEMBER_VALIDATOR_IMPORT_MARKER_NOT_FOUND');
  repository = repository.replace(importMarker, validatorImport);
}
repository = repository.replace(
  '  if (isCap04ContinuationReadObjectV1(object)) validateCanonicalObjectV1(object);',
  '  if (isCap04ContinuationReadObjectV1(object)) validateCap04CanonicalEnvelopeV1(object);',
);
if (!repository.includes('if (isCap04ContinuationReadObjectV1(object)) validateCap04CanonicalEnvelopeV1(object);')) {
  throw new Error('S6_CAP04_MEMBER_VALIDATOR_ROUTE_FAILED');
}
fs.writeFileSync(repositoryFile, repository, 'utf8');

console.log('patched CAP-04 individual member read validation');
