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
  return value ? "true" : "false";
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

  return (
    <div className="consolePage">
      <PageHeader
        title="Skill Carrier Onboarding"
        description="该载体为某 skill 提供输入：页面主交互只呈现载体概览与 source_type 分支，不再以培训流程叙事作为主骨架。"
      />

      <SectionCard title="第一层：接入概览（carrier / source_type / skill category / bind_target / device_type / field / telemetry）">
        <div className="contentGridTwo alignStart">
          <label className="field">访问令牌<input className="input" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <label className="field">carrier.device_id<input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} /></label>
          <label className="field">
            source_type
            <select className="select" value={sourceType} onChange={(e) => setSourceType(e.target.value as CarrierSourceType)}>
              <option value="simulator">simulator（模拟承载）</option>
              <option value="physical">physical（真实设备承载）</option>
            </select>
          </label>
          <div className="field">
            <span className="metaLabel">carrier.display_name</span>
            <div className="metaText">{overview?.displayName ?? "-"}</div>
          </div>
          <div className="field">
            <span className="metaLabel">skill category</span>
            <div className="metaText">{skill?.categories?.join(" / ") || "-"}</div>
          </div>
          <div className="field">
            <span className="metaLabel">bind_target</span>
            <div className="metaText">{skill?.bindingTargets?.join(" / ") || "-"}</div>
          </div>
          <div className="field">
            <span className="metaLabel">device_type</span>
            <div className="metaText">{overview?.deviceType ?? "-"}</div>
          </div>
          <div className="field">
            <span className="metaLabel">field</span>
            <div className="metaText">{overview?.fieldId ?? "-"}</div>
          </div>
          <div className="field">
            <span className="metaLabel">telemetry.last_telemetry</span>
            <div className="metaText">{formatTime(vm?.telemetry.lastTelemetryAt ?? null)}</div>
          </div>
          <div className="field">
            <span className="metaLabel">telemetry.last_heartbeat</span>
            <div className="metaText">{formatTime(vm?.telemetry.lastHeartbeatAt ?? null)}</div>
          </div>
        </div>
        <div className="metaText" style={{ marginTop: 8 }}>
          {loading ? "正在组装 skill carrier viewmodel..." : `skills=${skill?.total ?? 0} · telemetry_status=${vm?.telemetry.status ?? "-"}`}
        </div>
        {error ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>加载失败：{error}</div> : null}
      </SectionCard>

      <SectionCard title="第二层：模式分支（真实设备承载 vs 模拟承载）">
        {sourceType === "physical" ? (
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">真实设备承载（physical）</div>
            <div className="decisionItemMeta">该载体直接为 skill 提供现场输入，请优先核对设备在线状态、最后一次心跳与 telemetry 上报时间。</div>
            <div className="decisionItemMeta">current telemetry_status：{vm?.telemetry.status ?? "unknown"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">模拟承载（simulator）</div>
              <div className="decisionItemMeta">该载体通过 simulator 为 skill 注入测试输入，用于验证 skill 行为与绑定策略。</div>
              <div className="decisionItemMeta">
                simulator status：
                {vm?.simulator.checked ? (vm.simulator.running == null ? "unknown" : vm.simulator.running ? "running" : "stopped") : "not_checked"}
              </div>
            </div>
            <div className="decisionItemStatic">
              <div className="decisionItemTitle">Simulator 控制与正式状态信息</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <label className="field" style={{ minWidth: 220 }}>
                  <span className="metaLabel">interval_ms</span>
                  <input
                    className="input"
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    placeholder="1000"
                    inputMode="numeric"
                  />
                </label>
                <button type="button" className="btn primary" disabled={simulatorBusy} onClick={() => void handleSimulatorStart()}>
                  {simulatorBusy ? "处理中..." : "Start"}
                </button>
                <button type="button" className="btn" disabled={simulatorBusy} onClick={() => void handleSimulatorStop()}>
                  {simulatorBusy ? "处理中..." : "Stop"}
                </button>
                <button type="button" className="btn secondary" disabled={simulatorBusy} onClick={() => void refreshSimulatorStatus()}>
                  Refresh
                </button>
              </div>
              <div className="contentGridTwo alignStart">
                <div className="field"><span className="metaLabel">running</span><div className="metaText">{formatBool(effectiveSimulatorStatus?.running ?? null)}</div></div>
                <div className="field"><span className="metaLabel">started_ts_ms</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.started_ts_ms ?? null)}</div></div>
                <div className="field"><span className="metaLabel">stopped_ts_ms</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.stopped_ts_ms ?? null)}</div></div>
                <div className="field"><span className="metaLabel">interval_ms</span><div className="metaText">{effectiveSimulatorStatus?.interval_ms ?? "-"}</div></div>
                <div className="field"><span className="metaLabel">last_tick_ts_ms</span><div className="metaText">{formatTime(effectiveSimulatorStatus?.last_tick_ts_ms ?? null)}</div></div>
                <div className="field"><span className="metaLabel">status</span><div className="metaText">{String(effectiveSimulatorStatus?.status ?? "-")}</div></div>
                <div className="field"><span className="metaLabel">last_error</span><div className="metaText">{String(effectiveSimulatorStatus?.last_error ?? "-")}</div></div>
              </div>
              {simulatorError ? <div className="metaText" style={{ marginTop: 8, color: "#b42318" }}>simulator API 错误：{simulatorError}</div> : null}
            </div>
          </div>
        )}
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
