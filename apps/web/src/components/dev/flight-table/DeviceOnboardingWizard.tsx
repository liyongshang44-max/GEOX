import React from "react";
import type { FlightTableCredentialRefV1 } from "../../../api/flightTable";

type Props = {
  deviceIds: string[];
  credentials: FlightTableCredentialRefV1[];
};

const STEPS = ["选择设备模板", "创建设备", "签发凭证", "绑定田块", "发送 heartbeat", "发布 telemetry", "验证 observation / sensing"];

export default function DeviceOnboardingWizard({ deviceIds, credentials }: Props): React.ReactElement {
  return (
    <section className="flight-card">
      <div className="flight-card-head">
        <h2>真实设备接入向导</h2>
        <span>{deviceIds.length} 台设备 / {credentials.length} 个凭证</span>
      </div>
      <div className="flight-wizard">
        {STEPS.map((step) => <div key={step} className="flight-wizard-step"><span>PENDING</span>{step}</div>)}
      </div>
      <p className="flight-muted">FT-A0 只放置接入向导壳。设备创建、凭证签发、heartbeat 与 telemetry 在 FT-C/FT-F 实现。</p>
    </section>
  );
}
