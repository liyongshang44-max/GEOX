import React from "react";
import { Link } from "react-router-dom";
import { EmptyGuide, SectionCard } from "../../../shared/ui";

function EmptyStateGuide({
  fieldCount,
  deviceCount,
  hasFirstData,
}: {
  fieldCount: number;
  deviceCount: number;
  hasFirstData: boolean;
}): React.ReactElement | null {
  if (fieldCount < 1) {
    return (
      <EmptyGuide title="空态引导：无田块" message="先建田块，再接入设备。" actionLabel="新建田块" actionTo="/fields/new" />
    );
  }

  if (deviceCount < 1) {
    return (
      <EmptyGuide title="空态引导：无设备" message="绑定设备，开启监测。" actionLabel="去绑定设备" actionTo="/devices/onboarding" />
    );
  }

  if (!hasFirstData) {
    return (
      <EmptyGuide title="空态引导：无首条数据" message="设备已接入，等待首条回传。" actionLabel="查看设备状态" actionTo="/devices" />
    );
  }

  return null;
}

export default function FieldRuntime({
  fieldCount,
  normalFieldCount,
  riskFieldCount,
  deviceSummary,
  deviceCount,
  hasFirstData,
}: {
  fieldCount: number;
  normalFieldCount: number;
  riskFieldCount: number;
  deviceSummary: { online: number; offline: number; busy: number; low_battery: number };
  deviceCount: number;
  hasFirstData: boolean;
}): React.ReactElement {
  return (
    <SectionCard title="FieldRuntime" subtitle="田块与设备运行态。">
      <div className="operationsSummaryGrid" style={{ marginTop: 10 }}>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">地块状态</span>
          <strong>正常 {normalFieldCount} · 风险 {riskFieldCount}</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">总地块</span>
          <strong>{fieldCount} 个</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">设备在线/离线</span>
          <strong>{deviceSummary.online} / {deviceSummary.offline}</strong>
        </article>
        <article className="operationsSummaryMetric">
          <span className="operationsSummaryLabel">设备忙碌/低电</span>
          <strong>{deviceSummary.busy} / {deviceSummary.low_battery}</strong>
        </article>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Link className="btn primary" to="/fields">查看田块详情</Link>
        <Link className="btn" to="/devices">查看设备详情</Link>
      </div>
      <div style={{ marginTop: 10 }}>
        <EmptyStateGuide fieldCount={fieldCount} deviceCount={deviceCount} hasFirstData={hasFirstData} />
      </div>
    </SectionCard>
  );
}
