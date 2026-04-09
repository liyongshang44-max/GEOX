import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../../../auth/useSession";
import DeviceOnboardingFlow from "../../../features/devices/onboarding/components/DeviceOnboardingFlow";
import { PageHeader, SectionCard } from "../../../shared/ui";

export default function DeviceOnboardingPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { token, setToken } = useSession();
  const [deviceId, setDeviceId] = React.useState<string>(searchParams.get("device_id") || "demo_device_001");
  const [displayName, setDisplayName] = React.useState<string>("演示设备 001");
  const [fieldId, setFieldId] = React.useState<string>("field_demo_001");
  const [deviceMode, setDeviceMode] = React.useState<"real" | "simulator">("simulator");

  return (
    <div className="consolePage">
      <PageHeader
        title="设备接入向导"
        description="固定 6 步接入流程，统一展示状态、反馈、下一步动作与失败排查建议；当前以 mock state（pending/success/failed）驱动交互闭环。"
      />

      <SectionCard title="基础上下文">
        <div className="contentGridTwo alignStart">
          <label className="field">访问令牌<input className="input" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <label className="field">设备 ID<input className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} /></label>
          <label className="field">设备名称<input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <label className="field">
            设备模式
            <select className="select" value={deviceMode} onChange={(e) => setDeviceMode((e.target.value as "real" | "simulator"))}>
              <option value="simulator">simulator（仿真）</option>
              <option value="real">real（真实设备）</option>
            </select>
          </label>
          <label className="field">目标田块 ID<input className="input" value={fieldId} onChange={(e) => setFieldId(e.target.value)} /></label>
        </div>
        <div className="metaText" style={{ marginTop: 8 }}>
          当前演示上下文：<code>{deviceId}</code> / <code>{displayName}</code> / <code>{deviceMode}</code> / <code>{fieldId}</code>。
        </div>
      </SectionCard>

      <DeviceOnboardingFlow deviceId={deviceId} deviceMode={deviceMode} />

      <SectionCard title="后续动作">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn primary" to={`/devices/${encodeURIComponent(deviceId.trim())}`}>跳转设备详情</Link>
          <Link className="btn" to="/devices">返回设备列表</Link>
        </div>
      </SectionCard>
    </div>
  );
}
