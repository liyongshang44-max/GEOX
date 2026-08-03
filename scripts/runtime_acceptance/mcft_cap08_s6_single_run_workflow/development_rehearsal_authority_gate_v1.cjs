#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateDevelopmentRehearsalAuthorityV1 } = require('./execution_authority_gate_v1.cjs');

function main() {
  const authorityPath = String(process.env.MCFT_CAP08_DEVELOPMENT_AUTHORITY_PATH || '').trim();
  const exactSubjectSha = String(process.env.MCFT_CAP08_EXACT_SUBJECT_SHA || '').trim();
  const runLabel = String(process.env.MCFT_CAP08_RUN_LABEL || '').trim();
  const operationalRunInstanceId = String(process.env.MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID || '').trim();
  const outputPath = String(process.env.MCFT_CAP08_NORMALIZED_EXECUTION_AUTHORITY || '').trim();
  assert.ok(authorityPath, 'DEVELOPMENT_AUTHORITY_PATH_REQUIRED');
  assert.ok(outputPath, 'NORMALIZED_AUTHORITY_OUTPUT_REQUIRED');
  const authority = JSON.parse(fs.readFileSync(path.resolve(authorityPath), 'utf8'));
  const result = validateDevelopmentRehearsalAuthorityV1(authority, {
    exactSubjectSha,
    runLabel,
    operationalRunInstanceId,
  });
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result.authority, null, 2)}\n`);
  console.log(JSON.stringify({
    status: 'AUTHORIZED_DEVELOPMENT_REHEARSAL',
    execution_mode: result.execution_mode,
    evidence_class: result.evidence_class,
    authority_digest: result.authority_digest,
  }, null, 2));
}

if (require.main === module) main();
