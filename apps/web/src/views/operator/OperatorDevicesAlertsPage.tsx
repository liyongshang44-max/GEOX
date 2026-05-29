import React from "react";
import { Link } from "react-router-dom";
import { ackOperatorAlert, closeOperatorAlert, fetchOperatorDevicesAlerts } from "../../api/operatorDevicesAlerts";
import { fetchSessionMe, type SessionMe } from "../../api/session";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import { isPermissionDeniedError, OperatorPageStateView, sanitizeOperatorError, withOperatorLoadTimeout, type OperatorPageRuntimeState } from "../../components/operator/OperatorPageState";
import PermissionGate from "../../components/operator/PermissionGate";
import OperatorLayout from "../../layouts/OperatorLayout";
import { replaceOperatorTerms } from "../../lib/operatorStatusLabels";
import { hasOperatorPermission } from "../../lib/permissions";
import "../../styles/operatorDevicesAlerts.css";
import { buildOperatorDevicesAlertsVm, type OperatorAlertRowVm, type OperatorDeviceRowVm, type OperatorDevicesAlertsVm } from "../../viewmodels/operatorDevicesAlertsVm";
import { OPERATOR_PAGE_META } from "./operatorPageMeta";

const PAGE_NAME = "设备与告警中心";

type DeviceSectionProps = { title: string; description: string; rows: OperatorDeviceRowVm[]; revokeVisible: boolean };
type AlertActionState = { busyKey?: string; message?: string; tone?: "success" | "error" };
type AlertPermissionState = { sessionLoading: boolean; canAck: boolean; canClose: boolean; ackReason: string; closeReason: string };
type AlertSectionProps = { title: string; description: string; rows: OperatorAlertRowVm[]; ackCloseReady: boolean; actionState: AlertActionState; permissionState: AlertPermissionState; onAck: (alertId: string) => void; onClose: (alertId: string) => void };

function DeviceCard({ row, revokeVisible }: { row: OperatorDeviceRowVm; revokeVisible: boolean }): React.ReactElement {
  const showRevokeButton = revokeVisible && row.canRevoke;
  return <article className="operatorDeviceCard"><header className="operatorDeviceHead"><div><h3>{row.title}</h3><p>{row.deviceId}</p></div><span className={`operatorDeviceStatus ${row.statusTone}`}>{row.statusText}</span></header><div className="operatorDeviceMeta"><div><span>最近心跳</span><strong>{row.lastHeartbeatText}</strong></div><div><span>最近遥测</span><strong>{row.lastTelemetryText}</strong></div><div><span>绑定地块</span><strong>{row.boundFieldText}</strong></div><div><span>设备能力</span><strong>{row.capabilitiesText}</strong></div><div><span>凭证状态</span><strong>{row.credentialText}</strong></div><div><span>最近签发时间</span><strong>{row.credentialIssuedText}</strong></div><div><span>最近使用时间</span><strong>{row.credentialLastUsedText}</strong></div><div><span>撤销状态</span><strong>{row.revokeText}</strong></div><div><span>电量</span><strong>{row.batteryText}</strong></div><div><span>数据延迟</span><strong>{row.delayText}</strong></div><div><span>数据来源</span><strong>{row.sourceText}</strong></div></div><div className="operatorDevicesNotice">设备凭证仅展示状态与时间，不展示敏感凭据 payload。撤销仅在管理员权限 ready 时显示。</div><div className="operatorDevicesActions">{showRevokeButton ? <button type="button" disabled>撤销管理员操作待接入</button> : <span className="operatorDevicesReadOnlyAction">撤销默认只读或管理员可见</span>}</div></article>;
}

function DeviceSection({ title, description, rows, revokeVisible }: DeviceSectionProps): React.ReactElement {
  return <section className="operatorDevicesSection"><header className="operatorDevicesSectionHead"><div><h2>{title}</h2><p>{description}</p></div><span>{rows.length}</span></header>{rows.length ? <div className="operatorDevicesList">{rows.map((row) => <DeviceCard key={`${title}-${row.deviceId}`} row={row} revokeVisible={revokeVisible} />)}</div> : <div className="operatorQueueEmpty">暂无该类设备明细。上方 scope 数字仍以统一统计口径为准。</div>}</section>;
}

function AlertCard({ row, ackCloseReady, actionState, permissionState, onAck, onClose }: { row: OperatorAlertRowVm; ackCloseReady: boolean; actionState: AlertActionState; permissionState: AlertPermissionState; onAck: (alertId: string) => void; onClose: (alertId: string) => void }): React.ReactElement {
  const ackBusy = actionState.busyKey === `${row.alertId}:ack`;
  const closeBusy = actionState.busyKey === `${row.alertId}:close`;
  const ackDisabled = !ackCloseReady || !row.canAck || Boolean(actionState.busyKey);
  const closeDisabled = !ackCloseReady || !row.canClose || Boolean(actionState.busyKey);
  const actionNotice = row.disabledReason || (!permissionState.canAck ? permissionState.ackReason : "") || (!permissionState.canClose ? permissionState.closeReason : "");
  return <article className="operatorAlertCard"><header className="operatorAlertHead"><div><h3>{row.ruleText}</h3><p>{row.eventText}</p></div><span className={`operatorAlertStatus ${row.statusTone}`}>{row.statusText}</span></header><div className="operatorAlertMeta"><div><span>通知状态</span><strong>{row.notificationText}</strong></div><div><span>确认状态</span><strong>{row.ackText}</strong></div><div><span>关闭</span><strong>{row.closeText}</strong></div><div><span>责任人</span><strong>{row.ownerText}</strong></div><div><span>关联对象</span><strong>{row.objectText}</strong></div><div><span>处方状态</span><strong>{row.prescriptionText}</strong></div><div><span>超时</span><strong>{row.overdueText}</strong></div><div><span>创建时间</span><strong>{row.createdAtText}</strong></div><div><span>更新时间</span><strong>{row.updatedAtText}</strong></div><div><span>状态来源</span><strong>{row.statusSourceText}</strong></div><div><span>审计来源</span><strong>{row.auditText}</strong></div><div><span>数据来源</span><strong>{row.sourceText}</strong></div></div>{actionNotice ? <div className="operatorDevicesWarning">{replaceOperatorTerms(actionNotice)}</div> : null}<div className="operatorDevicesNotice">确认 / 关闭操作只在后端权限与审计 ready 后开放；操作成功后刷新列表。</div><div className="operatorDevicesActions">{row.operationHref ? <Link to={row.operationHref}>查看关联作业</Link> : null}<PermissionGate permissionKey="ack" allowed={permissionState.canAck} loading={permissionState.sessionLoading} disabledReason={permissionState.ackReason} fallback={() => <button type="button" disabled>{ackBusy ? "确认中..." : "确认"}</button>}>{() => <button type="button" disabled={ackDisabled} onClick={() => onAck(row.alertId)}>{ackBusy ? "确认中..." : "确认"}</button>}</PermissionGate><PermissionGate permissionKey="close_alert" allowed={permissionState.canClose} loading={permissionState.sessionLoading} disabledReason={permissionState.closeReason} fallback={() => <button type="button" disabled>{closeBusy ? "关闭中..." : "关闭"}</button>}>{() => <button type="button" disabled={closeDisabled} onClick={() => onClose(row.alertId)}>{closeBusy ? "关闭中..." : "关闭"}</button>}</PermissionGate></div></article>;
}

function AlertSection({ title, description, rows, ackCloseReady, actionState, permissionState, onAck, onClose }: AlertSectionProps): React.ReactElement {
  return <section className="operatorDevicesSection"><header className="operatorDevicesSectionHead"><div><h2>{title}</h2><p>{description}</p></div><span>{rows.length}</span></header>{rows.length ? <div className="operatorDevicesList">{rows.map((row) => <AlertCard key={`${title}-${row.alertId}`} row={row} ackCloseReady={ackCloseReady} actionState={actionState} permissionState={permissionState} onAck={onAck} onClose={onClose} />)}</div> : <div className="operatorQueueEmpty">暂无该类告警明细。上方告警事件 scope 仍以统一统计口径为准。</div>}</section>;
}

function permissionReason(sessionLoading: boolean, session: SessionMe | null, permissionName: "operator_alert_ack_close" | "admin_device_revoke"): string {
  if (sessionLoading) return "会话权限加载中...";
  if (!session) return "会话不可用";
  return `缺少会话权限：${permissionName}`;
}

export default function OperatorDevicesAlertsPage(): React.ReactElement {
  const meta = OPERATOR_PAGE_META.devicesAlerts;
  const [pageState, setPageState] = React.useState<OperatorPageRuntimeState>("loading");
  const [errorReason, setErrorReason] = React.useState("");
  const [vm, setVm] = React.useState<OperatorDevicesAlertsVm | null>(null);
  const [actionState, setActionState] = React.useState<AlertActionState>({});
  const [session, setSession] = React.useState<SessionMe | null>(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);

  const applyResponse = React.useCallback((response: Awaited<ReturnType<typeof fetchOperatorDevicesAlerts>>) => { const nextVm = buildOperatorDevicesAlertsVm(response); setVm(nextVm); setPageState(nextVm.totalDevices === 0 && nextVm.totalAlerts === 0 ? "empty" : "data-ready"); }, []);
  const reload = React.useCallback(() => { setPageState("loading"); setErrorReason(""); return withOperatorLoadTimeout(fetchOperatorDevicesAlerts(), PAGE_NAME).then(applyResponse).catch((error: unknown) => { setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); }); }, [applyResponse]);

  React.useEffect(() => { let alive = true; setSessionLoading(true); void fetchSessionMe().then((resp) => { if (alive) setSession(resp); }).catch(() => { if (alive) setSession(null); }).finally(() => { if (alive) setSessionLoading(false); }); return () => { alive = false; }; }, []);
  React.useEffect(() => { let alive = true; setPageState("loading"); setErrorReason(""); setVm(null); void withOperatorLoadTimeout(fetchOperatorDevicesAlerts(), PAGE_NAME).then((response) => { if (!alive) return; applyResponse(response); }).catch((error: unknown) => { if (!alive) return; setVm(null); setErrorReason(sanitizeOperatorError(error)); setPageState(isPermissionDeniedError(error) ? "permission-denied" : "error"); }); return () => { alive = false; }; }, [applyResponse]);

  const canAck = hasOperatorPermission(session, "ack");
  const canCloseAlert = hasOperatorPermission(session, "close_alert");
  const revokeVisibleForSession = hasOperatorPermission(session, "revoke_device_credential");
  const alertPermissionState: AlertPermissionState = { sessionLoading, canAck, canClose: canCloseAlert, ackReason: canAck ? "" : permissionReason(sessionLoading, session, "operator_alert_ack_close"), closeReason: canCloseAlert ? "" : permissionReason(sessionLoading, session, "operator_alert_ack_close") };

  async function runAlertAction(alertId: string, action: "ack" | "close") {
    if (action === "ack" && !canAck) { setActionState({ message: permissionReason(sessionLoading, session, "operator_alert_ack_close"), tone: "error" }); return; }
    if (action === "close" && !canCloseAlert) { setActionState({ message: permissionReason(sessionLoading, session, "operator_alert_ack_close"), tone: "error" }); return; }
    setActionState({ busyKey: `${alertId}:${action}` });
    try {
      const result = action === "ack" ? await ackOperatorAlert(alertId) : await closeOperatorAlert(alertId);
      if (!result.ok) { setActionState({ message: sanitizeOperatorError(result.message), tone: "error" }); return; }
      await reload();
      setActionState({ message: result.auditText ? `${replaceOperatorTerms(result.message)} 审计来源：${replaceOperatorTerms(result.auditText)}` : replaceOperatorTerms(result.message), tone: "success" });
    } catch (error) {
      setActionState({ message: sanitizeOperatorError(error), tone: "error" });
    }
  }

  return (
    <OperatorLayout title={meta.title} lead={meta.lead}>
      {pageState === "loading" ? <OperatorPageStateView state="loading" /> : null}
      {pageState === "error" ? <OperatorPageStateView state="error" reason={errorReason} /> : null}
      {pageState === "permission-denied" ? <OperatorPageStateView state="permission-denied" reason={errorReason} /> : null}
      {vm ? <div className="operatorDevicesAlertsPage"><section className="operatorWorkbenchSummary"><div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div><div><span>全域设备</span><strong>{vm.deviceScope.globalDevicesText.replace(/^全域设备：/, "")}</strong></div><div><span>可见授权设备</span><strong>{vm.deviceScope.visibleDevicesText.replace(/^可见授权设备：/, "")}</strong></div><div><span>当前地块设备</span><strong>{vm.deviceScope.fieldDevicesText.replace(/^当前地块设备：/, "")}</strong></div><div><span>离线设备</span><strong>{vm.deviceScope.offlineDevicesText.replace(/^离线设备：/, "")}</strong></div><div><span>告警事件</span><strong>{vm.deviceScope.alertEventsText.replace(/^告警事件：/, "")}</strong></div><div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div></section><div className="operatorScopeWarning">{vm.deviceScope.explanationText}</div><div className="operatorScopeWarning">{vm.deviceScope.sourceText}</div>{vm.totalDevices === 0 && vm.deviceScope.offlineDevicesText !== "离线设备：0 台" ? <div className="operatorScopeWarning">设备明细列表为 0 时，离线设备数字来自统一 scope 统计，不代表设备中心已返回所有设备明细。</div> : null}{vm.dataScopeWarning ? <div className="operatorScopeWarning">{replaceOperatorTerms(vm.dataScopeWarning)}</div> : null}{!vm.ackCloseReady ? <div className="operatorScopeWarning">确认 / 关闭未开放或当前无可操作权限。</div> : null}{actionState.message ? <div className={actionState.tone === "error" ? "operatorDevicesActionError" : "operatorDevicesActionSuccess"}>{actionState.message}</div> : null}{vm.totalDevices === 0 && vm.totalAlerts === 0 ? <OperatorEmptyState title={vm.emptyTitle || "暂无待处理事项"} description={vm.emptyDescription || "当前没有设备或告警明细。"} reason="没有设备或告警数据时不伪造状态、通知或确认/关闭结果；若上方 scope 仍有数字，则以统计口径说明为准。" /> : null}<section className="operatorDevicesGrid" aria-label="设备状态"><DeviceSection title="在线设备" description="当前在线或活跃的设备；列表为设备明细，不等同于全域设备总数。" rows={vm.onlineDevices} revokeVisible={vm.revokeVisible && revokeVisibleForSession} /><DeviceSection title="离线设备" description="离线设备需要追溯最近心跳、绑定地块和数据采集状态；列表为明细，统计见上方离线设备 scope。" rows={vm.offlineDevices} revokeVisible={vm.revokeVisible && revokeVisibleForSession} /><DeviceSection title="数据延迟" description="遥测或心跳存在延迟的设备。" rows={vm.delayedDevices} revokeVisible={vm.revokeVisible && revokeVisibleForSession} /><DeviceSection title="低电量" description="电量不足，需要运维关注。" rows={vm.lowBatteryDevices} revokeVisible={vm.revokeVisible && revokeVisibleForSession} /></section><section className="operatorDevicesGrid" aria-label="告警事件"><AlertSection title="告警事件" description="当前可见的告警规则、事件和通知状态；统计见上方告警事件 scope。" rows={vm.alerts} ackCloseReady={vm.ackCloseReady} actionState={actionState} permissionState={alertPermissionState} onAck={(alertId) => void runAlertAction(alertId, "ack")} onClose={(alertId) => void runAlertAction(alertId, "close")} /><AlertSection title="超时告警" description="超过处理窗口或已标记超时的告警。" rows={vm.overdueAlerts} ackCloseReady={vm.ackCloseReady} actionState={actionState} permissionState={alertPermissionState} onAck={(alertId) => void runAlertAction(alertId, "ack")} onClose={(alertId) => void runAlertAction(alertId, "close")} /></section></div> : null}
    </OperatorLayout>
  );
}
