import assert from "node:assert/strict";

const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const TOKEN = process.env.GEOX_TOKEN ?? "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
const OPERATION_PLAN_ID = process.env.GEOX_OPERATION_PLAN_ID ?? process.env.OPERATION_PLAN_ID ?? "";
const TIMEOUT_MS = Number(process.env.GEOX_ACCEPTANCE_TIMEOUT_MS ?? 60_000);
const POLL_INTERVAL_MS = Number(process.env.GEOX_ACCEPTANCE_POLL_INTERVAL_MS ?? 1_000);

const headers = {
  accept: "application/json",
  authorization: `Bearer ${TOKEN}`,
};

const SUCCESS_RULES = Object.freeze({
  acceptanceVerdict: new Set(["PASS"]),
  finalStatus: new Set(["SUCCESS", "SUCCEEDED", "VALID"]),
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonSafe(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  const text = await res.text();
  const body = readJsonSafe(text);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

function compactEvidenceBundle(bundle) {
  if (!bundle || typeof bundle !== "object") return null;
  const refs = Array.isArray(bundle.evidence_refs) ? bundle.evidence_refs : [];
  const kinds = refs.map((x) => x?.kind).filter(Boolean);
  return {
    evidence_count: refs.length,
    evidence_kinds: Array.from(new Set(kinds)).slice(0, 20),
    bundle_id: bundle.bundle_id ?? bundle.id ?? null,
  };
}

function extractDiagnostics(detail, listItem) {
  const operation = detail?.operation ?? {};
  const acceptance = operation.acceptance ?? detail?.acceptance ?? {};
  const receipt = operation.receipt ?? detail?.receipt ?? {};
  const report = operation.report_json ?? detail?.report_json ?? {};

  const finalStatusRaw = operation.final_status ?? detail?.final_status ?? listItem?.final_status ?? null;

  return {
    receipt_status: receipt.status ?? operation.receipt_status ?? null,
    final_status: finalStatusRaw ? String(finalStatusRaw).toUpperCase() : null,
    acceptance: {
      verdict: acceptance.verdict ? String(acceptance.verdict).toUpperCase() : null,
      missing_evidence: acceptance.missing_evidence ?? null,
      invalid_reason: acceptance.invalid_reason ?? null,
    },
    evidence_bundle: compactEvidenceBundle(report),
  };
}

function isTerminalSuccess(diag) {
  const verdict = diag.acceptance.verdict;
  const finalStatus = diag.final_status;
  return SUCCESS_RULES.acceptanceVerdict.has(verdict) && SUCCESS_RULES.finalStatus.has(finalStatus);
}

async function pollAcceptanceComplete(operationPlanId) {
  const startedAt = Date.now();
  let latest = null;

  while (Date.now() - startedAt <= TIMEOUT_MS) {
    const [detail, list] = await Promise.all([
      request(`/api/v1/operations/${encodeURIComponent(operationPlanId)}/detail`),
      request("/api/v1/operations"),
    ]);

    const listItem = (list.items ?? []).find(
      (x) => x.operation_plan_id === operationPlanId || x.operation_id === operationPlanId,
    );

    latest = extractDiagnostics(detail, listItem);

    if (isTerminalSuccess(latest)) {
      return latest;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const timeoutErr = new Error("acceptance smoke timeout before terminal success");
  timeoutErr.diagnostics = latest;
  throw timeoutErr;
}

async function main() {
  assert.ok(OPERATION_PLAN_ID, "缺少 GEOX_OPERATION_PLAN_ID/OPERATION_PLAN_ID");

  const result = await pollAcceptanceComplete(OPERATION_PLAN_ID);

  assert.ok(
    SUCCESS_RULES.acceptanceVerdict.has(result.acceptance.verdict),
    `acceptance.verdict 非成功值: ${result.acceptance.verdict}`,
  );
  assert.ok(
    SUCCESS_RULES.finalStatus.has(result.final_status),
    `final_status 非成功终态: ${result.final_status}`,
  );

  console.log(
    "[p1-acceptance-smoke] pass",
    JSON.stringify(
      {
        operation_plan_id: OPERATION_PLAN_ID,
        final_status: result.final_status,
        acceptance_verdict: result.acceptance.verdict,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  const diagnostics = err?.diagnostics ?? {};
  console.error(
    "[p1-acceptance-smoke] failed",
    JSON.stringify(
      {
        operation_plan_id: OPERATION_PLAN_ID || null,
        error: String(err?.message ?? err),
        receipt_status: diagnostics.receipt_status ?? null,
        final_status: diagnostics.final_status ?? null,
        acceptance_verdict: diagnostics.acceptance?.verdict ?? null,
        missing_evidence: diagnostics.acceptance?.missing_evidence ?? null,
        invalid_reason: diagnostics.acceptance?.invalid_reason ?? null,
        evidence_bundle: diagnostics.evidence_bundle ?? null,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
