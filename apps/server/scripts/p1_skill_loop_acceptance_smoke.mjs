const BASE_URL = process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
const TOKEN = process.env.GEOX_TOKEN ?? "";
const tenant = {
  tenant_id: process.env.GEOX_TENANT_ID ?? "tenantA",
  project_id: process.env.GEOX_PROJECT_ID ?? "projectA",
  group_id: process.env.GEOX_GROUP_ID ?? "groupA",
};
const OPERATION_PLAN_ID = String(process.env.GEOX_OPERATION_PLAN_ID ?? "").trim();
const TIMEOUT_MS = Math.max(5_000, Number(process.env.GEOX_ACCEPTANCE_TIMEOUT_MS ?? 60_000));
const POLL_MS = Math.max(200, Number(process.env.GEOX_ACCEPTANCE_POLL_MS ?? 1_000));

if (!TOKEN) throw new Error("MISSING_ENV:GEOX_TOKEN");
if (!OPERATION_PLAN_ID) throw new Error("MISSING_ENV:GEOX_OPERATION_PLAN_ID");

const headers = {
  accept: "application/json",
  authorization: `Bearer ${TOKEN}`,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFinalStatus(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function normalizeVerdict(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function buildDiagnostics(detail) {
  const op = detail?.operation ?? detail?.item ?? detail ?? {};
  const acceptance = op?.acceptance ?? {};
  const receipt = op?.receipt ?? detail?.receipt ?? {};
  const missingEvidence = Array.isArray(acceptance?.missing_evidence)
    ? acceptance.missing_evidence
    : Array.isArray(acceptance?.missingEvidence)
      ? acceptance.missingEvidence
      : [];
  const logsRefs = Array.isArray(receipt?.logs_refs)
    ? receipt.logs_refs
    : Array.isArray(receipt?.payload?.logs_refs)
      ? receipt.payload.logs_refs
      : [];

  return {
    operation_plan_id: String(op?.operation_plan_id ?? OPERATION_PLAN_ID),
    receipt_status: String(receipt?.status ?? op?.receipt_status ?? "").toUpperCase() || null,
    final_status: normalizeFinalStatus(op?.final_status),
    acceptance: {
      verdict: normalizeVerdict(acceptance?.verdict ?? acceptance?.status ?? acceptance?.result_status),
      missing_evidence: missingEvidence,
    },
    invalid_reason: String(op?.invalid_reason ?? acceptance?.invalid_reason ?? "") || null,
    evidence_bundle: {
      logs_count: logsRefs.length,
      report_json_present: Boolean(op?.report_json),
    },
  };
}

function isPassing(diag) {
  const allowedFinal = new Set(["SUCCESS", "SUCCEEDED", "VALID"]);
  return diag.acceptance.verdict === "PASS" && allowedFinal.has(diag.final_status);
}

function isHardFailure(diag) {
  const terminalBad = new Set(["INVALID_EXECUTION", "FAILED", "ERROR", "CANCELLED"]);
  if (terminalBad.has(diag.final_status)) return true;
  if (diag.acceptance.verdict === "FAIL") return true;
  return false;
}

async function fetchOperationDetail() {
  const query = new URLSearchParams(tenant).toString();
  const url = `${BASE_URL}/api/v1/operations/${encodeURIComponent(OPERATION_PLAN_ID)}/detail?${query}`;
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}: ${text}`);
  }
  return body;
}

async function main() {
  const started = Date.now();
  let last = null;

  while (Date.now() - started < TIMEOUT_MS) {
    const detail = await fetchOperationDetail();
    const diag = buildDiagnostics(detail);
    last = diag;

    console.log("[p1-acceptance-smoke][poll]", JSON.stringify(diag));

    if (isPassing(diag)) {
      console.log("[p1-acceptance-smoke] PASS: acceptance.verdict=PASS 且 final_status 命中 SUCCESS|SUCCEEDED|VALID");
      return;
    }
    if (isHardFailure(diag)) {
      console.error("[p1-acceptance-smoke] FAIL_HARD", JSON.stringify(diag));
      process.exit(1);
    }

    await sleep(POLL_MS);
  }

  console.error("[p1-acceptance-smoke] FAIL_TIMEOUT", JSON.stringify(last ?? {
    operation_plan_id: OPERATION_PLAN_ID,
    receipt_status: null,
    final_status: null,
    acceptance: { verdict: null, missing_evidence: [] },
    invalid_reason: null,
    evidence_bundle: { logs_count: 0, report_json_present: false },
  }));
  process.exit(1);
}

main().catch((err) => {
  console.error("[p1-acceptance-smoke] FAIL_EXCEPTION", err?.message ?? err);
  process.exit(1);
});
