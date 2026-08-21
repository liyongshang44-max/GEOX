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

function actionClass(action) {
  if (action === "CONTINUE") return "good";
  if (action === "DEGRADE_AND_CONTINUE") return "degraded";
  if (action === "FAIL_CLOSED") return "blocked";
  return "muted";
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
  const healthy = findCase(packet, "healthy_exact_provider_pair");
  const late = findCase(packet, "provider_late");
  const rows = [healthy, late].filter(Boolean);
  byId("runtimeComparison").innerHTML = rows.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.label)}</strong><br><code>${escapeHtml(item.case_id)}</code></td>
      <td><code>${escapeHtml(item.input.event_time)}</code></td>
      <td><code>${escapeHtml(item.input.available_to_runtime_at)}</code></td>
      <td><code>${escapeHtml(item.outcome.forcing_mode)}</code></td>
      <td><span class="badge ${item.outcome.runtime_health === "HEALTHY" ? "good" : "degraded"}">${escapeHtml(item.outcome.runtime_health)}</span></td>
      <td><span class="badge ${actionClass(item.outcome.action)}">${escapeHtml(item.outcome.action)}</span></td>
    </tr>
  `).join("");

  byId("runtimeCallout").innerHTML = `
    <strong>关键差异：</strong> exact rainfall=${escapeHtml(packet.comparison.same_exact_payload.rainfall_mm)} mm，historical ET0=${escapeHtml(packet.comparison.same_exact_payload.historical_et0_mm)} mm，数值完全相同。
    只有 availability 从决策边界变成了决策后 20 分钟。GEOX 因此拒绝把 late exact pair 当成 12:00 已知事实，切换到 <code>${escapeHtml(late.outcome.forcing_mode)}</code>，并把 epistemic class 显式标为 <code>ASSUMED</code>。
    <div class="hash-line">selection_hash <code>${escapeHtml(late.outcome.selection_hash)}</code></div>
  `;
}

function renderFailureCases(packet) {
  const cases = ["provider_late", "source_conflict", "missing_evidence"].map((id) => findCase(packet, id));
  byId("failureCards").innerHTML = cases.map((item) => {
    const error = item.outcome.error_code ? `<div class="error-code"><code>${escapeHtml(item.outcome.error_code)}</code></div>` : "";
    const detail = item.case_id === "provider_late"
      ? `Exact provider evidence is excluded from T; causal prior is used as <code>ASSUMED</code>. No provider wait and no retroactive rewrite.`
      : item.case_id === "source_conflict"
        ? `GEOX does not choose a winner between conflicting identities. No State write is authorized.`
        : `With neither exact forcing nor a causal prior, GEOX refuses to invent the current interval forcing.`;
    return `
      <article class="failure-card">
        <div class="failure-head"><span class="badge ${actionClass(item.outcome.action)}">${escapeHtml(item.outcome.action)}</span><code>${escapeHtml(item.case_id)}</code></div>
        <h3>${escapeHtml(item.label)}</h3>
        <p>${detail}</p>
        ${error}
      </article>
    `;
  }).join("");
}

function renderBehavior(packet) {
  byId("behaviorMatrix").innerHTML = packet.behavior_matrix.map((row) => `
    <tr>
      <td>${escapeHtml(row.condition)}</td>
      <td><strong>${escapeHtml(row.behavior)}</strong></td>
      <td>${escapeHtml(row.claim)}</td>
    </tr>
  `).join("");
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

const TRACE_ORDER = [
  "field_state_snapshot_v1",
  "forecast_run_v1",
  "scenario_set_v1",
  "calibration_replay_v1",
  "forecast_error_v1",
  "field_learning_candidate_v1",
  "decision_cycle_v1",
];

function renderTraceObjects(target, trace) {
  if (!trace || !trace.system_derived) throw new Error("TWIN_TRACE_SYSTEM_DERIVED_MISSING");
  target.innerHTML = TRACE_ORDER.map((objectType) => {
    const value = trace.system_derived[objectType] ?? {};
    return `
      <article class="trace-object">
        <p class="eyebrow">${escapeHtml(objectType)}</p>
        <strong title="${escapeHtml(objectIdentity(objectType, value))}">${escapeHtml(shortHash(objectIdentity(objectType, value)))}</strong>
        <code title="${escapeHtml(value.determinism_hash ?? "")}">${escapeHtml(shortHash(value.determinism_hash))}</code>
      </article>
    `;
  }).join("");
}

function renderRuntimeValueTrace(wrapper) {
  const trace = wrapper?.twin_trace;
  if (!trace) throw new Error("RUNTIME_VALUE_TRACE_MISSING");
  renderTraceObjects(byId("runtimeTraceObjects"), trace);
  const state = trace.answers?.current_field_state ?? {};
  const forecast = trace.answers?.seven_day_forecast ?? {};
  const scenarios = trace.answers?.scenario_comparison ?? {};
  const decision = trace.answers?.decision_cycle ?? {};
  byId("runtimeTraceStatus").className = "status-line good-text";
  byId("runtimeTraceStatus").textContent = `Builder trace PASS · runtime_builders_invoked=${wrapper.runtime_builders_invoked} · determinism_stable=${wrapper.determinism_stable} · forbidden_auto_writes_absent=${wrapper.forbidden_auto_writes_absent}`;
  const answer = byId("runtimeTraceAnswer");
  answer.hidden = false;
  answer.innerHTML = `
    <strong>Trace readout:</strong>
    State=<code>${escapeHtml(state.water_state)}</code> · soil moisture=<code>${escapeHtml(state.soil_moisture_percent)}%</code> ·
    Forecast=<code>${escapeHtml(forecast.point_count)} points / ${escapeHtml(forecast.horizon_days)} days</code> ·
    Scenario options=<code>${escapeHtml(scenarios.option_count)}</code> ·
    Decision stage=<code>${escapeHtml(decision.current_stage)}</code>.
    <div class="hash-line">这 7 个对象由现有 Twin Kernel builders 现场生成，页面没有内置这些对象或 hash。</div>
  `;
}

async function loadRuntimeValueTrace() {
  const response = await fetch("/api/runtime-value-trace", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error(payload.error ?? `RUNTIME_TRACE_HTTP_${response.status}`);
  renderRuntimeValueTrace(payload);
}

function renderPersistedTrace(wrapper, operatorBaseUrl, decisionCycleId) {
  const trace = wrapper?.twin_trace;
  if (!trace) throw new Error("PERSISTED_TWIN_TRACE_READ_MODEL_MISSING");
  renderTraceObjects(byId("persistedTraceObjects"), trace);
  const answers = trace.answers?.decision_cycle ?? {};
  byId("persistedTraceStatus").className = "status-line good-text";
  byId("persistedTraceStatus").textContent = `Persisted trace loaded · read_only=${trace.read_only} · stage=${answers.current_stage ?? "—"} · forbidden_auto_writes_absent=${answers.forbidden_auto_writes_absent ?? "—"}`;
  const href = `${operatorBaseUrl}/operator/twin/traces/${encodeURIComponent(decisionCycleId)}`;
  byId("persistedTraceActions").innerHTML = `<a class="primary-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Open full GEOX Twin Trace ↗</a>`;
}

async function loadPersistedTrace(packet, decisionCycleId) {
  const id = String(decisionCycleId ?? "").trim();
  if (!id) {
    byId("persistedTraceStatus").className = "status-line blocked-text";
    byId("persistedTraceStatus").textContent = "decision_cycle_id is required.";
    return;
  }
  byId("persistedTraceStatus").className = "status-line muted";
  byId("persistedTraceStatus").textContent = "Loading persisted Twin Trace...";
  byId("persistedTraceObjects").innerHTML = "";
  byId("persistedTraceActions").innerHTML = "";
  const response = await fetch(`/api/twin-trace?decision_cycle_id=${encodeURIComponent(id)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `TRACE_HTTP_${response.status}`);
  renderPersistedTrace(payload, packet.runtime_context.geox_operator_base_url, id);
}

async function main() {
  const response = await fetch("/api/demo", { cache: "no-store" });
  const packet = await response.json();
  if (!response.ok || packet.ok !== true) throw new Error(packet.error ?? `DEMO_HTTP_${response.status}`);

  byId("heroProblem").textContent = packet.problem.concise_zh;
  byId("subjectSha").textContent = shortHash(packet.runtime_context.subject_sha);
  byId("subjectSha").title = packet.runtime_context.subject_sha;
  byId("selectorId").textContent = packet.canonical_selector_contract_id;

  renderFlow(byId("architectureFlow"), packet.architecture.frozen_runtime_path);
  renderFlow(byId("traceFlow"), packet.architecture.commercial_trace_path);
  renderRuntimeComparison(packet);
  renderFailureCases(packet);
  renderBehavior(packet);
  byId("nonclaims").innerHTML = packet.hard_nonclaims.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("");

  try {
    await loadRuntimeValueTrace();
  } catch (error) {
    byId("runtimeTraceStatus").className = "status-line blocked-text";
    byId("runtimeTraceStatus").textContent = `Runtime Value Trace failed: ${error.message}`;
  }

  const params = new URLSearchParams(window.location.search);
  const initialTraceId = params.get("decision_cycle_id") ?? "";
  byId("decisionCycleId").value = initialTraceId;
  byId("loadTraceButton").addEventListener("click", () => {
    loadPersistedTrace(packet, byId("decisionCycleId").value).catch((error) => {
      byId("persistedTraceStatus").className = "status-line blocked-text";
      byId("persistedTraceStatus").textContent = `Persisted trace load failed: ${error.message}`;
    });
  });
  if (initialTraceId) await loadPersistedTrace(packet, initialTraceId);
}

main().catch((error) => {
  const target = byId("fatalError");
  target.hidden = false;
  target.textContent = `Commercial Evidence Demo failed: ${error.message}`;
});
