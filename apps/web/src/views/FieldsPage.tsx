import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFields } from "../hooks/useFields";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";

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
  const { fields, status, busy, refresh } = useFields();

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Fields / GIS · Sprint F2</div>
          <h2 className="heroTitle">田块与 GIS</h2>
          <p className="heroText">列表页只负责展示字段列表与进入详情页。</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/delivery/export-jobs">查看证据导出</Link>
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新列表</button>
        </div>
      </section>

      <section className="card sectionBlock statusPanel">
        <div className="sectionHeader"><div><div className="sectionTitle">运行状态</div><div className="sectionDesc">请求与状态由 hook 统一管理。</div></div></div>
        <div className="kv"><span className="k">状态消息</span><span className="v statusText">{status || "-"}</span></div>
        <div className="kv"><span className="k">田块数量</span><span className="v">{String(fields.length)}</span></div>
        <div className="kv"><span className="k">最新更新时间</span><span className="v">{fields[0] ? fmtTs(fields[0].updated_ts_ms) : "-"}</span></div>
      </section>

      {status.includes("失败") || status.includes("error") || status.includes("500") ? <ErrorState title="田块数据读取异常" message="接口暂不可用，已保留页面可操作状态。" onRetry={() => void refresh()} /> : null}

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">田块列表</div><div className="sectionDesc">点击进入地块详情。</div></div></div>
        <div className="list modernList">
          {fields.map((field) => (
            <button key={field.field_id} className="fieldListItem" onClick={() => navigate(`/fields/${encodeURIComponent(field.field_id)}`)}>
              <div className="fieldListMain">
                <div className="jobTitleRow"><div className="title">{field.name}</div><div className="pill">{field.status}</div></div>
                <div className="meta"><span>ID：{field.field_id}</span><span>面积：{fmtArea(field.area_ha)}</span><span>更新：{fmtTs(field.updated_ts_ms)}</span></div>
              </div>
              <div className="jobListAction">查看详情</div>
            </button>
          ))}
          {!fields.length ? <EmptyState title="暂无可展示田块" description="可在数据接入后刷新重试" /> : null}
        </div>
      </section>
    </div>
  );
}
