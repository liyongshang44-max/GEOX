import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchFields, type FieldListItem } from "../lib/api";

function fmtTs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString();
}

function fmtArea(area: number | null | undefined): string {
  if (typeof area !== "number" || !Number.isFinite(area)) return "-";
  return `${area} ha`;
}

export default function FieldsPage(): React.ReactElement {
  const navigate = useNavigate();
  const [token, setToken] = React.useState<string>(() => {
    try { return localStorage.getItem("geox_ao_act_token") || "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4"; } catch { return "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4"; }
  });
  const [fields, setFields] = React.useState<FieldListItem[]>([]);
  const [status, setStatus] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);

  function persistToken(next: string): void {
    setToken(next);
    try { localStorage.setItem("geox_ao_act_token", next); } catch {}
  }

  async function refresh(): Promise<void> {
    setBusy(true);
    setStatus("正在同步田块列表...");
    try {
      const nextFields = await fetchFields(token);
      setFields(nextFields);
      setStatus(`已加载 ${nextFields.length} 个田块。`);
    } catch (e: any) {
      setStatus(`读取失败：${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => { void refresh(); }, []);

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Fields / GIS · Sprint F2</div>
          <h2 className="heroTitle">田块与 GIS</h2>
          <p className="heroText">田块列表页现在作为地块工作台入口：进入详情后可查看概览、地图、传感器、作业和告警五个面，不再只是后端骨架的展示页。</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/delivery/export-jobs">查看证据导出</Link>
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新列表</button>
        </div>
      </section>
      <div className="contentGridTwo">
        <section className="card sectionBlock"><div className="sectionHeader"><div><div className="sectionTitle">访问设置</div><div className="sectionDesc">当前页直接调用 Commercial v1 字段接口，详情页已收口为 5 个标签页。</div></div></div><label className="field">访问令牌<input className="input" value={token} onChange={(e) => persistToken(e.target.value)} /></label></section>
        <section className="card sectionBlock statusPanel"><div className="sectionHeader"><div><div className="sectionTitle">运行状态</div><div className="sectionDesc">优先保证列表稳定与详情连通，再逐步补复杂地图编辑与批量维护。</div></div></div><div className="kv"><span className="k">状态消息</span><span className="v statusText">{status || "-"}</span></div><div className="kv"><span className="k">田块数量</span><span className="v">{String(fields.length)}</span></div><div className="kv"><span className="k">最新更新时间</span><span className="v">{fields[0] ? fmtTs(fields[0].updated_ts_ms) : "-"}</span></div></section>
      </div>
      <section className="card sectionBlock"><div className="sectionHeader"><div><div className="sectionTitle">田块列表</div><div className="sectionDesc">点击任一田块进入详情页，查看边界、设备绑定、季节、传感器、作业与告警摘要。</div></div></div><div className="list modernList">{fields.map((field) => (<button key={field.field_id} className="fieldListItem" onClick={() => navigate(`/fields/${encodeURIComponent(field.field_id)}`)}><div className="fieldListMain"><div className="jobTitleRow"><div className="title">{field.name}</div><div className="pill">{field.status}</div></div><div className="meta"><span>ID：{field.field_id}</span><span>面积：{fmtArea(field.area_ha)}</span><span>更新：{fmtTs(field.updated_ts_ms)}</span></div></div><div className="jobListAction">查看详情</div></button>))}{!fields.length ? <div className="emptyState">当前还没有可展示的田块。可先通过 acceptance 或 API 创建一个 field 再刷新。</div> : null}</div></section>
    </div>
  );
}
