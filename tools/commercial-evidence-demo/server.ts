// tools/commercial-evidence-demo/server.ts
// Purpose: standalone read-only Commercial Evidence Demo microsite.
// Boundary: this server is not registered in the GEOX production server. It executes existing pure Runtime/Twin Kernel code and optionally proxies the existing read-only Twin Trace API.

import { execFileSync, spawnSync } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommercialEvidencePacketV1 } from "./packet.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(ROOT, "../..");
const PORT = Number(process.env.COMMERCIAL_EVIDENCE_DEMO_PORT ?? 4177);
const GEOX_BASE_URL = String(process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const GEOX_OPERATOR_BASE_URL = String(process.env.GEOX_OPERATOR_BASE_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");

function subjectSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "UNPINNED_LOCAL_CHECKOUT";
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function sendStatic(res: ServerResponse, file: string): Promise<void> {
  const fullPath = join(ROOT, file);
  const body = await readFile(fullPath);
  const mime = extname(file) === ".html"
    ? "text/html; charset=utf-8"
    : extname(file) === ".js"
      ? "text/javascript; charset=utf-8"
      : "text/css; charset=utf-8";
  res.writeHead(200, {
    "content-type": mime,
    "cache-control": "no-store",
    "content-length": body.length,
  });
  res.end(body);
}

function safeDecisionCycleId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,240}$/.test(trimmed)) return null;
  return trimmed;
}

function buildRuntimeValueTrace(): unknown {
  const run = spawnSync(process.execPath, ["scripts/governance_acceptance/TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (run.status !== 0) {
    const diagnostic = String(run.stderr || run.stdout || "").trim().slice(0, 1200);
    throw new Error(`COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_FAILED:${run.status}:${diagnostic}`);
  }
  try {
    const parsed = JSON.parse(run.stdout.trim());
    if (parsed?.ok !== true || parsed?.runtime_builders_invoked !== true || parsed?.complete_tk_chain_built !== true) {
      throw new Error("RUNTIME_VALUE_TRACE_ACCEPTANCE_NOT_PASS");
    }
    return {
      ...parsed,
      demo_trace_mode: "CONTROLLED_IN_MEMORY_EXISTING_BUILDERS",
      production_authority: false,
      database_required: false,
      canonical_write_count: 0,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "RUNTIME_VALUE_TRACE_ACCEPTANCE_NOT_PASS") throw error;
    throw new Error("COMMERCIAL_EVIDENCE_RUNTIME_VALUE_TRACE_NON_JSON_OUTPUT");
  }
}

async function proxyTwinTrace(res: ServerResponse, decisionCycleId: string): Promise<void> {
  const upstream = await fetch(`${GEOX_BASE_URL}/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`, {
    headers: { accept: "application/json" },
  });
  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { ok: false, error: "UPSTREAM_NON_JSON_TRACE_RESPONSE", status: upstream.status };
  }
  sendJson(res, upstream.status, payload);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `127.0.0.1:${PORT}`}`);
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "COMMERCIAL_EVIDENCE_DEMO_READ_ONLY_GET_REQUIRED" });
      return;
    }

    if (url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "geox-commercial-evidence-demo", read_only: true });
      return;
    }

    if (url.pathname === "/api/demo") {
      sendJson(res, 200, {
        ok: true,
        ...buildCommercialEvidencePacketV1(),
        runtime_context: {
          subject_sha: subjectSha(),
          geox_base_url: GEOX_BASE_URL,
          geox_operator_base_url: GEOX_OPERATOR_BASE_URL,
          canonical_selector_source: "apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts",
          standalone_demo_server: true,
        },
      });
      return;
    }

    if (url.pathname === "/api/runtime-value-trace") {
      sendJson(res, 200, buildRuntimeValueTrace());
      return;
    }

    if (url.pathname === "/api/twin-trace") {
      const decisionCycleId = safeDecisionCycleId(url.searchParams.get("decision_cycle_id"));
      if (!decisionCycleId) {
        sendJson(res, 400, { ok: false, error: "DECISION_CYCLE_ID_REQUIRED_OR_INVALID" });
        return;
      }
      await proxyTwinTrace(res, decisionCycleId);
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      await sendStatic(res, "index.html");
      return;
    }
    if (url.pathname === "/app.js") {
      await sendStatic(res, "app.js");
      return;
    }
    if (url.pathname === "/styles.css") {
      await sendStatic(res, "styles.css");
      return;
    }

    sendJson(res, 404, { ok: false, error: "COMMERCIAL_EVIDENCE_DEMO_ROUTE_NOT_FOUND" });
  } catch (error: unknown) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(JSON.stringify({
    ok: true,
    service: "geox-commercial-evidence-demo",
    url: `http://127.0.0.1:${PORT}`,
    geox_base_url: GEOX_BASE_URL,
    geox_operator_base_url: GEOX_OPERATOR_BASE_URL,
    read_only: true,
    subject_sha: subjectSha(),
  }, null, 2));
});
