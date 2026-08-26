const byId = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortHash(value) {
  const text = String(value ?? "");
  if (text.length <= 24) return text || "—";
  return `${text.slice(0, 13)}…${text.slice(-8)}`;
}

function formatUtc(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} 协调世界时`;
}

function formatFractionPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : "—";
}

function normalizedKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function actionClass(action) {
  if (action === "CONTINUE") return "good";
  if (action === "DEGRADE_AND_CONTINUE") return "degraded";
  if (action === "FAIL_CLOSED") return "blocked";
  return "muted";
}

function actionZh(action) {
  return ({
    CONTINUE: "继续",
    DEGRADE_AND_CONTINUE: "降级继续",
    FAIL_CLOSED: "拒绝继续",
    APPEND_FORWARD: "只向后补记",
  })[action] ?? "按规则处理";
}

function healthZh(health) {
  return ({ HEALTHY: "正常", DEGRADED: "明确降级" })[health] ?? "状态未分类";
}

function forcingZh(mode) {
  return ({
    EXACT_PROVIDER_INTERVAL_PAIR: "使用当时已经可用的精确证据",
    PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR: "使用上一步的合规假设值",
  })[mode] ?? "没有授权当前时段驱动";
}

function epistemicZh(value) {
  return ({ OBSERVED: "实测", ESTIMATED: "估算", ASSUMED: "假设" })[value] ?? "未分类";
}

function waterStateZh(value) {
  return ({ NORMAL: "正常", DRY: "偏干", WET: "偏湿", UNKNOWN: "未知" })[value] ?? "未分类";
}

function decisionStageZh(value) {
  return ({
    ACCEPTED: "已接受",
    APPROVED: "已批准",
    REJECTED: "已拒绝",
    RETURNED: "已退回补充",
    PENDING: "待处理",
  })[value] ?? "未分类";
}

function renderFlow(target, items) {
  target.innerHTML = items.map((item, index) => `
    <div class="flow-node">
      <span class="flow-index">${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item)}</strong>
    </div>${index < items.length - 1 ? '<span class="flow-arrow">→</span>' : ''}
  `).join("");
}

function findCase(packet, caseId) {
  return packet.cases.find((item) => item.case_id === caseId);
}

function renderRuntimeComparison(packet) {
  const rows = [findCase(packet, "healthy_exact_provider_pair"), findCase(packet, "provider_late")].filter(Boolean);
  byId("runtimeComparison").innerHTML = rows.map((item) => {
    const isLate = item.case_id === "provider_late";
    const caseLabel = isLate ? "同一数据内容在决策后才发布" : "决策时已经拿到精确证据";
    const judgement = isLate ? "不能算作当时已知 · 明确降级" : "当时已经可知 · 正常使用";
    return `
      <tr>
        <td><strong>${caseLabel}</strong></td>
        <td>${escapeHtml(formatUtc(item.input.event_time))}</td>
        <td>${escapeHtml(formatUtc(item.input.available_to_runtime_at))}</td>
        <td><span class="badge ${item.outcome.runtime_health === "HEALTHY" ? "good" : "degraded"}">${judgement}</span></td>
        <td><span class="badge ${actionClass(item.outcome.action)}">${escapeHtml(actionZh(item.outcome.action))}</span></td>
      </tr>`;
  }).join("");

  byId("runtimeCallout").innerHTML = `
    <strong>这是机器可核验的规范选择器实验，不是上面的 25 毫米农艺场景：</strong>
    受控输入保持降雨量=${escapeHtml(packet.comparison.same_exact_payload.rainfall_mm)} 毫米、历史参考作物蒸散估算=${escapeHtml(packet.comparison.same_exact_payload.historical_et0_mm)} 毫米不变，只改变真实可用时间。这样不会把业务说明场景伪装成农艺权威。
  `;
}

const INTERACTIVE_CASES = {
  healthy_exact_provider_pair: {
    title: "正常 · 当时已有合格精确证据",
    verdict: "资格通过",
    summary: "精确数据在决策边界已经可用，规范选择器允许正常继续。",
  },
  provider_late: {
    title: "数据晚到 · 精确证据在决策后才到",
    verdict: "明确降级",
    summary: "晚到精确证据被排除；已有合规先验时，运行时明确降级、使用假设驱动，不等待，也不回改过去。",
  },
  source_conflict: {
    title: "来源冲突 · 同一来源身份出现矛盾内容",
    verdict: "已阻断",
    summary: "规范选择器不猜哪个来源是真的，直接拒绝继续，不授权状态或情景输出。",
  },
  missing_evidence: {
    title: "证据缺失 · 当前时段没有合规输入",
    verdict: "已阻断",
    summary: "既没有精确数据对，也没有合规先验，规范选择器拒绝编造当前时段驱动。",
  },
};

async function runInteractiveCase(caseId) {
  const status = byId("interactiveCaseStatus");
  const result = byId("interactiveCaseResult");
  const proof = byId("interactiveMachineProof");
  document.querySelectorAll("[data-case-id]").forEach((button) => button.classList.toggle("active", button.dataset.caseId === caseId));
  status.className = "status-line muted";
  status.textContent = "正在重新执行规范选择器...";
  result.innerHTML = "";
  proof.textContent = "执行中...";

  const response = await fetch(`/api/demo?case=${encodeURIComponent(caseId)}&run=${Date.now()}`, { cache: "no-store" });
  const packet = await response.json();
  if (!response.ok || packet.ok !== true) throw new Error("演示服务返回异常");
  const item = findCase(packet, caseId);
  if (!item) throw new Error("未找到指定案例");
  const presentation = INTERACTIVE_CASES[caseId];
  const action = item.outcome.action;
  const className = actionClass(action);
  const selectorOutcome = item.outcome.forcing_mode ? forcingZh(item.outcome.forcing_mode) : "没有授权当前时段驱动";

  status.className = `status-line ${className === "good" ? "good-text" : className === "degraded" ? "degraded-text" : "blocked-text"}`;
  status.textContent = `规范选择器已重新执行 · ${presentation.verdict} · ${actionZh(action)} · 代码版本 ${shortHash(packet.runtime_context.subject_sha)}`;
  result.innerHTML = `
    <div class="interactive-result-main">
      <div><p class="eyebrow">${escapeHtml(presentation.verdict)}</p><h3>${escapeHtml(presentation.title)}</h3><p>${escapeHtml(presentation.summary)}</p></div>
      <div class="interactive-verdict ${className}"><span>系统行为</span><strong>${escapeHtml(actionZh(action))}</strong></div>
    </div>
    <div class="interactive-result-facts">
      <span><b>证据处理</b>${escapeHtml(selectorOutcome)}</span>
      <span><b>运行健康</b>${escapeHtml(healthZh(item.outcome.runtime_health))}</span>
      <span><b>等待数据提供方</b>${item.outcome.provider_wait_required === true ? "是" : "否"}</span>
      <span><b>状态写入授权</b>${item.outcome.state_write_authorized === false ? "否" : "按规范选择器结果"}</span>
    </div>`;

  proof.textContent = JSON.stringify({
    "机器证明链": "GET /api/demo → buildCommercialEvidencePacketV1 → 规范选择器",
    "代码版本": packet.runtime_context.subject_sha,
    "规范选择器源码": packet.runtime_context.canonical_selector_source,
    "规则合同标识": packet.canonical_selector_contract_id,
    "选择策略标识": packet.canonical_selection_policy_id,
    "案例原始机器对象": item,
    "副作用统计": packet.side_effects,
    "是否生产权威": false,
    "是否影响正式验收": false,
  }, null, 2);
}

function renderFailureCases(packet) {
  const cases = ["provider_late", "source_conflict", "missing_evidence"].map((id) => findCase(packet, id));
  const labels = { provider_late: "数据在决策后才到", source_conflict: "来源身份冲突", missing_evidence: "当前时段证据不足" };
  byId("failureCards").innerHTML = cases.map((item) => {
    const detail = item.case_id === "provider_late"
      ? "决策时排除迟到精确证据；已有合规先验则明确降级继续。不等待，也不回改过去。"
      : item.case_id === "source_conflict"
        ? "来源身份相同但内容冲突时，GEOX 不猜哪个是真的，也不授权状态写入。"
        : "既没有当时可用的精确证据，也没有合规先验时，GEOX 拒绝编造当前时段输入。";
    return `<article class="failure-card"><div class="failure-head"><span class="badge ${actionClass(item.outcome.action)}">${escapeHtml(actionZh(item.outcome.action))}</span></div><h3>${escapeHtml(labels[item.case_id] ?? "受控失败")}</h3><p>${detail}</p></article>`;
  }).join("");
}

function renderBehavior(packet) {
  const conditionLabels = {
    "exact evidence valid and available by t": "证据完整，而且在决策时已经可用",
    "provider late causal prior exists": "关键数据晚到，但已有合规先验",
    "state valid but forecast prerequisite missing": "状态仍有效，但预测前提不足",
    "no causal current interval forcing": "当前时段没有任何合规驱动证据",
    "source identity conflict": "数据来源身份发生冲突",
    "late exact evidence later arrives": "精确证据在决策之后才到达",
  };
  const behaviorLabels = {
    "continue": "继续",
    "degrade continue": "降级继续",
    "block forecast continue state": "保留状态，停止预测",
    "fail closed": "拒绝继续",
    "append forward": "只向后补记",
  };
  const claimLabels = {
    "healthy observed estimated": "证据资格完整，正常计算",
    "assumed forcing no relabel no wait": "明确说明使用假设值，不改标签，也不等待迟到数据",
    "0 forecast points no scenario": "保留合法状态，但不生成没有依据的预测或情景",
    "no invented state forcing": "不编造当前时段输入",
    "no winner guessed": "不猜哪个冲突来源是真的",
    "no retroactive tick rewrite": "新证据只向后记录，不篡改过去那次决策",
  };
  byId("behaviorMatrix").innerHTML = packet.behavior_matrix.map((row) => `
    <tr>
      <td>${escapeHtml(conditionLabels[normalizedKey(row.condition)] ?? "证据条件受限")}</td>
      <td><strong>${escapeHtml(behaviorLabels[normalizedKey(row.behavior)] ?? "按规则受控处理")}</strong></td>
      <td>${escapeHtml(claimLabels[normalizedKey(row.claim)] ?? "只声明证据实际支持的结果")}</td>
    </tr>`).join("");
}

function objectIdentity(objectType, value) {
  const fields = {
    field_state_snapshot_v1: "snapshot_id",
    forecast_run_v1: "forecast_run_id",
    scenario_set_v1: "scenario_set_id",
    calibration_replay_v1: "calibration_replay_id",
    forecast_error_v1: "forecast_error_id",
    field_learning_candidate_v1: "field_learning_candidate_id",
    decision_cycle_v1: "decision_cycle_id",
  };
  return value?.[fields[objectType]] ?? "—";
}

const TRACE_ORDER = ["field_state_snapshot_v1", "forecast_run_v1", "scenario_set_v1", "calibration_replay_v1", "forecast_error_v1", "field_learning_candidate_v1", "decision_cycle_v1"];
const TRACE_LABELS_ZH = {
  field_state_snapshot_v1: "田块状态快照",
  forecast_run_v1: "预测运行",
  scenario_set_v1: "情景集合",
  calibration_replay_v1: "校准回放",
  forecast_error_v1: "预测误差",
  field_learning_candidate_v1: "学习候选",
  decision_cycle_v1: "决策周期",
};

function renderTraceObjects(target, trace) {
  if (!trace || !trace.system_derived) throw new Error("缺少系统派生追溯对象");
  target.innerHTML = TRACE_ORDER.map((objectType) => {
    const value = trace.system_derived[objectType] ?? {};
    return `<article class="trace-object"><p class="eyebrow">${escapeHtml(TRACE_LABELS_ZH[objectType] ?? "追溯对象")}</p><strong title="${escapeHtml(objectIdentity(objectType, value))}">${escapeHtml(shortHash(objectIdentity(objectType, value)))}</strong><code title="${escapeHtml(value.determinism_hash ?? "")}">${escapeHtml(shortHash(value.determinism_hash))}</code></article>`;
  }).join("");
}

function traceReadout(trace) {
  const state = trace.answers?.current_field_state ?? {};
  const forecast = trace.answers?.seven_day_forecast ?? {};
  const scenarios = trace.answers?.scenario_comparison ?? {};
  const decision = trace.answers?.decision_cycle ?? {};
  return { html: `状态=<strong>${escapeHtml(waterStateZh(state.water_state))}</strong> · 土壤含水率=<strong>${escapeHtml(state.soil_moisture_percent)}%</strong> · 预测=<strong>${escapeHtml(forecast.point_count)} 点 / ${escapeHtml(forecast.horizon_days)} 天</strong> · 情景=<strong>${escapeHtml(scenarios.option_count)} 个</strong> · 决策阶段=<strong>${escapeHtml(decisionStageZh(decision.current_stage))}</strong>。` };
}

function renderConnectedData(payload, packet) {
  const status = byId("connectedDataStatus");
  const answer = byId("connectedDataAnswer");
  const objects = byId("connectedTraceObjects");
  if (payload.connected !== true) {
    status.className = "status-line blocked-text";
    status.textContent = "未连接 · 当前未获得产品侧持久化决策数据";
    answer.hidden = false;
    answer.innerHTML = "系统不会用工程夹具冒充产品持久化数据。未连接时只显示明确的不可用状态。";
    objects.innerHTML = "";
    return;
  }
  renderTraceObjects(objects, payload.twin_trace);
  status.className = "status-line good-text";
  status.textContent = `已连接 · 产品侧持久化数据 · 只读 · 决策周期 ${shortHash(payload.decision_cycle_id)}`;
  answer.hidden = false;
  answer.innerHTML = `<strong>持久化读取结果：</strong>${traceReadout(payload.twin_trace).html}<div class="hash-line">来源：现有 GEOX 服务与数字孪生内核持久化读模型；本演示写入次数为 0。</div>`;
}

async function loadConnectedData(packet, decisionCycleId = "") {
  const id = String(decisionCycleId ?? "").trim();
  byId("connectedDataStatus").className = "status-line muted";
  byId("connectedDataStatus").textContent = "正在读取产品侧持久化数据...";
  const suffix = id ? `?decision_cycle_id=${encodeURIComponent(id)}` : "";
  const response = await fetch(`/api/live-data${suffix}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error("产品侧持久化数据读取失败");
  renderConnectedData(payload, packet);
}

function renderMcftRuntimeEvidence(payload) {
  const status = byId("mcftRuntimeStatus");
  const answer = byId("mcftRuntimeAnswer");
  const objects = byId("mcftRuntimeObjects");
  if (payload.connected !== true) {
    status.className = "status-line blocked-text";
    status.textContent = "未连接 · 当前未配置历史资格数据读取";
    answer.hidden = false;
    answer.innerHTML = "系统不会回退到本地旧数据库，也不会把构建器工程夹具冒充真实持久化数据。只允许服务端读取白名单历史资格数据库；浏览器不会收到数据库连接串。";
    objects.innerHTML = "";
    return;
  }

  const evidence = payload.evidence_window ?? {};
  const soil = evidence.selected_soil_observation ?? {};
  const forcing = evidence.forcing ?? {};
  const state = payload.state ?? {};
  const forecast = payload.forecast ?? {};
  const scenario = payload.scenario ?? {};
  const checkpoint = payload.checkpoint ?? {};
  const tick = payload.tick ?? {};
  const logicalTime = evidence.logical_time ?? tick.logical_time;

  status.className = "status-line good-text";
  status.textContent = "已连接 · 历史持久化工程资格数据 · 只读 · 写入次数 0";
  answer.hidden = false;
  answer.innerHTML = `<strong>${escapeHtml(formatUtc(logicalTime))}，系统只认当时真正已经进入知识状态的证据。</strong> 土壤观测发生于 <strong>${escapeHtml(formatUtc(soil.observed_at))}</strong>，在 <strong>${escapeHtml(formatUtc(soil.available_to_runtime_at))}</strong> 已进入系统。当前时段精确降雨和参考作物蒸散估算在边界还不可用，GEOX 没有等待、回填或假装已经知道，而是<strong>${escapeHtml(forcingZh(forcing.mode))}</strong>，并以<strong>${escapeHtml(healthZh(forcing.runtime_health))}</strong>继续仍被授权的计算。`;

  const cards = [
    ["决策时刻", formatUtc(logicalTime), "证明当时知识边界"],
    ["采用的土壤证据", `${formatFractionPercent(soil.canonical_value)} 土壤含水率`, `${formatUtc(soil.observed_at)} 观测 · ${formatUtc(soil.available_to_runtime_at)} 已可用 · 拒绝旧值 ${evidence.rejected_observation_count ?? "—"} 条`],
    ["当前天气依据", forcingZh(forcing.mode), `${healthZh(forcing.runtime_health)} · 降雨/参考作物蒸散：${epistemicZh(forcing.precipitation_epistemic_class)} / ${epistemicZh(forcing.et0_epistemic_class)} · 不等待迟到数据`],
    ["当前田块状态", `根区含水率 ${formatFractionPercent(state.root_zone_vwc_fraction?.mean)}`, `可用水比例 ${formatFractionPercent(state.available_water_fraction)} · 状态有效：${state.use_eligibility?.state_valid === true ? "是" : "否"}`],
    ["后续预测", `${forecast.point_count ?? "—"} 个预测点 · ${scenario.option_count ?? "—"} 个情景`, `预测已完成 · 情景资格：${forecast.scenario_eligible === true ? "是" : "否"}`],
    ["系统最终行为", forcing.runtime_health === "DEGRADED" ? "降级继续" : "正常继续", `检查点 ${checkpoint.tick_sequence ?? "—"} · 下一时刻 ${formatUtc(checkpoint.next_tick_logical_time)} · 晚到证据不回改已完成时刻`],
  ];
  objects.innerHTML = cards.map(([label, primary, secondary], index) => `<article class="trace-object ${index === 2 ? "evidence-degraded-card" : ""}"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(primary)}</strong><span class="card-secondary">${escapeHtml(secondary)}</span></article>`).join("");
}

async function loadMcftRuntimeEvidence() {
  byId("mcftRuntimeStatus").className = "status-line muted";
  byId("mcftRuntimeStatus").textContent = "正在读取历史资格数据...";
  const response = await fetch("/api/mcft-runtime-evidence", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error("历史资格数据读取失败");
  renderMcftRuntimeEvidence(payload);
}

function renderRuntimeValueTrace(wrapper) {
  const trace = wrapper?.twin_trace;
  if (!trace) throw new Error("缺少数字孪生追溯对象");
  renderTraceObjects(byId("runtimeTraceObjects"), trace);
  byId("runtimeTraceStatus").className = "status-line good-text";
  byId("runtimeTraceStatus").textContent = "构建器链通过 · 调用真实数字孪生内核构建器 · 确定性稳定 · 未发生禁止的自动写入";
  const answer = byId("runtimeTraceAnswer");
  answer.hidden = false;
  answer.innerHTML = `<strong>工程链路读取：</strong>${traceReadout(trace).html}<div class="hash-line">7 个对象由现有数字孪生内核构建器现场生成；页面没有内置这些对象或哈希，也不声称持久化生产状态。</div>`;
}

async function loadRuntimeValueTrace() {
  const response = await fetch("/api/runtime-value-trace", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error("工程构建器链读取失败");
  renderRuntimeValueTrace(payload);
}

function renderPersistedTrace(wrapper, operatorBaseUrl, decisionCycleId) {
  const trace = wrapper?.twin_trace;
  if (!trace) throw new Error("缺少持久化决策追溯对象");
  renderTraceObjects(byId("persistedTraceObjects"), trace);
  byId("persistedTraceStatus").className = "status-line good-text";
  byId("persistedTraceStatus").textContent = `持久化决策链已读取 · 只读 · 当前阶段 ${decisionStageZh(trace.answers?.decision_cycle?.current_stage)}`;
  const href = `${operatorBaseUrl}/operator/twin/traces/${encodeURIComponent(decisionCycleId)}`;
  byId("persistedTraceActions").innerHTML = `<a class="primary-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">打开完整 GEOX 决策追溯 ↗</a>`;
}

async function loadPersistedTrace(packet, decisionCycleId) {
  const id = String(decisionCycleId ?? "").trim();
  if (!id) {
    byId("persistedTraceStatus").className = "status-line blocked-text";
    byId("persistedTraceStatus").textContent = "需要填写决策周期标识。";
    return;
  }
  byId("persistedTraceStatus").className = "status-line muted";
  byId("persistedTraceStatus").textContent = "正在读取持久化决策链...";
  byId("persistedTraceObjects").innerHTML = "";
  byId("persistedTraceActions").innerHTML = "";
  const response = await fetch(`/api/twin-trace?decision_cycle_id=${encodeURIComponent(id)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error("持久化决策链读取失败");
  renderPersistedTrace(payload, packet.runtime_context.geox_operator_base_url, id);
}

function renderComponentMap() {
  const rows = [
    ["现实数据 / 数据提供方 / 传感器 → 证据", "canonical facts + external evidence bindings", "证据时序 / 来源身份"],
    ["时点 / 权威边界", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md", "真实可用时间 / 进入系统时间"],
    ["当前区间驱动选择器", "apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts", "本演示的 /api/demo 每次请求直接执行"],
    ["规范运行时核心 / 持久化", "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts", "状态 / 预测 / 情景 / 健康 / 检查点"],
    ["规范追加式事实库", "PostgreSQL facts", "历史工程资格只读证据"],
    ["状态", "twin_state_estimate_v1", "持久化对象 + 确定性引用"],
    ["预测", "twin_forecast_run_v1", "历史工程资格中的 72 点持久化预测"],
    ["情景", "twin_scenario_set_v1", "持久化情景集合"],
    ["健康 / 恢复", "twin_runtime_health_v1 + twin_runtime_checkpoint_v1", "降级原因码 + 继续运行检查点"],
    ["产品追溯 / 操作员只读查看", "apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx", "只读决策追溯"],
    ["未来受控执行", "NOT YET A COMMERCIAL CLAIM", "当前演示不把未来能力冒充已验收能力"],
  ];
  byId("componentMap").innerHTML = rows.map(([node, component, proof]) => `<tr><td><strong>${escapeHtml(node)}</strong></td><td><code>${escapeHtml(component)}</code></td><td>${escapeHtml(proof)}</td></tr>`).join("");
}

function renderEconomics() {
  const number = (id) => {
    const value = Number(byId(id).value);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  const area = number("ecoAreaHa");
  const depth = number("ecoIrrigationMm");
  const pumpingRate = number("ecoPumpingRate");
  const otherElectric = number("ecoEnergy");
  const labor = number("ecoLabor");
  const maintenance = number("ecoEquipment");
  const volumeM3 = area * depth * 10;
  const pumping = area * depth * pumpingRate;
  const direct = pumping + otherElectric + labor + maintenance;
  byId("economicsResult").innerHTML = `
    <div><span>一次计划灌溉水量</span><strong>${volumeM3.toLocaleString(undefined, { maximumFractionDigits: 0 })} 立方米</strong><small>面积 × 灌溉深度 × 10</small></div>
    <div><span>可量化直接暴露</span><strong>$${direct.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>泵送能源 + 其他当次电力 + 增量人工 + 增量维护；不是投资回报</small></div>
    <div><span>其中泵送能源成本</span><strong>$${pumping.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>默认费率 0.534 美元/毫米/公顷，来自密歇根州立大学 2024 外部基准</small></div>`;
}

function evidenceClassZh(value) {
  return ({
    REAL_MACHINE_EXECUTION: "真实机器执行",
    PERSISTED_ENGINEERING_QUALIFICATION: "持久化工程资格证据",
    DEMO_SCENARIO_INPUT: "演示场景输入",
    CUSTOMER_INPUT: "客户输入",
    FORMAL_PRODUCTION_EVIDENCE: "正式生产证据",
  })[value] ?? "未分类证据";
}

function releaseStatusZh(value) {
  return ({
    PROVEN: "已证明",
    DISCLOSED_INPUT: "已披露输入",
    CUSTOMER_DATA_REQUIRED: "需要客户数据",
    NOT_CLAIMED: "未声明",
  })[value] ?? "未分类";
}

function releaseStatusClass(value) {
  if (value === "PROVEN") return "good";
  if (value === "DISCLOSED_INPUT" || value === "CUSTOMER_DATA_REQUIRED") return "degraded";
  if (value === "NOT_CLAIMED") return "blocked";
  return "muted";
}

function renderEvidenceReleaseManifest(packet) {
  const manifest = packet.evidence_release_manifest;
  if (!manifest || !Array.isArray(manifest.claims)) throw new Error("缺少商业证据声明清单");
  byId("releaseExactSha").textContent = packet.runtime_context.subject_sha;
  byId("releaseExactSha").title = packet.runtime_context.subject_sha;
  byId("releaseGateSummary").innerHTML = `<strong>付费试点销售：条件通过。</strong> 当前页面的“已证明”只在每一行标注的证据等级内成立；最终真实时间验收、自动执行与客户投资回报没有被借用或提前声明。`;
  byId("releaseManifestRows").innerHTML = manifest.claims.map((claim) => {
    const implementations = (claim.repo_implementation ?? []).map((item) => `<code>${escapeHtml(item)}</code>`).join("<br />");
    const machineEvidence = (claim.machine_evidence ?? []).map((item) => `<code>${escapeHtml(item)}</code>`).join("<br />");
    return `<tr>
      <td><strong>${escapeHtml(claim.claim_zh)}</strong></td>
      <td>${implementations}</td>
      <td>${machineEvidence}</td>
      <td><span class="badge ${releaseStatusClass(claim.status)}">${escapeHtml(evidenceClassZh(claim.evidence_class))}</span></td>
      <td><span class="badge ${releaseStatusClass(claim.status)}">${escapeHtml(releaseStatusZh(claim.status))}</span></td>
    </tr>`;
  }).join("");
}

function renderNonclaims(items) {
  const labels = {
    COMMERCIAL_DEMO_IS_NOT_PRODUCTION_RUNTIME_AUTHORITY: "本演示不是生产运行权威",
    CONTROLLED_DEMO_INPUT_IS_NOT_FORMAL_EXTERNAL_EVIDENCE: "受控演示输入不是正式外部证据",
    CONTROLLED_RUNTIME_VALUE_TRACE_IS_NOT_PERSISTED_PRODUCTION_STATE: "受控运行值追溯不是持久化生产状态",
    NO_MCFT_CAP09_COMPLETION_CLAIM: "不声明 MCFT-CAP-09 已完成",
    NO_FORMAL_O00_O23_CLAIM: "不声明最终连续真实时间验收已完成",
    NO_AUTONOMOUS_RECOMMENDATION_OR_DISPATCH: "不授权自动建议或自动派发",
    NO_RETROACTIVE_TICK_REWRITE: "不回改已完成的运行时刻",
  };
  byId("nonclaims").innerHTML = items.map((item) => `<li>${escapeHtml(labels[item] ?? "未声明能力")}</li>`).join("");
}

async function main() {
  const response = await fetch("/api/demo", { cache: "no-store" });
  const packet = await response.json();
  if (!response.ok || packet.ok !== true) throw new Error("商业证据演示加载失败");

  byId("heroProblem").textContent = "农业人工智能最大的问题，不只是算得对不对，而是它用来做决定的数据，在那个时刻到底是不是真的已经知道。";
  byId("subjectSha").textContent = shortHash(packet.runtime_context.subject_sha);
  byId("subjectSha").title = packet.runtime_context.subject_sha;
  byId("selectorId").textContent = packet.canonical_selector_contract_id;

  renderFlow(byId("architectureFlow"), ["数据提供方 / 传感器", "原始 / 规范证据", "时点 / 权威边界", "当前区间驱动选择器", "规范运行时核心", "状态", "预测", "情景", "运行时资格边界", "人工审批", "未来受控执行"]);
  renderFlow(byId("traceFlow"), ["证据", "状态", "预测", "情景", "运行资格"]);
  renderRuntimeComparison(packet);
  renderFailureCases(packet);
  renderBehavior(packet);
  renderComponentMap();
  renderEconomics();
  renderEvidenceReleaseManifest(packet);
  renderNonclaims(packet.hard_nonclaims);

  const params = new URLSearchParams(window.location.search);
  const initialTraceId = params.get("decision_cycle_id") ?? "";
  byId("decisionCycleId").value = initialTraceId;

  try { await loadMcftRuntimeEvidence(); } catch {
    byId("mcftRuntimeStatus").className = "status-line blocked-text";
    byId("mcftRuntimeStatus").textContent = "历史运行证据读取失败";
  }
  try { await loadConnectedData(packet, initialTraceId); } catch {
    byId("connectedDataStatus").className = "status-line blocked-text";
    byId("connectedDataStatus").textContent = "产品侧持久化数据读取失败";
  }
  try { await loadRuntimeValueTrace(); } catch {
    byId("runtimeTraceStatus").className = "status-line blocked-text";
    byId("runtimeTraceStatus").textContent = "工程构建器链执行失败";
  }

  byId("runtimeCaseButtons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-case-id]");
    if (!button) return;
    runInteractiveCase(button.dataset.caseId).catch(() => {
      byId("interactiveCaseStatus").className = "status-line blocked-text";
      byId("interactiveCaseStatus").textContent = "规范选择器执行失败";
    });
  });

  ["ecoAreaHa", "ecoIrrigationMm", "ecoPumpingRate", "ecoEnergy", "ecoLabor", "ecoEquipment"].forEach((id) => byId(id).addEventListener("input", renderEconomics));

  byId("refreshMcftRuntimeEvidence").addEventListener("click", () => loadMcftRuntimeEvidence().catch(() => {
    byId("mcftRuntimeStatus").className = "status-line blocked-text";
    byId("mcftRuntimeStatus").textContent = "历史运行证据读取失败";
  }));
  byId("refreshConnectedData").addEventListener("click", () => loadConnectedData(packet, byId("decisionCycleId").value).catch(() => {
    byId("connectedDataStatus").className = "status-line blocked-text";
    byId("connectedDataStatus").textContent = "产品侧持久化数据读取失败";
  }));
  byId("loadTraceButton").addEventListener("click", () => loadPersistedTrace(packet, byId("decisionCycleId").value).catch(() => {
    byId("persistedTraceStatus").className = "status-line blocked-text";
    byId("persistedTraceStatus").textContent = "持久化决策链读取失败";
  }));
  if (initialTraceId) await loadPersistedTrace(packet, initialTraceId);

  await runInteractiveCase("healthy_exact_provider_pair");
}

main().catch(() => {
  const target = byId("fatalError");
  target.hidden = false;
  target.textContent = "商业证据演示加载失败。";
});