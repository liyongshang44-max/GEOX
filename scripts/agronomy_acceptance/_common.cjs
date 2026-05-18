const assert = require('node:assert/strict');

function env(name, fallback = '') { return String(process.env[name] ?? fallback).trim(); }

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl) {
  const healthPaths = ['/api/v1/health', '/api/health', '/health'];
  const attempts = Number(process.env.SAMPLING_HEALTH_RETRY_ATTEMPTS || 30);
  const delayMs = Number(process.env.SAMPLING_HEALTH_RETRY_DELAY_MS || 1000);

  let last = '';

  for (let i = 0; i < attempts; i += 1) {
    for (const healthPath of healthPaths) {
      try {
        const res = await fetch(`${baseUrl}${healthPath}`, { method: 'GET' });
        last = `${healthPath} -> ${res.status}`;
        if (res.ok) return true;
      } catch (err) {
        last = `${healthPath} -> ${String(err?.message ?? err)}`;
      }
    }
    await sleep(delayMs);
  }

  throw new Error(`live API unavailable at ${baseUrl}; last_health=${last}`);
}

async function fetchJson(url, { method = 'GET', token = '', body = undefined } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function requireOk(resp, msg) {
  assert.equal(resp.ok, true, `${msg} status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.ok, true, `${msg} json.ok!=true body=${resp.text}`);
  return resp.json;
}

module.exports = { assert, env, fetchJson, requireOk, waitForHealth };
