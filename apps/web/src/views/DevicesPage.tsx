import React from "react";
import { useSession } from "../auth/useSession";
import { Link, useNavigate } from "react-router-dom";
import { fetchDevices, type DeviceListItem } from "../lib/api";
import { bindDeviceToField } from "../api/devices";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import { formatTimeOrFallback } from "../lib/presentation/time";

export default function DevicesPage(): React.ReactElement {
  const navigate = useNavigate();
  const { token, setToken } = useSession();
  const [items, setItems] = React.useState<DeviceListItem[]>([]);
  const [status, setStatus] = React.useState<string>("正在准备设备中心...");
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [onlineFilter, setOnlineFilter] = React.useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [boundFilter, setBoundFilter] = React.useState<"ALL" | "BOUND" | "UNBOUND">("ALL");
  const [receiptFilter, setReceiptFilter] = React.useState<"ALL" | "HAS" | "NONE">("ALL");
  const [bindForm, setBindForm] = React.useState({ device_id: "", field_id: "" });
  const [bindMsg, setBindMsg] = React.useState("");

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    setStatus("正在读取设备列表...");
    try {
      const nextItems = await fetchDevices(token);
      setItems(nextItems);
      setStatus(`已加载 ${nextItems.length} 台设备。`);
    } catch (e: any) {
      setError("设备列表加载失败，请稍后重试");
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => { void refresh(); }, []);

  const filtered = items.filter((item) => {
    if (onlineFilter !== "ALL") {
      const isOnline = String(item.connection_status).toUpperCase() === "ONLINE";
      if ((onlineFilter === "ONLINE") !== isOnline) return false;
    }
    if (boundFilter !== "ALL") {
      const isBound = Boolean(item.field_id);
      if ((boundFilter === "BOUND") !== isBound) return false;
    }
    if (receiptFilter !== "ALL") {
      const hasReceipt = Boolean(item.last_receipt_status || item.last_receipt_ts_ms);
      if ((receiptFilter === "HAS") !== hasReceipt) return false;
    }
    return true;
  });
  const stateCounts = React.useMemo(() => {
    const counts = {
      未接入: items.length < 1 ? 1 : 0,
      已接入未绑定: 0,
      已绑定待数据: 0,
      在线正常: 0,
      离线: 0,
      数据异常: 0,
    };
    for (const item of items) {
      const online = String(item.connection_status ?? "").toUpperCase() === "ONLINE";
      const bound = Boolean(item.field_id);
      const hasData = Boolean(item.last_telemetry_ts_ms || item.last_receipt_ts_ms);
      if (!bound) counts.已接入未绑定 += 1;
      if (bound && !hasData) counts.已绑定待数据 += 1;
      if (online && hasData) counts.在线正常 += 1;
      if (!online) counts.离线 += 1;
      if (String(item.last_receipt_status ?? "").toUpperCase().includes("FAIL")) counts.数据异常 += 1;
    }
    return counts;
  }, [items]);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">设备运营中心</div>
          <h2 className="heroTitle">设备中心</h2>
          <p className="heroText">设备列表页作为“设备运营入口”：支持按在线、绑定、回执状态筛选并快速进入详情。</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/devices/onboarding">接入向导</Link>
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新设备</button>
        </div>
      </section>

      {error ? <ErrorState title="设备中心加载失败" message={error} onRetry={() => void refresh()} technical={status} /> : null}

      <div className="summaryGrid">
        <div className="metricCard card"><div className="metricLabel">设备总数</div><div className="metricValue">{items.length}</div><div className="metricHint">当前租户已注册设备</div></div>
        <div className="metricCard card"><div className="metricLabel">在线设备</div><div className="metricValue">{items.filter((x) => x.connection_status === "ONLINE").length}</div><div className="metricHint">最近 15 分钟心跳</div></div>
        <div className="metricCard card"><div className="metricLabel">已绑定田块</div><div className="metricValue">{items.filter((x) => !!x.field_id).length}</div><div className="metricHint">具备 field 归属</div></div>
        <div className="metricCard card"><div className="metricLabel">页面状态</div><div className="metricValue">{status.includes("失败") ? "异常" : "正常"}</div><div className="metricHint">{status}</div></div>
      </div>
      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">设备状态卡</div>
            <div className="sectionDesc">覆盖未接入 / 已接入未绑定 / 已绑定待数据 / 在线正常 / 离线 / 数据异常。</div>
          </div>
        </div>
        <div className="operationsSummaryGrid">
          {Object.entries(stateCounts).map(([label, count]) => (
            <div key={label} className="operationsSummaryMetric">
              <span className="operationsSummaryLabel">{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">首次开局：设备绑定田块</div>
            <div className="sectionDesc">完成设备接入后，将设备绑定到目标田块，再进入方案创建。</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn" to="/fields">上一步：田块</Link>
            <Link className="btn" to="/programs/create">下一步：初始化经营</Link>
          </div>
        </div>
        <div className="toolbarFilters">
          <input className="input" placeholder="设备ID" value={bindForm.device_id} onChange={(e) => setBindForm((s) => ({ ...s, device_id: e.target.value }))} />
          <input className="input" placeholder="田块ID" value={bindForm.field_id} onChange={(e) => setBindForm((s) => ({ ...s, field_id: e.target.value }))} />
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                if (!bindForm.device_id.trim() || !bindForm.field_id.trim()) {
                  setBindMsg("请填写设备ID和田块ID");
                  return;
                }
                setBindMsg("正在绑定...");
                try {
                  const selected = items.find((item) => item.device_id === bindForm.device_id.trim());
                  const isOffline = String(selected?.connection_status ?? "").toUpperCase() !== "ONLINE";
                  const res = await bindDeviceToField({
                    device_id: bindForm.device_id.trim(),
                    field_id: bindForm.field_id.trim(),
                  });
                  if (res?.ok) {
                    const offlineHint = isOffline ? "；当前设备离线，建议先校验在线状态" : "";
                    setBindMsg(`绑定成功：${res.device_id} -> ${res.field_id}${offlineHint}`);
                    await refresh();
                    navigate(`/fields/${encodeURIComponent(res.field_id ?? bindForm.field_id.trim())}`);
                  } else {
                    setBindMsg(`绑定失败：${res?.error ?? "UNKNOWN_ERROR"}`);
                  }
                } catch (e: any) {
                  setBindMsg(`绑定失败：${e?.bodyText || e?.message || String(e)}`);
                }
              })();
            }}
          >
            绑定设备
          </button>
        </div>
        {bindMsg ? <div className="metaText" style={{ marginTop: 8 }}>{bindMsg}</div> : null}
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">设备列表</div>
            <div className="sectionDesc">展示设备在线状态、绑定地块、最近心跳、凭据状态、最近命令与回执摘要。</div>
          </div>
        </div>

        <label className="field">访问令牌<input className="input" value={token} onChange={(e) => setToken(e.target.value)} /></label>

        <div className="toolbarFilters" style={{ marginBottom: 8 }}>
          <select className="select" value={onlineFilter} onChange={(e) => setOnlineFilter(e.target.value as any)}>
            <option value="ALL">在线状态（全部）</option>
            <option value="ONLINE">在线</option>
            <option value="OFFLINE">离线</option>
          </select>
          <select className="select" value={boundFilter} onChange={(e) => setBoundFilter(e.target.value as any)}>
            <option value="ALL">绑定状态（全部）</option>
            <option value="BOUND">已绑定</option>
            <option value="UNBOUND">未绑定</option>
          </select>
          <select className="select" value={receiptFilter} onChange={(e) => setReceiptFilter(e.target.value as any)}>
            <option value="ALL">回执（全部）</option>
            <option value="HAS">最近有回执</option>
            <option value="NONE">最近无回执</option>
          </select>
        </div>

        <div className="list modernList">
          {filtered.map((item) => (
            <Link key={item.device_id} className="infoCard linkCard" to={`/devices/${encodeURIComponent(item.device_id)}`}>
              <div className="jobTitleRow">
                <div>
                  <div className="title">{item.display_name || item.device_id}</div>
                  <div className="metaText">{item.device_id}</div>
                </div>
                <StatusBadge status={item.connection_status || "PENDING"} />
              </div>
              <div className="meta wrapMeta">
                <span>绑定地块：{item.field_id || "未绑定"}</span>
                <span>最近心跳：{formatTimeOrFallback(item.last_heartbeat_ts_ms)}</span>
                <span>首条数据：{item.last_telemetry_ts_ms || item.last_receipt_ts_ms ? "已收到" : "未收到（等待首条数据）"}</span>
                <span>凭据状态：{item.last_credential_status || "未知"}</span>
                <span>最近命令：{item.last_command_type || "-"}</span>
                <span>最近回执：<StatusBadge status={item.last_receipt_status || "PENDING"} /></span>
              </div>
            </Link>
          ))}
          {!filtered.length ? (
            items.length < 1
              ? <EmptyState title="还没有设备" description="先完成设备接入，系统才能持续获取田块状态并生成建议。" actionText="接入并绑定设备" onAction={() => navigate("/devices/onboarding")} secondaryActionText="查看设备页" onSecondaryAction={() => navigate("/devices")} />
              : <EmptyState title="当前暂无可展示设备" description="可调整筛选器或稍后重试" actionText="刷新设备" onAction={() => void refresh()} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
