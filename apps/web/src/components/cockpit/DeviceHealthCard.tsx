import React from "react";
import type { CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";

type Props = {
  summary: CustomerDashboardVm["deviceHealth"];
};

export default function DeviceHealthCard({ summary }: Props): React.ReactElement {
  if (summary.empty) {
    return <article className="customerCard"><h3 className="customerCardTitle">设备健康</h3><div className="muted">暂无设备状态摘要</div></article>;
  }
  return (
    <article className="customerCard">
      <h3 className="customerCardTitle">设备健康</h3>
      <div className="customerMetricLabel">在线设备：{summary.onlineDevices ?? "--"}</div>
      <div className="customerMetricLabel">离线设备：{summary.offlineDevices ?? "--"}</div>
      <div className="customerMetricLabel">告警设备：{summary.alertDevices ?? "--"}</div>
      <div className="muted">最近更新时间：{summary.updatedAtText ?? "--"}</div>
    </article>
  );
}
