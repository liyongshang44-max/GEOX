#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const {
  DEVELOPMENT_MODE_V1,
  validateExactPathAuthorityV1,
} = require('./execution_authority_gate_v1.cjs');
const { validatePortBundleV1, validateCreatedPortsV1 } = require('./workflow_port_bundle_contract_v1.cjs');
const { readExactReceiptObjectsV1 } = require('../mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs');
const { executeCompleteCap07ReadbackV1 } = require('../mcft_cap08_s6_single_run_db/cap07_readback_execution_adapter_v1.cjs');
const { digest } = require('../mcft_cap08_s6_single_run_ports/shared_v1.cjs');

const ROOT = path.resolve(__dirname, '../../..');

function comparableReadbackV1(readback) {
  return readback.objects.map(object => ({
    object_id: object.object_id,
    object_type: object.object_type,
    determinism_hash: object.determinism_hash,
    tenant_id: object.tenant_id,
    project_id: object.project_id,
    group_id: object.group_id,
    field_id: object.field_id,
    season_id: object.season_id,
    zone_id: object.zone_id,
  }));
}

async function main() {
  const exactSubjectSha = String(process.env.MCFT_CAP08_EXACT_SUBJECT_SHA || '').trim();
  const runLabel = String(process.env.MCFT_CAP08_RUN_LABEL || '').trim();
  const operationalRunInstanceId = String(process.env.MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID || '').trim();
  const authorityPath = String(process.env.MCFT_CAP08_NORMALIZED_EXECUTION_AUTHORITY || '').trim();
  const bundlePath = String(process.env.MCFT_CAP08_REHEARSAL_BUNDLE || '').trim();
  const outputPath = String(process.env.MCFT_CAP08_RESTART_READBACK_OUTPUT || '').trim();
  assert.ok(authorityPath && bundlePath && outputPath, 'RESTART_READBACK_PATHS_REQUIRED');

  const authority = JSON.parse(fs.readFileSync(path.resolve(authorityPath), 'utf8'));
  const validated = validateExactPathAuthorityV1(authority, {
    exactSubjectSha,
    runLabel,
    operationalRunInstanceId,
  });
  assert.equal(validated.execution_mode, DEVELOPMENT_MODE_V1, 'RESTART_DEVELOPMENT_AUTHORITY_REQUIRED');
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), exactSubjectSha);
  assert.equal(execFileSync('git', ['rev-parse', `HEAD:${validated.module_path}`], { cwd: ROOT, encoding: 'utf8' }).trim(), authority.port_bundle_blob_sha);

  const bundle = JSON.parse(fs.readFileSync(path.resolve(bundlePath), 'utf8'));
  assert.equal(bundle.classification, 'DEVELOPMENT_REHEARSAL');
  assert.equal(bundle.evidence_class, 'NON_FORMAL');
  assert.equal(bundle.spec.exact_subject_sha, exactSubjectSha);
  assert.equal(bundle.spec.run_label, runLabel);
  assert.equal(bundle.spec.operational_run_instance_id, operationalRunInstanceId);

  const imported = require(path.join(ROOT, validated.module_path));
  const createPortsV1 = validatePortBundleV1(imported);
  const ports = validateCreatedPortsV1(await createPortsV1({
    root: ROOT,
    authority,
    exactSubjectSha,
    runLabel,
    operationalRunInstanceId,
  }));
  const adminPool = new Pool({ connectionString: String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || ''), max: 1 });
  const before = Number((await adminPool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n);
  const readback = await readExactReceiptObjectsV1(ports.closureReader, bundle.spec, bundle.receipt_manifest);
  const cap07 = await executeCompleteCap07ReadbackV1(ports.cap07Reader, bundle.spec, authority);
  const after = Number((await adminPool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n);
  assert.equal(after, before, 'RESTART_READBACK_CANONICAL_WRITE_DELTA');
  assert.equal(readback.object_count, 153);
  assert.equal(cap07.product_read_write_delta, 0);
  assert.equal(
    digest(comparableReadbackV1(readback)),
    digest(comparableReadbackV1(bundle.readback)),
    'RESTART_READBACK_SEMANTIC_DRIFT',
  );

  const result = {
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_restart_readback_result_v1',
    status: 'PASS',
    evidence_class: 'NON_FORMAL',
    exact_subject_sha: exactSubjectSha,
    run_label: runLabel,
    rehearsal_run_label: authority.rehearsal_run_label,
    operational_run_instance_id: operationalRunInstanceId,
    logical_database_identity: authority.logical_database_identity.identity_id,
    physical_database_name: bundle.fresh_database.database_name,
    fresh_process_module_reload: true,
    fresh_database_connections: true,
    exact_receipt_readback_count: readback.object_count,
    cap07_surface_count: cap07.surface_definition_count,
    cap07_request_variant_count: cap07.request_variant_count,
    canonical_write_delta: after - before,
    semantic_readback_digest: digest(comparableReadbackV1(readback)),
    hard_acceptance_eligible: false,
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
  await adminPool.end();
  console.log(JSON.stringify(result, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
