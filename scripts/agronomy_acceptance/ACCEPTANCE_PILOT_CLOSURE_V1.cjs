const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const execFileAsync = promisify(execFile);

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function tokenFilePath() {
  return path.join(process.cwd(), 'config', 'auth', 'ao_act_tokens_v0.json');
}

function readTokenFile() {
  const raw = fs.readFileSync(tokenFilePath(), 'utf8');
  return JSON.parse(raw);
}

function writeTokenFile(json) {
  fs.writeFileSync(tokenFilePath(), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

function readDefaultTokenRecord() {
  try {
    const json = readTokenFile();
    const rec = (Array.isArray(json?.tokens) ? json.tokens : []).find((item) =>
      item &&
      item.revoked !== true &&
      Array.isArray(item.scopes) &&
      item.scopes.includes('ao_act.task.write') &&
      item.scopes.includes('ao_act.receipt.write') &&
      item.scopes.includes('ao_act.index.read')
    );
    return rec || null;
  } catch {
    return null;
  }
}

function createTempExecutorToken(baseRecord, suffix) {
  assert.ok(baseRecord && typeof baseRecord === 'object', 'BASE_TOKEN_RECORD_MISSING');

  const json = readTokenFile();
  const tokens = Array.isArray(json.tokens) ? json.tokens.slice() : [];

  const token = `geox_exec_${crypto.randomUUID().replace(/-/g, '')}`;
  const token_id = `executor_accept_${suffix}`;
  const actor_id = `executor_accept_${suffix}`;
  const scopes = Array.from(new Set([
    ...(Array.isArray(baseRecord.scopes) ? baseRecord.scopes : []),
    'ao_act.task.write',
    'ao_act.receipt.write',
    'ao_act.index.read'
  ]));

  const rec = {
    ...baseRecord,
    token,
    token_id,
    actor_id,
    scopes,
    revoked: false
  };

  tokens.push(rec);
  writeTokenFile({ ...json, tokens });

  let cleaned = false;
  return {
    token,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      const latest = readTokenFile();
      const latestTokens = Array.isArray(latest.tokens) ? latest.tokens : [];
      writeTokenFile({
        ...latest,
        tokens: latestTokens.filter((item) => String(item?.token_id ?? '') !== token_id)
      });
    }
  };
}

async function waitEvidenceDone(base, token, jobId) {
  for (let i = 0; i < 50; i += 1) {
    await sleep(300);
    const out = await fetchJson(
      `${base}/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET', token }
    );
    const json = requireOk(out, 'evidence-export-status');
    const status = String(json?.job?.status ?? '').toUpperCase();
    if (status === 'DONE') return json;
    assert.notStrictEqual(status, 'ERROR', `evidence export failed: ${out.text}`);
  }
  assert.fail('evidence export job timeout');
}

async function waitTaskVisibleInOperations(base, token, triple, actTaskId) {
  for (let i = 0; i < 30; i += 1) {
    const out = await fetchJson(
      `${base}/api/v1/operations?tenant_id=${encodeURIComponent(triple.tenant_id)}&project_id=${encodeURIComponent(triple.project_id)}&group_id=${encodeURIComponent(triple.group_id)}`,
      { method: 'GET', token }
    );

    if (out.ok && out.json?.ok) {
      const items =
        Array.isArray(out.json.items) ? out.json.items
          : Array.isArray(out.json.operations) ? out.json.operations
            : [];

      const found = items.some((item) => {
        const taskId =
          item?.task_id ??
          item?.act_task_id ??
          item?.task?.act_task_id ??
          item?.task?.task_id ??
          null;
        return String(taskId ?? '') === String(actTaskId);
      });

      if (found) return true;
    }

    await sleep(400);
  }

  return false;
}

async function runDispatchOnce({ base, dispatchToken, tenant_id, project_id, group_id }) {
  const run = await execFileAsync(
    'pnpm',
    [
      'exec', 'tsx', 'src/run_dispatch_once.ts',
      '--baseUrl', base,
      '--token', dispatchToken,
      '--tenant_id', tenant_id,
      '--project_id', project_id,
      '--group_id', group_id,
      '--executor_id', `pilot_closure_${Date.now()}`,
      '--limit', '10'
    ],
    {
      cwd: path.join(process.cwd(), 'apps', 'executor'),
      env: process.env
    }
  );

  return `${run.stdout || ''}\n${run.stderr || ''}`;
}

function serializeForMatch(v) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return '';
  }
}

function bundleContainsId(bundleNode, id) {
  if (!id) return false;
  return serializeForMatch(bundleNode).includes(String(id));
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const baseRecord = readDefaultTokenRecord();
  const token = env('AO_ACT_TOKEN', env('GEOX_AO_ACT_TOKEN', baseRecord?.token ? String(baseRecord.token) : ''));
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const season_id = env('SEASON_ID', 'season_demo_1');
  const device_id = env('DEVICE_ID', 'device_demo_1');
  const chainStart = Date.now() - 90_000;

  if (!token) throw new Error('MISSING_AO_ACT_TOKEN');

  let tempExecutor = null;
  let executorToken = env('AO_ACT_EXECUTOR_TOKEN', env('GEOX_AO_ACT_EXECUTOR_TOKEN', ''));
  if (!executorToken) {
    if (!baseRecord) throw new Error('MISSING_BASE_TOKEN_RECORD_FOR_TEMP_EXECUTOR_TOKEN');
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    tempExecutor = createTempExecutorToken(baseRecord, suffix);
    executorToken = tempExecutor.token;
  }

  const triple = { tenant_id, project_id, group_id };

  try {
    const recRes = await fetchJson(`${base}/api/v1/recommendations/generate`, {
      method: 'POST',
      token,
      body: {
        tenant_id,
        project_id,
        group_id,
        field_id,
        season_id,
        device_id,
        telemetry: { soil_moisture_pct: 18.5, canopy_temp_c: 33.2 },
        image_recognition: { stress_score: 0.71, disease_score: 0.21, pest_risk_score: 0.35, confidence: 0.92 }
      }
    });
    const recJson = requireOk(recRes, 'generate recommendation');
    const recommendation_id = String(recJson?.recommendations?.[0]?.recommendation_id ?? '');
    assert.ok(recommendation_id, 'recommendation_id missing');

    const submitRes = await fetchJson(
      `${base}/api/v1/recommendations/${encodeURIComponent(recommendation_id)}/submit-approval`,
      {
        method: 'POST',
        token,
        body: { tenant_id, project_id, group_id }
      }
    );
    const submitJson = requireOk(submitRes, 'submit approval');
    const approval_request_id = String(submitJson.approval_request_id ?? '');
    assert.ok(approval_request_id, 'approval_request_id missing');

    const decideRes = await fetchJson(
      `${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`,
      {
        method: 'POST',
        token,
        body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'pilot closure acceptance' }
      }
    );
    const decideJson = requireOk(decideRes, 'approval decide');
    const act_task_id = String(decideJson.act_task_id ?? '');
    assert.ok(act_task_id, 'act_task_id missing');

    const visible = await waitTaskVisibleInOperations(base, token, triple, act_task_id);
    assert.equal(visible, true, `task not visible in operations within timeout: ${act_task_id}`);

    let dispatchHit = false;
    let lastDispatchOutput = '';
    for (let i = 0; i < 5; i += 1) {
      lastDispatchOutput = await runDispatchOnce({
        base,
        dispatchToken: executorToken,
        tenant_id,
        project_id,
        group_id
      });

      const hasRuntimeEvidence = [
        'claimed queue size=',
        'claimed task',
        'published success',
        'receipt_status=',
        'no claimed dispatch items found'
      ].some((frag) => lastDispatchOutput.includes(frag));

      if (hasRuntimeEvidence) {
        dispatchHit = true;
        break;
      }

      await sleep(500);
    }
    assert.equal(dispatchHit, true, `dispatch runtime produced no recognizable output: ${lastDispatchOutput}`);

    const timelineRes = await fetchJson(
      `${base}/api/v1/fields/${encodeURIComponent(field_id)}/timeline?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&since_ts_ms=${chainStart}`,
      { method: 'GET', token }
    );
    const timelineJson = requireOk(timelineRes, 'field timeline');
    const ops = Array.isArray(timelineJson.operations) ? timelineJson.operations : [];
    const trajectories = Array.isArray(timelineJson.trajectories) ? timelineJson.trajectories : [];
    assert.ok(ops.length > 0, 'field timeline should include operations');

    if (trajectories.length === 0) {
      console.warn(
        `WARN ACCEPTANCE_PILOT_CLOSURE_V1: no GIS trajectory points visible; field_id=${field_id} since_ts_ms=${chainStart} ops=${ops.length}`
      );
    }

    const exportCreate = await fetchJson(`${base}/api/v1/evidence-export/jobs`, {
      method: 'POST',
      token,
      body: {
        scope_type: 'FIELD',
        scope_id: field_id,
        from_ts_ms: chainStart,
        to_ts_ms: Date.now() + 10_000
      }
    });
    const exportCreateJson = requireOk(exportCreate, 'evidence export create');
    const job_id = String(exportCreateJson.job_id ?? '');
    assert.ok(job_id, 'job_id missing');
    await waitEvidenceDone(base, token, job_id);

    const dl = await fetch(
      `${base}/api/v1/evidence-export/jobs/${encodeURIComponent(job_id)}/download`,
      {
        method: 'GET',
        headers: token ? { authorization: `Bearer ${token}` } : {}
      }
    );
    const dlText = await dl.text();
    assert.equal(dl.ok, true, `evidence download failed status=${dl.status} body=${dlText}`);
    const bundle = JSON.parse(dlText);
    const operationBundles = Array.isArray(bundle?.operation_bundles) ? bundle.operation_bundles : [];
    assert.ok(operationBundles.length > 0, 'operation_bundles missing');

    const matched = operationBundles.find((item) => {
      const b = item?.operation_bundle ?? {};

      const hasOperationPlan = !!b.operation_plan;
      const hasReceipt = !!b.receipt;
      const hasTimeline = Array.isArray(b.timeline) && b.timeline.length > 0;

      const containsRecommendationId = bundleContainsId(b, recommendation_id);
      const containsApprovalRequestId = bundleContainsId(b, approval_request_id);
      const containsTaskId = bundleContainsId(b, act_task_id);

      return (
        hasOperationPlan &&
        hasReceipt &&
        hasTimeline &&
        containsRecommendationId &&
        containsApprovalRequestId &&
        containsTaskId
      );
    });

    if (!matched) {
      const debugTop = operationBundles.slice(0, 5).map((item, idx) => {
        const b = item?.operation_bundle ?? {};
        return {
          idx,
          hasRecommendation: !!b.recommendation,
          hasApproval: !!b.approval,
          hasOperationPlan: !!b.operation_plan,
          hasTask: !!b.task,
          hasReceipt: !!b.receipt,
          timelineLen: Array.isArray(b.timeline) ? b.timeline.length : 0,
          containsRecommendationId: bundleContainsId(b, recommendation_id),
          containsApprovalRequestId: bundleContainsId(b, approval_request_id),
          containsTaskId: bundleContainsId(b, act_task_id)
        };
      });
      console.error('DEBUG ACCEPTANCE_PILOT_CLOSURE_V1 operation bundle summary:', JSON.stringify(debugTop, null, 2));
    }

    assert.ok(
      matched,
      `evidence operation_bundle should include current chain ids: recommendation=${recommendation_id} approval=${approval_request_id} task=${act_task_id}`
    );

    console.log('PASS ACCEPTANCE_PILOT_CLOSURE_V1');
  } finally {
    if (tempExecutor && typeof tempExecutor.cleanup === 'function') {
      tempExecutor.cleanup();
    }
  }
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_PILOT_CLOSURE_V1', e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});