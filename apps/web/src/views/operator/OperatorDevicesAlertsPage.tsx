import React from "react";
import { Link } from "react-router-dom";
import { fetchOperatorDevicesAlerts } from "../../api/operatorDevicesAlerts";
import OperatorEmptyState from "../../components/operator/OperatorEmptyState";
import OperatorLayout from "../../layouts/OperatorLayout";
import "../../styles/operatorDevicesAlerts.css";
import { buildOperatorDevicesAlertsVm, type OperatorAlertRowVm, type OperatorDeviceRowVm, type OperatorDevicesAlertsVm } from "../../viewmodels/operatorDevicesAlertsVm";

type DeviceSectionProps = {
  title: string;
  description: string;
  rows: OperatorDeviceRowVm[];
  revokeVisible: boolean;
};

type AlertSectionProps = {
  title: string;
  description: string;
  rows: OperatorAlertRowVm[];
  ackCloseReady: boolean;
};

function DeviceCard({ row, revokeVisible }: { row: OperatorDeviceRowVm; revokeVisible: boolean }): React.ReactElement {
  return (
    <article className="operatorDeviceCard">
      <header className="operatorDeviceHead">
        <div>
          <h3>{row.title}</h3>
          <p>{row.deviceId}</p>
        </div>
        <span className={`operatorDeviceStatus ${row.statusTone}`}>{row.statusText}</span>
      </header>

      <div className="operatorDeviceMeta">
        <div><span>最近心跳</span><strong>{row.lastHeartbeatText}</strong></div>
        <div><span>最近 telemetry</span><strong>{row.lastTelemetryText}</strong></div>
        <div><span>绑定地块</span><strong>{row.boundFieldText}</strong></div>
        <div><span>设备能力</span><strong>{row.capabilitiesText}</strong></div>
        <div><span>凭证状态</span><strong>{row.credentialText}</strong></div>
        <div><span>revoke 状态</span><strong>{revokeVisible ? row.revokeText : "revoke 只读或管理员可见"}</strong></div>
        <div><span>电量</span><strong>{row.batteryText}</strong></div>
        <div><span>数据延迟</span><strong>{row.delayText}</strong></div>
        <div><span>数据来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorDevicesNotice">secret / token / access key 不展示。离线设备可追溯最近心跳与绑定地块。</div>
      <div className="operatorDevicesActions"><button type="button" disabled>revoke 只读</button></div>
    </article>
  );
}

function DeviceSection({ title, description, rows, revokeVisible }: DeviceSectionProps): React.ReactElement {
  return (
    <section className="operatorDevicesSection">
      <header className="operatorDevicesSectionHead">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{rows.length}</span>
      </header>
      {rows.length ? (
        <div className="operatorDevicesList">
          {rows.map((row) => <DeviceCard key={`${title}-${row.deviceId}`} row={row} revokeVisible={revokeVisible} />)}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类设备。</div>}
    </section>
  );
}

function AlertCard({ row, ackCloseReady }: { row: OperatorAlertRowVm; ackCloseReady: boolean }): React.ReactElement {
  return (
    <article className="operatorAlertCard">
      <header className="operatorAlertHead">
        <div>
          <h3>{row.ruleText}</h3>
          <p>{row.eventText}</p>
        </div>
        <span className={`operatorAlertStatus ${row.statusTone}`}>{row.statusText}</span>
      </header>

      <div className="operatorAlertMeta">
        <div><span>通知状态</span><strong>{row.notificationText}</strong></div>
        <div><span>ACK</span><strong>{row.ackText}</strong></div>
        <div><span>关闭</span><strong>{row.closeText}</strong></div>
        <div><span>责任人</span><strong>{row.ownerText}</strong></div>
        <div><span>关联对象</span><strong>{row.objectText}</strong></div>
        <div><span>处方状态</span><strong>{row.prescriptionText}</strong></div>
        <div><span>超时</span><strong>{row.overdueText}</strong></div>
        <div><span>创建时间</span><strong>{row.createdAtText}</strong></div>
        <div><span>更新时间</span><strong>{row.updatedAtText}</strong></div>
        <div><span>数据来源</span><strong>{row.sourceText}</strong></div>
      </div>

      <div className="operatorDevicesNotice">ACK / close 写操作未 ready 前保持只读，不伪造处理结果。</div>
      <div className="operatorDevicesActions">
        {row.operationHref ? <Link to={row.operationHref}>查看关联作业</Link> : null}
        <button type="button" disabled={!ackCloseReady}>ACK</button>
        <button type="button" disabled={!ackCloseReady}>关闭</button>
      </div>
    </article>
  );
}

function AlertSection({ title, description, rows, ackCloseReady }: AlertSectionProps): React.ReactElement {
  return (
    <section className="operatorDevicesSection">
      <header className="operatorDevicesSectionHead">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{rows.length}</span>
      </header>
      {rows.length ? (
        <div className="operatorDevicesList">
          {rows.map((row) => <AlertCard key={`${title}-${row.alertId}`} row={row} ackCloseReady={ackCloseReady} />)}
        </div>
      ) : <div className="operatorQueueEmpty">暂无该类告警。</div>}
    </section>
  );
}

export default function OperatorDevicesAlertsPage(): React.ReactElement {
  const [loading, setLoading] = React.useState(true);
  const [vm, setVm] = React.useState<OperatorDevicesAlertsVm | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchOperatorDevicesAlerts()
      .then((response) => {
        if (!alive) return;
        setVm(buildOperatorDevicesAlertsVm(response));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <OperatorLayout title="设备与告警中心" lead="查看设备在线状态、心跳、telemetry、凭证状态、告警事件、通知、ACK 与关闭状态。">
      {loading ? <div className="operatorEmptyState">设备与告警中心加载中...</div> : null}
      {!loading && vm ? (
        <div className="operatorDevicesAlertsPage">
          <section className="operatorWorkbenchSummary">
            <div><span>数据范围</span><strong>{vm.dataScopeText}</strong></div>
            <div><span>设备总数</span><strong>{vm.totalDevices}</strong></div>
            <div><span>告警总数</span><strong>{vm.totalAlerts}</strong></div>
            <div><span>更新时间</span><strong>{vm.generatedAtText}</strong></div>
          </section>

          {vm.dataScopeWarning ? <div className="operatorScopeWarning">{vm.dataScopeWarning}</div> : null}
          {!vm.ackCloseReady ? <div className="operatorScopeWarning">ACK / close 写操作未 ready，当前只读。</div> : null}

          {vm.totalDevices === 0 && vm.totalAlerts === 0 ? <OperatorEmptyState title={vm.emptyTitle} description={vm.emptyDescription} reason="没有设备或告警数据时不伪造状态、通知或 ACK/close 结果。" /> : null}

          <section className="operatorDevicesGrid" aria-label="设备状态">
            <DeviceSection title="在线设备" description="当前在线或活跃的设备。" rows={vm.onlineDevices} revokeVisible={vm.revokeVisible} />
            <DeviceSection title="离线设备" description="离线设备需要追溯最近心跳和绑定地块。" rows={vm.offlineDevices} revokeVisible={vm.revokeVisible} />
            <DeviceSection title="数据延迟" description="telemetry 或心跳存在延迟的设备。" rows={vm.delayedDevices} revokeVisible={vm.revokeVisible} />
            <DeviceSection title="低电量" description="电量不足，需要运维关注。" rows={vm.lowBatteryDevices} revokeVisible={vm.revokeVisible} />
          </section>

          <section className="operatorDevicesGrid" aria-label="告警事件">
            <AlertSection title="告警事件" description="当前可见的告警规则、事件和通知状态。" rows={vm.alerts} ackCloseReady={vm.ackCloseReady} />
            <AlertSection title="超时告警" description="超过处理窗口或已标记超时的告警。" rows={vm.overdueAlerts} ackCloseReady={vm.ackCloseReady} />
          </section>
        </div>
      ) : null}
    </OperatorLayout>
  );
}
