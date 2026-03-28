import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { FIELD_TEXT, type FieldLang } from "../lib/fieldViewModel";
import { useFieldDetail } from "../hooks/useFieldDetail";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";

const STATUS_COLOR: Record<string, string> = {
  ok: "#12b76a",
  risk: "#f79009",
  error: "#f04438",
};

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const [lang, setLang] = React.useState<FieldLang>(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const labels = FIELD_TEXT[lang];

  const { model, busy, status, error, technical, refresh } = useFieldDetail({ fieldId, lang });

  if (busy && !model) return <SectionSkeleton kind="detail" />;
  if (!busy && !model) return <EmptyState title="田块信息暂不可用" description="当前未获取到田块详情，请稍后重试。" actionText="重试" onAction={() => void refresh()} />;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>[ {model?.fieldName || "field_c8_demo"} ]</div>
              <div style={{ color: STATUS_COLOR[model?.status || "ok"], fontWeight: 700, fontSize: 18 }}>整体状态：{model?.statusDot || "●"} {model?.statusLabel || "正常"}</div>
            </div>
            <div className="muted">原因：{model?.statusReason || "运行稳定"}</div>
            <div className="muted">设备：{model?.currentTask?.deviceId || "dev_onboard_accept_001"}</div>
            <div className="muted">当前作业：{model?.currentTask ? `${model.currentTask.action}中` : "无"}</div>
            <div className="muted">最近动作：{model?.lastEvent?.relativeText || "暂无"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button>
            <Link className="btn" to="/fields">返回</Link>
            <button className="btn" onClick={() => setLang((x) => (x === "zh" ? "en" : "zh"))}>切换语言</button>
          </div>
        </div>
      </section>

      {error ? <ErrorState title="地块详情暂不可用" message={error} technical={technical || undefined} onRetry={() => void refresh()} /> : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(120px,1fr))", gap: 10 }}>
        {(model?.kpis ?? []).map((item) => (
          <article key={item.label} className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>{item.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{item.value}</div>
          </article>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr", gap: 12 }}>
        <article className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>当前作业</h3>
          {model?.currentTask ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>{model.currentTask.action.toUpperCase()}</div>
              <div className="muted">状态：{model.currentTask.status}</div>
              <div className="muted">进度：{model.currentTask.progress}%</div>
              <button className="btn" style={{ width: "fit-content", marginTop: 8 }}>查看执行详情</button>
            </div>
          ) : <div className="muted">暂无执行中的作业</div>}

          <hr style={{ border: "none", borderTop: "1px solid #eaecf0", margin: "14px 0" }} />
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Program（经营方案）</h3>
          {model?.program ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div className="muted">目标：{model.program.objective || "无农药 / 高品质"}</div>
              <div className="muted">状态：{model.program.status || "运行中"}</div>
              <div className="muted">预计产量：{model.program.expectedYield || "--"}</div>
              <div className="muted">预计成本：{model.program.expectedCost || "--"}</div>
              <Link className="btn" style={{ width: "fit-content", marginTop: 8 }} to={model.program.programId ? `/programs/${encodeURIComponent(model.program.programId)}` : "/programs"}>查看方案</Link>
            </div>
          ) : <div className="muted">暂无经营方案</div>}
        </article>

        <article className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>时间线</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(model?.timeline ?? []).slice(0, 6).map((item, idx) => (
              <div key={`${item.ts}_${idx}`} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 8 }}>
                <div className="mono" style={{ color: "#475467" }}>[{item.timeLabel}]</div>
                <div>{item.text}</div>
              </div>
            ))}
            {!(model?.timeline ?? []).length ? <div className="muted">暂无时间线事件</div> : null}
          </div>
          <button className="btn" style={{ marginTop: 12 }}>查看更多</button>
        </article>

        <article className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>证据</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {(model?.evidence ?? []).slice(0, 3).map((item) => (
              <div key={item.id} style={{ display: "grid", gap: 4 }}>
                <div>✓ {item.text}</div>
                <div className="muted">时间：{item.timeLabel}</div>
                <div className="muted">设备：{item.deviceId}</div>
              </div>
            ))}
            {!(model?.evidence ?? []).length ? <div className="muted">暂无证据</div> : null}
          </div>
          <button className="btn" style={{ marginTop: 12 }}>下载证据包</button>
        </article>
      </section>

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>地图</h3>
        {!model?.map.polygonGeoJson ? (
          <div style={{ border: "1px dashed #d0d5dd", background: "#f2f4f7", borderRadius: 10, padding: 24, color: "#667085" }}>
            暂无田块边界数据
          </div>
        ) : (
          <FieldGisMap
            polygonGeoJson={model.map.polygonGeoJson}
            heatGeoJson={model.map.heatGeoJson}
            markers={model.map.markers}
            trajectorySegments={model.map.trajectorySegments}
            acceptancePoints={model.map.acceptancePoints}
            labels={labels}
          />
        )}
        {!model?.map.hasTrajectory ? (
          <div style={{ marginTop: 10, border: "1px dashed #d0d5dd", background: "#f2f4f7", borderRadius: 10, padding: 16, color: "#667085" }}>
            暂无轨迹
          </div>
        ) : null}
      </section>

      <div className="muted">{status}</div>
    </div>
  );
}
