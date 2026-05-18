const { randomUUID } = require('node:crypto');
const assertNode = require('node:assert/strict');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function rid(prefix) { return `${prefix}_${randomUUID().replace(/-/g, '')}`; }

async function health(base) {
  const a = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
  if (a.ok) return true;
  const b = await fetchJson(`${base}/api/health`, { method: 'GET' });
  if (b.ok) return true;
  throw new Error(`health failed: ${a.status}/${b.status}`);
}

async function main() {
  const mode = 'live';
  assertNode.equal(process.env.SAMPLING_MODE !== 'offline', true, 'offline fallback is forbidden in formal sampling E2E');
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const reportOperationId = process.env.SAMPLING_REPORT_OPERATION_ID || null;
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });

  const checks = {
    ao_sense_task_created: false,
    ao_sense_receipt_created: false,
    sample_receipt_refs_ao_sense_receipt: false,
    sampling_plan_created: false,
    sample_receipt_created: false,
    lab_result_imported: false,
    sampling_acceptance_evaluated: false,
    acceptance_api_live_called: false,
    invalid_lab_result_not_pass: false,
  };

  try {
    await health(base);

    const run = rid('formal_sampling');
    const sample_id = rid('sample');

    const now = Date.now();
    const aoTask = requireOk(await fetchJson(`${base}/api/v1/sense/task`, {
      method: 'POST',
      token,
      body: {
        subjectRef: {
          projectId: scope.project_id,
          groupId: scope.group_id,
        },
        window: {
          startTs: now - 60_000,
          endTs: now + 60_000,
        },
        sense_kind: 'sampling',
        sense_focus: 'soil_sample_collection',
        priority: 'normal',
        supporting_problem_state_id: `problem_${run}`,
        supporting_determinism_hash: `det_${run}`,
        supporting_effective_config_hash: `cfg_${run}`,
      },
    }), 'create ao sense task');
    checks.ao_sense_task_created = true;

    const aoReceipt = requireOk(await fetchJson(`${base}/api/v1/sense/receipt`, {
      method: 'POST',
      token,
      body: {
        task_id: aoTask.task_id,
        executed_at_ts: Date.now(),
        result: 'success',
        evidence_refs: [
          { kind: 'raw_sample_v1', ref_id: rid('raw_sample') },
          { kind: 'marker_v1', ref_id: rid('marker') },
        ],
      },
    }), 'create ao sense receipt');
    checks.ao_sense_receipt_created = true;

    const plan = requireOk(await fetchJson(`${base}/api/v1/sampling/plan`, { method: 'POST', token, body: { tenant_id: scope.tenant_id, project_id: scope.project_id, group_id: scope.group_id, field_id: `field_${run}`, reason: 'MANUAL_REQUEST', sample_type: 'SOIL', required_depth_cm: 20, required_points: 3, evidence_refs: [{ kind: 'fact_id', ref_id: aoTask.fact_id }] } }), 'create sampling plan');
    checks.sampling_plan_created = true;

    const aoSenseReceiptFactId = aoReceipt.fact_id;
    const receipt = requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        sample_id,
        tenant_id: scope.tenant_id,
        project_id: scope.project_id,
        group_id: scope.group_id,
        field_id: `field_${run}`,
        collected_at_ts: Date.now(),
        collector_actor_id: 'collector_formal_sampling',
        sample_type: 'SOIL',
        chain_of_custody_status: 'RECORDED',
        evidence_refs: [{ kind: 'fact_id', ref_id: aoSenseReceiptFactId }],
        ao_sense_receipt_fact_id: aoSenseReceiptFactId,
      },
    }), 'create sample receipt with evidence refs');
    checks.sample_receipt_created = true;
    checks.sample_receipt_refs_ao_sense_receipt = true;

    const lab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, { method: 'POST', token, body: { sample_id, imported_at_ts: Date.now(), metrics: { ph: 6.5, ec: 1.2 }, units: { ph: 'pH', ec: 'mS/cm' }, evidence_refs: [{ kind: 'import_run_v1', ref_id: rid('import_run') }], quality_status: 'PASS' } }), 'import lab result');
    checks.lab_result_imported = true;

    const acceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id, import_id: lab.import_id } }), 'evaluate sampling acceptance');
    checks.acceptance_api_live_called = true;
    checks.sampling_acceptance_evaluated = ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE'].includes(acceptance.verdict);

    const sample = requireOk(await fetchJson(`${base}/api/v1/sampling/sample/${sample_id}`, { method: 'GET', token }), 'fetch sample by sample_id');
    assert.equal(Boolean(sample.sample_id || sample.sample?.sample_id), true, 'sample lookup missing sample id');

    const negNoReceiptLab = await fetchJson(`${base}/api/v1/sampling/lab-result`, {
      method: 'POST',
      token,
      body: {
        sample_id: rid('missing_receipt_sample'),
        report_ref: rid('missing_receipt_report'),
        imported_at_ts: Date.now(),
        metrics: { ph: 6.1, ec: 1.1, quality_status: 'PASS' },
      },
    });
    assert.equal(negNoReceiptLab.ok, false, `expected 4xx for lab result without sample receipt; got ${negNoReceiptLab.status}`);
    assert.equal(negNoReceiptLab.status >= 400 && negNoReceiptLab.status < 500, true, `expected 4xx for lab result without sample receipt; got ${negNoReceiptLab.status}`);

    const negNoEvidenceReceipt = await fetchJson(`${base}/api/v1/sampling/receipt`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_ref: { sample_id: rid('sample_no_evidence') }, collected_at_ts: Date.now(), collector_id: 'collector_formal_sampling', evidence_refs: [] } });
    assert.equal(negNoEvidenceReceipt.ok, false, `expected 4xx for sample receipt without evidence_refs; got ${negNoEvidenceReceipt.status}`);
    assert.equal(negNoEvidenceReceipt.status >= 400 && negNoEvidenceReceipt.status < 500, true, `expected 4xx for sample receipt without evidence_refs; got ${negNoEvidenceReceipt.status}`);

    const negMismatch = await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id: rid('mismatch'), import_id: lab.import_id } });
    const mismatchAccepted = negMismatch.ok && negMismatch.json?.ok === true && negMismatch.json?.verdict === 'INSUFFICIENT_EVIDENCE';
    assert.equal((negMismatch.status >= 400 && negMismatch.status < 500) || mismatchAccepted, true, `expected 4xx or INSUFFICIENT_EVIDENCE for sample_id mismatch; got status=${negMismatch.status} body=${negMismatch.text}`);

    const missingReceiptSampleId = rid('missing_receipt_acceptance');
    const missingReceiptAcceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, {
      method: 'POST',
      token,
      body: { plan_id: plan.plan_id, sample_id: missingReceiptSampleId, import_id: rid('missing_receipt_import') },
    }), 'evaluate acceptance with existing plan but missing receipt');
    assert.equal(missingReceiptAcceptance.verdict, 'INSUFFICIENT_EVIDENCE', 'missing receipt must return INSUFFICIENT_EVIDENCE');
    const acceptanceFact = await pool.query('SELECT record_json FROM facts WHERE fact_id=$1', [missingReceiptAcceptance.fact_id]);
    assert.equal(acceptanceFact.rowCount, 1, 'acceptance fact must exist');
    const acceptanceRecord = acceptanceFact.rows[0].record_json || {};
    assert.equal(acceptanceRecord.tenant_id, scope.tenant_id, 'tenant_id must match plan/auth scope');
    assert.equal(acceptanceRecord.project_id, scope.project_id, 'project_id must match plan/auth scope');
    assert.equal(acceptanceRecord.group_id, scope.group_id, 'group_id must match plan/auth scope');
    assert.notEqual(acceptanceRecord.tenant_id, '', 'tenant_id must not be empty');
    assert.notEqual(acceptanceRecord.project_id, '', 'project_id must not be empty');
    assert.notEqual(acceptanceRecord.group_id, '', 'group_id must not be empty');
    checks.acceptance_missing_receipt_uses_plan_scope = true;

    const invalidSampleId = rid('sample_invalid_quality');
    requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id: invalidSampleId, tenant_id: scope.tenant_id, project_id: scope.project_id, group_id: scope.group_id, field_id: `field_${run}`, collected_at_ts: Date.now(), collector_actor_id: 'collector_formal_sampling', sample_type: 'SOIL', chain_of_custody_status: 'RECORDED', evidence_refs: [{ kind: 'fact_id', ref_id: aoSenseReceiptFactId }] } }), 'create receipt for invalid quality sample');
    const invalidLab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, { method: 'POST', token, body: { sample_id: invalidSampleId, imported_at_ts: Date.now(), metrics: { ph: 9.9, ec: 4.4 }, units: { ph: 'pH', ec: 'mS/cm' }, evidence_refs: [{ kind: 'import_run_v1', ref_id: rid('import_run') }], quality_status: 'INVALID' } }), 'import invalid quality lab result');
    const invalidAcceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id: invalidSampleId, import_id: invalidLab.import_id } }), 'evaluate invalid quality sampling acceptance');
    checks.invalid_lab_result_not_pass = invalidAcceptance.verdict !== 'PASS';

    for (const [name, value] of Object.entries(checks)) {
      assert.equal(value, true, `check must be true: ${name}`);
    }

    const output = { ok: true, scenario: 'FORMAL_SAMPLING', mode, checks, refs: { plan_id: plan.plan_id, receipt_id: receipt.receipt_id, import_id: lab.import_id } };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, scenario: 'FORMAL_SAMPLING', error: err?.message ?? String(err) }, null, 2));
  process.exitCode = 1;
});
