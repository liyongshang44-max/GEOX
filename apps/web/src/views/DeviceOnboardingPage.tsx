import React from "react";
import { fetchDeviceOnboardingStatus, registerDeviceOnboarding } from "../lib/api";

function readToken(): string {
  try {
    return localStorage.getItem("geox_ao_act_token") || "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
  } catch {
    return "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
  }
}

function fmtTs(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "-";
}

export default function DeviceOnboardingPage(): React.ReactElement {
  const [token, setToken] = React.useState<string>(() => readToken());
  const [deviceId, setDeviceId] = React.useState<string>("demo_device_001");
  const [displayName, setDisplayName] = React.useState<string>("演示设备 001");
  const [credentialId, setCredentialId] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("请填写设备信息并签发接入凭据。");
  const [busy, setBusy] = React.useState<boolean>(false);
  const [registerResult, setRegisterResult] = React.useState<any>(null);
  const [onboarding, setOnboarding] = React.useState<any>(null);

  function persistToken(next: string): void {
    setToken(next);
    try {
      localStorage.setItem("geox_ao_act_token", next);
    } catch {
      // ignore
    }
  }

  async function handleRegister(): Promise<void> {
    setBusy(true);
    setStatus("正在注册设备并签发凭据...");
    try {
      const res = await registerDeviceOnboarding(token, {
        device_id: deviceId.trim(),
        display_name: displayName.trim(),
        credential_id: credentialId.trim() || undefined,
      });
      setRegisterResult(res);
      setStatus(`设备 ${res?.device_id || deviceId} 已注册，凭据已签发。`);
      const next = await fetchDeviceOnboardingStatus(token, deviceId.trim());
      setOnboarding(next);
    } catch (e: any) {
      setStatus(`注册失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshStatus(): Promise<void> {
    setBusy(true);
    setStatus(`正在查询 ${deviceId} 的接入状态...`);
    try {
      const next = await fetchDeviceOnboardingStatus(token, deviceId.trim());
      setOnboarding(next);
      setStatus("接入状态已刷新。");
    } catch (e: any) {
      setStatus(`状态查询失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Devices · Onboarding</div>
          <h2 className="heroTitle">设备接入向导</h2>
          <p className="heroText">完成“设备注册 → 凭据签发 → 首条 telemetry 上传”的闭环，并提供设备端配置示例。</p>
        </div>
        <div className="heroActions">
          <button className="btn primary" disabled={busy} onClick={() => void handleRegister()}>一键注册并签发</button>
          <button className="btn" disabled={busy} onClick={() => void handleRefreshStatus()}>刷新接入状态</button>
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">设备注册</div></div></div>
        <div className="contentGridTwo alignStart">
          <label className="field">访问令牌<input className="input" value={token} onChange={(e) => persistToken(e.target.value)} /></label>
          <label className="field">设备 ID<input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} /></label>
          <label className="field">设备名称<input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label className="field">凭据 ID（可选）<input className="input" value={credentialId} onChange={(e) => setCredentialId(e.target.value)} placeholder="留空自动生成" /></label>
        </div>
        <div className="metaText" style={{ marginTop: 8 }}>{status}</div>
      </section>

      {registerResult ? (
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">一次性凭据（请立即保存）</div></div></div>
          <div className="meta wrapMeta">
            <span>设备：{registerResult.device_id}</span>
            <span>凭据：{registerResult.credential_id}</span>
            <span>Topic：{registerResult?.access_info?.telemetry_topic || "-"}</span>
          </div>
          <pre className="jsonPreview">{registerResult.credential_secret}</pre>
        </section>
      ) : null}

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">设备端配置指南</div></div></div>
        <ol className="metaText" style={{ lineHeight: 1.8 }}>
          <li>设置 MQTT Client ID：<code>{onboarding?.access_info?.mqtt_client_id || `geox-&lt;tenant&gt;-${deviceId}`}</code></li>
          <li>认证用户名建议使用设备 ID，密码使用上方一次性 credential secret。</li>
          <li>发布 telemetry 到 Topic：<code>{onboarding?.access_info?.telemetry_topic || `telemetry/&lt;tenant&gt;/${deviceId}`}</code></li>
          <li>建议同时上报 heartbeat 到 Topic：<code>{onboarding?.access_info?.heartbeat_topic || `heartbeat/&lt;tenant&gt;/${deviceId}`}</code></li>
          <li>首条 telemetry 建议 JSON 示例：<code>{`{"metric":"battery_percent","value":87,"ts_ms":${Date.now()}}`}</code></li>
        </ol>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">接入进度</div></div></div>
        <div className="summaryGrid">
          <div className="metricCard card"><div className="metricLabel">设备已注册</div><div className="metricValue">{onboarding?.registration_completed ? "是" : "否"}</div></div>
          <div className="metricCard card"><div className="metricLabel">凭据可用</div><div className="metricValue">{onboarding?.credential_ready ? "是" : "否"}</div></div>
          <div className="metricCard card"><div className="metricLabel">首条遥测</div><div className="metricValue">{onboarding?.first_telemetry_uploaded ? "已上传" : "未上传"}</div></div>
          <div className="metricCard card"><div className="metricLabel">最近遥测时间</div><div className="metricValue" style={{ fontSize: 14 }}>{fmtTs(onboarding?.last_telemetry_ts_ms)}</div></div>
        </div>
      </section>
    </div>
  );
}
