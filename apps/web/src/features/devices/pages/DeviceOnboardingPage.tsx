import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../../../auth/useSession";
import {
  getDeviceSimulatorStatus,
  startDeviceSimulator,
  stopDeviceSimulator,
  type DeviceSimulatorStatus,
} from "../../../api/deviceSimulator";
import { bindDeviceToField } from "../../../api/devices";
import { registerDeviceOnboarding } from "../../../lib/api";
import { PageHeader, SectionCard } from "../../../shared/ui";
import { buildSkillCarrierVm, type CarrierSourceType, type SkillCarrierVm } from "../../../viewmodels/skillCarrierVm";

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function formatBool(value: boolean | null | undefined): string {
  if (value == null) return "-";
  return value ? "已启动" : "未启动";
}

function formatRawStatus(value: unknown): string {
  if (typeof value === "boolean") return value ? "已启动" : "未启动";
  if (value == null) return "-";
  return String(value);
}

function formatIntervalToSeconds(intervalMs: number | null | undefined): string {
  const ms = Number(intervalMs ?? NaN);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} 秒`;
}

export default function DeviceOnboardingPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, setToken } = useSession();
  const [deviceId, setDeviceId] = React.useState<string>(searchParams.get("device_id") || "");
  const [sourceType, setSourceType] = React.useState<CarrierSourceType>("simulator");
  const [vm, setVm] = React.useState<SkillCarrierVm | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const [simulatorStatus, setSimulatorStatus] = React.useState<DeviceSimulatorStatus | null>(null);
  const [simulatorError, setSimulatorError] = React.useState<string>("");
  const [simulatorBusy, setSimulatorBusy] = React.useState<boolean>(false);
  const [intervalInput, setIntervalInput] = React.useState<string>("1000");
  const [onboardingBusy, setOnboardingBusy] = React.useState<boolean>(false);
  const [onboardingError, setOnboardingError] = React.useState<string>("");
  const [onboardingSuccess, setOnboardingSuccess] = React.useState<string>("");
  const [onboardingForm, setOnboardingForm] = React.useState<{
    device_id: string;
    display_name: string;
    device_mode: "real" | "simulator";
    device_type: string;
    field_id: string;
  }>({
    device_id: searchParams.get("device_id") || "",
    display_name: "",
    device_mode: "simulator",
    device_type: "",
    field_id: "",
  });

  function updateOnboardingForm<K extends keyof typeof onboardingForm>(key: K, value: (typeof onboardingForm)[K]): void {
    setOnboardingForm((prev) => ({ ...prev, [key]: value }));
  }

  const refreshSimulatorStatus = React.useCallback(async (): Promise<void> => {
    const id = deviceId.trim();
    if (sourceType !== "simulator" || !token.trim() || !id) {
      setSimulatorStatus(null);
      return;
    }
    try {
      const status = await getDeviceSimulatorStatus(id);
      setSimulatorStatus(status);
      setSimulatorError("");
    } catch {
      setSimulatorError("状态刷新失败");
    }
  }, [deviceId, sourceType, token]);

  React.useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      const id = deviceId.trim();
      if (!token.trim() || !id) {
        setVm(null);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const next = await buildSkillCarrierVm({ token, deviceId: id, sourceType });
        if (active) setVm(next);
      } catch {
        if (!active) return;
        setVm(null);
        setError("获取承载信息失败");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token, deviceId, sourceType]);

  React.useEffect(() => {
    let active = true;
    async function loadStatus(): Promise<void> {
      if (sourceType !== "simulator") {
        setSimulatorStatus(null);
        setSimulatorError("");
        return;
      }
      setSimulatorError("");
      try {
        const id = deviceId.trim();
        if (!token.trim() || !id) {
          setSimulatorStatus(null);
          return;
        }
        const status = await getDeviceSimulatorStatus(id);
        if (active) setSimulatorStatus(status);
      } catch {
        if (!active) return;
        setSimulatorStatus(null);
        setSimulatorError("状态刷新失败");
      }
    }
    void loadStatus();
    return () => {
      active = false;
    };
  }, [token, deviceId, sourceType]);

  async function handleSimulatorStart(): Promise<void> {
    const id = deviceId.trim();
    if (!token.trim() || !id) return;
    setSimulatorBusy(true);
    setSimulatorError("");
    try {
      const parsedInterval = Number(intervalInput);
      const result = await startDeviceSimulator(id, Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : undefined);
      setSimulatorStatus(result);
      await refreshSimulatorStatus();
    } catch {
      setSimulatorError("模拟感知控制失败");
    } finally {
      setSimulatorBusy(false);
    }
  }

  async function handleSimulatorStop(): Promise<void> {
    const id = deviceId.trim();
    if (!token.trim() || !id) return;
    setSimulatorBusy(true);
    setSimulatorError("");
    try {
      const result = await stopDeviceSimulator(id);
      setSimulatorStatus(result);
      await refreshSimulatorStatus();
    } catch {
      setSimulatorError("模拟感知控制失败");
    } finally {
      setSimulatorBusy(false);
    }
  }

  async function handleCreateDevice(): Promise<void> {
    const nextDeviceId = onboardingForm.device_id.trim();
    const nextDisplayName = onboardingForm.display_name.trim();
    const nextFieldId = onboardingForm.field_id.trim();
    const nextDeviceType = onboardingForm.device_type.trim();
    if (!token.trim()) {
      setOnboardingError("请先填写访问令牌。");
      return;
    }
    if (!nextDeviceId) {
      setOnboardingError("请填写 device_id。");
      return;
    }
    if (!nextDisplayName) {
      setOnboardingError("请填写 display_name。");
      return;
    }
    setOnboardingBusy(true);
    setOnboardingError("");
    setOnboardingSuccess("");
    try {
      await registerDeviceOnboarding(token, {
        device_id: nextDeviceId,
        display_name: nextDisplayName,
        device_mode: onboardingForm.device_mode,
        device_template: nextDeviceType || undefined,
        template_code: nextDeviceType || undefined,
      });
      if (nextFieldId) {
        await bindDeviceToField({ device_id: nextDeviceId, field_id: nextFieldId });
      }
      setDeviceId(nextDeviceId);
      setSourceType(onboardingForm.device_mode === "simulator" ? "simulator" : "physical");
      setOnboardingSuccess(`设备 ${nextDeviceId} 已创建，正在跳转详情页。`);
      navigate(`/devices/${encodeURIComponent(nextDeviceId)}`);
    } catch (e: any) {
      setOnboardingError(`创建设备失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setOnboardingBusy(false);
    }
  }

  const overview = vm?.carrier;
  const skill = vm?.skill;
  const ui = vm?.ui;
  const effectiveSimulatorStatus: DeviceSimulatorStatus | null = simulatorStatus ?? (vm?.simulator.status as DeviceSimulatorStatus | null) ?? null;
  const carrierModeText = sourceType === "simulator" ? "模拟承载" : "真实设备承载";
  const simulatorStateText = (() => {
    if (effectiveSimulatorStatus?.last_error) return "异常";
    if (effectiveSimulatorStatus?.running === true) return "运行中";
    if (effectiveSimulatorStatus?.running === false) return "已停止";
    return "未启动";
  })();
  const skillCategoriesText = skill?.categories?.join(" / ") || "未识别";
  const bindingTargetsText = skill?.bindingTargets?.join(" / ") || "未绑定";
  const sensingStatusText = vm?.telemetry.status || simulatorStateText;
  const pageTitle = ui?.pageTitle || "感知载体接入";
  const pageDescription = ui?.pageDescription || "当前页面用于为地块接入承载感知技能与设备技能的载体，支持真实设备承载与模拟承载两种模式。可查看承载状态、控制模拟感知并验证技能输入链路。";
  const carrierSummaryText = ui?.carrierSummary || `已识别 ${skill?.total ?? 0} 个候选技能，当前为 ${carrierModeText}。`;

  return (
    <div className="consolePage">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
      />
      <SectionCard title="新设备首次接入入口" subtitle="用于完成设备对象创建与首次接入，不再依赖默认 demo 设备。">
        <div className="contentGridTwo alignStart">
          <label className="field">
            <span className="metaLabel">device_id *</span>
            <input className="input" placeholder="如 device_demo_001" value={onboardingForm.device_id} onChange={(e) => updateOnboardingForm("device_id", e.target.value)} />
          </label>
          <label className="field">
            <span className="metaLabel">display_name *</span>
            <input className="input" placeholder="设备显示名称" value={onboardingForm.display_name} onChange={(e) => updateOnboardingForm("display_name", e.target.value)} />
          </label>
          <label className="field">
            <span className="metaLabel">device_mode *</span>
            <select className="select" value={onboardingForm.device_mode} onChange={(e) => updateOnboardingForm("device_mode", e.target.value as "real" | "simulator")}>
              <option value="real">真实设备承载</option>
              <option value="simulator">模拟承载</option>
            </select>
          </label>
          <label className="field">
            <span className="metaLabel">device_type（可选）</span>
            <input className="input" placeholder="如 soil_sensor_v1" value={onboardingForm.device_type} onChange={(e) => updateOnboardingForm("device_type", e.target.value)} />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="metaLabel">field_id（可选）</span>
            <input className="input" placeholder="如 field_demo_001" value={onboardingForm.field_id} onChange={(e) => updateOnboardingForm("field_id", e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" className="btn primary" disabled={onboardingBusy} onClick={() => void handleCreateDevice()}>
            {onboardingBusy ? "创建中..." : "新建设备并发起首次接入"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={onboardingBusy}
            onClick={() => {
              const id = onboardingForm.device_id.trim();
              if (!id) return;
              setDeviceId(id);
              setSourceType(onboardingForm.device_mode === "simulator" ? "simulator" : "physical");
            }}
          >
            使用该设备查看接入状态
          </button>
        </div>
        {onboardingError ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>{onboardingError}</div> : null}
        {onboardingSuccess ? <div className="metaText" style={{ marginTop: 8, color: "#067647" }}>{onboardingSuccess}</div> : null}
      </SectionCard>

      <SectionCard title="已有设备载体接入状态总览" subtitle="以下区域用于已存在设备的状态查看、模拟控制与排障。">
        <div className="contentGridTwo alignStart" style={{ marginBottom: 12 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">载体信息</div>
            <div className="decisionItemMeta">{ui?.carrierIdLabel || "载体编号"}：{deviceId || "-"}</div>
            <div className="decisionItemMeta">{ui?.carrierNameLabel || "载体名称"}：{overview?.displayName || "未命名载体"}</div>
            <div className="decisionItemMeta">{ui?.carrierModeLabel || "承载模式"}：{carrierModeText}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">技能承载</div>
            <div className="decisionItemMeta">{ui?.skillCategoryLabel || "当前技能类别"}：{skillCategoriesText}</div>
            <div className="decisionItemMeta">{ui?.bindTargetLabel || "当前绑定目标"}：{bindingTargetsText}</div>
            <div className="decisionItemMeta">{ui?.deviceTypeLabel || "当前设备类型"}：{overview?.deviceType || "未识别"}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">现场绑定</div>
            <div className="decisionItemMeta">{ui?.fieldLabel || "当前绑定地块"}：{overview?.fieldId || "未绑定"}</div>
            <div className="decisionItemMeta">{ui?.inputStatusLabel || "当前输入状态"}：{sensingStatusText || "-"}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">最近感知</div>
            <div className="decisionItemMeta">{ui?.latestInputLabel || "最近感知时间"}：{formatTime(vm?.telemetry.lastTelemetryAt ?? null)}</div>
            <div className="decisionItemMeta">{ui?.latestHeartbeatLabel || "最近心跳时间"}：{formatTime(vm?.telemetry.lastHeartbeatAt ?? null)}</div>
          </div>
        </div>
        <div className="metaText" style={{ marginTop: 8 }}>
          {loading ? "正在加载承载状态…" : carrierSummaryText}
        </div>
        {error ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>{error}</div> : null}
      </SectionCard>

      <SectionCard title="承载模式与模拟感知">
        {sourceType === "physical" ? (
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">真实设备承载</div>
            <div className="decisionItemMeta">该载体直接为技能提供现场输入，请优先核对感知链路与心跳连续性。</div>
            <div className="decisionItemMeta">当前感知链路状态：{vm?.telemetry.status ?? "未知"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">模拟感知控制卡</div>
              <div className="decisionItemMeta" style={{ marginBottom: 8 }}>{ui?.simulatorControlSummary || "当前为模拟承载，可直接控制模拟感知并验证技能输入链路。"}</div>
              <div className="metaLabel" style={{ marginBottom: 6 }}>状态摘要</div>
              <div className="contentGridTwo alignStart" style={{ marginBottom: 10 }}>
                <div className="field">
                  <span className="metaLabel">{ui?.simulatorStatusLabel || "当前状态"}</span>
                  <div className="metaText">{simulatorStateText}</div>
                </div>
                <div className="field">
                  <span className="metaLabel">{ui?.simulatorLastTickLabel || "最近一次模拟输入时间"}</span>
                  <div className="metaText">{formatTime(effectiveSimulatorStatus?.last_tick_ts_ms ?? null)}</div>
                </div>
                <div className="field">
                  <span className="metaLabel">{ui?.simulatorIntervalLabel || "当前模拟输入周期"}</span>
                  <div className="metaText">{formatIntervalToSeconds(effectiveSimulatorStatus?.interval_ms ?? null)}</div>
                </div>
                <div className="field">
                  <span className="metaLabel">当前承载说明</span>
                  <div className="metaText">正在为 {skill?.categories?.join(" / ") || "相关技能"} 提供模拟输入</div>
                </div>
              </div>
              <div className="metaLabel" style={{ marginBottom: 6 }}>操作区</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <label className="field" style={{ minWidth: 220 }}>
                  <span className="metaLabel">模拟输入周期</span>
                  <input
                    className="input"
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    placeholder="1000"
                    inputMode="numeric"
                  />
                  <div className="metaText">默认 1000 ms，合法范围 1000–60000 ms。</div>
                </label>
                <button type="button" className="btn primary" disabled={simulatorBusy} onClick={() => void handleSimulatorStart()}>
                  {simulatorBusy ? "处理中..." : "启动模拟感知"}
                </button>
                <button type="button" className="btn" disabled={simulatorBusy} onClick={() => void handleSimulatorStop()}>
                  {simulatorBusy ? "处理中..." : "停止模拟感知"}
                </button>
                <button type="button" className="btn secondary" disabled={simulatorBusy} onClick={() => void refreshSimulatorStatus()}>
                  刷新状态
                </button>
              </div>
              {simulatorError ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>{simulatorError}</div> : null}
              <details style={{ marginTop: 10 }}>
                <summary className="metaText" style={{ cursor: "pointer" }}>技术详情（可折叠）</summary>
                <div className="contentGridTwo alignStart" style={{ marginTop: 8 }}>
                  <div className="field"><span className="metaLabel">原始运行状态字段</span><div className="metaText">{formatBool(effectiveSimulatorStatus?.running ?? null)}</div></div>
                  <div className="field"><span className="metaLabel">原始状态字段</span><div className="metaText">{formatRawStatus(effectiveSimulatorStatus?.status)}</div></div>
                  <div className="field"><span className="metaLabel">启动时间戳</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.started_ts_ms ?? null)}</div></div>
                  <div className="field"><span className="metaLabel">停止时间戳</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.stopped_ts_ms ?? null)}</div></div>
                  <div className="field"><span className="metaLabel">{ui?.simulatorErrorLabel || "最近错误"}</span><div className="metaText">{String(effectiveSimulatorStatus?.last_error ?? "-")}</div></div>
                  <div className="field"><span className="metaLabel">原始周期字段</span><div className="metaText">{effectiveSimulatorStatus?.interval_ms ?? "-"}</div></div>
                  <div className="field"><span className="metaLabel">最近 tick 时间戳</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.last_tick_ts_ms ?? null)}</div></div>
                </div>
              </details>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="技术详情 / 展开调试信息">
        <details>
          <summary className="metaText" style={{ cursor: "pointer" }}>展开设备接入技术详情（仅供排障）</summary>
          <div className="contentGridTwo alignStart" style={{ marginTop: 10 }}>
            <label className="field">
              <span className="metaLabel">访问令牌</span>
              <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
            <label className="field">
              <span className="metaLabel">载体编号</span>
              <input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="metaLabel">承载模式切换</span>
              <select className="select" value={sourceType} onChange={(e) => setSourceType(e.target.value as CarrierSourceType)}>
                <option value="simulator">模拟承载</option>
                <option value="physical">真实设备承载</option>
              </select>
            </label>
            <div className="field"><span className="metaLabel">设备显示名称</span><div className="metaText">{overview?.displayName ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">设备标识</span><div className="metaText">{deviceId || "-"}</div></div>
            <div className="field"><span className="metaLabel">接入来源类型</span><div className="metaText">{sourceType}</div></div>
            <div className="field"><span className="metaLabel">设备运行模式</span><div className="metaText">{overview?.deviceMode ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">模拟感知是否已启动</span><div className="metaText">{formatBool(overview?.simulatorStarted)}</div></div>
            <div className="field"><span className="metaLabel">模拟感知状态</span><div className="metaText">{overview?.simulatorStatus ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">技能分类</span><div className="metaText">{skill?.categories?.join(" / ") || "-"}</div></div>
            <div className="field"><span className="metaLabel">绑定目标</span><div className="metaText">{skill?.bindingTargets?.join(" / ") || "-"}</div></div>
            <div className="field"><span className="metaLabel">设备类型</span><div className="metaText">{overview?.deviceType ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">所属地块</span><div className="metaText">{overview?.fieldId ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">最近遥测时间</span><div className="metaText">{formatTime(vm?.telemetry.lastTelemetryAt ?? null)}</div></div>
            <div className="field"><span className="metaLabel">最近心跳时间</span><div className="metaText">{formatTime(vm?.telemetry.lastHeartbeatAt ?? null)}</div></div>
          </div>
        </details>
      </SectionCard>

      <SectionCard title="接入辅助步骤（可选）" subtitle="用于帮助说明、排查指引与步骤附录，不作为页面主骨架。">
        <details>
          <summary className="metaText" style={{ cursor: "pointer" }}>展开帮助说明 / 步骤参考 / 排查附录</summary>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">帮助说明</div>
              <div className="decisionItemMeta">本区域仅作为接入辅助说明，不参与主路径状态判断。</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">步骤参考</div>
              <div className="decisionItemMeta">建议依次核对：载体信息、技能承载、现场绑定、最近感知与模拟控制状态。</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">排查附录</div>
              <div className="decisionItemMeta">如出现异常，请先刷新状态，再查看“技术详情 / 展开调试信息”中的原始字段。</div>
            </div>
          </div>
        </details>
      </SectionCard>

      <SectionCard title="后续动作">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn primary" to={`/devices/${encodeURIComponent(deviceId.trim())}`}>查看载体详情</Link>
          <Link className="btn" to="/skills/registry">查看技能注册</Link>
          <Link className="btn" to="/skills/bindings">查看技能绑定</Link>
          <Link className="btn" to="/devices">返回设备列表</Link>
        </div>
      </SectionCard>
    </div>
  );
}
