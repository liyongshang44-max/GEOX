import React from "react";

export function DeviceHealthCard({ offlineDevices }: { offlineDevices: string }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">设备健康</h3><div className="customerMetricValue">离线设备 {offlineDevices} 台</div><div className="muted">仅展示设备在线健康，不展示天气信息。</div></article>;
}

export function ValueResultPanel({ valueText, roiItems }: { valueText: string; roiItems: number }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">价值结果</h3><div className="customerMetricLabel">价值记录 {roiItems} 条</div><div className="muted customerSpacingTopXs">{valueText}</div></article>;
}
