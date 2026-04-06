"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDispatchOnce = runDispatchOnce;
const node_crypto_1 = __importDefault(require("node:crypto"));
const adapters_1 = require("./adapters/index.ts");
const claim_1 = require("./lib/claim.ts");
function parseBool(v, fallback) {
    if (v === undefined)
        return fallback;
    const s = String(v).trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on")
        return true;
    if (s === "0" || s === "false" || s === "no" || s === "off")
        return false;
    return fallback;
}
function parseArgs(argv) {
    const get = (k) => {
        const idx = argv.indexOf(`--${k}`);
        if (idx === -1)
            return undefined;
        const v = argv[idx + 1];
        if (!v || v.startsWith("--"))
            return undefined;
        return v;
    };
    const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3001";
    const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
    const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA";
    const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA";
    const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA";
    const executor_id = get("executor_id") ??
        process.env.GEOX_EXECUTOR_ID ??
        `dispatch_exec_${node_crypto_1.default.randomUUID().replace(/-/g, "")}`;
    const limit = Math.max(1, Number.parseInt(get("limit") ?? process.env.GEOX_EXECUTOR_LIMIT ?? "1", 10) || 1);
    const lease_seconds = Math.max(5, Math.min(300, Number.parseInt(get("lease_seconds") ?? process.env.GEOX_DISPATCH_LEASE_SECONDS ?? "30", 10) || 30));
    const act_task_id = get("act_task_id") ?? process.env.GEOX_ACT_TASK_ID ?? undefined;
    const auto_evaluate = parseBool(get("auto_evaluate") ?? process.env.GEOX_AUTO_EVALUATE, false);
    if (!token)
        throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)");
    return { baseUrl, token, tenant_id, project_id, group_id, executor_id, limit, lease_seconds, act_task_id, auto_evaluate };
}
async function httpJson(url, token, init) {
    const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
    };
    if (init?.body)
        headers["Content-Type"] = "application/json";
    const res = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
    const text = await res.text();
    let obj = null;
    try {
        obj = text ? JSON.parse(text) : {};
    }
    catch {
        obj = { _non_json: text };
    }
    if (!res.ok)
        throw new Error(`http ${res.status}: ${text}`);
    return obj;
}
function toAoActTask(item, args) {
    const taskPayload = item?.task?.payload ?? {};
    const taskMeta = taskPayload?.meta && typeof taskPayload.meta === "object" ? taskPayload.meta : {};
    const itemMeta = item?.meta && typeof item.meta === "object" ? item.meta : {};
    const act_task_id = String(item?.act_task_id ?? taskPayload?.act_task_id ?? "").trim();
    const command_id = String(item?.command_id ?? taskPayload?.command_id ?? act_task_id).trim();
    const action_type = String(taskPayload?.action_type ?? "").trim();
    const task_type = String(taskPayload?.task_type ?? taskMeta?.task_type ?? "").trim();
    const operation_plan_id = String(taskPayload?.operation_plan_id ??
        taskMeta?.operation_plan_id ??
        item?.operation_plan_id ??
        itemMeta?.operation_plan_id ??
        "").trim();
    if (!act_task_id || !command_id || !action_type || !operation_plan_id) {
        throw new Error(`invalid claim item payload: ${JSON.stringify(item)}`);
    }
    return {
        tenant_id: String(taskPayload?.tenant_id ?? args.tenant_id),
        project_id: String(taskPayload?.project_id ?? args.project_id),
        group_id: String(taskPayload?.group_id ?? args.group_id),
        act_task_id,
        command_id,
        action_type,
        task_type,
        operation_plan_id,
        adapter_type: String(taskPayload?.adapter_type ?? "").trim() || null,
        adapter_hint: String(item?.adapter_hint ?? "").trim() || null,
        parameters: taskPayload?.parameters && typeof taskPayload.parameters === "object" ? taskPayload.parameters : {},
        meta: taskMeta,
        outbox_fact_id: typeof item?.outbox_fact_id === "string" ? item.outbox_fact_id : null,
        device_id: typeof item?.device_id === "string" ? item.device_id : null,
        downlink_topic: typeof item?.downlink_topic === "string" ? item.downlink_topic : null,
        qos: Number.isFinite(Number(item?.qos)) ? Number(item.qos) : 1,
        retain: typeof item?.retain === "boolean" ? item.retain : false
    };
}
const recentTerminalByTask = new Map();
const DEFAULT_TERMINAL_DEDUPE_MS = 120000;
function parseTerminalDedupeMs() {
    const raw = process.env.GEOX_EXECUTOR_TERMINAL_DEDUPE_MS ?? `${DEFAULT_TERMINAL_DEDUPE_MS}`;
    const parsed = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(parsed))
        return DEFAULT_TERMINAL_DEDUPE_MS;
    return Math.max(10000, parsed);
}
function sweepExpiredTerminalDedupe(nowMs) {
    for (const [taskId, untilMs] of recentTerminalByTask.entries()) {
        if (untilMs > nowMs)
            continue;
        recentTerminalByTask.delete(taskId);
    }
}
function shouldSkipByTerminalDedupe(taskId, nowMs) {
    const terminalUntilMs = recentTerminalByTask.get(taskId) ?? 0;
    if (terminalUntilMs <= nowMs)
        return false;
    console.log(`TERMINAL_DEDUPE_SKIP act_task_id=${taskId} terminal_until_ts=${terminalUntilMs}`);
    return true;
}
function markTerminalDedupe(taskId, nowMs, dedupeMs) {
    recentTerminalByTask.set(taskId, nowMs + dedupeMs);
}
function logExecutionEvent(task, adapter, status, startedAtMs) {
    const durationMs = Math.max(0, Date.now() - startedAtMs);
    const payload = {
        task_id: task.act_task_id,
        program_id: String(task.meta?.program_id ?? task.operation_plan_id ?? "").trim() || null,
        device_id: String(task.device_id ?? task.meta?.device_id ?? "").trim() || null,
        adapter,
        status,
        duration_ms: durationMs
    };
    console.log(`EXECUTION_EVENT ${JSON.stringify(payload)}`);
}
function normalizeDispatchError(error, adapterType) {
    const raw = String(error?.message ?? error ?? "").trim();
    const upper = raw.toUpperCase();
    if (upper.includes("OFFLINE") || upper.includes("TIMEOUT") || upper.includes("ECONNREFUSED")) {
        return { code: "DEVICE_OFFLINE", reason: "DEVICE_OFFLINE", message: raw || "device offline" };
    }
    if (upper.startsWith("ADAPTER_VALIDATE_FAILED")) {
        return { code: "ADAPTER_VALIDATE_FAILED", reason: "ADAPTER_VALIDATE_FAILED", message: raw };
    }
    if (upper.startsWith("ADAPTER_UNSUPPORTED_ACTION")) {
        return { code: "ADAPTER_UNSUPPORTED_ACTION", reason: "ADAPTER_UNSUPPORTED_ACTION", message: raw };
    }
    if (upper.includes("DISPATCH_ERROR")) {
        return { code: "DISPATCH_EXEC_ERROR", reason: "DISPATCH_EXEC_ERROR", message: raw };
    }
    return {
        code: "DISPATCH_FAILED",
        reason: adapterType ? `DISPATCH_FAILED_${String(adapterType).toUpperCase()}` : "DISPATCH_FAILED",
        message: raw || "dispatch failed"
    };
}
async function writeDispatchState(args, task, state, extra = {}) {
    console.log(`INFO: writing dispatch state act_task_id=${task.act_task_id} state=${state}`);
    try {
        const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/dispatches/state`, args.token, {
            method: "POST",
            body: JSON.stringify({
                tenant_id: task.tenant_id,
                project_id: task.project_id,
                group_id: task.group_id,
                act_task_id: task.act_task_id,
                command_id: task.command_id,
                state,
                ...extra
            })
        });
        if (!out?.ok)
            throw new Error(`dispatch state write failed state=${state} task=${task.act_task_id}`);
    }
    catch (error) {
        const msg = String(error?.message ?? error);
        if ((state === "ACKED" || state === "FAILED") && msg.includes("http 409") && (msg.includes("STATE_TRANSITION_DENIED") || msg.includes("OPERATION_PLAN_TERMINAL"))) {
            console.log(`WARN: dispatch state ${state.toLowerCase()} skipped act_task_id=${task.act_task_id} reason=already_terminal`);
            return;
        }
        throw error;
    }
}
async function getReceipts(args, task) {
    const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(task.tenant_id)}&project_id=${encodeURIComponent(task.project_id)}&group_id=${encodeURIComponent(task.group_id)}&act_task_id=${encodeURIComponent(task.act_task_id)}&limit=50`, args.token, { method: "GET" });
    return Array.isArray(out?.items) ? out.items : [];
}
async function readOperationPlan(args, task) {
    const out = await httpJson(`${args.baseUrl}/api/v1/operations/plans/${encodeURIComponent(task.operation_plan_id)}?tenant_id=${encodeURIComponent(task.tenant_id)}&project_id=${encodeURIComponent(task.project_id)}&group_id=${encodeURIComponent(task.group_id)}`, args.token, { method: "GET" });
    return out?.item ?? null;
}
async function logPostReceiptPlanState(args, task, nextStep) {
    try {
        const planItem = await readOperationPlan(args, task);
        const postStatus = String(planItem?.plan?.record_json?.payload?.status ?? "").trim().toUpperCase();
        const receiptFactId = String(planItem?.plan?.record_json?.payload?.receipt_fact_id ?? "").trim();
        console.log(JSON.stringify({
            act_task_id: task.act_task_id,
            post_receipt_plan_status: postStatus || null,
            post_receipt_receipt_fact_id: receiptFactId || null,
            next_step: nextStep
        }));
        return { status: postStatus, receipt_fact_id: receiptFactId || null };
    }
    catch (error) {
        console.log(JSON.stringify({
            act_task_id: task.act_task_id,
            post_receipt_plan_status: null,
            post_receipt_receipt_fact_id: null,
            next_step: nextStep,
            plan_read_error: String(error?.message ?? error)
        }));
        return { status: "", receipt_fact_id: null };
    }
}
function hasReceiptIdempotencyKey(items, taskId, attemptNo, receiptCode) {
    const expected = `${taskId}:${attemptNo}:${receiptCode}`;
    return items.some((item) => String(item?.receipt?.payload?.meta?.idempotency_key ?? "").trim() === expected);
}
async function appendReceiptV1(args, task, attemptNo, receipt_status, adapter_type, receipt_code, receipt_message, raw_receipt_ref) {
    const receiptCode = String(receipt_code ?? receipt_status).trim() || receipt_status;
    const idempotencyKey = `${task.act_task_id}:${attemptNo}:${receiptCode}`;
    const existing = await getReceipts(args, task);
    if (hasReceiptIdempotencyKey(existing, task.act_task_id, attemptNo, receiptCode)) {
        console.log(`INFO: dedupe receipt hit idempotency_key=${idempotencyKey}`);
        return;
    }
    const now = Date.now();
    const mappedStatus = receipt_status === "FAILED" ? "not_executed" : "executed";
    const operationPlanId = String(task.operation_plan_id ?? task.meta?.operation_plan_id ?? "").trim();
    const commandId = String(task.command_id ?? task.act_task_id).trim();
    if (!operationPlanId)
        throw new Error("MISSING_OPERATION_PLAN_ID");
    if (!commandId)
        throw new Error("MISSING_COMMAND_ID");
    try {
        const out = await httpJson(`${args.baseUrl}/api/v1/ao-act/receipts`, args.token, {
            method: "POST",
            body: JSON.stringify({
                tenant_id: task.tenant_id,
                project_id: task.project_id,
                group_id: task.group_id,
                task_id: task.act_task_id,
                act_task_id: task.act_task_id,
                command_id: commandId,
                operation_plan_id: operationPlanId,
                executor_id: {
                    kind: "script",
                    id: args.executor_id,
                    namespace: "executor_runtime_v1"
                },
                execution_time: { start_ts: now - 100, end_ts: now },
                execution_coverage: {
                    kind: "field",
                    ref: String(task.meta?.field_id ?? task.meta?.target_ref ?? "executor_dispatch")
                },
                resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 },
                logs_refs: [{ kind: "stdout", ref: raw_receipt_ref ?? `executor://run_dispatch_once/${task.act_task_id}` }],
                status: mappedStatus,
                constraint_check: { violated: false, violations: [] },
                observed_parameters: {},
                meta: {
                    schema: "ao_act_receipt_v1",
                    task_id: task.act_task_id,
                    command_id: commandId,
                    operation_plan_id: operationPlanId,
                    device_id: task.device_id ?? "",
                    adapter_type,
                    attempt_no: attemptNo,
                    receipt_status,
                    receipt_code: receiptCode,
                    receipt_message: receipt_message ?? null,
                    raw_receipt_ref: raw_receipt_ref ?? null,
                    received_ts: now,
                    idempotency_key: idempotencyKey
                }
            })
        });
        if (!out?.ok)
            throw new Error(`append receipt failed: ${JSON.stringify(out)}`);
    }
    catch (error) {
        const msg = String(error?.message ?? error);
        if (msg.includes("TASK_ALREADY_HAS_RECEIPT")) {
            console.log(`WARN: receipt append skipped act_task_id=${task.act_task_id} reason=already_has_receipt`);
            return;
        }
        if (msg.includes("http 409") && msg.includes("DUPLICATE_RECEIPT")) {
            console.log(`WARN: receipt append dedupe act_task_id=${task.act_task_id} idempotency_key=${idempotencyKey}`);
            return;
        }
        throw error;
    }
}
async function runDispatchOnce(cliArgs) {
    const args = parseArgs(cliArgs ?? process.argv.slice(2));
    const terminalDedupeMs = parseTerminalDedupeMs();
    sweepExpiredTerminalDedupe(Date.now());
    if (args.auto_evaluate) {
        console.log("WARN: auto_evaluate=true requested, but executor keeps acceptance decoupled and will not auto-evaluate.");
    }
    const registry = (0, adapters_1.createAdapterRegistry)({ baseUrl: args.baseUrl, token: args.token, executor_id: args.executor_id });
    const claimed = await (0, claim_1.claimDispatchTasks)({
        baseUrl: args.baseUrl,
        token: args.token,
        tenant_id: args.tenant_id,
        project_id: args.project_id,
        group_id: args.group_id,
        executor_id: args.executor_id,
        limit: args.limit,
        lease_seconds: args.lease_seconds,
        ...(args.act_task_id ? { act_task_id: args.act_task_id } : {})
    });
    console.log(`INFO: claimed queue size=${claimed.length}`);
    if (claimed.length < 1) {
        console.log("INFO: no claimed dispatch items found (no-op)");
        return;
    }
    for (const item of claimed.slice(0, args.limit)) {
        const task = toAoActTask(item, args);
        const nowMs = Date.now();
        if (shouldSkipByTerminalDedupe(task.act_task_id, nowMs))
            continue;
        const adapterType = String(task.adapter_type ?? task.adapter_hint ?? "").trim().toLowerCase();
        const adapter = (0, adapters_1.findAdapterByType)(registry, adapterType);
        const startedAtMs = Date.now();
        let executionStatus = "FAILED";
        let adapterTypeForLog = String(adapter.type ?? adapter.adapter_type ?? adapterType).trim() || adapterType;
        try {
            const supportsAction = task.task_type || task.action_type;
            const supportsInput = adapterType === "mqtt" ? task : supportsAction;
            const supportsResult = typeof adapter.supports === "function" ? adapter.supports(supportsInput) : true;
            console.log("[dispatch-debug]", {
                selected_adapter: adapterTypeForLog,
                adapter_type: adapterType,
                task_type: task.task_type || "",
                action_type: task.action_type,
                supports_input: typeof supportsInput === "string" ? supportsInput : "[task-object]",
                supports_result: supportsResult
            });
            if (!supportsResult) {
                throw new Error(`ADAPTER_UNSUPPORTED_ACTION:${adapterType}:${supportsAction}`);
            }
            if (typeof adapter.validate === "function") {
                const validation = adapter.validate(task);
                if (!validation.ok)
                    throw new Error(`ADAPTER_VALIDATE_FAILED:${adapterType}:${validation.reason}`);
            }
            const attemptNo = Math.max(1, Number(item?.attempt_no ?? item?.attempt_count ?? 1));
            console.log(`INFO: claimed task act_task_id=${task.act_task_id} attempt_no=${attemptNo}`);
            await writeDispatchState(args, task, "DISPATCHED");
            const execTask = {
                ...task,
                runtime: {
                    executor_id: args.executor_id,
                    lease_token: String(item?.lease_token ?? "") || undefined,
                    lease_until_ts: item?.lease_until_ts ? Number(item.lease_until_ts) : undefined,
                    attempt_no: attemptNo
                }
            };
            const execution = await adapter.execute(execTask);
            const adapterTypeNormalized = String(adapter.type ?? adapter.adapter_type ?? adapterType).trim() || adapterType;
            adapterTypeForLog = adapterTypeNormalized;
            const execMeta = execution?.meta ?? {};
            const receiptStatus = String(execMeta?.receipt_status ?? (execution.status === "FAILED" ? "FAILED" : "ACKED")).toUpperCase();
            console.log(`INFO: adapter dispatch result act_task_id=${task.act_task_id} command_id=${task.command_id} receipt_status=${receiptStatus}`);
            if (execution.status === "FAILED" || receiptStatus === "FAILED") {
                const normalizedError = normalizeDispatchError(execMeta?.reason ?? execMeta?.receipt_message ?? execMeta?.receipt_code ?? "DISPATCH_FAILED", adapterTypeNormalized);
                await appendReceiptV1(args, task, attemptNo, "FAILED", adapterTypeNormalized, String(execMeta?.receipt_code ?? normalizedError.code), typeof execMeta?.receipt_message === "string" ? execMeta.receipt_message : normalizedError.message);
                const postReceipt = await logPostReceiptPlanState(args, task, "write_failed_state");
                if (postReceipt.status === "SUCCEEDED" || postReceipt.status === "FAILED") {
                    console.log(`WARN: skip failed state write act_task_id=${task.act_task_id} reason=plan_already_terminal`);
                }
                else {
                    await writeDispatchState(args, task, "FAILED", {
                        failure_code: normalizedError.code,
                        failure_reason: normalizedError.reason,
                        failure_message: normalizedError.message,
                        device_offline: normalizedError.code === "DEVICE_OFFLINE",
                        attempt_no: attemptNo,
                        max_retries: 3,
                        retry_exhausted: attemptNo >= 3,
                        adapter_type: adapterTypeNormalized,
                        device_context: {
                            device_id: task.device_id ?? null,
                            adapter_type: adapterTypeNormalized,
                            executor_id: args.executor_id,
                            attempt_no: attemptNo
                        }
                    });
                }
                markTerminalDedupe(task.act_task_id, Date.now(), terminalDedupeMs);
                executionStatus = "FAILED";
                console.log(`PASS: dispatch failed act_task_id=${task.act_task_id} attempt_no=${attemptNo}`);
                continue;
            }
            const postReceipt = await logPostReceiptPlanState(args, task, "write_acked_state");
            if (postReceipt.status === "SUCCEEDED" || postReceipt.status === "FAILED") {
                console.log(`WARN: skip acked state write act_task_id=${task.act_task_id} reason=plan_already_terminal`);
            }
            else {
                await writeDispatchState(args, task, "ACKED");
            }
            markTerminalDedupe(task.act_task_id, Date.now(), terminalDedupeMs);
            executionStatus = "SUCCEEDED";
            console.log(`PASS: dispatch acked act_task_id=${task.act_task_id} attempt_no=${attemptNo}`);
        }
        catch (error) {
            const attemptNo = Math.max(1, Number(item?.attempt_no ?? item?.attempt_count ?? 1));
            const normalizedError = normalizeDispatchError(error, adapterType);
            console.log(`ERROR_CODE: act_task_id=${task.act_task_id} code=${normalizedError.code} reason=${normalizedError.reason}`);
            await appendReceiptV1(args, task, attemptNo, "FAILED", adapterType, normalizedError.code, normalizedError.message);
            await writeDispatchState(args, task, "FAILED", {
                failure_code: normalizedError.code,
                failure_reason: normalizedError.reason,
                failure_message: normalizedError.message,
                device_offline: normalizedError.code === "DEVICE_OFFLINE",
                attempt_no: attemptNo,
                max_retries: 3,
                retry_exhausted: attemptNo >= 3,
                adapter_type: adapterType,
                device_context: {
                    device_id: task.device_id ?? null,
                    adapter_type: adapterType,
                    executor_id: args.executor_id,
                    attempt_no: attemptNo
                }
            });
            markTerminalDedupe(task.act_task_id, Date.now(), terminalDedupeMs);
            executionStatus = "FAILED";
            throw error;
        }
        finally {
            logExecutionEvent(task, adapterTypeForLog, executionStatus, startedAtMs);
        }
    }
}
async function main() {
    await runDispatchOnce(process.argv.slice(2));
}
if (require.main === module) {
    main().catch((err) => {
        console.error(`FAIL: ${err?.message ?? String(err)}`);
        process.exit(1);
    });
}
