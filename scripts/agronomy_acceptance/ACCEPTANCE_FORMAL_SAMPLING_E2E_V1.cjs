const { randomUUID } = require('node:crypto');
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
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });

  const checks = {
    ao_sense_task_created: false,
    ao_sense_receipt_created: false,
    sampling_plan_created: false,
    sample_receipt_created: false,
    lab_result_imported: false,
    sampling_acceptance_evaluated: false,
    invalid_lab_result_not_pass: false,
    customer_report_downgraded_when_evidence_missing: false,
  };

  try {
    await health(base);

    const run = rid('formal_sampling');
    const sample_id = rid('sample');

    const aoTask = requireOk(await fetchJson(`${base}/api/v1/sense/task`, {
      method: 'POST',
      token,
      body: {
        tenant_id: scope.tenant_id,
        project_id: scope.project_id,
        group_id: scope.group_id,
        field_id: `field_${run}`,
        requested_by: 'acceptance_script',
        request_ts: Date.now(),
        notes: `run=${run}`,
      },
    }), 'create ao sense task');
    checks.ao_sense_task_created = true;

    const aoReceipt = requireOk(await fetchJson(`${base}/api/v1/sense/receipt`, {
      method: 'POST',
      token,
      body: { task_id: aoTask.task_id, receipt_ts: Date.now(), operator_id: 'acceptance_operator' },
    }), 'create ao sense receipt');
    checks.ao_sense_receipt_created = true;

    const plan = requireOk(await fetchJson(`${base}/api/v1/sampling/plan`, { method: 'POST', token, body: { subject_ref: { project_id: scope.project_id, field_id: `field_${run}` }, sampling_kind: 'FORMAL_SAMPLING', requested_by: 'acceptance_script', requested_at_ts: Date.now(), notes: `run=${run}` } }), 'create sampling plan');
    checks.sampling_plan_created = true;

    const receipt = requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_ref: { sample_id }, collected_at_ts: Date.now(), collector_id: 'collector_formal_sampling', evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoTask.task_id }, { kind: 'ao_sense_receipt', ref_id: aoReceipt.receipt_id }, { kind: 'photo', ref_id: rid('photo') }] } }), 'create sample receipt with evidence refs');
    checks.sample_receipt_created = true;

    const lab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, { method: 'POST', token, body: { sample_id, report_ref: rid('lab_report'), imported_at_ts: Date.now(), metrics: { ph: 6.5, ec: 1.2, quality_status: 'PASS' } } }), 'import lab result');
    checks.lab_result_imported = true;

    const acceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id, import_id: lab.import_id } }), 'evaluate sampling acceptance');
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

    const invalidSampleId = rid('sample_invalid_quality');
    requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_ref: { sample_id: invalidSampleId }, collected_at_ts: Date.now(), collector_id: 'collector_formal_sampling', evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoTask.task_id }, { kind: 'ao_sense_receipt', ref_id: aoReceipt.receipt_id }, { kind: 'photo', ref_id: rid('photo') }] } }), 'create receipt for invalid quality sample');
    const invalidLab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, { method: 'POST', token, body: { sample_id: invalidSampleId, report_ref: rid('lab_report_invalid_quality'), imported_at_ts: Date.now(), metrics: { ph: 9.9, ec: 4.4, quality_status: 'INVALID' } } }), 'import invalid quality lab result');
    const invalidAcceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id: invalidSampleId, import_id: invalidLab.import_id } }), 'evaluate invalid quality sampling acceptance');
    checks.invalid_lab_result_not_pass = invalidAcceptance.verdict !== 'PASS';

    const debugSampleId = rid('debug_sample');
    requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_ref: { sample_id: debugSampleId }, collected_at_ts: Date.now(), collector_id: 'collector_formal_sampling', evidence_refs: [{ kind: 'simulated', ref_id: rid('sim') }, { kind: 'debug', ref_id: rid('dbg') }] } }), 'create receipt for simulated/debug sample');
    const debugLab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, { method: 'POST', token, body: { sample_id: debugSampleId, report_ref: rid('lab_report_debug'), imported_at_ts: Date.now(), metrics: { ph: 6.2, ec: 1.0, quality_status: 'PASS' } } }), 'import debug lab result');
    const debugAcceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_id: debugSampleId, import_id: debugLab.import_id } }), 'evaluate debug/simulated sampling acceptance');
    checks.customer_report_downgraded_when_evidence_missing = (debugAcceptance.customer_visible_eligible === false) || (debugAcceptance.report_tier && String(debugAcceptance.report_tier).toUpperCase() !== 'FORMAL');

    const output = { ok: true, scenario: 'FORMAL_SAMPLING', mode: 'live', checks, refs: { plan_id: plan.plan_id, receipt_id: receipt.receipt_id, lab_result_id: lab.lab_result_id } };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, scenario: 'FORMAL_SAMPLING', error: err?.message ?? String(err) }, null, 2));
  process.exitCode = 1;
});
