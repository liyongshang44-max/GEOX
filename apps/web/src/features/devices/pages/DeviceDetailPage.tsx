
import React from "react";
import { useSession } from "../../../auth/useSession";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  bindDeviceToField,
  fetchDeviceControlPlane,
  fetchDeviceConsole,
  fetchDeviceDetail,
  fetchDeviceStatusOptional,
  fetchDevices,
  fetchTelemetryLatestOptional,
  fetchTelemetryMetricsOptional,
  fetchTelemetrySeriesOptional,
  issueDeviceCredential,
  revokeDeviceCredential,
  type DeviceConsoleView,
  type DeviceControlPlaneView,
  type DeviceDetail,
  type DeviceListItem,
  type DeviceStatus,
  type TelemetryLatestItem,
  type TelemetryMetricsItem,
} from "../../../lib/api";
import { fetchFieldDetail, fetchFields, type FieldDetail, type FieldListItem } from "../../../api/fields";
import StatusBadge from "../../../components/common/StatusBadge";
import ErrorState from "../../../components/common/ErrorState";
import { formatTimeOrFallback } from "../../../lib/presentation/time";
import { normalizeStatusWord } from "../../../lib/statusVocabulary";
import { ONBOARDING_TRACE_STORAGE_KEY, type OnboardingRecord } from "../../../features/devices/onboarding/mockFlow";
import { buildDevicePolicyAwareMetrics } from "../../../viewmodels/deviceTelemetryViewModel";
import { formatSourceMeta } from "../../../lib/dataOrigin";
import { extractBootstrapContext } from "../../../lib/bootstrapContext";

function fmtTs(v: number | null | undefined): string {
  return formatTimeOrFallback(v);
}

function formatCarrierSkillNote(raw: unknown): string {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return "正在为感知技能提供输入";
  if (normalized.includes("irrigation") || normalized.includes("灌溉")) return "正在为灌溉类技能提供输入";
  if (normalized.includes("patrol") || normalized.includes("巡检")) return "正在为巡检类技能提供输入";
  if (normalized.includes("alert") || normalized.includes("告警")) return "正在为告警类技能提供输入";
  if (normalized.includes("growth") || normalized.includes("生长")) return "正在为生长评估类技能提供输入";
  return "正在为相关感知技能提供输入";
}
type BoundFieldInfo = { field_id: string | null; bound_ts_ms: number | null };
type NamedSettled<T = unknown> = { name: string; status: "fulfilled"; value: T } | { name: string; status: "rejected"; reason: unknown };

function withTimeout<T>(name: string, promise: Promise<T>, ms = 8000): Promise<NamedSettled<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ name, status: "rejected", reason: new Error(`TIMEOUT:${name}`) }), ms);
    promise.then((value) => { clearTimeout(timer); resolve({ name, status: "fulfilled", value }); }).catch((reason) => { clearTimeout(timer); resolve({ name, status: "rejected", reason }); });
  });
}
async function resolveBoundFieldFromFields(deviceId: string): Promise<BoundFieldInfo> {
  const fields: FieldListItem[] = await fetchFields();
  for (const field of fields) {
    try {
      const detail: FieldDetail | null = await fetchFieldDetail(field.field_id);
      const matched = (detail?.bound_devices || []).find((item: any) => item.device_id === deviceId);
      if (matched) return { field_id: field.field_id, bound_ts_ms: matched.bound_ts_ms ?? null };
    } catch {}
  }
  return { field_id: null, bound_ts_ms: null };
}

export default function DeviceDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const { token, setToken } = useSession();
  const [detail, setDetail] = React.useState<DeviceDetail | null>(null);
  const [consoleView, setConsoleView] = React.useState<DeviceConsoleView | null>(null);
  const [controlPlane, setControlPlane] = React.useState<DeviceControlPlaneView | null>(null);
  const [statusObj, setStatusObj] = React.useState<DeviceStatus | null>(null);
  const [deviceListItem, setDeviceListItem] = React.useState<DeviceListItem | null>(null);
  const [resolvedBoundField, setResolvedBoundField] = React.useState<BoundFieldInfo>({ field_id: null, bound_ts_ms: null });
  const [latest, setLatest] = React.useState<TelemetryLatestItem[]>([]);
  const [metrics, setMetrics] = React.useState<TelemetryMetricsItem[]>([]);
  const [series, setSeries] = React.useState<Record<string, Array<{ ts_ms: number; value_num: number | null; value_text: string | null; fact_id: string }>>>({});
  const [busy, setBusy] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("正在准备设备详情...");
  const [availableFields, setAvailableFields] = React.useState<FieldListItem[]>([]);
  const [bindFieldId, setBindFieldId] = React.useState<string>("");
  const [newCredentialId, setNewCredentialId] = React.useState<string>("");
  const [issuedSecret, setIssuedSecret] = React.useState<string>("");
  const [issuedCredentialId, setIssuedCredentialId] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [statusSnapshotFallback, setStatusSnapshotFallback] = React.useState<string | null>(null);
  const [onboardingRecords, setOnboardingRecords] = React.useState<OnboardingRecord[]>([]);

  async function refresh(): Promise<void> {
    if (!deviceId) return;
    setBusy(true); setError(null); setStatus(`正在读取设备 ${deviceId} ...`);
    try {
      const results = await Promise.all([
        withTimeout("fetchDeviceDetail", fetchDeviceDetail(token, deviceId)),
        withTimeout("fetchDeviceConsole", fetchDeviceConsole(token, deviceId)),
        withTimeout("fetchDeviceControlPlane", fetchDeviceControlPlane(token, deviceId)),
        withTimeout("fetchDeviceStatus", fetchDeviceStatusOptional(token, deviceId)),
        withTimeout("fetchTelemetryLatest", fetchTelemetryLatestOptional(token, { device_id: deviceId })),
        withTimeout("fetchTelemetryMetrics", fetchTelemetryMetricsOptional(token, { device_id: deviceId })),
        withTimeout("fetchTelemetrySeries", fetchTelemetrySeriesOptional(token, { device_id: deviceId })),
        withTimeout("fetchDevices", fetchDevices(token)),
        withTimeout("fetchFields", fetchFields()),
      ]);
      const byName = Object.fromEntries(results.map((r) => [r.name, r])) as Record<string, NamedSettled<any>>;
      const nextDetail = byName.fetchDeviceDetail?.status === "fulfilled" ? byName.fetchDeviceDetail.value : null;
      const nextConsole = byName.fetchDeviceConsole?.status === "fulfilled" ? byName.fetchDeviceConsole.value : null;
      const statusResult = byName.fetchDeviceStatus;
      const nextStatus = statusResult?.status === "fulfilled" ? statusResult.value ?? null : null;
      const nextControlPlane = byName.fetchDeviceControlPlane?.status === "fulfilled" ? byName.fetchDeviceControlPlane.value : null;
      const nextLatest = byName.fetchTelemetryLatest?.status === "fulfilled" ? byName.fetchTelemetryLatest.value : [];
      const nextMetrics = byName.fetchTelemetryMetrics?.status === "fulfilled" ? byName.fetchTelemetryMetrics.value : [];
      const nextSeries = byName.fetchTelemetrySeries?.status === "fulfilled" ? ((byName.fetchTelemetrySeries.value as any)?.series || (byName.fetchTelemetrySeries.value as any) || {}) : {};
      const nextDevices = byName.fetchDevices?.status === "fulfilled" ? byName.fetchDevices.value : [];
      const nextFields = byName.fetchFields?.status === "fulfilled" ? byName.fetchFields.value : [];
      const requiredFailures = ["fetchDeviceDetail", "fetchDeviceConsole", "fetchDeviceControlPlane"].filter((name) => byName[name]?.status === "rejected");
      if (requiredFailures.length > 0) {
        setError("设备详情加载失败，请稍后重试");
      }
      const statusUnavailable = statusResult?.status === "rejected" || (statusResult?.status === "fulfilled" && !statusResult.value);
      setStatusSnapshotFallback(statusUnavailable ? "当前设备暂无状态快照" : null);
      const matchedDevice = nextDevices.find((item: any) => String(item.device_id) === String(deviceId)) || null;
      let boundFieldInfo: BoundFieldInfo = { field_id: matchedDevice?.field_id || (nextDetail as any)?.device?.field_id || null, bound_ts_ms: matchedDevice?.bound_ts_ms || (nextDetail as any)?.device?.bound_ts_ms || null };
      if (!boundFieldInfo.field_id && nextFields.length) boundFieldInfo = await resolveBoundFieldFromFields(deviceId);
      setDetail(nextDetail); setConsoleView(nextConsole); setControlPlane(nextControlPlane); setStatusObj(nextStatus); setDeviceListItem(matchedDevice); setResolvedBoundField(boundFieldInfo); setLatest(nextLatest); setMetrics(nextMetrics); setSeries(nextSeries); setAvailableFields(nextFields as FieldListItem[]); setBindFieldId(String(boundFieldInfo.field_id || "")); setStatus(`设备 ${deviceId} 已加载。`);
    } catch (e: any) {
      setError("设备详情加载失败，请稍后重试"); setStatus(`读取失败：${e?.bodyText || e?.message || String(e)}`);
    } finally { setBusy(false); }
  }

  async function handleIssueCredential(): Promise<void> {
    if (!deviceId) return;
    setBusy(true); setIssuedSecret(""); setIssuedCredentialId(""); setStatus(`正在为 ${deviceId} 签发凭据...`);
    try {
      const created = await issueDeviceCredential(token, deviceId, newCredentialId.trim() ? { credential_id: newCredentialId.trim() } : {});
      setIssuedSecret(String(created?.credential_secret || "")); setIssuedCredentialId(String(created?.credential_id || "")); setNewCredentialId(""); await refresh(); setStatus(`凭据已签发：${created?.credential_id || "-"}`);
    } catch (e: any) { setStatus(`签发失败：${e?.bodyText || e?.message || String(e)}`); } finally { setBusy(false); }
  }
  async function handleRevokeCredential(credentialId: string): Promise<void> {
    if (!deviceId || !credentialId) return;
    setBusy(true); setStatus(`正在撤销凭据 ${credentialId} ...`);
    try { await revokeDeviceCredential(token, deviceId, credentialId); await refresh(); setStatus(`凭据已撤销：${credentialId}`); }
    catch (e: any) { setStatus(`撤销失败：${e?.bodyText || e?.message || String(e)}`); } finally { setBusy(false); }
  }
  async function handleBindField(): Promise<void> {
    if (!deviceId || !bindFieldId.trim()) return;
    setBusy(true); setStatus(`正在绑定到田块 ${bindFieldId} ...`);
    try {
      await bindDeviceToField(token, deviceId, { field_id: bindFieldId.trim() });
      await refresh();
      const offline = String(statusObj?.status ?? hero?.status?.code ?? "").toUpperCase() !== "ONLINE";
      setStatus(`设备已绑定到田块：${bindFieldId}${offline ? "；当前设备离线，建议先校验在线状态" : ""}`);
      navigate(`/fields/${encodeURIComponent(bindFieldId.trim())}`);
    }
    catch (e: any) { setStatus(`绑定失败：${e?.bodyText || e?.message || String(e)}`); } finally { setBusy(false); }
  }

  React.useEffect(() => { void refresh(); }, [deviceId]);
  React.useEffect(() => {
    if (!deviceId) return;
    try {
      const raw = localStorage.getItem(ONBOARDING_TRACE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed.filter((item: OnboardingRecord) => item.deviceId === deviceId) : [];
      setOnboardingRecords(list);
    } catch {
      setOnboardingRecords([]);
    }
  }, [deviceId, status]);

  const boundFieldId = resolvedBoundField.field_id || deviceListItem?.field_id || (detail as any)?.device?.field_id || null;
  const boundTsMs = resolvedBoundField.bound_ts_ms || deviceListItem?.bound_ts_ms || (detail as any)?.device?.bound_ts_ms || null;
  const cp = (controlPlane as any)?.item; const hero = cp?.device; const cpSummary = cp?.summary; const cpOverview = cp?.overview; const cpConnectivity = cp?.connectivity;
  const bootstrapContext = extractBootstrapContext((detail as any)?.device, statusObj, cpOverview, cpSummary);
  const recentLatest = latest[0]; const statusLabel = normalizeStatusWord(hero?.status?.label || statusObj?.status || "-");
  const latestImageItem = latest.find((item: any) => String(item?.metric ?? item?.metric_key ?? "").toLowerCase() === "image_ref") || null;
  const latestImageRef = String(latestImageItem?.value_text ?? latestImageItem?.value ?? "-") || "-";
  const latestImageUpdatedTs = latestImageItem?.ts_ms ?? latestImageItem?.observed_at_ts_ms ?? statusObj?.last_telemetry_ts_ms ?? null;
  const firstDataReceived = Boolean((cpOverview as any)?.last_telemetry_label || statusObj?.last_telemetry_ts_ms || recentLatest);
  const firstDataLabel = firstDataReceived ? "已完成" : "数据不足";
  const hasTelemetryData = latest.length > 0 || metrics.length > 0 || Object.keys(series || {}).length > 0;
  const latestOnboardingTrace = onboardingRecords.slice().sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  const policyAwareMetrics = React.useMemo(() => buildDevicePolicyAwareMetrics({ latest, metrics, series }), [latest, metrics, series]);
  const heroMetric = policyAwareMetrics[0] || null;
  const fieldHref = boundFieldId ? `/fields/${encodeURIComponent(boundFieldId)}` : "/fields";
  const statusBlockText = statusSnapshotFallback || `${statusLabel} · 最近心跳：${cpOverview?.last_heartbeat_label || fmtTs(statusObj?.last_heartbeat_ts_ms)}`;
  const carrierModeText = String(bootstrapContext.device_mode ?? "").toLowerCase().includes("sim") ? "模拟承载" : "真实设备";
  const sensingStateRaw = String(bootstrapContext.simulator_status ?? "").toLowerCase();
  const sensingStateText = (() => {
    if (sensingStateRaw.includes("error") || sensingStateRaw.includes("fail")) return "异常";
    if (sensingStateRaw.includes("running") || sensingStateRaw.includes("start")) return "运行中";
    if (sensingStateRaw.includes("stop") || sensingStateRaw.includes("idle")) return "已停止";
    if (bootstrapContext.simulator_started === true) return "运行中";
    if (bootstrapContext.simulator_started === false) return "已停止";
    return "已停止";
  })();
  const carrierSummaryText = formatCarrierSkillNote(bootstrapContext.skill_related_note);
  const recentSensingTimeText = cpOverview?.last_telemetry_label || fmtTs(statusObj?.last_telemetry_ts_ms);
  const cycleMs = Number((cpOverview as any)?.interval_ms ?? (statusObj as any)?.interval_ms ?? NaN);
  const cycleSec = Number((cpOverview as any)?.interval_sec ?? (cpOverview as any)?.report_interval_sec ?? (statusObj as any)?.interval_sec ?? NaN);
  const cycleText = Number.isFinite(cycleSec) && cycleSec > 0
    ? `${cycleSec} 秒`
    : (Number.isFinite(cycleMs) && cycleMs > 0 ? `${Math.round(cycleMs / 1000)} 秒` : "不适用");
  const summaryLead = `当前设备状态 ${statusLabel}，绑定对象 ${boundFieldId || "未绑定田块"}，载体模式 ${carrierModeText}，最近遥测 ${heroMetric ? `${heroMetric.display_label_zh}=${heroMetric.value}${heroMetric.canonical_unit ? ` ${heroMetric.canonical_unit}` : ""}` : "暂无"}。`;

  return (
    <div className="demoDashboardPage">
      <section className="card demoHero detailHeroCard">
        <div className="eyebrow">GEOX / 设备控制台</div>
        <div className="demoCardTopRow" style={{ alignItems: "flex-start", marginTop: 8 }}>
          <div>
            <h1 className="demoHeroTitle">{hero?.title || (detail as any)?.device?.display_name || deviceId || "设备详情"}</h1>
            <p className="demoHeroSubTitle">{hero?.subtitle || "用于查看设备在线状态、接入信息、最近命令与执行回执。"}</p>
            <div className="demoMetricHint">{summaryLead}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`statusWord ${statusLabel === "在线" ? "online" : "offline"}`}>{statusLabel}</span>
            <Link className="btn secondary" to="/devices">返回设备列表</Link>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button>
          </div>
        </div>
        <div className="operationsSummaryGrid" style={{ marginTop: 16 }}>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">在线状态</span><strong>{statusLabel}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">绑定田块</span><strong>{cpSummary?.bound_field?.field_name || boundFieldId || "未绑定"}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近命令</span><strong>{cpSummary?.recent_commands?.count ?? consoleView?.recent_commands?.length ?? 0}</strong></div>
          <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">最近回执</span><strong>{cpSummary?.recent_receipts?.count ?? consoleView?.recent_receipts?.length ?? 0}</strong></div>
        </div>
        <div className="operationsSummaryActions">
          <Link className="btn" to={fieldHref}>查看绑定田块</Link>
          <Link className="btn" to="/operations">查看作业中心</Link>
        </div>
        <div className="deviceStatusGrid" style={{ marginTop: 12 }}>
          <div className="deviceStateCard"><div className="deviceStateTitle">在线状态</div><div className="deviceStateValue">{statusLabel}</div></div>
          <div className="deviceStateCard"><div className="deviceStateTitle">绑定状态</div><div className="deviceStateValue">{boundFieldId ? "已完成" : "待处理"}</div></div>
          <div className="deviceStateCard"><div className="deviceStateTitle">首条数据状态</div><div className="deviceStateValue">{firstDataLabel}</div></div>
        </div>
        {statusLabel === "离线" ? (
          <div className="operationsSummaryActions" style={{ marginTop: 8 }}>
            <Link className="btn secondary" to="/devices/onboarding">离线排查入口</Link>
            <Link className="btn weak" to="/operations">查看最近作业</Link>
          </div>
        ) : null}
      </section>

      {error ? <ErrorState title="设备详情暂不可用" message={error} technical={status} onRetry={() => void refresh()} /> : null}

      <section className="demoContentGrid">
        <section className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">图像观测（V1）</div>
            <div className="detailSectionLead">当前仅提供图像占位预览、更新时间与最新 image_ref。</div>
          </div>
          {!hasTelemetryData ? <div className="decisionItemStatic" style={{ marginBottom: 12 }}>暂无遥测数据（当前设备未提供最新遥测视图）。</div> : null}
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">图像占位预览</div>
              <div className="decisionItemMeta">当前版本不渲染实时视频流，仅显示静态占位。</div>
              <div style={{ marginTop: 8, border: "1px dashed #9ca3af", borderRadius: 10, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", background: "#f9fafb" }}>
                image preview placeholder
              </div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">更新时间</div>
              <div className="decisionItemMeta">{fmtTs(latestImageUpdatedTs)}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最新 image_ref</div>
              <div className="decisionItemMeta" style={{ wordBreak: "break-all" }}>{latestImageRef || "-"}</div>
            </div>
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader"><div className="sectionTitle">现场状态</div><div className="detailSectionLead">先判断这台设备当前是否可联动、是否绑定到了正确田块，以及最近是否还在稳定回传数据。</div></div>
          <div className="decisionList">
            <div className="decisionItemStatic"><div className="decisionItemTitle">设备身份</div><div className="decisionItemMeta">{cpOverview?.display_name || (detail as any)?.device?.display_name || deviceId || "-"} · ID：{cpOverview?.device_id || (detail as any)?.device?.device_id || deviceId || "-"}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">现场绑定</div><div className="decisionItemMeta">{cpSummary?.bound_field?.field_name || boundFieldId || "未绑定田块"} · 绑定时间：{cpSummary?.bound_field?.bound_at_label || fmtTs(boundTsMs)}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">最近状态</div><div className="decisionItemMeta">{statusBlockText}</div></div>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="metaText" style={{ cursor: "pointer" }}>展开技术补充信息（trace chips）</summary>
            <div className="traceChipRow" style={{ marginTop: 8 }}>
              <span className="traceChip">最近遥测：{hasTelemetryData ? (cpOverview?.last_telemetry_label || "-") : "暂无遥测数据"}</span>
              <span className="traceChip">电量：{cpOverview?.battery_percent ?? "-"}%</span>
              <span className="traceChip">固件：{cpOverview?.fw_ver || statusObj?.firmware_version || "-"}</span>
              <span className="traceChip">信号：{cpOverview?.rssi_dbm ?? statusObj?.rssi_dbm ?? "-"} dBm</span>
            </div>
          </details>
      </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader"><div className="sectionTitle">载体状态</div><div className="detailSectionLead">用于快速确认当前承载模式、感知输入状态与最近回传节奏。</div></div>
          <div className="decisionList">
            <div className="decisionItemStatic"><div className="decisionItemTitle">载体模式</div><div className="decisionItemMeta">{carrierModeText}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">当前感知状态</div><div className="decisionItemMeta">{sensingStateText}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">当前承载说明</div><div className="decisionItemMeta">{carrierSummaryText}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">最近感知时间</div><div className="decisionItemMeta">{recentSensingTimeText}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">运行周期</div><div className="decisionItemMeta">{cycleText}</div></div>
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader"><div className="sectionTitle">策略化指标视图</div><div className="detailSectionLead">仅展示已纳入指标展示策略且允许出现在设备详情页的指标，未分级指标默认不渲染。</div></div>
          {!policyAwareMetrics.length ? <div className="decisionItemStatic">暂无可展示指标（策略未覆盖或数据不足）。</div> : null}
          <div className="decisionList">
            {policyAwareMetrics.map((item) => (
              <div key={item.metric} className="decisionItemStatic">
                <div className="decisionItemTitle">{item.display_label_zh}</div>
                <div className="decisionItemMeta">值：{item.value}{item.canonical_unit ? ` ${item.canonical_unit}` : ""}</div>
                <div className="decisionItemMeta">推理状态：{item.reasoning_status}</div>
                <div className="decisionItemMeta">
                  来源：{formatSourceMeta({
                    source_kind: item.source_kind,
                    source_type: item.source_type,
                    data_origin: item.data_origin,
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card detailHeroCard">
          <div className="demoSectionHeader"><div className="sectionTitle">接入信息</div><div className="detailSectionLead">给设备接入和调试同学看的最小信息面，只保留本轮接入一定会用到的关键 Topic。</div></div>
          <div className="decisionList">
            <div className="decisionItemStatic"><div className="decisionItemTitle">MQTT 客户端编号</div><div className="decisionItemMeta">{cpConnectivity?.mqtt_client_id || consoleView?.access_info?.mqtt_client_id || "-"}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">遥测 / 心跳通道</div><div className="decisionItemMeta">{cpConnectivity?.telemetry_topic || consoleView?.access_info?.telemetry_topic || "-"} · {cpConnectivity?.heartbeat_topic || consoleView?.access_info?.heartbeat_topic || "-"}</div></div>
            <div className="decisionItemStatic"><div className="decisionItemTitle">下发 / 回执通道</div><div className="decisionItemMeta">{cpConnectivity?.downlink_topic || consoleView?.access_info?.downlink_topic || "-"} · {cpConnectivity?.receipt_topic || consoleView?.access_info?.receipt_topic || "-"}</div></div>
          </div>
        </section>

        <section id="onboarding-records" className="card detailHeroCard">
          <div className="demoSectionHeader">
            <div className="sectionTitle">接入记录</div>
            <div className="detailSectionLead">预留接入记录入口，并与 onboarding trace 数据关联，便于追溯每步执行结果。</div>
          </div>
          <div className="decisionList">
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">接入流程入口</div>
              <div className="decisionItemMeta">可回到接入向导继续执行/复盘 6 步流程。</div>
              <div className="operationsSummaryActions">
                <Link className="btn" to={`/devices/onboarding?device_id=${encodeURIComponent(String(deviceId || ""))}`}>打开接入向导</Link>
              </div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">最近 trace</div>
              <div className="decisionItemMeta">trace_id：{latestOnboardingTrace?.traceId || "-"}</div>
              <div className="decisionItemMeta">步骤：{latestOnboardingTrace?.stepKey || "-"} · 状态：{latestOnboardingTrace?.nextState || "-"}</div>
              <div className="decisionItemMeta">时间：{fmtTs(latestOnboardingTrace?.timestamp || null)}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">历史接入记录</div>
              <div className="decisionItemMeta">{onboardingRecords.length} 条</div>
              <details style={{ marginTop: 8 }}>
                <summary className="metaText" style={{ cursor: "pointer" }}>技术补充信息</summary>
                <div className="decisionItemMeta" style={{ marginTop: 6 }}>记录来源：local mock trace</div>
              </details>
            </div>
          </div>
        </section>
      </section>

      <section className="card detailHeroCard">
        <div className="demoSectionHeader"><div className="sectionTitle">凭据与接入动作</div><div className="detailSectionLead">在同一屏里完成签发、撤销和绑定，避免交付同学在设备页与接入向导之间来回切换。</div></div>
        <div className="decisionItemStatic" style={{ marginBottom: 12 }}>{consoleView?.access_info?.secret_warning || "设备密钥仅在签发时显示一次。"}</div>
        <div className="toolbarFilters" style={{ marginBottom: 12 }}>
          <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="调试令牌" />
          <input className="input" value={newCredentialId} onChange={(e) => setNewCredentialId(e.target.value)} placeholder="新凭据 ID（可选）" />
          <select className="select" value={bindFieldId} onChange={(e) => setBindFieldId(e.target.value)}>
            <option value="">选择田块</option>
            {availableFields.map((field: any) => <option key={String(field.field_id)} value={String(field.field_id)}>{String(field.name || field.field_id)}</option>)}
          </select>
        </div>
        <div className="operationsSummaryActions">
          <button className="btn" onClick={() => void handleIssueCredential()} disabled={busy}>签发一次性密钥</button>
          <button className="btn" onClick={() => void handleBindField()} disabled={busy || !bindFieldId.trim()}>绑定到田块</button>
        </div>
        {issuedSecret ? <div className="decisionItemStatic" style={{ marginTop: 12 }}><div className="decisionItemTitle">新凭据已签发：{issuedCredentialId || "-"}</div><div className="decisionItemMeta">请立即复制并下发到设备侧，平台不会再次返回明文 secret。</div><pre className="jsonPreview">{issuedSecret}</pre></div> : null}
        <div className="decisionList" style={{ marginTop: 12 }}>
          {(consoleView?.credentials || []).map((item) => (
            <div key={item.credential_id} className="decisionItemStatic">
              <div className="demoCardTopRow">
                <div><div className="decisionItemTitle">{item.credential_id}</div><div className="decisionItemMeta">签发：{fmtTs(item.issued_ts_ms)} · 撤销：{fmtTs(item.revoked_ts_ms)}</div></div>
                <StatusBadge status={item.status} />
              </div>
              <div className="operationsSummaryActions"><button className="btn" onClick={() => void handleRevokeCredential(String(item.credential_id))} disabled={busy || item.status !== "ACTIVE"}>撤销凭据</button></div>
            </div>
          ))}
          {!(consoleView?.credentials || []).length ? <div className="decisionItemStatic">当前还没有凭据记录。</div> : null}
        </div>
      </section>
    </div>
  );
}
