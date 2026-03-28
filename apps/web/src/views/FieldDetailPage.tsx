import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { FIELD_TEXT, type FieldLang } from "../lib/fieldViewModel";
import { useFieldDetail } from "../hooks/useFieldDetail";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import { formatTimeOrFallback } from "../lib/presentation/time";

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

  const currentTask = model?.currentTask;
  const currentProgram = model?.program;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{model?.fieldName || "field_c8_demo"}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: STATUS_COLOR[model?.status || "ok"] || "#12b76a", fontWeight: 700 }}>
              <span>{model?.statusDot || "●"}</span>
              <span>{model?.statusLabel || "正常"}</span>
            </div>
            <div className="muted">设备：{model?.deviceCount ?? 0} 台　当前作业：{currentTask?.action || "暂无作业"}　进度：{currentTask?.progress ?? 0}%</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn" to="/fields">返回</Link>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button>
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
          {currentTask ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>{currentTask.action.toUpperCase()}</div>
              <div className="muted">设备：{currentTask.deviceId}</div>
              <div className="muted">状态：{currentTask.status}</div>
              <div className="muted">进度：{currentTask.progress}%</div>
              <div className="muted">开始：{currentTask.startedAt ? formatTimeOrFallback(currentTask.startedAt) : "--"}</div>
              <button className="btn" style={{ width: "fit-content", marginTop: 8 }}>查看执行详情</button>
            </div>
          ) : <div className="muted">暂无作业</div>}

          <hr style={{ border: "none", borderTop: "1px solid #eaecf0", margin: "14px 0" }} />
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Program（经营方案）</h3>
          {currentProgram ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div className="muted">目标：{currentProgram.objective || "无农药 / 高品质"}</div>
              <div className="muted">状态：{currentProgram.status || "运行中"}</div>
              <div className="muted">预计产量：{currentProgram.expectedYield || "--"}</div>
              <div className="muted">预计成本：{currentProgram.expectedCost || "--"}</div>
              <Link className="btn" style={{ width: "fit-content", marginTop: 8 }} to={currentProgram.programId ? `/programs/${encodeURIComponent(currentProgram.programId)}` : "/programs"}>查看方案</Link>
            </div>
          ) : <div className="muted">暂无经营方案</div>}
        </article>

        <article className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>时间线</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {(model?.timeline ?? []).slice(0, 6).map((item, idx) => (
              <div key={`${item.ts}_${idx}`} style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 8 }}>
                <div className="mono" style={{ color: "#475467" }}>{item.timeLabel}</div>
                <div>{item.text}</div>
              </div>
            ))}
            {!(model?.timeline ?? []).length ? <div className="muted">暂无时间线事件</div> : null}
          </div>
          <button className="btn" style={{ marginTop: 12 }}>查看更多</button>
        </article>

        <article className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>最近证据</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {(model?.evidence ?? []).slice(0, 4).map((item) => <div key={item.id}>✓ {item.text}</div>)}
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
