'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RUN_ID_PLACEHOLDER_V1 = '<github_run_id>';

function materializePhysicalDatabaseNameV1(authority, githubRunId) {
  assert.equal(
    authority?.record_status,
    'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED',
    'DATABASE_IDENTITY_AUTHORITY_REQUIRED',
  );
  const identity = authority.logical_database_identity;
  assert.ok(identity && typeof identity === 'object', 'LOGICAL_DATABASE_IDENTITY_REQUIRED');
  assert.equal(identity.identity_frozen, true, 'LOGICAL_DATABASE_IDENTITY_NOT_FROZEN');
  assert.equal(identity.reusable, false, 'LOGICAL_DATABASE_IDENTITY_REUSABLE');
  const template = String(identity.physical_name_template ?? '');
  assert.equal(
    template.split(RUN_ID_PLACEHOLDER_V1).length - 1,
    1,
    'PHYSICAL_DATABASE_TEMPLATE_PLACEHOLDER',
  );
  const runId = String(githubRunId ?? '').trim();
  assert.match(runId, /^[1-9][0-9]*$/, 'GITHUB_RUN_ID_REQUIRED');
  const databaseName = template.replace(RUN_ID_PLACEHOLDER_V1, runId);
  assert.match(databaseName, /^[a-z][a-z0-9_]{0,62}$/, 'PHYSICAL_DATABASE_NAME_CONTRACT');
  return databaseName;
}

function main() {
  const authorityPath = String(process.env.MCFT_CAP08_NORMALIZED_EXECUTION_AUTHORITY ?? '').trim();
  const githubEnv = String(process.env.GITHUB_ENV ?? '').trim();
  assert.ok(authorityPath, 'NORMALIZED_EXECUTION_AUTHORITY_REQUIRED');
  assert.ok(githubEnv, 'GITHUB_ENV_REQUIRED');
  const authority = JSON.parse(fs.readFileSync(path.resolve(authorityPath), 'utf8'));
  const databaseName = materializePhysicalDatabaseNameV1(authority, process.env.GITHUB_RUN_ID);
  fs.appendFileSync(githubEnv, `MCFT_CAP08_DB_NAME=${databaseName}\n`);
  console.log(JSON.stringify({
    status: 'PASS',
    logical_database_identity: authority.logical_database_identity.identity_id,
    physical_database_name: databaseName,
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  RUN_ID_PLACEHOLDER_V1,
  materializePhysicalDatabaseNameV1,
};
