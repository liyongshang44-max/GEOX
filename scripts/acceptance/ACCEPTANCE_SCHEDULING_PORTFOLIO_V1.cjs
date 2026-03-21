#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = String(process.env.GEOX_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TOKEN = String(process.env.GEOX_AO_ACT_TOKEN || process.env.AO_ACT_TOKEN || 'geox_dev_MqF24b9NHfB6AkBNjKaxP_T0CnL0XZykhdmSyoQvg4').trim();

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function fetchJson(path, { method = 'GET', token = TOKEN, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
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

async function main() {
  const me = ensureOk(await fetchJson('/api/v1/auth/me'), 'auth_me');
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
    ensureOk(await fetchJson('/api/raw', {
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
    ensureOk(await fetchJson('/api/raw', {
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
  ensureOk(await fetchJson('/api/raw', {
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

  ensureOk(await fetchJson('/api/raw', {
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

  const conflictsResp = ensureOk(await fetchJson(withTenantQuery('/api/v1/scheduling/conflicts', tenant)), 'fetch_conflicts');
  const hintsResp = ensureOk(await fetchJson(withTenantQuery('/api/v1/scheduling/hints', tenant)), 'fetch_hints');

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
}

main().catch((err) => {
  console.error('FAIL ACCEPTANCE_SCHEDULING_PORTFOLIO_V1', err?.stack || err?.message || String(err));
  process.exit(1);
});
