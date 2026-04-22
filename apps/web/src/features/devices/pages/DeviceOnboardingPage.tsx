import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../../../auth/useSession";
import {
  getDeviceSimulatorStatus,
  startDeviceSimulator,
  stopDeviceSimulator,
  type DeviceSimulatorStatus,
} from "../../../api/deviceSimulator";
import DeviceOnboardingFlow from "../../../features/devices/onboarding/components/DeviceOnboardingFlow";
import { PageHeader, SectionCard } from "../../../shared/ui";
import { buildSkillCarrierVm, type CarrierSourceType, type SkillCarrierVm } from "../../../viewmodels/skillCarrierVm";

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function formatBool(value: boolean | null | undefined): string {
  if (value == null) return "-";
  return value ? "是" : "否";
}

export default function DeviceOnboardingPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { token, setToken } = useSession();
  const [deviceId, setDeviceId] = React.useState<string>(searchParams.get("device_id") || "demo_device_001");
  const [sourceType, setSourceType] = React.useState<CarrierSourceType>("simulator");
  const [vm, setVm] = React.useState<SkillCarrierVm | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>("");
  const [simulatorStatus, setSimulatorStatus] = React.useState<DeviceSimulatorStatus | null>(null);
  const [simulatorError, setSimulatorError] = React.useState<string>("");
  const [simulatorBusy, setSimulatorBusy] = React.useState<boolean>(false);
  const [intervalInput, setIntervalInput] = React.useState<string>("1000");

  const refreshSimulatorStatus = React.useCallback(async (): Promise<void> => {
    const id = deviceId.trim();
    if (sourceType !== "simulator" || !token.trim() || !id) {
      setSimulatorStatus(null);
      return;
    }
    const status = await getDeviceSimulatorStatus(id);
    setSimulatorStatus(status);
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
      } catch (e: unknown) {
        if (!active) return;
        setVm(null);
        setError(e instanceof Error ? e.message : "加载失败");
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
      } catch (e: unknown) {
        if (!active) return;
        setSimulatorStatus(null);
        setSimulatorError(e instanceof Error ? e.message : "获取 simulator 状态失败");
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
    } catch (e: unknown) {
      setSimulatorError(e instanceof Error ? e.message : "启动 simulator 失败");
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
    } catch (e: unknown) {
      setSimulatorError(e instanceof Error ? e.message : "停止 simulator 失败");
    } finally {
      setSimulatorBusy(false);
    }
  }

  const overview = vm?.carrier;
  const skill = vm?.skill;
  const effectiveSimulatorStatus: DeviceSimulatorStatus | null = simulatorStatus ?? (vm?.simulator.status as DeviceSimulatorStatus | null) ?? null;
  const carrierModeText = sourceType === "simulator" ? "模拟承载" : "真实设备承载";
  const skillInputText = `${skill?.categories?.join(" / ") || "未识别 skill 类别"} · ${skill?.bindingTargets?.join(" / ") || "未绑定目标"}`;
  const bindingStatusText = `${overview?.fieldId || "未绑定 field"} · ${vm?.telemetry.status || "暂无遥测状态"}`;
  const sensingText = `输入 ${formatTime(vm?.telemetry.lastTelemetryAt ?? null)} · 心跳 ${formatTime(vm?.telemetry.lastHeartbeatAt ?? null)}`;
  const simulatorStateText = (() => {
    if (effectiveSimulatorStatus?.last_error) return "异常";
    if (effectiveSimulatorStatus?.running === true) return "运行中";
    if (effectiveSimulatorStatus?.running === false) return "已停止";
    return "未启动";
  })();

  return (
    <div className="consolePage">
      <PageHeader
        title="Skill Carrier Onboarding"
        description="该载体正在为 sensing skill 提供演示输入：先看产品摘要，再按需展开技术详情排障。"
      />

      <SectionCard title="首屏摘要">
        <div className="contentGridTwo alignStart">
          <label className="field">
            访问令牌
            <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label className="field">
            载体 ID
            <input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
          </label>
          <label className="field">
            承载模式
            <select className="select" value={sourceType} onChange={(e) => setSourceType(e.target.value as CarrierSourceType)}>
              <option value="simulator">模拟承载</option>
              <option value="physical">真实设备承载</option>
            </select>
          </label>
          <div className="field">
            <span className="metaLabel">承载模式</span>
            <div className="metaText">{carrierModeText}</div>
          </div>
          <div className="field">
            <span className="metaLabel">当前技能输入</span>
            <div className="metaText">{skillInputText}</div>
          </div>
          <div className="field">
            <span className="metaLabel">载体绑定状态</span>
            <div className="metaText">{bindingStatusText}</div>
          </div>
          <div className="field">
            <span className="metaLabel">最近感知</span>
            <div className="metaText">{sensingText}</div>
          </div>
        </div>
        <div className="metaText" style={{ marginTop: 8 }}>
          {loading ? "正在组装 skill 载体摘要..." : `已识别 ${skill?.total ?? 0} 个候选 skill，当前为 ${carrierModeText}。`}
        </div>
        {error ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>加载失败：{error}</div> : null}
      </SectionCard>

      <SectionCard title="第二层：模式分支（真实设备承载 vs 模拟承载）">
        {sourceType === "physical" ? (
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">真实设备承载（physical）</div>
            <div className="decisionItemMeta">该载体直接为 skill 提供现场输入，请优先核对感知链路与心跳连续性。</div>
            <div className="decisionItemMeta">当前感知链路状态：{vm?.telemetry.status ?? "unknown"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">模拟承载（simulator）</div>
              <div className="decisionItemMeta">该载体正在为 sensing skill 提供演示输入，用于验证 skill 行为与绑定策略。</div>
              <div className="decisionItemMeta">当前模拟输入状态：{simulatorStateText}</div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">模拟感知控制</div>
              <div className="contentGridTwo alignStart" style={{ marginBottom: 8 }}>
                <div className="field">
                  <span className="metaLabel">当前状态</span>
                  <div className="metaText">{simulatorStateText}</div>
                </div>
                <div className="field">
                  <span className="metaLabel">当前承载说明</span>
                  <div className="metaText">正在为 {skill?.categories?.join(" / ") || "sensing skill"} 提供模拟输入</div>
                </div>
                <div className="field">
                  <span className="metaLabel">最近一次模拟输入时间</span>
                  <div className="metaText">{formatTime(effectiveSimulatorStatus?.last_tick_ts_ms ?? null)}</div>
                </div>
                <div className="field">
                  <span className="metaLabel">模拟输入周期</span>
                  <div className="metaText">{effectiveSimulatorStatus?.interval_ms ? `${effectiveSimulatorStatus.interval_ms} ms` : "-"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <label className="field" style={{ minWidth: 220 }}>
                  <span className="metaLabel">模拟输入周期（毫秒）</span>
                  <input
                    className="input"
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    placeholder="1000"
                    inputMode="numeric"
                  />
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
              {simulatorError ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>simulator API 错误：{simulatorError}</div> : null}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="技术详情 / 展开调试信息">
        <details>
          <summary className="metaText" style={{ cursor: "pointer" }}>展开 carrier/device/simulator 原始字段（仅供排障）</summary>
          <div className="contentGridTwo alignStart" style={{ marginTop: 10 }}>
            <div className="field"><span className="metaLabel">carrier.display_name</span><div className="metaText">{overview?.displayName ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">carrier.device_id</span><div className="metaText">{deviceId || "-"}</div></div>
            <div className="field"><span className="metaLabel">source_type</span><div className="metaText">{sourceType}</div></div>
            <div className="field"><span className="metaLabel">device_mode</span><div className="metaText">{overview?.deviceMode ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">simulator_started</span><div className="metaText">{formatBool(overview?.simulatorStarted)}</div></div>
            <div className="field"><span className="metaLabel">simulator_status</span><div className="metaText">{overview?.simulatorStatus ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">skill category</span><div className="metaText">{skill?.categories?.join(" / ") || "-"}</div></div>
            <div className="field"><span className="metaLabel">bind_target</span><div className="metaText">{skill?.bindingTargets?.join(" / ") || "-"}</div></div>
            <div className="field"><span className="metaLabel">device_type</span><div className="metaText">{overview?.deviceType ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">field</span><div className="metaText">{overview?.fieldId ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">telemetry.last_telemetry</span><div className="metaText">{formatTime(vm?.telemetry.lastTelemetryAt ?? null)}</div></div>
            <div className="field"><span className="metaLabel">telemetry.last_heartbeat</span><div className="metaText">{formatTime(vm?.telemetry.lastHeartbeatAt ?? null)}</div></div>
            <div className="field"><span className="metaLabel">running</span><div className="metaText">{formatBool(effectiveSimulatorStatus?.running ?? null)}</div></div>
            <div className="field"><span className="metaLabel">started_ts_ms</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.started_ts_ms ?? null)}</div></div>
            <div className="field"><span className="metaLabel">stopped_ts_ms</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.stopped_ts_ms ?? null)}</div></div>
            <div className="field"><span className="metaLabel">interval_ms</span><div className="metaText">{effectiveSimulatorStatus?.interval_ms ?? "-"}</div></div>
            <div className="field"><span className="metaLabel">last_tick_ts_ms</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.last_tick_ts_ms ?? null)}</div></div>
            <div className="field"><span className="metaLabel">status</span><div className="metaText">{String(effectiveSimulatorStatus?.status ?? "-")}</div></div>
            <div className="field"><span className="metaLabel">last_error</span><div className="metaText">{String(effectiveSimulatorStatus?.last_error ?? "-")}</div></div>
          </div>
        </details>
      </SectionCard>

      <DeviceOnboardingFlow sourceType={sourceType} />

      <SectionCard title="后续动作">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn primary" to={`/devices/${encodeURIComponent(deviceId.trim())}`}>跳转设备详情</Link>
          <Link className="btn" to="/skills/registry">查看技能注册中心</Link>
          <Link className="btn" to="/skills/bindings">查看 skill 绑定关系</Link>
          <Link className="btn" to="/devices">返回设备列表</Link>
        </div>
      </SectionCard>
    </div>
  );
}
