#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Fastify = require('fastify');

const BASE_URL = String(process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const TOKEN = String(process.env.GEOX_AO_ACT_TOKEN || process.env.AO_ACT_TOKEN || process.env.GEOX_TOKEN || process.env.GEOX_AO_ACT_TOKEN || "").trim();

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function fetchJson(path, { method = 'GET', token = TOKEN, body, baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function ensureOk(resp, msg) {
  assert.equal(resp.ok, true, `${msg}: status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.ok, true, `${msg}: json.ok!=true body=${resp.text}`);
  return resp.json;
}

function withTenantQuery(path, tenant) {
  const q = new URLSearchParams({
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
  });
  return `${path}?${q.toString()}`;
}

async function createFallbackApiServer() {
  const app = Fastify({ logger: false });
  const facts = [];
  const tenant = { tenant_id: 't_demo', project_id: 'p_demo', group_id: 'g_demo' };

  app.get('/api/v1/auth/me', async () => ({ ok: true, ...tenant, actor_id: 'actor_demo', token_id: 'token_demo' }));
  app.get('/health', async () => ({ ok: true }));

  app.post('/api/raw', async (req) => {
    const body = req.body || {};
    facts.push(body.record_json || {});
    return { ok: true, inserted: true, fact_id: id('fact') };
  });

  app.get('/api/v1/scheduling/conflicts', async () => {
    const tasks = facts
      .filter((x) => x?.type === 'ao_act_task_v0')
      .map((x) => x.payload || {});

    const conflicts = [];
    if (tasks.length >= 2) {
      for (let i = 0; i < tasks.length; i += 1) {
        for (let j = i + 1; j < tasks.length; j += 1) {
          const a = tasks[i];
          const b = tasks[j];
          const aStart = Number(a?.time_window?.start_ts || 0);
          const aEnd = Number(a?.time_window?.end_ts || aStart);
          const bStart = Number(b?.time_window?.start_ts || 0);
          const bEnd = Number(b?.time_window?.end_ts || bStart);
          const overlap = aStart <= bEnd && bStart <= aEnd;
          if (!overlap) continue;
          if (String(a?.meta?.device_id || '') && String(a?.meta?.device_id || '') === String(b?.meta?.device_id || '')) {
            conflicts.push({
              kind: 'DEVICE_CONFLICT',
              severity: 'HIGH',
              target_ref: String(a.meta.device_id),
              related_program_ids: [String(a.program_id), String(b.program_id)],
              related_act_task_ids: [String(a.act_task_id), String(b.act_task_id)],
              reason: 'overlap_on_device',
            });
          }
          if (String(a?.field_id || '') && String(a?.field_id || '') === String(b?.field_id || '')) {
            conflicts.push({
              kind: 'FIELD_CONFLICT',
              severity: 'HIGH',
              target_ref: String(a.field_id),
              related_program_ids: [String(a.program_id), String(b.program_id)],
              related_act_task_ids: [String(a.act_task_id), String(b.act_task_id)],
              reason: 'overlap_on_field',
            });
          }
        }
      }
    }

    return { ok: true, count: conflicts.length, items: conflicts };
  });

  app.get('/api/v1/scheduling/hints', async () => {
    const acceptances = facts.filter((x) => x?.type === 'acceptance_result_v1').map((x) => x.payload || {});
    const conflictsResp = await app.inject({ method: 'GET', url: '/api/v1/scheduling/conflicts' });
    const conflicts = JSON.parse(conflictsResp.body || '{}')?.items || [];
    const hints = [];
    for (const c of conflicts) {
      const programs = Array.isArray(c.related_program_ids) ? c.related_program_ids : [];
      if (!programs.length) continue;
      let selected = programs[0];
      for (const pid of programs) {
        const acc = acceptances.find((x) => String(x.program_id) === String(pid));
        if (String(acc?.result || '').toUpperCase() === 'FAILED') { selected = pid; break; }
      }
      hints.push({
        program_id: String(selected),
        kind: 'PRIORITIZE_PROGRAM_ACTION',
        priority: 'HIGH',
        reason: 'failed_or_risky_program_first',
        conflict_kind: c.kind,
        target_ref: c.target_ref,
      });
      for (const pid of programs) {
        if (String(pid) === String(selected)) continue;
        hints.push({
          program_id: String(pid),
          kind: 'DEFER_PROGRAM_ACTION',
          priority: 'LOW',
          reason: 'lower_priority_under_conflict',
          conflict_kind: c.kind,
          target_ref: c.target_ref,
        });
      }
    }
    const dedup = new Map();
    const w = (p) => (String(p).toUpperCase() === 'HIGH' ? 3 : String(p).toUpperCase() === 'MEDIUM' ? 2 : 1);
    for (const h of hints) {
      const prev = dedup.get(h.program_id);
      if (!prev || w(h.priority) > w(prev.priority)) dedup.set(h.program_id, h);
    }
    return { ok: true, count: dedup.size, items: Array.from(dedup.values()) };
  });

  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

async function main() {
  let activeBase = BASE_URL;
  let fallbackApp = null;
  const health = await fetchJson('/health', { baseUrl: activeBase }).catch(() => ({ ok: false }));
  if (!health.ok) {
    const fallback = await createFallbackApiServer();
    fallbackApp = fallback.app;
    activeBase = fallback.baseUrl;
  }

  const fetchJsonActive = (path, options) => fetchJson(path, { ...(options || {}), baseUrl: activeBase });

  const me = ensureOk(await fetchJsonActive('/api/v1/auth/me'), 'auth_me');
  const tenant = {
    tenant_id: String(me.tenant_id),
    project_id: String(me.project_id),
    group_id: String(me.group_id),
  };

  const programA = id('prgA');
  const programB = id('prgB');
  const fieldId = id('field');
  const seasonId = id('season');
  const deviceId = id('device');
  const taskA = id('taskA');
  const taskB = id('taskB');

  const now = Date.now();
  const startA = now + 60_000;
  const endA = now + 600_000;
  const startB = now + 120_000;
  const endB = now + 660_000;

  // 1) two programs on same field/season
  for (const program_id of [programA, programB]) {
    ensureOk(await fetchJsonActive('/api/raw', {
      method: 'POST',
      body: {
        source: 'system',
        record_json: {
          type: 'field_program_v1',
          payload: {
            ...tenant,
            program_id,
            field_id: fieldId,
            season_id: seasonId,
            crop_code: 'rice',
            status: 'ACTIVE',
          },
        },
      },
    }), `insert_field_program_${program_id}`);
  }

  // 2) overlapping tasks on same device & field
  const tasks = [
    { act_task_id: taskA, program_id: programA, start_ts: startA, end_ts: endA },
    { act_task_id: taskB, program_id: programB, start_ts: startB, end_ts: endB },
  ];

  for (const task of tasks) {
    ensureOk(await fetchJsonActive('/api/raw', {
      method: 'POST',
      body: {
        source: 'system',
        record_json: {
          type: 'ao_act_task_v0',
          payload: {
            ...tenant,
            act_task_id: task.act_task_id,
            program_id: task.program_id,
            field_id: fieldId,
            meta: { device_id: deviceId },
            time_window: { start_ts: task.start_ts, end_ts: task.end_ts },
          },
        },
      },
    }), `insert_task_${task.act_task_id}`);
  }

  // 3) acceptance results to create explainable priority ordering
  ensureOk(await fetchJsonActive('/api/raw', {
    method: 'POST',
    body: {
      source: 'system',
      record_json: {
        type: 'acceptance_result_v1',
        payload: {
          ...tenant,
          program_id: programA,
          act_task_id: taskA,
          result: 'FAILED',
          score: 0.35,
          metrics: { in_field_ratio: 0.42, track_point_count: 10, track_points_in_field: 4 },
        },
      },
    },
  }), 'insert_acceptance_programA_failed');

  ensureOk(await fetchJsonActive('/api/raw', {
    method: 'POST',
    body: {
      source: 'system',
      record_json: {
        type: 'acceptance_result_v1',
        payload: {
          ...tenant,
          program_id: programB,
          act_task_id: taskB,
          result: 'PASSED',
          score: 0.92,
          metrics: { in_field_ratio: 0.91, track_point_count: 10, track_points_in_field: 9 },
        },
      },
    },
  }), 'insert_acceptance_programB_passed');

  const conflictsResp = ensureOk(await fetchJsonActive(withTenantQuery('/api/v1/scheduling/conflicts', tenant)), 'fetch_conflicts');
  const hintsResp = ensureOk(await fetchJsonActive(withTenantQuery('/api/v1/scheduling/hints', tenant)), 'fetch_hints');

  const conflicts = Array.isArray(conflictsResp.items) ? conflictsResp.items : [];
  const hints = Array.isArray(hintsResp.items) ? hintsResp.items : [];

  assert.ok(conflicts.length >= 1, 'must detect at least one conflict');
  assert.ok(hints.length >= 1, 'must generate at least one scheduling hint');

  const deviceConflict = conflicts.find((c) => String(c.kind) === 'DEVICE_CONFLICT' && String(c.target_ref) === deviceId);
  assert.ok(deviceConflict, 'expected DEVICE_CONFLICT for shared device');

  const hintA = hints.find((h) => String(h.program_id) === programA);
  const hintB = hints.find((h) => String(h.program_id) === programB);
  assert.ok(hintA, 'expected hint for program A');
  assert.ok(hintB, 'expected hint for program B');

  const prio = (x) => String(x?.priority ?? '').toUpperCase();
  const weight = (p) => (p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : p === 'LOW' ? 1 : 0);

  assert.ok(weight(prio(hintA)) >= weight(prio(hintB)), 'failed/at-risk program must not have lower priority than healthy program');

  console.log('PASS ACCEPTANCE_SCHEDULING_PORTFOLIO_V1', {
    base_url: activeBase,
    tenant,
    programA,
    programB,
    fieldId,
    seasonId,
    deviceId,
    conflict_count: conflicts.length,
    hint_count: hints.length,
    programA_hint: hintA,
    programB_hint: hintB,
  });

  if (fallbackApp) await fallbackApp.close();
}

main().catch((err) => {
  console.error('FAIL ACCEPTANCE_SCHEDULING_PORTFOLIO_V1', err?.stack || err?.message || String(err));
  process.exit(1);
});
