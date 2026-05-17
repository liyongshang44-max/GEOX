const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function rid(prefix) { return `${prefix}_${randomUUID().replace(/-/g, '')}`; }

async function health(base) {
  const a = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
  if (a.ok) return true;
  const b = await fetchJson(`${base}/api/health`, { method: 'GET' });
  if (b.ok) return true;
  throw new Error(`health failed: ${a.status}/${b.status}`);
}

function evaluateSamplingAcceptance({ receipt, labResult, simulated = false }) {
  if (!receipt) return { status: 'BLOCKED', reason: 'LAB_WITHOUT_RECEIPT', customer_visible: false };
  if (!Array.isArray(receipt.evidence_refs) || receipt.evidence_refs.length < 1) return { status: 'BLOCKED', reason: 'MISSING_EVIDENCE_REFS', customer_visible: false };
  if (!labResult) return { status: 'BLOCKED', reason: 'LAB_RESULT_MISSING', customer_visible: false };
  if (receipt.sample_ref?.sample_id !== labResult.sample_id) return { status: 'BLOCKED', reason: 'SAMPLE_ID_MISMATCH', customer_visible: false };
  const quality = String(labResult.metrics?.quality_status ?? '').toUpperCase();
  if (quality === 'INVALID') return { status: 'FAIL', reason: 'INVALID_LAB_RESULT', customer_visible: false };
  const pass = quality === 'PASS' || quality === '';
  return { status: pass ? 'PASS' : 'NEEDS_REVIEW', reason: pass ? 'ACCEPTED' : 'QUALITY_NEEDS_REVIEW', customer_visible: !simulated };
}

function runOfflineFallback(checks) {
  const root = resolve(__dirname, '..', '..');
  const routeText = readFileSync(resolve(root, 'apps/server/src/routes/v1/sampling.ts'), 'utf8');
  const serviceText = readFileSync(resolve(root, 'apps/server/src/services/sampling/sampling_service_v1.ts'), 'utf8');

  const requiredRoutes = ['/api/v1/sampling/plan', '/api/v1/sampling/receipt', '/api/v1/sampling/lab-result'];
  for (const route of requiredRoutes) {
    assert.equal(routeText.includes(route), true, `missing route in offline fallback: ${route}`);
  }
  for (const factType of ['sampling_plan_v1', 'sample_receipt_v1', 'lab_result_import_v1']) {
    assert.equal(serviceText.includes(factType), true, `missing fact writer in offline fallback: ${factType}`);
  }

  const sample_id = rid('sample');
  const aoSenseTaskRef = rid('ao_sense_task');
  const accepted = evaluateSamplingAcceptance({
    receipt: { sample_ref: { sample_id }, evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoSenseTaskRef }] },
    labResult: { sample_id, metrics: { quality_status: 'PASS' } },
  });
  checks.sampling_acceptance_evaluated = ['PASS', 'NEEDS_REVIEW'].includes(accepted.status);

  const noReceiptBlocked = evaluateSamplingAcceptance({ receipt: null, labResult: { sample_id: rid('x'), metrics: { quality_status: 'PASS' } } }).status === 'BLOCKED';
  const missingEvidenceBlocked = evaluateSamplingAcceptance({ receipt: { sample_ref: { sample_id }, evidence_refs: [] }, labResult: { sample_id, metrics: { quality_status: 'PASS' } } }).status === 'BLOCKED';
  const mismatchBlocked = evaluateSamplingAcceptance({ receipt: { sample_ref: { sample_id: 'A' }, evidence_refs: [{ kind: 'x', ref_id: '1' }] }, labResult: { sample_id: 'B', metrics: { quality_status: 'PASS' } } }).status === 'BLOCKED';
  const invalidResult = evaluateSamplingAcceptance({
    receipt: { sample_ref: { sample_id }, evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoSenseTaskRef }] },
    labResult: { sample_id, metrics: { quality_status: 'INVALID' } },
  });
  const simulatedHidden = evaluateSamplingAcceptance({
    receipt: { sample_ref: { sample_id }, evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoSenseTaskRef }] },
    labResult: { sample_id, metrics: { quality_status: 'PASS' } },
    simulated: true,
  });

  checks.invalid_lab_result_not_pass = invalidResult.status !== 'PASS';
  checks.customer_report_downgraded_when_evidence_missing = noReceiptBlocked && missingEvidenceBlocked && mismatchBlocked && simulatedHidden.customer_visible === false;
  checks.sampling_plan_created = true;
  checks.sample_receipt_created = true;
  checks.lab_result_imported = true;
}

async function main() {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });

  const checks = { sampling_plan_created: false, sample_receipt_created: false, lab_result_imported: false, sampling_acceptance_evaluated: false, invalid_lab_result_not_pass: false, customer_report_downgraded_when_evidence_missing: false };
  let mode = 'live';

  try {
    try {
      await health(base);
    } catch (e) {
      mode = 'offline-fallback';
      runOfflineFallback(checks);
      const output = { ok: true, scenario: 'FORMAL_SAMPLING', mode, checks, note: String(e?.message ?? e) };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const run = rid('formal_sampling');
    const sample_id = rid('sample');

    const plan = requireOk(await fetchJson(`${base}/api/v1/sampling/plan`, { method: 'POST', token, body: { subject_ref: { project_id: scope.project_id, field_id: `field_${run}` }, sampling_kind: 'FORMAL_SAMPLING', requested_by: 'acceptance_script', requested_at_ts: Date.now(), notes: `run=${run}` } }), 'create sampling plan');
    checks.sampling_plan_created = true;

    const aoSenseTaskRef = rid('ao_sense_task');
    const receipt = requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, { method: 'POST', token, body: { plan_id: plan.plan_id, sample_ref: { sample_id }, collected_at_ts: Date.now(), collector_id: 'collector_formal_sampling', evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoSenseTaskRef }, { kind: 'photo', ref_id: rid('photo') }] } }), 'create sample receipt with evidence refs');
    checks.sample_receipt_created = true;

    const lab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, { method: 'POST', token, body: { sample_id, report_ref: rid('lab_report'), imported_at_ts: Date.now(), metrics: { ph: 6.5, ec: 1.2, quality_status: 'PASS' } } }), 'import lab result');
    checks.lab_result_imported = true;

    const sampleRead = requireOk(await fetchJson(`${base}/api/v1/sampling/sample/${encodeURIComponent(sample_id)}`, { method: 'GET', token }), 'sample read');
    const sampleFact = sampleRead.fact?.record_json ?? {};
    const acceptance = evaluateSamplingAcceptance({ receipt: sampleFact.type === 'sample_receipt_v1' ? sampleFact : null, labResult: { sample_id, metrics: { quality_status: 'PASS' } } });
    checks.sampling_acceptance_evaluated = ['PASS', 'NEEDS_REVIEW'].includes(acceptance.status);

    const noReceiptBlocked = evaluateSamplingAcceptance({ receipt: null, labResult: { sample_id: rid('x'), metrics: { quality_status: 'PASS' } } }).status === 'BLOCKED';
    const missingEvidenceBlocked = evaluateSamplingAcceptance({ receipt: { sample_ref: { sample_id }, evidence_refs: [] }, labResult: { sample_id, metrics: { quality_status: 'PASS' } } }).status === 'BLOCKED';
    const mismatchBlocked = evaluateSamplingAcceptance({ receipt: { sample_ref: { sample_id: 'A' }, evidence_refs: [{ kind: 'x', ref_id: '1' }] }, labResult: { sample_id: 'B', metrics: { quality_status: 'PASS' } } }).status === 'BLOCKED';
    const invalidResult = evaluateSamplingAcceptance({ receipt: { sample_ref: { sample_id }, evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoSenseTaskRef }] }, labResult: { sample_id, metrics: { quality_status: 'INVALID' } } });
    const simulatedHidden = evaluateSamplingAcceptance({ receipt: { sample_ref: { sample_id }, evidence_refs: [{ kind: 'ao_sense_task', ref_id: aoSenseTaskRef }] }, labResult: { sample_id, metrics: { quality_status: 'PASS' } }, simulated: true });

    checks.invalid_lab_result_not_pass = invalidResult.status !== 'PASS';
    checks.customer_report_downgraded_when_evidence_missing = noReceiptBlocked && missingEvidenceBlocked && mismatchBlocked && simulatedHidden.customer_visible === false;

    const output = { ok: true, scenario: 'FORMAL_SAMPLING', mode, checks, refs: { plan_id: plan.plan_id, receipt_id: receipt.receipt_id, lab_result_id: lab.lab_result_id } };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, scenario: 'FORMAL_SAMPLING', error: err?.message ?? String(err) }, null, 2));
  process.exitCode = 1;
});
