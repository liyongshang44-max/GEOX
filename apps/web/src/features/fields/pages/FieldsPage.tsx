import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFields } from "../../../hooks/useFields";
import { createField } from "../../../api/fields";
import EmptyState from "../../../components/common/EmptyState";
import ErrorState from "../../../components/common/ErrorState";

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
  const [creating, setCreating] = React.useState(false);
  const [createMsg, setCreateMsg] = React.useState("");
  const [newField, setNewField] = React.useState({ field_id: "", name: "", area_ha: "" });

  const submitCreate = async (): Promise<void> => {
    if (!newField.field_id.trim() || !newField.name.trim()) {
      setCreateMsg("请填写田块ID和田块名称");
      return;
    }
    setCreating(true);
    setCreateMsg("正在创建田块...");
    try {
      const res = await createField({
        field_id: newField.field_id.trim(),
        name: newField.name.trim(),
        area_ha: newField.area_ha.trim() ? Number(newField.area_ha) : null,
      });
      if (res?.ok && res?.field_id) {
        setCreateMsg(`田块 ${res.field_id} 创建成功，进入初始化页`);
        await refresh();
        navigate(`/fields/${encodeURIComponent(res.field_id)}`);
        return;
      }
      setCreateMsg(`创建失败：${res?.error ?? "UNKNOWN_ERROR"}`);
    } catch (e: any) {
      setCreateMsg(`创建失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Fields / GIS · Sprint F2</div>
          <h2 className="heroTitle">田块与 GIS</h2>
          <p className="heroText">支持开局创建田块并进入详情继续初始化。</p>
        </div>
        <div className="heroActions">
          <Link className="btn" to="/delivery/export-jobs">查看证据导出</Link>
          <Link className="btn" to="/fields/new">新建田块</Link>
          <button className="btn primary" onClick={() => void refresh()} disabled={busy}>刷新列表</button>
        </div>
      </section>

      <section className="card sectionBlock statusPanel">
        <div className="sectionHeader"><div><div className="sectionTitle">运行状态</div><div className="sectionDesc">请求与状态由 hook 统一管理。</div></div></div>
        <div className="kv"><span className="k">状态消息</span><span className="v statusText">{status || "-"}</span></div>
        <div className="kv"><span className="k">田块数量</span><span className="v">{String(fields.length)}</span></div>
        <div className="kv"><span className="k">最新更新时间</span><span className="v">{fields[0] ? fmtTs(fields[0].updated_ts_ms) : "-"}</span></div>
      </section>

      <section className="card sectionBlock">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">首次开局：新建田块</div>
            <div className="sectionDesc">完成“田块创建 → 绑定设备 → 创建方案”的第一步。</div>
          </div>
          <div>
            <Link className="btn" to="/devices">下一步：绑定设备</Link>
          </div>
        </div>
        <div className="toolbarFilters">
          <input className="input" placeholder="田块ID（如 field_demo_001）" value={newField.field_id} onChange={(e) => setNewField((s) => ({ ...s, field_id: e.target.value }))} />
          <input className="input" placeholder="田块名称" value={newField.name} onChange={(e) => setNewField((s) => ({ ...s, name: e.target.value }))} />
          <input className="input" placeholder="面积ha（可选）" value={newField.area_ha} onChange={(e) => setNewField((s) => ({ ...s, area_ha: e.target.value }))} />
          <button className="btn primary" onClick={() => void submitCreate()} disabled={creating || busy}>{creating ? "创建中..." : "新建田块"}</button>
        </div>
        {createMsg ? <div className="metaText" style={{ marginTop: 8 }}>{createMsg}</div> : null}
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
          {!fields.length ? <EmptyState title="还没有田块" description="先创建田块，系统才能开始记录状态、接入设备和生成经营方案。" actionText="新建田块" onAction={() => navigate("/fields/new")} secondaryActionText="查看接入说明" onSecondaryAction={() => navigate("/devices/onboarding")} /> : null}
        </div>
      </section>
    </div>
  );
}
