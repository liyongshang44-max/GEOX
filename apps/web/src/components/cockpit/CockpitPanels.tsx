import React from "react";
import { Link } from "react-router-dom";
import type { CustomerActionItemVm, CustomerDashboardVm } from "../../viewmodels/customerDashboardVm";

export function CockpitFieldRiskPanel({ items }: { items: CustomerDashboardVm["topRiskFields"] }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">地块风险</h3><ul className="customerList">{items.map((item) => <li key={item.id} className="customerListItem"><Link to={item.href}>{item.rowText}</Link></li>)}{!items.length ? <li className="muted">暂无高风险地块</li> : null}</ul></article>;
}

export function CockpitActionList({ items }: { items: CustomerActionItemVm[] }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">行动清单</h3><div className="customerList">{items.slice(0, 5).map((item) => <div key={item.id} className="customerListItem"><div><strong>{item.title}</strong></div><div className="muted">{item.summary}</div>{item.primaryAction.href ? <Link className="customerButton customerSpacingTopXs" to={item.primaryAction.href}>{item.primaryAction.label}</Link> : <div className="muted customerSpacingTopXs">{item.primaryAction.disabledReason ?? "暂无可执行动作"}</div>}</div>)}</div></article>;
}

export function DeviceHealthCard({ offlineDevices }: { offlineDevices: string }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">设备健康</h3><div className="customerMetricValue">离线设备 {offlineDevices} 台</div><div className="muted">仅展示设备在线健康，不展示天气信息。</div></article>;
}

export function ValueResultPanel({ valueText, roiItems }: { valueText: string; roiItems: number }): React.ReactElement {
  return <article className="customerCard"><h3 className="customerCardTitle">价值结果</h3><div className="customerMetricLabel">价值记录 {roiItems} 条</div><div className="muted customerSpacingTopXs">{valueText}</div></article>;
}
