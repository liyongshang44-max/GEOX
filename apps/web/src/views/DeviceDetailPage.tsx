import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchDeviceConsole,
  fetchDeviceDetail,
  fetchDeviceStatus,
  fetchDevices,
  fetchFields,
  fetchFieldDetail,
  fetchTelemetryLatest,
  fetchTelemetryMetrics,
  fetchTelemetrySeries,
  type DeviceConsoleView,
  type DeviceDetail,
  type DeviceListItem,
  type DeviceStatus,
  type TelemetryLatestItem,
  type TelemetryMetricsItem,
  type FieldListItem,
  type FieldDetail,
} from "../lib/api";

function readToken(): string {
  try {
    return localStorage.getItem("geox_ao_act_token") || "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
  } catch {
    return "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
  }
}

function fmtTs(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) && v > 0
    ? new Date(v).toLocaleString("zh-CN", { hour12: false })
    : "-";
}

function prettyValue(vn: number | null, vt: string | null): string {
  return typeof vn === "number" && Number.isFinite(vn) ? String(vn) : (vt || "-");
}

type BoundFieldInfo = {
  field_id: string | null;
  bound_ts_ms: number | null;
};

async function resolveBoundFieldFromFields(token: string, deviceId: string): Promise<BoundFieldInfo> {
  const fields: FieldListItem[] = await fetchFields(token);
  for (const field of fields) {
    try {
      const detail: FieldDetail = await fetchFieldDetail(token, field.field_id);
      const matched = (detail.bound_devices || []).find((item) => item.device_id === deviceId);
      if (matched) {
        return {
          field_id: field.field_id,
          bound_ts_ms: matched.bound_ts_ms ?? null,
        };
      }
    } catch {
      // ignore single-field lookup failure and continue scanning other fields
    }
  }
  return { field_id: null, bound_ts_ms: null };
}

export default function DeviceDetailPage(): React.ReactElement {
  const { deviceId } = useParams();

  const [token, setToken] = React.useState<string>(() => readToken());
  const [detail, setDetail] = React.useState<DeviceDetail | null>(null);
  const [consoleView, setConsoleView] = React.useState<DeviceConsoleView | null>(null);
  const [statusObj, setStatusObj] = React.useState<DeviceStatus | null>(null);
  const [deviceListItem, setDeviceListItem] = React.useState<DeviceListItem | null>(null);
  const [resolvedBoundField, setResolvedBoundField] = React.useState<BoundFieldInfo>({ field_id: null, bound_ts_ms: null });
  const [latest, setLatest] = React.useState<TelemetryLatestItem[]>([]);
  const [metrics, setMetrics] = React.useState<TelemetryMetricsItem[]>([]);
  const [series, setSeries] = React.useState<Record<string, Array<{ ts_ms: number; value_num: number | null; value_text: string | null; fact_id: string }>>>({});
  const [busy, setBusy] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("正在准备设备详情...");

  function persistToken(next: string): void {
    setToken(next);
    try {
      localStorage.setItem("geox_ao_act_token", next);
    } catch {
      // ignore localStorage failure
    }
  }

  async function refresh(): Promise<void> {
    if (!deviceId) return;

    setBusy(true);
    setStatus(`正在读取设备 ${deviceId} ...`);

    try {
      const [
        nextDetail,
        nextConsole,
        nextStatus,
        nextLatest,
        nextMetrics,
        nextSeries,
        nextDevices,
      ] = await Promise.all([
        fetchDeviceDetail(token, deviceId),
        fetchDeviceConsole(token, deviceId),
        fetchDeviceStatus(token, deviceId),
        fetchTelemetryLatest(token, deviceId),
        fetchTelemetryMetrics(token, deviceId),
        fetchTelemetrySeries(token, deviceId),
        fetchDevices(token),
      ]);

      const matchedDevice = nextDevices.find((item) => item.device_id === deviceId) || null;

      let boundFieldInfo: BoundFieldInfo = {
        field_id: matchedDevice?.field_id || nextDetail?.device?.field_id || null,
        bound_ts_ms: matchedDevice?.bound_ts_ms || nextDetail?.device?.bound_ts_ms || null,
      };

      if (!boundFieldInfo.field_id) {
        boundFieldInfo = await resolveBoundFieldFromFields(token, deviceId);
      }

      setDetail(nextDetail);
      setConsoleView(nextConsole);
      setStatusObj(nextStatus);
      setDeviceListItem(matchedDevice);
      setResolvedBoundField(boundFieldInfo);
      setLatest(nextLatest);
      setMetrics(nextMetrics);
      setSeries(nextSeries);
      setStatus(`设备 ${deviceId} 已加载。`);
    } catch (e: any) {
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void refresh();
  }, [deviceId]);

  const boundFieldId =
    resolvedBoundField.field_id ||
    deviceListItem?.field_id ||
    detail?.device?.field_id ||
    null;

  const boundTsMs =
    resolvedBoundField.bound_ts_ms ||
    deviceListItem?.bound_ts_ms ||
    detail?.device?.bound_ts_ms ||
    null;

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Device Detail · Sprint D2</div>
          <h2 className="heroTitle">{detail?.device?.display_name || deviceId || "设备详情"}</h2>
          <p className="heroText">
            本轮把设备详情收口成“接入与执行控制台”：不仅看状态和遥测，还能查看接入 topic、凭据生命周期提示，以及最近命令与设备回执。
          </p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/devices">返回设备列表</Link>
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新详情</button>
        </div>
      </section>

      <div className="summaryGrid">
        <div className="metricCard card">
          <div className="metricLabel">在线状态</div>
          <div className="metricValue">{statusObj?.status || "-"}</div>
          <div className="metricHint">最近心跳：{fmtTs(statusObj?.last_heartbeat_ts_ms)}</div>
        </div>

        <div className="metricCard card">
          <div className="metricLabel">绑定田块</div>
          <div className="metricValue">{boundFieldId || "未绑定"}</div>
          <div className="metricHint">绑定时间：{fmtTs(boundTsMs)}</div>
        </div>

        <div className="metricCard card">
          <div className="metricLabel">最近命令</div>
          <div className="metricValue">{consoleView?.recent_commands?.length ?? 0}</div>
          <div className="metricHint">最近 20 条 device 定向下发</div>
        </div>

        <div className="metricCard card">
          <div className="metricLabel">最近设备回执</div>
          <div className="metricValue">{consoleView?.recent_receipts?.length ?? 0}</div>
          <div className="metricHint">设备 ACK / 执行回执留痕</div>
        </div>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">设备概览</div>
              <div className="sectionDesc">展示设备注册、凭据摘要和状态信息。</div>
            </div>
          </div>

          <label className="field">
            访问令牌
            <input className="input" value={token} onChange={(e) => persistToken(e.target.value)} />
          </label>

          <div className="kv"><span className="k">设备 ID</span><span className="v">{detail?.device?.device_id || deviceId || "-"}</span></div>
          <div className="kv"><span className="k">显示名称</span><span className="v">{detail?.device?.display_name || "-"}</span></div>
          <div className="kv"><span className="k">最新凭据</span><span className="v">{detail?.device?.last_credential_id || "-"}</span></div>
          <div className="kv"><span className="k">凭据状态</span><span className="v">{detail?.device?.last_credential_status || "-"}</span></div>
          <div className="kv"><span className="k">页面状态</span><span className="v">{status}</span></div>
          <div className="kv"><span className="k">绑定田块</span><span className="v">{boundFieldId || "未绑定"}</span></div>
          <div className="kv"><span className="k">绑定时间</span><span className="v">{fmtTs(boundTsMs)}</span></div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">接入信息</div>
              <div className="sectionDesc">给交付和设备侧同学看的最小接入向导。</div>
            </div>
          </div>

          <div className="kv"><span className="k">MQTT Client ID</span><span className="v">{consoleView?.access_info?.mqtt_client_id || "-"}</span></div>
          <div className="kv"><span className="k">遥测 Topic</span><span className="v">{consoleView?.access_info?.telemetry_topic || "-"}</span></div>
          <div className="kv"><span className="k">心跳 Topic</span><span className="v">{consoleView?.access_info?.heartbeat_topic || "-"}</span></div>
          <div className="kv"><span className="k">下发 Topic</span><span className="v">{consoleView?.access_info?.downlink_topic || "-"}</span></div>
          <div className="kv"><span className="k">回执 Topic</span><span className="v">{consoleView?.access_info?.receipt_topic || "-"}</span></div>
          <div className="kv"><span className="k">协议版本</span><span className="v">{consoleView?.access_info?.payload_contract_version || "-"}</span></div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">凭据管理说明</div>
              <div className="sectionDesc">真正的签发 / 撤销动作仍走现有 admin API。</div>
            </div>
          </div>

          <div className="emptyState" style={{ marginBottom: 12 }}>
            {consoleView?.access_info?.secret_warning || "设备密钥仅在签发时显示一次。"}
          </div>

          <div className="list modernList">
            {(consoleView?.credentials || []).map((item) => (
              <div key={item.credential_id} className="infoCard">
                <div className="jobTitleRow">
                  <div className="title">{item.credential_id}</div>
                  <div className={`pill tone-${item.status === "ACTIVE" ? "ok" : "warn"}`}>{item.status}</div>
                </div>
                <div className="meta">
                  <span>签发：{fmtTs(item.issued_ts_ms)}</span>
                  <span>撤销：{fmtTs(item.revoked_ts_ms)}</span>
                </div>
              </div>
            ))}
            {!(consoleView?.credentials || []).length ? <div className="emptyState">当前还没有凭据记录。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">最近命令与设备回执</div>
              <div className="sectionDesc">把设备侧真正关心的最后一公里放到同一屏。</div>
            </div>
          </div>

          <div className="list modernList" style={{ marginBottom: 12 }}>
            {(consoleView?.recent_commands || []).map((item) => (
              <div key={`${item.act_task_id}_${item.outbox_fact_id}`} className="infoCard">
                <div className="jobTitleRow">
                  <div>
                    <div className="title">{item.action_type || "命令"}</div>
                    <div className="metaText">{item.act_task_id}</div>
                  </div>
                  <div className="pill tone-info">{item.state}</div>
                </div>
                <div className="meta wrapMeta">
                  <span>设备：{item.device_id}</span>
                  <span>Topic：{item.downlink_topic || "-"}</span>
                  <span>QoS：{item.qos}</span>
                  <span>尝试：{item.attempt_count}</span>
                  <span>创建：{fmtTs(item.created_ts_ms)}</span>
                </div>
              </div>
            ))}
            {!(consoleView?.recent_commands || []).length ? <div className="emptyState">当前还没有针对本设备的下发命令。</div> : null}
          </div>

          <div className="list modernList">
            {(consoleView?.recent_receipts || []).map((item) => (
              <div key={item.fact_id} className="infoCard">
                <div className="jobTitleRow">
                  <div>
                    <div className="title">{item.act_task_id}</div>
                    <div className="metaText">{item.fact_id}</div>
                  </div>
                  <div className="pill tone-ok">{item.status || "-"}</div>
                </div>
                <div className="meta wrapMeta">
                  <span>Uplink：{item.uplink_topic || "-"}</span>
                  <span>Runtime：{item.adapter_runtime || "-"}</span>
                  <span>时间：{fmtTs(item.created_ts_ms)}</span>
                </div>
              </div>
            ))}
            {!(consoleView?.recent_receipts || []).length ? <div className="emptyState">当前还没有本设备的 ACK / 执行回执。</div> : null}
          </div>
        </section>
      </div>

      <div className="contentGridTwo alignStart">
        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">最新遥测</div>
              <div className="sectionDesc">按 metric 展示最近值。</div>
            </div>
          </div>

          <div className="list modernList">
            {latest.map((item) => (
              <div key={`${item.metric}_${item.fact_id}`} className="infoCard">
                <div className="jobTitleRow">
                  <div className="title">{item.metric}</div>
                  <div className="pill tone-info">{prettyValue(item.value_num, item.value_text)}</div>
                </div>
                <div className="meta wrapMeta">
                  <span>时间：{fmtTs(item.ts_ms)}</span>
                  <span>fact：{item.fact_id}</span>
                </div>
              </div>
            ))}
            {!latest.length ? <div className="emptyState">当前没有最新遥测数据。</div> : null}
          </div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">指标摘要</div>
              <div className="sectionDesc">展示 count / min / max / avg / latest。</div>
            </div>
          </div>

          <div className="list modernList">
            {metrics.map((item) => (
              <div key={item.metric} className="infoCard">
                <div className="jobTitleRow">
                  <div className="title">{item.metric}</div>
                  <div className="pill tone-ok">{item.count} 点</div>
                </div>
                <div className="meta wrapMeta">
                  <span>最新：{prettyValue(item.latest_value_num, item.latest_value_text)}</span>
                  <span>最小：{item.min_value_num ?? "-"}</span>
                  <span>最大：{item.max_value_num ?? "-"}</span>
                  <span>均值：{item.avg_value_num ?? "-"}</span>
                </div>
              </div>
            ))}
            {!metrics.length ? <div className="emptyState">当前还没有可聚合的指标摘要。</div> : null}
          </div>
        </section>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">最小趋势</div>
            <div className="sectionDesc">本轮先用文本序列展示每个 metric 的最近点。</div>
          </div>
        </div>

        <div className="list modernList">
          {Object.entries(series).map(([metric, points]) => (
            <div key={metric} className="infoCard">
              <div className="jobTitleRow">
                <div className="title">{metric}</div>
                <div className="pill tone-info">{points.length} 点</div>
              </div>
              <div className="seriesPreview">
                {points
                  .slice(-8)
                  .map((point) => `${fmtTs(point.ts_ms)} = ${prettyValue(point.value_num, point.value_text)}`)
                  .join("\n")}
              </div>
            </div>
          ))}
          {!Object.keys(series).length ? <div className="emptyState">当前还没有可展示的趋势点。</div> : null}
        </div>
      </section>
    </div>
  );
}
