'use strict';

const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createFreshDatabasePortV1 } = require('./fresh_database_v1.cjs');
const { createDirectMaterializerV1 } = require('./direct_materializer_v1.cjs');
const { createClosureReaderV1 } = require('./closure_reader_v1.cjs');
const { createRecoveryPortV1 } = require('./recovery_v1.cjs');
const { createCap07ReaderV1 } = require('./cap07_reader_v1.cjs');
const { createArtifactWriterV1 } = require('./artifact_writer_v1.cjs');

function validateFactoryAuthorityV1({
  authority,
  exactSubjectSha,
  runLabel,
  operationalRunInstanceId,
}) {
  assert.equal(
    authority?.record_status,
    'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED',
    'FORMAL_PORT_BUNDLE_AUTHORITY_REQUIRED',
  );
  assert.equal(authority.authority_class, 'FINAL_FORMAL_RUN_ONLY');
  assert.equal(
    authority.evidence_class,
    'FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS',
  );
  assert.equal(authority.exact_subject_sha, exactSubjectSha, 'FORMAL_PORT_BUNDLE_AUTHORITY_SUBJECT');
  assert.equal(authority.authorized_run_label, runLabel, 'FORMAL_PORT_BUNDLE_AUTHORITY_RUN_LABEL');
  assert.equal(
    authority.operational_run_instance_id,
    operationalRunInstanceId,
    'FORMAL_PORT_BUNDLE_AUTHORITY_INSTANCE',
  );
  assert.equal(authority.single_run_database_execution_authorized, true);
  assert.equal(authority.database_execution_workflow_authorized, true);
  assert.equal(authority.final_formal_run_execution_authorized, true);
  assert.equal(authority.logical_database_identity?.identity_frozen, true);
  assert.equal(authority.logical_database_identity?.reusable, false);
  return authority;
}

async function createPortsV1({
  root,
  authority,
  exactSubjectSha,
  runLabel,
  operationalRunInstanceId,
}) {
  validateFactoryAuthorityV1({
    authority,
    exactSubjectSha,
    runLabel,
    operationalRunInstanceId,
  });
  const databaseUrl = String(process.env.DATABASE_URL || '');
  const adminUrl = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || '');
  if (!databaseUrl || !adminUrl) throw new Error('PORT_BUNDLE_DATABASE_URLS_REQUIRED');
  const pool = new Pool({ connectionString: databaseUrl, max: 6 });
  const adminPool = new Pool({ connectionString: adminUrl, max: 4 });
  const shared = {
    receipts: [],
    selector: null,
    recovery: new Map(),
    readModel: new Map(),
  };
  return {
    freshDatabase: createFreshDatabasePortV1({ pool, adminPool, authority }),
    materializer: createDirectMaterializerV1({ root, pool, adminPool, shared, authority }),
    closureReader: createClosureReaderV1({ pool }),
    recovery: createRecoveryPortV1({ pool, adminPool, shared }),
    cap07Reader: await createCap07ReaderV1({ root, pool, shared }),
    artifactWriter: createArtifactWriterV1({ root }),
  };
}

module.exports = {
  createPortsV1,
  validateFactoryAuthorityV1,
};
