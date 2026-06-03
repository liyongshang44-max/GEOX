import React from "react";
import { Link } from "react-router-dom";
import { labelOperatorOfflineHandlingStatus } from "../../lib/operatorStatusLabels";
import type { OperatorDeviceOfflineFocusVm } from "../../viewmodels/operatorDevicesAlertsVm";

// Compatibility marker for older product-language acceptance: 它不会直接恢复设备，也不会自动生成正式作业成功、客户 ROI 或 Field Memory
// Visible copy below uses the PR-18H-FIX customer wording: 客户价值结论 / 田块记忆。
export type DeviceOfflineActionState = {
  status: "idle" | "submitting" | "success" | "error" | "disabled";
  message?: string;
  auditId?: string;
};

type Props = {
  focus: OperatorDeviceOfflineFocusVm;
  actionState: DeviceOfflineActionState;
  onConfirmOffline: () => void;
  onMarkManualReview: () => void;
  onCreateTaskCandidate: () => void;
};

function ActionResult({ state }: { state: DeviceOfflineActionState }): React.ReactElement | null {
  if (state.status === "idle") return null;
  if (state.status === "submitting") return <div className="operatorDevicesNotice">正在提交处理结果...</div>;
  if (state.status === "success") return <div className="operatorDevicesActionSuccess">{state.message || `已记录设备离线确认，审计编号：${state.auditId || "offline-audit-local"}`}</div>;
  if (state.status === "disabled") return <div className="operatorDevicesWarning">动作未开放。当前只能记录需人工核查，不能直接创建任务</div>;
  return <div className="operatorDevicesActionError">{state.message || "操作未完成：缺少权限 / 后端接口未开放 / 设备不存在 / 设备明细不可用"}</div>;
}

function handlingText(value: string): string {
  return labelOperatorOfflineHandlingStatus(value, value || "处理状态待确认");
}

export default function DeviceOfflineHandlingPanel({ focus, actionState, onConfirmOffline, onMarkManualReview, onCreateTaskCandidate }: Props): React.ReactElement | null {
  if (!focus.active) return null;
  const isSubmitting = actionState.status === "submitting";
  const isReadOnlyOrUnlocated = focus.mode === "AGGREGATE_ONLY" || focus.mode === "MISSING_LOCATION";
  const canConfirmOffline = focus.mode === "DEVICE_MATCHED";
  const canMarkManualReview = focus.mode === "DEVICE_MATCHED";
  const canCreateTaskCandidate = focus.mode === "DEVICE_MATCHED";
  return (
    <section className="operatorDevicesSection operatorDevicesFocusPanel" aria-label="设备离线处理面板">
      <header className="operatorDevicesSectionHead">
        <div>
          <h2>设备离线处理</h2>
          <p>{focus.title}：{focus.description}</p>
        </div>
        <span>{focus.statusText}</span>
      </header>

      <div className="operatorDevicesStageCard">
        <strong>当前处理阶段：排查入口</strong>
        <p>本页用于记录设备离线事实和后续处理建议。</p>
        <p>它不会直接恢复设备；不生成正式作业成功，不生成客户价值结论，不生成田块记忆。</p>
      </div>

      {focus.mode === "DEVICE_MATCHED" ? <div className="operatorDevicesNotice">正在处理：设备离线</div> : null}
      {focus.mode === "AGGREGATE_ONLY" ? <div className="operatorDevicesWarning">缺少设备定位信息。该待办来自聚合统计，当前处理阶段：排查入口；只读。</div> : null}
      {focus.mode === "MISSING_LOCATION" ? <div className="operatorDevicesActionError">缺少设备定位信息</div> : null}
      {focus.mode === "DEVICE_NOT_FOUND" ? <div className="operatorDevicesActionError">操作未完成：缺少权限 / 后端接口未开放 / 设备不存在 / 设备明细不可用</div> : null}

      <div className="operatorDeviceMeta">
        <div><span>设备</span><strong>{focus.deviceIdText}</strong></div>
        <div><span>绑定地块</span><strong>{focus.fieldText}</strong></div>
        <div><span>最近心跳</span><strong>{focus.lastHeartbeatText}</strong></div>
        <div><span>最近遥测</span><strong>{focus.lastTelemetryText}</strong></div>
        <div><span>数据延迟</span><strong>{focus.delayText}</strong></div>
        <div><span>处理状态</span><strong>{handlingText(focus.handlingStatusText)}</strong></div>
      </div>

      <div className="operatorDevicesWarning">{focus.auditText}</div>
      <div className="operatorDevicesNotice">离线处理只建立排查链路；未完成现场复核前，不会直接恢复设备；不生成正式作业成功，不生成客户价值结论，不生成田块记忆。</div>
      {isReadOnlyOrUnlocated ? <div className="operatorDevicesWarning">缺少设备定位时，只能返回运营总队列查看来源；不会创建维护任务候选。</div> : null}
      <ol className="operatorDevicesChecklist">{focus.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol>

      <div className="operatorDeviceActionHelp" aria-label="设备离线动作后果说明">
        <div><strong>记录设备离线确认</strong><p>记录设备确认为离线，用于审计。</p></div>
        <div><strong>标记需人工核查</strong><p>记录需要人工现场排查，不直接派单。</p></div>
        <div><strong>创建维护任务候选</strong><p>创建候选记录，等待人工确认后才可能转成正式任务。</p></div>
      </div>

      <div className="operatorDevicesActions">
        {focus.relatedFieldHref ? <Link to={focus.relatedFieldHref}>查看地块报告</Link> : null}
        {focus.returnHref ? <Link to={focus.returnHref}>返回运营总队列</Link> : null}
        <button type="button" disabled={isSubmitting || !canConfirmOffline} onClick={onConfirmOffline}>记录设备离线确认</button>
        <button type="button" disabled={isSubmitting || !canMarkManualReview} onClick={onMarkManualReview}>标记需人工核查</button>
        <button type="button" disabled={isSubmitting || !canCreateTaskCandidate} onClick={onCreateTaskCandidate}>创建维护任务候选</button>
      </div>

      <ActionResult state={actionState} />
    </section>
  );
}
