// scripts/runtime_acceptance/ACCEPTANCE_EVIDENCE_ARTIFACT_FROM_AS_EXECUTED_V1_RUNTIME.cjs
const assert = require('assert');
const { Client } = require('pg');

const baseUrl = process.env.BASE_URL || process.env.THREE_SURFACE_BASE_URL || 'http://127.0.0.1:3001';
const executorToken = process.env.GEOX_EXECUTOR_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-executor';
const approverToken = process.env.GEOX_APPROVER_ONLY_TOKEN || 'set-via-env-or-external-secret-file-approver';
const clientToken = process.env.GEOX_CLIENT_TOKEN || 'set-via-env-or-external-secret-file-client';
const prefix = 'h43_evidence_artifact_from_as_executed_acceptance_';
const runId = `${Date.now()}`;

const scope = {
  tenant_id: process.env.GEOX_TENANT_ID || 'tenantA',
  project_id: process.env.GEOX_PROJECT_ID || 'projectA',
  group_id: process.env.GEOX_GROUP_ID || 'groupA',
};

const fieldId = process.env.THREE_SURFACE_FIELD_ID || 'field_demo_001';

function requestBody(suffix, overrides = {}) {
  return {
    ...scope,
    field_id: fieldId,
    zone_id: 'zoneA',
    as_executed_id: `${prefix}asexec_${runId}_${suffix}`,
    task_id: `${prefix}task_${runId}_${suffix}`,
    receipt_id: `${prefix}receipt_${runId}_${suffix}`,
    operation_plan_id: `${prefix}op_${runId}_${suffix}`,
    operator_id: `${prefix}operator`,
    idempotency_key: `${prefix}idem_${runId}_${suffix}`,
    materialization_reason: 'materialize execution evidence pointers',
    ...overrides,
  };
}

async function postEvidenceArtifacts(token, body) {
  const response = await fetch(`${baseUrl}/api/v1/evidence-artifacts/from-as-executed`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, json };
}

async function seedAsExecuted(db, body, refs = {}) {
  const evidenceRefs = refs.evidence_refs ?? [
    { kind: 'image', ref: `s3://formal/${prefix}${runId}_${body.as_executed_id}.jpg` },
  ];
  const receiptRefs = refs.receipt_refs ?? [
    { kind: 'receipt', ref: `fact://${body.receipt_id}` },
  ];
  const logRefs = refs.log_refs ?? [
    { kind: 'log', ref: `log://${prefix}${runId}_${body.as_executed_id}` },
  ];

  await db.query(
    `INSERT INTO as_executed_record_v1 (
       as_executed_id,
       tenant_id,
       project_id,
       group_id,
       field_id,
       task_id,
       receipt_id,
       prescription_id,
       planned,
       executed,
       evidence_refs,
       receipt_refs,
       log_refs
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'{}'::jsonb,$10::jsonb,$11::jsonb,$12::jsonb)`,
    [
      body.as_executed_id,
      body.tenant_id,
      body.project_id,
      body.group_id,
      body.field_id,
      body.task_id,
      body.receipt_id,
      body.operation_plan_id,
      JSON.stringify({ operation_plan_id: body.operation_plan_id }),
      JSON.stringify(evidenceRefs),
      JSON.stringify(receiptRefs),
      JSON.stringify(logRefs),
    ],
  );
}

async function countFacts(db, type) {
  const result = await db.query(
    `SELECT count(*) AS count
       FROM facts
      WHERE record_json::jsonb->>'type' = $1
        AND record_json::text LIKE $2`,
    [type, `%${prefix}%`],
  );
  return Number(result.rows[0].count);
}

async function artifactPayloads(db) {
  const result = await db.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE record_json::jsonb->>'type' = 'evidence_artifact_v1'
        AND record_json::text LIKE $1
      ORDER BY fact_id`,
    [`%${prefix}%`],
  );
  return result.rows.map((row) => ({ fact_id: row.fact_id, payload: row.record_json.payload }));
}

async function assertRejectedByRole(token, label) {
  const response = await postEvidenceArtifacts(token, requestBody(label));
  assert(
    [401, 403].includes(response.status),
    `${label} token must be rejected, got ${JSON.stringify(response)}`,
  );
}

function assertFormalArtifactShape(artifacts) {
  assert(artifacts.some((artifact) => artifact.payload.summary.pointer_source === 'evidence_ref'));
  assert(artifacts.some((artifact) => artifact.payload.summary.pointer_source === 'receipt_ref'));
  assert(artifacts.some((artifact) => artifact.payload.summary.pointer_source === 'log_ref'));

  for (const artifact of artifacts) {
    assert.equal(artifact.payload.source, 'AS_EXECUTED_RECORD_V1');
    assert.equal(artifact.payload.source_lane, 'FORMAL_OPERATION');
    assert.equal(artifact.payload.formal_eligible, true);
    assert.equal(artifact.payload.evidence_level, 'FORMAL');
    for (const forbidden of ['success', 'failure', 'effectiveness', 'yield', 'profit']) {
      assert(!(forbidden in artifact.payload), `artifact contains ${forbidden}`);
    }
  }
}

async function assertDuplicateDoesNotCreateFacts(db, body) {
  const artifactCountBefore = await countFacts(db, 'evidence_artifact_v1');
  const submissionCountBefore = await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1');
  const duplicate = await postEvidenceArtifacts(executorToken, body);

  assert.equal(duplicate.json.status, 'REJECTED_DUPLICATE');
  assert.equal(await countFacts(db, 'evidence_artifact_v1'), artifactCountBefore);
  assert.equal(await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1'), submissionCountBefore);
}

async function assertSameArtifactPayloadIsIdempotent(db, originalBody) {
  const artifactCountBefore = await countFacts(db, 'evidence_artifact_v1');
  const submissionCountBefore = await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1');
  const response = await postEvidenceArtifacts(executorToken, {
    ...originalBody,
    idempotency_key: `${originalBody.idempotency_key}_same_payload`,
  });

  assert.equal(response.status, 200, JSON.stringify(response));
  assert.equal(response.json.status, 'EVIDENCE_ARTIFACTS_RECORDED');
  assert.equal(await countFacts(db, 'evidence_artifact_v1'), artifactCountBefore);
  assert.equal(await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1'), submissionCountBefore + 1);
}

async function assertDifferentArtifactPayloadConflicts(db, originalBody) {
  const artifacts = await artifactPayloads(db);
  const target = artifacts.find((artifact) => artifact.payload.summary.as_executed_id === originalBody.as_executed_id);
  assert(target, 'expected target artifact to mutate for conflict check');

  await db.query(
    `UPDATE facts
        SET record_json = jsonb_set(record_json::jsonb, '{payload,kind}', '"tampered_kind"'::jsonb, false)
      WHERE fact_id = $1`,
    [target.fact_id],
  );

  const artifactCountBefore = await countFacts(db, 'evidence_artifact_v1');
  const submissionCountBefore = await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1');
  const response = await postEvidenceArtifacts(executorToken, {
    ...originalBody,
    idempotency_key: `${originalBody.idempotency_key}_conflict`,
  });

  assert.equal(response.status, 409, JSON.stringify(response));
  assert.equal(response.json.status, 'REJECTED_DUPLICATE');
  assert.equal(await countFacts(db, 'evidence_artifact_v1'), artifactCountBefore);
  assert.equal(await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1'), submissionCountBefore);
}

async function assertRejectionCases(db) {
  const missing = await postEvidenceArtifacts(executorToken, requestBody('missing'));
  assert.equal(missing.json.status, 'REJECTED_AS_EXECUTED_NOT_FOUND');

  const scopeMismatchBody = requestBody('scope_mismatch');
  await seedAsExecuted(db, scopeMismatchBody);
  const scopeMismatch = await postEvidenceArtifacts(executorToken, {
    ...scopeMismatchBody,
    field_id: 'wrong_field',
  });
  assert.equal(scopeMismatch.json.status, 'REJECTED_SCOPE_MISMATCH');

  const noPointersBody = requestBody('no_pointers');
  await seedAsExecuted(db, noPointersBody, { evidence_refs: [], receipt_refs: [], log_refs: [] });
  const noPointers = await postEvidenceArtifacts(executorToken, noPointersBody);
  assert.equal(noPointers.json.status, 'REJECTED_NO_EVIDENCE_POINTERS');

  const devPointerBody = requestBody('dev_pointer');
  await seedAsExecuted(db, devPointerBody, {
    evidence_refs: [{ kind: 'image', ref: 'dev://flight-table/demo' }],
    receipt_refs: [],
    log_refs: [],
  });
  const devPointer = await postEvidenceArtifacts(executorToken, devPointerBody);
  assert.equal(devPointer.json.status, 'REJECTED_DEV_EVIDENCE_NOT_FORMAL');
}

async function assertNoDownstreamFacts(db) {
  for (const type of [
    'acceptance_result_v1',
    'water_response_verification_v1',
    'roi_ledger_v1',
    'field_memory_v1',
  ]) {
    assert.equal(await countFacts(db, type), 0, `no ${type}`);
  }
}

async function cleanup(db) {
  await db.query(
    `DELETE FROM facts
      WHERE record_json::text LIKE $1
         OR fact_id LIKE $2`,
    [`%${prefix}%`, `${prefix}%`],
  );
  await db.query(
    `DELETE FROM as_applied_map_v1
      WHERE as_applied_id LIKE $1
         OR task_id LIKE $1
         OR receipt_id LIKE $1`,
    [`${prefix}%`],
  );
  await db.query(
    `DELETE FROM as_executed_record_v1
      WHERE as_executed_id LIKE $1
         OR task_id LIKE $1
         OR receipt_id LIKE $1`,
    [`${prefix}%`],
  );
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    const body = requestBody('success');
    await seedAsExecuted(db, body);

    const artifactCountBefore = await countFacts(db, 'evidence_artifact_v1');
    const response = await postEvidenceArtifacts(executorToken, body);
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal(response.json.status, 'EVIDENCE_ARTIFACTS_RECORDED');
    assert.equal(response.json.acceptance_created, false);
    assert.equal(response.json.roi_created, false);
    assert.equal(response.json.field_memory_created, false);

    const artifacts = await artifactPayloads(db);
    assert(artifacts.length - artifactCountBefore >= 3, 'at least three artifacts created');
    assertFormalArtifactShape(artifacts);
    assert((await countFacts(db, 'operator_as_executed_evidence_artifact_submission_v1')) >= 1);

    await assertDuplicateDoesNotCreateFacts(db, body);
    await assertSameArtifactPayloadIsIdempotent(db, body);
    await assertDifferentArtifactPayloadConflicts(db, body);
    await assertRejectionCases(db);
    await assertRejectedByRole(approverToken, 'approver');
    await assertRejectedByRole(clientToken, 'client_viewer');
    await assertNoDownstreamFacts(db);

    console.log(JSON.stringify({ ok: true, status: response.json.status, artifacts: artifacts.length }, null, 2));
  } finally {
    await cleanup(db);
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
