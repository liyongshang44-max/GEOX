const { randomUUID } = require('node:crypto');
const assertNode = require('node:assert/strict');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

function rid(prefix) { return `${prefix}_${randomUUID().replace(/-/g, '')}`; }

async function countAcceptanceFacts(pool, planId, sampleId) {
  const q = await pool.query(
    `SELECT count(*)::int AS n
       FROM facts
      WHERE (record_json::jsonb->>'type')='sampling_acceptance_v1'
        AND (record_json::jsonb->>'plan_id')=$1
        AND (record_json::jsonb->>'sample_id')=$2`,
    [planId, sampleId],
  );
  return Number(q.rows?.[0]?.n ?? 0);
}

async function main() {
  const mode = 'live';
  assertNode.equal(process.env.SAMPLING_MODE !== 'offline', true, 'offline fallback is forbidden in formal sampling E2E');
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('ADMIN_TOKEN', env('AO_ACT_TOKEN', 'admin_token'));
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });

  const checks = {
    ao_sense_task_created: false,
    ao_sense_receipt_created: false,
    sampling_plan_exact_identity: false,
    sample_receipt_exact_plan_binding: false,
    lab_exact_receipt_binding: false,
    sampling_acceptance_exact_chain_persisted: false,
    later_receipt_lab_do_not_replace_exact_chain: false,
    cross_chain_lab_binding_rejected: false,
    missing_exact_source_does_not_mint_acceptance: false,
    invalid_lab_result_not_pass: false,
    sample_lookup_works_before_ambiguity: false,
  };

  try {
    await waitForHealth(base);
    const run = rid('formal_sampling');
    const sample_id = rid('sample');
    const field_id = `field_${run}`;
    const now = Date.now();

    const aoTask = requireOk(await fetchJson(`${base}/api/v1/sense/task`, {
      method: 'POST',
      token,
      body: {
        subjectRef: { projectId: scope.project_id, groupId: scope.group_id },
        window: { startTs: now - 60_000, endTs: now + 60_000 },
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

    const plan = requireOk(await fetchJson(`${base}/api/v1/sampling/plan`, {
      method: 'POST',
      token,
      body: {
        ...scope,
        field_id,
        reason: 'MANUAL_REQUEST',
        sample_type: 'SOIL',
        required_depth_cm: 20,
        required_points: 3,
        evidence_refs: [{ kind: 'fact_id', ref_id: aoTask.fact_id }],
      },
    }), 'create sampling plan');
    checks.sampling_plan_exact_identity = Boolean(plan.plan_id && plan.fact_id);

    const receipt = requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id,
        ...scope,
        field_id,
        collected_at_ts: Date.now(),
        collector_actor_id: 'collector_formal_sampling',
        sample_type: 'SOIL',
        chain_of_custody_status: 'RECORDED',
        evidence_refs: [{ kind: 'fact_id', ref_id: aoReceipt.fact_id }],
        ao_sense_receipt_fact_id: aoReceipt.fact_id,
      },
    }), 'create exact sample receipt');
    checks.sample_receipt_exact_plan_binding = Boolean(receipt.fact_id);

    const lab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, {
      method: 'POST',
      token,
      body: {
        sample_id,
        receipt_fact_id: receipt.fact_id,
        imported_at_ts: Date.now(),
        metrics: { ph: 6.5, ec: 1.2 },
        units: { ph: 'pH', ec: 'mS/cm' },
        evidence_refs: [{ kind: 'import_run_v1', ref_id: rid('import_run') }],
        quality_status: 'PASS',
      },
    }), 'import exact lab result');
    checks.lab_exact_receipt_binding = Boolean(lab.fact_id);

    const acceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id,
        receipt_fact_id: receipt.fact_id,
        import_id: lab.import_id,
        lab_fact_id: lab.fact_id,
      },
    }), 'evaluate exact sampling acceptance');
    assert.equal(acceptance.verdict, 'PASS', 'exact PASS chain should evaluate PASS');

    const acceptanceFact = await pool.query('SELECT record_json FROM facts WHERE fact_id=$1', [acceptance.fact_id]);
    assert.equal(acceptanceFact.rowCount, 1, 'acceptance fact must exist');
    const ar = acceptanceFact.rows[0].record_json || {};
    assert.equal(ar.plan_fact_id, plan.fact_id, 'acceptance must freeze exact plan fact');
    assert.equal(ar.receipt_fact_id, receipt.fact_id, 'acceptance must freeze exact receipt fact');
    assert.equal(ar.lab_fact_id, lab.fact_id, 'acceptance must freeze exact lab fact');
    assert.equal(ar.acceptance_fact_id, acceptance.fact_id, 'acceptance must freeze its own exact fact identity');
    checks.sampling_acceptance_exact_chain_persisted = true;

    const sample = requireOk(await fetchJson(`${base}/api/v1/sampling/sample/${sample_id}`, { method: 'GET', token }), 'fetch unique sample');
    assert.equal(sample.fact?.record_json?.sample_id, sample_id, 'sample lookup missing sample id');
    checks.sample_lookup_works_before_ambiguity = true;

    const laterReceipt = requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id,
        ...scope,
        field_id,
        collected_at_ts: Date.now() + 1,
        collector_actor_id: 'collector_later',
        sample_type: 'SOIL',
        chain_of_custody_status: 'RECORDED',
        evidence_refs: [{ kind: 'fact_id', ref_id: aoReceipt.fact_id }],
      },
    }), 'create later receipt for same sample');

    const laterLab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, {
      method: 'POST',
      token,
      body: {
        sample_id,
        receipt_fact_id: laterReceipt.fact_id,
        imported_at_ts: Date.now() + 2,
        metrics: { ph: 9.9, ec: 4.4 },
        units: { ph: 'pH', ec: 'mS/cm' },
        evidence_refs: [{ kind: 'import_run_v1', ref_id: rid('later_import') }],
        quality_status: 'INVALID',
      },
    }), 'create later invalid lab for same sample');

    const exactAgain = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id,
        receipt_fact_id: receipt.fact_id,
        import_id: lab.import_id,
        lab_fact_id: lab.fact_id,
      },
    }), 're-evaluate original exact chain');
    assert.equal(exactAgain.verdict, 'PASS', 'later facts must not replace original exact source chain');
    checks.later_receipt_lab_do_not_replace_exact_chain = true;

    const crossChain = await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id,
        receipt_fact_id: receipt.fact_id,
        import_id: laterLab.import_id,
        lab_fact_id: laterLab.fact_id,
      },
    });
    assert.equal(crossChain.ok, false, 'cross-chain lab must be rejected');
    assert.equal(crossChain.status >= 400 && crossChain.status < 500, true, 'cross-chain lab must fail 4xx');
    checks.cross_chain_lab_binding_rejected = true;

    const missingExactSample = rid('missing_exact');
    const beforeMissing = await countAcceptanceFacts(pool, plan.plan_id, missingExactSample);
    const missingExact = await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, {
      method: 'POST',
      token,
      body: { plan_id: plan.plan_id, sample_id: missingExactSample, import_id: rid('missing_import') },
    });
    assert.equal(missingExact.ok, false, 'missing exact refs must fail');
    assert.equal(missingExact.status >= 400 && missingExact.status < 500, true, 'missing exact refs must fail 4xx');
    const afterMissing = await countAcceptanceFacts(pool, plan.plan_id, missingExactSample);
    assert.equal(afterMissing, beforeMissing, 'missing exact refs must not mint Acceptance fact');
    checks.missing_exact_source_does_not_mint_acceptance = true;

    const invalidSampleId = rid('sample_invalid_quality');
    const invalidReceipt = requireOk(await fetchJson(`${base}/api/v1/sampling/receipt`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id: invalidSampleId,
        ...scope,
        field_id,
        collected_at_ts: Date.now(),
        collector_actor_id: 'collector_formal_sampling',
        sample_type: 'SOIL',
        chain_of_custody_status: 'RECORDED',
        evidence_refs: [{ kind: 'fact_id', ref_id: aoReceipt.fact_id }],
      },
    }), 'create invalid-quality receipt');
    const invalidLab = requireOk(await fetchJson(`${base}/api/v1/sampling/lab-result`, {
      method: 'POST',
      token,
      body: {
        sample_id: invalidSampleId,
        receipt_fact_id: invalidReceipt.fact_id,
        imported_at_ts: Date.now(),
        metrics: { ph: 9.9, ec: 4.4 },
        units: { ph: 'pH', ec: 'mS/cm' },
        evidence_refs: [{ kind: 'import_run_v1', ref_id: rid('import_run') }],
        quality_status: 'INVALID',
      },
    }), 'import invalid quality lab result');
    const invalidAcceptance = requireOk(await fetchJson(`${base}/api/v1/sampling/acceptance/evaluate`, {
      method: 'POST',
      token,
      body: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        sample_id: invalidSampleId,
        receipt_fact_id: invalidReceipt.fact_id,
        import_id: invalidLab.import_id,
        lab_fact_id: invalidLab.fact_id,
      },
    }), 'evaluate invalid quality sampling acceptance');
    checks.invalid_lab_result_not_pass = invalidAcceptance.verdict !== 'PASS';

    for (const [name, value] of Object.entries(checks)) assert.equal(value, true, `check must be true: ${name}`);

    console.log(JSON.stringify({
      ok: true,
      scenario: 'FORMAL_SAMPLING_EXACT_SOURCE',
      mode,
      checks,
      refs: {
        plan_id: plan.plan_id,
        plan_fact_id: plan.fact_id,
        receipt_fact_id: receipt.fact_id,
        lab_fact_id: lab.fact_id,
        acceptance_fact_id: acceptance.fact_id,
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, scenario: 'FORMAL_SAMPLING_EXACT_SOURCE', error: err?.message ?? String(err) }, null, 2));
  process.exitCode = 1;
});
