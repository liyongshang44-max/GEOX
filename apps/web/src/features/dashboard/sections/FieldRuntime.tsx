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
      <EmptyGuide title="下一步：先创建田块" message="完成田块创建后，再进行设备绑定与策略配置。" actionLabel="新建田块" actionTo="/fields/new" />
    );
  }

  if (deviceCount < 1) {
    return (
      <EmptyGuide title="下一步：绑定首台设备" message="设备接入后才能开启实时监测与告警。" actionLabel="去绑定设备" actionTo="/devices/onboarding" />
    );
  }

  if (!hasFirstData) {
    return (
      <EmptyGuide title="下一步：检查首条回传" message="已完成接入，请确认设备已开始上报数据。" actionLabel="查看设备状态" actionTo="/devices" />
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
        <Link className="operationsSummaryMetric" to="/fields?from=field_runtime">
          <span className="operationsSummaryLabel">地块状态</span>
          <strong>正常 {normalFieldCount} · 风险 {riskFieldCount}</strong>
        </Link>
        <Link className="operationsSummaryMetric" to="/fields?from=field_runtime">
          <span className="operationsSummaryLabel">总地块</span>
          <strong>{fieldCount} 个</strong>
        </Link>
        <Link className="operationsSummaryMetric" to="/devices?from=field_runtime">
          <span className="operationsSummaryLabel">设备在线/离线</span>
          <strong>{deviceSummary.online} / {deviceSummary.offline}</strong>
        </Link>
        <Link className="operationsSummaryMetric" to="/devices?from=field_runtime">
          <span className="operationsSummaryLabel">设备忙碌/低电</span>
          <strong>{deviceSummary.busy} / {deviceSummary.low_battery}</strong>
        </Link>
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
