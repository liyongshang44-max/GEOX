const assert = require('node:assert/strict'); // 断言库，用于验收校验。
const crypto = require('node:crypto'); // 生成随机后缀，避免测试对象冲突。
const { execFile } = require('node:child_process'); // 执行本地命令行子进程。
const { promisify } = require('node:util'); // 将回调风格 API 转成 Promise。

const execFileAsync = promisify(execFile); // 将 execFile Promise 化，便于 await 调用。

function env(name, fallback = '') { return String(process.env[name] ?? fallback).trim(); } // 读取环境变量并做字符串归一化。

async function fetchJson(url, { method = 'GET', token = '', body = undefined } = {}) { // 统一 HTTP JSON 请求帮助函数。
  const res = await fetch(url, { // 发起 HTTP 请求。
    method, // HTTP 方法。
    headers: { // 请求头。
      ...(body === undefined ? {} : { 'content-type': 'application/json' }), // 仅在有 body 时发送 JSON content-type。
      accept: 'application/json', // 期望服务端返回 JSON。
      ...(token ? { authorization: `Bearer ${token}` } : {}) // 若提供 token，则携带 Bearer 鉴权头。
    },
    body: body === undefined ? undefined : JSON.stringify(body) // 若有 body，则序列化为 JSON 字符串。
  }); // fetch 结束。
  const text = await res.text(); // 读取原始文本，便于调试失败响应。
  let json = null; // 默认 JSON 为空。
  try { json = text ? JSON.parse(text) : null; } catch {} // 尝试解析 JSON，失败则保持 null。
  return { status: res.status, ok: res.ok, json, text }; // 返回统一响应结构。
} // fetchJson 结束。

function requireOk(resp, label) { // 断言响应必须是 HTTP 成功且 json.ok 为 true。
  assert.equal(resp.ok, true, `${label} status=${resp.status} body=${resp.text}`); // 断言 HTTP 状态成功。
  assert.equal(resp.json?.ok, true, `${label} json.ok!=true body=${resp.text}`); // 断言业务层 ok=true。
  return resp.json; // 返回解析后的 JSON。
} // requireOk 结束。

function recommendationBody(triple, deviceId, suffix) { // 构造 recommendation generate 请求体。
  return {
    tenant_id: triple.tenant_id, // 租户 ID。
    project_id: triple.project_id, // 项目 ID。
    group_id: triple.group_id, // 分组 ID。
    field_id: env('FIELD_ID', 'field_c8_demo'), // 地块 ID，允许环境变量覆盖。
    season_id: env('SEASON_ID', 'season_demo'), // 季节 ID，允许环境变量覆盖。
    device_id: deviceId, // 目标设备 ID。
    telemetry: { soil_moisture_pct: 18, canopy_temp_c: 33 }, // 最小可触发灌溉建议的 telemetry。
    image_recognition: { stress_score: 0.8, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 }, // 最小图像推理输入。
    meta: { note: `executor_runtime_v1_${suffix}` } // 测试标记，便于追踪。
  }; // 返回 recommendation body。
} // recommendationBody 结束。

async function createApprovedTaskViaRecommendation(base, adminToken, triple, suffix, deviceId) { // 用 admin token 走 recommendation -> approval -> approve -> task 合法链路。
  const recResp = await fetchJson(`${base}/api/v1/recommendations/generate`, { // 生成 recommendation。
    method: 'POST', // POST 请求。
    token: adminToken, // 使用 admin token。
    body: recommendationBody(triple, deviceId, suffix) // 请求体。
  }); // recommendation 请求完成。
  const recOut = requireOk(recResp, `generate recommendation ${suffix}`); // 断言 recommendation 成功。
  const recommendationId = String(recOut.recommendations?.[0]?.recommendation_id ?? '').trim(); // 提取 recommendation_id。
  assert.ok(recommendationId, `recommendation_id missing for ${suffix}; body=${JSON.stringify(recOut)}`); // 必须拿到 recommendation_id。

  const submitResp = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recommendationId)}/submit-approval`, { // 提交审批。
    method: 'POST', // POST 请求。
    token: adminToken, // 使用 admin token。
    body: { ...triple } // 仅需租户三元组。
  }); // submit approval 请求完成。
  const submitOut = requireOk(submitResp, `submit approval ${suffix}`); // 断言提交审批成功。

  const approvalRequestId = String(submitOut.approval_request_id ?? '').trim(); // 提取 approval_request_id。
  assert.ok(approvalRequestId, `approval_request_id missing for ${suffix}; body=${JSON.stringify(submitOut)}`); // 必须拿到 approval_request_id。

  const decideResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approvalRequestId)}/decide`, { // 审批通过。
    method: 'POST', // POST 请求。
    token: adminToken, // 使用 admin token。
    body: {
      ...triple, // 租户三元组。
      decision: 'APPROVE', // 通过审批。
      reason: `executor_runtime_v1_${suffix}` // 审批原因。
    } // 审批 body。
  }); // approve 请求完成。
  const decideOut = requireOk(decideResp, `approve request ${suffix}`); // 断言审批成功。

  const actTaskId = String(decideOut.act_task_id ?? '').trim(); // 提取 act_task_id。
  const operationPlanId = String(decideOut.operation_plan_id ?? '').trim(); // 提取 operation_plan_id。
  assert.ok(actTaskId, `act_task_id missing in approve response: ${JSON.stringify(decideOut)}`); // act_task_id 必须存在。
  assert.ok(operationPlanId, `operation_plan_id missing in approve response: ${JSON.stringify(decideOut)}`); // operation_plan_id 必须存在。

  return { recommendationId, approvalRequestId, operationPlanId, actTaskId }; // 返回后续需要的链路对象。
} // createApprovedTaskViaRecommendation 结束。

async function createTaskWithUnsupportedAction(base, adminToken, triple, operationPlanId, suffix, deviceId) { // 使用 admin token 创建一个 adapter 不支持的 action，用于负例验证。
  return fetchJson(`${base}/api/v1/ao-act/tasks`, { // 发起创建 task 请求。
    method: 'POST', // POST 请求。
    token: adminToken, // 使用 admin token。
    body: {
      ...triple, // 租户三元组。
      operation_plan_id: operationPlanId, // 使用真实 operation_plan_id，避免 404。
      approval_request_id: `apr_neg_${suffix}`, // 负例审批请求 ID。
      issuer: { kind: 'system', id: 'acceptance_negative' }, // 测试签发者。
      action_type: 'spray.start', // irrigation adapter 不支持的动作。
      target: { kind: 'device', id: deviceId }, // 目标设备。
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 60000 }, // 最小时间窗。
      parameter_schema: { type: 'object' }, // 参数 schema。
      parameters: { dosage_ml: 1 }, // 测试参数。
      constraints: {}, // 约束对象。
      meta: { device_id: deviceId, adapter_type: 'irrigation_http_v1' } // 指定 adapter。
    } // task body。
  }); // create task 请求完成。
} // createTaskWithUnsupportedAction 结束。

async function listReceipts(base, readToken, triple, actTaskId) { // 列出 receipt，供验收校验。
  return fetchJson(
    `${base}/api/v1/ao-act/receipts?tenant_id=${encodeURIComponent(triple.tenant_id)}&project_id=${encodeURIComponent(triple.project_id)}&group_id=${encodeURIComponent(triple.group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`,
    { method: 'GET', token: readToken }
  ); // 返回 receipts 查询结果。
} // listReceipts 结束。

async function listDownlinks(base, readToken, triple, actTaskId) { // 列出已发布 downlinks，供验收校验。
  return fetchJson(
    `${base}/api/v1/ao-act/downlinks?tenant_id=${encodeURIComponent(triple.tenant_id)}&project_id=${encodeURIComponent(triple.project_id)}&group_id=${encodeURIComponent(triple.group_id)}&act_task_id=${encodeURIComponent(actTaskId)}&limit=20`,
    { method: 'GET', token: readToken }
  ); // 返回 downlinks 查询结果。
} // listDownlinks 结束。

function sleep(ms) { // 简单 sleep，等待异步链路落库。
  return new Promise((resolve) => setTimeout(resolve, ms)); // 指定毫秒后 resolve。
} // sleep 结束。

(async () => { // 主流程入口。
  const base = env('BASE_URL', 'http://127.0.0.1:3000'); // 控制平面基地址。
  const adminToken = env('AO_ACT_TOKEN', env('GEOX_AO_ACT_TOKEN', '')); // admin token：用于 recommendation / submit-approval / approve / retry 等管理动作。
  const executorToken = env('AO_ACT_EXECUTOR_TOKEN', env('GEOX_AO_ACT_EXECUTOR_TOKEN', '')); // executor token：仅用于 dispatch/runtime 路径。
  const triple = { // 默认租户三元组。
    tenant_id: env('TENANT_ID', 'tenantA'), // tenantA。
    project_id: env('PROJECT_ID', 'projectA'), // projectA。
    group_id: env('GROUP_ID', 'groupA') // groupA。
  }; // triple 对象结束。
  const deviceId = env('DEVICE_ID', 'dev_onboard_accept_001'); // 目标设备 ID。

  if (!adminToken) throw new Error('MISSING_AO_ACT_TOKEN'); // 没有 admin token 就不能做 seed。
  if (!executorToken) throw new Error('MISSING_AO_ACT_EXECUTOR_TOKEN'); // 没有 executor token 就不能跑 dispatch/runtime。

  const rid = crypto.randomUUID().replace(/-/g, '').slice(0, 8); // 生成随机后缀，避免测试数据冲突。

  const seed = await createApprovedTaskViaRecommendation(base, adminToken, triple, `seed_${rid}`, deviceId); // 先走 recommendation -> approval -> operation_plan 合法链路，作为 unsupported 负例的种子。

  { // adapter 不支持 action 的拒绝负例。
    const bad = await createTaskWithUnsupportedAction(base, adminToken, triple, seed.operationPlanId, rid, deviceId); // 创建不支持的 action。
    assert.equal(bad.status, 400, `expected 400 for unsupported action, got ${bad.status} body=${bad.text}`); // 必须返回 400。
    assert.equal(String(bad.json?.error ?? ''), 'ADAPTER_UNSUPPORTED_ACTION', `unexpected error payload: ${bad.text}`); // 错误码必须正确。
  } // unsupported action 负例结束。

  const claimSeed = await createApprovedTaskViaRecommendation(base, adminToken, triple, `claim_${rid}`, deviceId); // 为 claim/lease 用例创建独立任务，避免影响后续 worker 用例。
  const claim = await fetchJson(`${base}/api/v1/ao-act/dispatches/claim`, { // 使用 executor token 认领 dispatch。
    method: 'POST', // POST 请求。
    token: executorToken, // claim 必须走 executor token。
    body: { ...triple, executor_id: `acc_exec_${rid}`, limit: 1, lease_seconds: 20, act_task_id: claimSeed.actTaskId } // claim body。
  }); // claim 请求完成。
  const claimOut = requireOk(claim, 'claim dispatch'); // 断言 claim 成功。
  assert.ok(Array.isArray(claimOut.items) && claimOut.items.length >= 1, 'claim should return at least 1 item'); // 至少返回一个 item。
  const item = claimOut.items[0]; // 取第一个 claim item。
  assert.ok(Number(item.attempt_no ?? item.attempt_count ?? 0) >= 1, 'attempt_no should be >= 1'); // attempt_no 必须 >= 1。

  const runSeed = await createApprovedTaskViaRecommendation(base, adminToken, triple, `run_${rid}`, deviceId); // 为 dispatch + simulator receipt 闭环创建独立任务，避免被 claim 用例占用。
  await execFileAsync('pnpm', [ // 执行 run_dispatch_once.ts，验证 executor runtime。
    '--filter', '@geox/executor', 'exec', 'tsx', 'src/run_dispatch_once.ts', // 执行 executor runtime 入口。
    '--baseUrl', base, // 指定 baseUrl。
    '--token', executorToken, // 这里必须使用 executor token。
    '--tenant_id', triple.tenant_id, // tenant。
    '--project_id', triple.project_id, // project。
    '--group_id', triple.group_id, // group。
    '--executor_id', `acc_exec_${rid}`, // executor_id。
    '--limit', '1', // 仅处理一个任务。
    '--lease_seconds', '20', // 租约秒数。
    '--act_task_id', runSeed.actTaskId // 指定 act_task_id。
  ], { cwd: process.cwd(), env: process.env }); // 使用当前工作目录与环境变量。

  await sleep(200); // 等待 simulator/published/receipt 链路落库。

  const receiptsResp = await listReceipts(base, adminToken, triple, runSeed.actTaskId); // 用 admin token 读 receipts。
  const receiptsOut = requireOk(receiptsResp, 'list receipts'); // 断言 receipts 查询成功。
  assert.ok(Array.isArray(receiptsOut.items) && receiptsOut.items.length >= 1, `receipts should exist for simulator flow: ${JSON.stringify(receiptsOut)}`); // 必须至少有一条 receipt。
  const receiptItem = receiptsOut.items[0]; // 取第一条 receipt。
  const receiptPayload = receiptItem?.receipt?.payload ?? {}; // 提取 receipt payload。
  const receiptMeta = receiptPayload?.meta ?? {}; // 提取 receipt meta。
  const idempotencyKey = String(receiptPayload?.idempotency_key ?? receiptMeta?.idempotency_key ?? '').trim(); // 提取幂等键。
  assert.ok(idempotencyKey, `idempotency_key missing from receipt payload: ${JSON.stringify(receiptItem)}`); // 幂等键必须存在。
  console.log(`INFO: receipt observed act_task_id=${runSeed.actTaskId} idempotency_key=${idempotencyKey}`); // 输出关键 trace。
  console.log(`INFO: receipt sample ${JSON.stringify(receiptItem)}`); // 输出 sample receipt。

  const downlinksResp = await listDownlinks(base, adminToken, triple, runSeed.actTaskId); // 用 admin token 读 downlinks。
  const downlinksOut = requireOk(downlinksResp, 'list downlinks'); // 断言 downlinks 查询成功。
  assert.ok(Array.isArray(downlinksOut.items) && downlinksOut.items.length >= 1, `downlinks/published should exist: ${JSON.stringify(downlinksOut)}`); // 必须至少有一条 published downlink。
  console.log(`INFO: downlink sample ${JSON.stringify(downlinksOut.items[0])}`); // 输出 sample downlink。

  const retry = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(runSeed.actTaskId)}/retry`, { // receipt 已存在后，retry 应被拒绝。
    method: 'POST', // POST 请求。
    token: adminToken, // retry 属于管理动作，用 admin token。
    body: { ...triple, retry_reason: 'acceptance_retry' } // retry 请求体。
  }); // retry 请求完成。
  assert.equal(retry.status, 400, `retry after receipt should be rejected, got ${retry.status} body=${retry.text}`); // retry 必须被拒绝。

  const dedupeReplay = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, { // 重放同一条 simulator uplink receipt，验证 dedupe。
    method: 'POST', // POST 请求。
    token: executorToken, // uplink/runtime 路径使用 executor token。
    body: {
      ...triple, // 租户三元组。
      task_id: runSeed.actTaskId, // task_id。
      act_task_id: runSeed.actTaskId, // act_task_id。
      command_id: runSeed.actTaskId, // command_id。
      device_id: deviceId, // 设备 ID。
      status: 'executed', // 外层状态，供兼容路径使用。
      start_ts: Date.now() - 50, // 最小开始时间。
      end_ts: Date.now(), // 最小结束时间。
      meta: {
        idempotency_key: idempotencyKey, // 重放同一幂等键。
        adapter_type: 'irrigation_simulator', // adapter 类型。
        attempt_no: Number(receiptPayload?.attempt_no ?? receiptMeta?.attempt_no ?? 1), // attempt_no。
        receipt_status: 'SUCCEEDED', // 原始 receipt 状态。
        receipt_code: String(receiptPayload?.receipt_code ?? receiptMeta?.receipt_code ?? 'ACK'), // receipt_code。
        device_id: deviceId // 设备 ID。
      } // meta 结束。
    } // body 结束。
  }); // dedupe replay 请求完成。
  assert.equal(dedupeReplay.status, 409, `replay same simulator receipt must dedupe, got ${dedupeReplay.status} body=${dedupeReplay.text}`); // 重放必须触发 409 去重。

  console.log('PASS: ACCEPTANCE_EXECUTOR_RUNTIME_V1'); // 所有断言通过则输出 PASS。
})().catch((err) => { // 统一失败出口。
  console.error(`FAIL: ${err?.message ?? String(err)}`); // 输出失败信息。
  process.exit(1); // 退出码置为 1。
}); // 主流程结束。