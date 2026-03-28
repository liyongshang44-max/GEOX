import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { FIELD_TEXT, type FieldLang } from "../lib/fieldViewModel";
import { useFieldDetail } from "../hooks/useFieldDetail";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SectionSkeleton from "../components/common/SectionSkeleton";
import ReceiptEvidenceCard from "../components/evidence/ReceiptEvidenceCard";

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  ok: { color: "#067647", bg: "#ecfdf3", border: "#abefc6" },
  risk: { color: "#b54708", bg: "#fffaeb", border: "#fedf89" },
  error: { color: "#b42318", bg: "#fef3f2", border: "#fecdca" },
};

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const [lang] = React.useState<FieldLang>(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const labels = FIELD_TEXT[lang];

  const { model, busy, error, technical, refresh } = useFieldDetail({ fieldId, lang });

  if (busy && !model) return <SectionSkeleton kind="detail" />;
  if (!busy && !model) return <EmptyState title="田块信息暂不可用" description="当前未获取到田块详情，请稍后重试。" actionText="重试" onAction={() => void refresh()} />;

  const statusStyle = STATUS_STYLE[model?.status || "ok"];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{model?.fieldName || "field_c8_demo"}</div>
              <span
                style={{
                  color: statusStyle.color,
                  background: statusStyle.bg,
                  border: `1px solid ${statusStyle.border}`,
                  borderRadius: 999,
                  padding: "2px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {model?.statusLabel || "正常"}
              </span>
            </div>
            <div className="muted">面积：{model?.areaText || "--"}</div>
            <div className="muted">当前作物：{model?.currentCropText || "--"}</div>
            <div className="muted">当前经营方案：{model?.currentPlanText || "--"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>刷新</button>
            <Link className="btn" to="/fields">返回</Link>
          </div>
        </div>
      </section>

      {error ? <ErrorState title="田块详情暂不可用" message={error} technical={technical || undefined} onRetry={() => void refresh()} /> : null}

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>当前状态</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(140px,1fr))", gap: 10 }}>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>土壤湿度</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.soilMoisture || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>温度</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.temperature || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>设备在线状态</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.deviceOnline || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>最近心跳</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.recentHeartbeat || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>最近一次建议摘要</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.latestSuggestion || "--"}</div>
          </article>
        </div>
      </section>

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>最近作业</h3>
        {model?.currentTask ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>动作：{model.currentTask.action}</div>
            <div className="muted">状态：{model.currentTask.status}</div>
            <div className="muted">时间：{model.lastEvent?.relativeText || "刚刚"}</div>
            {model.currentTask.operationPlanId ? <Link className="btn" to={`/operations/${encodeURIComponent(model.currentTask.operationPlanId)}`}>查看作业详情</Link> : null}
          </div>
        ) : <div className="muted">暂无执行任务</div>}
      </section>

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>执行证据摘要</h3>
        {model?.latestEvidence?.href ? (
          <Link to={model.latestEvidence.href} style={{ textDecoration: "none", color: "inherit" }}>
            <ReceiptEvidenceCard data={model.latestEvidence} />
          </Link>
        ) : (
          <ReceiptEvidenceCard data={model?.latestEvidence} />
        )}
      </section>

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>地图 / 轨迹</h3>
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
            暂无可用轨迹数据
          </div>
        ) : null}
      </section>
    </div>
  );
}
