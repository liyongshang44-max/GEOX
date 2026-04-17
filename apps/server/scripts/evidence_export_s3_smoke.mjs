#!/usr/bin/env node

const BASE_URL = process.env.GEOX_BASE_URL || "http://127.0.0.1:3001";
const AUTH_HEADER = process.env.GEOX_AUTH_HEADER || "Bearer x";
const POLL_INTERVAL_MS = Number(process.env.GEOX_SMOKE_POLL_INTERVAL_MS || 2000);
const TIMEOUT_MS = Number(process.env.GEOX_SMOKE_TIMEOUT_MS || 120000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: AUTH_HEADER,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) throw new Error(`HTTP_${res.status} ${path} -> ${JSON.stringify(payload)}`);
  return payload;
}

async function assertDownload(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: { authorization: AUTH_HEADER },
  });
  if (res.status === 302 || res.status === 307) {
    const location = String(res.headers.get("location") || "");
    assert(location.length > 0, `redirect location missing for ${path}`);
    const redirected = await fetch(location, { method: "GET" });
    assert(redirected.ok, `redirect target download failed for ${path}: HTTP_${redirected.status}`);
    return;
  }
  assert(res.ok, `download failed for ${path}: HTTP_${res.status}`);
}

async function main() {
  const createPayload = {
    scope_type: "TENANT",
    export_format: "JSON",
    export_language: "zh-CN",
    from_ts_ms: 0,
    to_ts_ms: Date.now(),
  };

  const createRes = await requestJson("/api/v1/evidence-export/jobs", {
    method: "POST",
    body: JSON.stringify(createPayload),
  });

  const jobId = String(createRes?.job?.job_id || "").trim();
  assert(jobId, "job_id missing in create response");

  const startedAt = Date.now();
  let job = null;
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const detail = await requestJson(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}`);
    job = detail?.job || null;
    if (String(job?.status || "") === "DONE") break;
    if (String(job?.status || "") === "ERROR") {
      throw new Error(`job failed: ${JSON.stringify(job)}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  assert(job && String(job.status) === "DONE", `job not DONE within ${TIMEOUT_MS}ms`);
  const delivery = job?.evidence_pack?.delivery || {};
  assert(String(delivery.storage_mode) === "S3_COMPAT", `expected storage_mode S3_COMPAT, got ${delivery.storage_mode}`);
  assert(typeof delivery.object_store_key === "string" && delivery.object_store_key.length > 0, "object_store_key missing");

  await assertDownload(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=bundle`);
  await assertDownload(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=manifest`);
  await assertDownload(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=checksums`);

  console.log(JSON.stringify({ ok: true, base_url: BASE_URL, job_id: jobId, storage_mode: delivery.storage_mode, object_store_key: delivery.object_store_key }, null, 2));
}

main().catch((err) => {
  console.error(`[evidence_export_s3_smoke] ${err?.stack || err}`);
  process.exit(1);
});
