import React from "react";
import type {
  FlightTableCredentialRefV1,
  FlightTableDeviceStepResultV1,
  FlightTableDeviceSummaryV1,
  FlightTableDeviceTemplateV1,
} from "../../../api/flightTable";

export type DeviceOnboardingDraftV1 = {
  template_code: string;
  device_id: string;
  mode: "simulator" | "physical";
  telemetry_mode: "fast" | "realistic";
};

type Props = {
  fieldId?: string | null;
  deviceIds: string[];
  credentials: FlightTableCredentialRefV1[];
  templates: FlightTableDeviceTemplateV1[];
  devices: FlightTableDeviceSummaryV1[];
  draft: DeviceOnboardingDraftV1;
  loading: boolean;
  error: string | null;
  onDraftChange: (patch: Partial<DeviceOnboardingDraftV1>) => void;
  onOnboardDevice: () => void;
  onRetry: () => void;
};

const STEPS: Array<{ key: string; label: string }> = [
  { key: "select_template", label: "选择设备模板" },
  { key: "create_device", label: "创建设备" },
  { key: "credential", label: "签发凭证" },
  { key: "field_binding", label: "绑定田块" },
  { key: "heartbeat", label: "发送 heartbeat" },
  { key: "telemetry", label: "发布 telemetry" },
  { key: "verify_observation_sensing", label: "验证 observation / sensing" },
];

function stepStatus(devices: FlightTableDeviceSummaryV1[], key: string, loading: boolean): { status: "PENDING" | "RUNNING" | "PASS" | "FAIL"; message: string } {
  if (loading && key === "create_device") return { status: "RUNNING", message: "正在执行设备接入链路" };
  if (key === "select_template") return { status: "PASS", message: "模板已选择" };
  const last = devices[0];
  const found: FlightTableDeviceStepResultV1 | undefined = last?.steps.find((step) => step.step_key === key);
  if (!found) return { status: "PENDING", message: "等待执行" };
  return { status: found.status, message: `${found.source}: ${found.message}` };
}

function statusClass(status: string): string {
  return `flight-wizard-step flight-wizard-step-${status.toLowerCase()}`;
}

export default function DeviceOnboardingWizard(props: Props): React.ReactElement {
  const { deviceIds, credentials, templates, devices, draft, loading, error, fieldId } = props;
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const selectedDevice = devices.find((device) => device.device_id === selectedDeviceId) ?? devices[0] ?? null;
  const selectedTemplate = templates.find((template) => template.template_code === draft.template_code) ?? templates[0] ?? null;

  React.useEffect(() => {
    if (!selectedDeviceId && devices[0]) setSelectedDeviceId(devices[0].device_id);
  }, [devices, selectedDeviceId]);

  return (
    <section className="flight-card flight-device-card">
      <div className="flight-card-head">
        <h2>真实设备接入向导</h2>
        <span>{deviceIds.length} 台设备 / {credentials.length} 个凭证</span>
      </div>
      <p className="flight-muted">设备必须按正式链路进入：创建、能力、绑定、凭证、heartbeat、telemetry、observation/sensing 验证。前端不直接修改 device_status_index_v1。</p>

      <div className="flight-device-controls">
        <label>
          <span>设备模板</span>
          <select value={draft.template_code} onChange={(event) => props.onDraftChange({ template_code: event.target.value })}>
            {templates.map((template) => <option key={template.template_code} value={template.template_code}>{template.template_code}</option>)}
          </select>
        </label>
        <label>
          <span>device_id</span>
          <input value={draft.device_id} placeholder="留空自动生成" onChange={(event) => props.onDraftChange({ device_id: event.target.value })} />
        </label>
        <label>
          <span>mode</span>
          <select value={draft.mode} onChange={(event) => props.onDraftChange({ mode: event.target.value as "simulator" | "physical" })}>
            <option value="simulator">simulator</option>
            <option value="physical">physical</option>
          </select>
        </label>
        <label>
          <span>telemetry mode</span>
          <select value={draft.telemetry_mode} onChange={(event) => props.onDraftChange({ telemetry_mode: event.target.value as "fast" | "realistic" })}>
            <option value="fast">fast internal ingest</option>
            <option value="realistic">MQTT-compatible ingest</option>
          </select>
        </label>
      </div>

      {selectedTemplate ? (
        <div className="flight-template-summary">
          <strong>{selectedTemplate.device_type}</strong>
          <span>capabilities: {selectedTemplate.capabilities.join(", ")}</span>
          <span>required skills: {selectedTemplate.required_observation_skills.join(", ")}</span>
          <span>default metrics: {selectedTemplate.default_metrics.map((metric) => metric.metric).join(", ")}</span>
        </div>
      ) : null}

      <div className="flight-actions flight-card-actions">
        <button type="button" onClick={props.onOnboardDevice} disabled={loading || !fieldId}>执行真实设备接入</button>
        <button type="button" onClick={props.onRetry} disabled={loading}>重试</button>
        <span className="flight-muted">API 快照在“验收回放”tab 查看。</span>
      </div>
      {error ? <p className="flight-error-text">{error}</p> : null}

      <div className="flight-wizard">
        {STEPS.map((step) => {
          const state = stepStatus(devices, step.key, loading);
          return (
            <div key={step.key} className={statusClass(state.status)}>
              <span>{state.status}</span>
              <strong>{step.label}</strong>
              <small>{state.message}</small>
            </div>
          );
        })}
      </div>

      <div className="flight-device-list">
        <div className="flight-card-head">
          <h3>设备列表</h3>
          <span>credential secret 永不显示</span>
        </div>
        {devices.length ? (
          <div className="flight-device-table">
            <div className="flight-device-row flight-device-row-head">
              <span>type</span><span>device_id</span><span>mode</span><span>credential</span><span>online</span><span>heartbeat</span><span>telemetry</span><span>binding</span><span>capabilities</span>
            </div>
            {devices.map((device) => (
              <button key={device.device_id} type="button" className="flight-device-row" onClick={() => setSelectedDeviceId(device.device_id)}>
                <span>{device.device_type}</span>
                <span>{device.device_id}</span>
                <span>{device.mode}</span>
                <span>{device.credential_id} / {device.credential_status} / ****</span>
                <span>{device.online_status}</span>
                <span>{device.last_heartbeat ?? "-"}</span>
                <span>{device.last_telemetry ?? "-"}</span>
                <span>{device.field_binding ?? "-"}</span>
                <span>{device.capabilities.join(", ")}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="flight-muted">尚未接入设备。</p>
        )}
      </div>

      {selectedDevice ? (
        <aside className="flight-device-detail">
          <div className="flight-card-head">
            <h3>设备详情</h3>
            <span>{selectedDevice.projection_status}</span>
          </div>
          <dl className="flight-field-state">
            <dt>capabilities</dt><dd>{selectedDevice.capabilities.join(", ")}</dd>
            <dt>required skills</dt><dd>{selectedDevice.required_observation_skills.join(", ")}</dd>
            <dt>last metrics</dt><dd>{selectedDevice.last_telemetry_metrics.map((metric) => `${metric.metric}=${String(metric.value)}${metric.unit ? ` ${metric.unit}` : ""}`).join("; ")}</dd>
            <dt>projection status</dt><dd>{selectedDevice.projection_status}</dd>
            <dt>sources</dt><dd>{selectedDevice.sources.join(", ")}</dd>
          </dl>
        </aside>
      ) : null}
    </section>
  );
}
