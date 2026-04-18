#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.GEOX_BASE_URL || "http://127.0.0.1:3001";
const POLL_INTERVAL_MS = Number(process.env.GEOX_SMOKE_POLL_INTERVAL_MS || 2000);
const TIMEOUT_MS = Number(process.env.GEOX_SMOKE_TIMEOUT_MS || 120000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const TOKEN_CANDIDATE_FILES = [
  path.join(REPO_ROOT, "config/auth/example_tokens.json"),
  path.join(REPO_ROOT, "config/auth/ao_act_tokens_v0.json"),
];
const EXPECTED_TENANT = String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA";
const EXPECTED_PROJECT = String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA";
const EXPECTED_GROUP = String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTokenFile(tokenFilePath) {
  if (!fs.existsSync(tokenFilePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
  const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
  for (const row of tokens) {
    const token = typeof row?.token === "string" ? row.token.trim() : "";
    const scopes = Array.isArray(row?.scopes) ? row.scopes.map((s) => String(s)) : [];
    const tenant = String(row?.tenant_id ?? "").trim();
    const project = String(row?.project_id ?? "").trim();
    const group = String(row?.group_id ?? "").trim();
    const revoked = Boolean(row?.revoked);
    if (!token || revoked) continue;
    if (token.includes("set-via-env-or-external-secret-file")) continue;
    if (tenant !== EXPECTED_TENANT || project !== EXPECTED_PROJECT || group !== EXPECTED_GROUP) continue;
    if (!scopes.includes("evidence_export.read") || !scopes.includes("evidence_export.write")) continue;
    return token;
  }
  return null;
}

function resolveAoActToken() {
  const fromEnv = String(process.env.GEOX_AO_ACT_TOKEN || "").trim();
  if (fromEnv) return fromEnv;

  for (const tokenFilePath of TOKEN_CANDIDATE_FILES) {
    const candidate = parseTokenFile(tokenFilePath);
    if (candidate) return candidate;
  }
  throw new Error(
    `MISSING_GEOX_AO_ACT_TOKEN: set GEOX_AO_ACT_TOKEN or provide a valid token in one of ${TOKEN_CANDIDATE_FILES.join(", ")}`
  );
}

const AO_ACT_TOKEN = resolveAoActToken();
const AUTH_HEADER = process.env.GEOX_AUTH_HEADER || `Bearer ${AO_ACT_TOKEN}`;

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
  const requestUrl = `${BASE_URL}${path}`;
  const res = await fetch(requestUrl, {
    method: "GET",
    redirect: "manual",
    headers: { authorization: AUTH_HEADER },
  });
  if (res.status === 302 || res.status === 307) {
    const location = String(res.headers.get("location") || "");
    assert(location.length > 0, `redirect location missing for ${path}`);
    console.log(`[smoke] final fetch url (${path}) = ${location}`);
    const redirected = await fetch(location, { method: "GET" });
    assert(redirected.ok, `redirect target download failed for ${path}: HTTP_${redirected.status}`);
    return;
  }
  console.log(`[smoke] final fetch url (${path}) = ${requestUrl}`);
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
  console.log("[smoke] create response =", JSON.stringify(createRes, null, 2));

  const jobId = String(createRes?.job_id || "").trim();
  assert(jobId, `job_id missing in create response: ${JSON.stringify(createRes)}`);

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
  console.log("[smoke] final polled job =", JSON.stringify(job, null, 2));
  const delivery = job?.evidence_pack?.delivery || {};
  console.log("[smoke] artifact_path =", String(job?.artifact_path || ""));
  console.log("[smoke] object_store_bundle_path =", String(job?.object_store_bundle_path || ""));
  console.log("[smoke] object_store_manifest_path =", String(job?.object_store_manifest_path || ""));
  console.log("[smoke] pack_object_store_key =", String(job?.pack_object_store_key || ""));
  assert(String(delivery.storage_mode) === "S3_COMPAT", `expected storage_mode S3_COMPAT, got ${delivery.storage_mode}`);
  assert(typeof delivery.object_store_key === "string" && delivery.object_store_key.length > 0, "object_store_key missing");
  const partUrls = delivery?.object_store_part_download_urls || {};
  console.log("[smoke] final fetch url (bundle) =", String(partUrls?.bundle || `${BASE_URL}/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=bundle`));
  console.log("[smoke] final fetch url (manifest) =", String(partUrls?.manifest || `${BASE_URL}/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=manifest`));
  console.log("[smoke] final fetch url (checksums) =", String(partUrls?.checksums || `${BASE_URL}/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=checksums`));

  await assertDownload(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=bundle`);
  await assertDownload(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=manifest`);
  await assertDownload(`/api/v1/evidence-export/jobs/${encodeURIComponent(jobId)}/download?part=checksums`);

  console.log(JSON.stringify({ ok: true, base_url: BASE_URL, job_id: jobId, storage_mode: delivery.storage_mode, object_store_key: delivery.object_store_key }, null, 2));
}

main().catch((err) => {
  console.error(`[evidence_export_s3_smoke] ${err?.stack || err}`);
  process.exit(1);
});
