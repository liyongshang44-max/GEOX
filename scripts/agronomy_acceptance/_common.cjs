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

function originOf(url) {
  try { return new URL(url).origin; }
  catch { return ''; }
}

function retryDelayMs(attemptIndex) {
  const baseDelay = Number(process.env.ACCEPTANCE_FETCH_RETRY_DELAY_MS || 250);
  return Math.min(2000, baseDelay * Math.max(1, attemptIndex + 1));
}

async function healthSnapshot(url) {
  const origin = originOf(url);
  if (!origin) return 'origin_unavailable';
  for (const healthPath of ['/api/v1/health', '/api/health', '/health']) {
    try {
      const res = await fetch(`${origin}${healthPath}`, { method: 'GET' });
      return `${healthPath} -> ${res.status}`;
    } catch (err) {
      return `${healthPath} -> ${String(err?.message ?? err)}`;
    }
  }
  return 'health_unavailable';
}

async function fetchJson(url, { method = 'GET', token = '', body = undefined } = {}) {
  const attempts = Math.max(1, Number(process.env.ACCEPTANCE_FETCH_RETRY_ATTEMPTS || 5));
  let lastError = null;
  let lastStatus = null;
  let lastText = '';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      lastStatus = res.status;
      lastText = text;
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt + 1 < attempts) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return { status: res.status, ok: res.ok, json, text };
    } catch (err) {
      lastError = err;
      if (attempt + 1 >= attempts) break;
      await sleep(retryDelayMs(attempt));
    }
  }

  const health = await healthSnapshot(url);
  const reason = lastError ? String(lastError?.stack || lastError?.message || lastError) : `last_status=${lastStatus} body=${lastText}`;
  throw new Error(`fetchJson failed after ${attempts} attempt(s): ${method} ${url}; health=${health}; reason=${reason}`);
}

function requireOk(resp, msg) {
  assert.equal(resp.ok, true, `${msg} status=${resp.status} body=${resp.text}`);
  assert.equal(resp.json?.ok, true, `${msg} json.ok!=true body=${resp.text}`);
  return resp.json;
}

module.exports = { assert, env, fetchJson, requireOk, waitForHealth };