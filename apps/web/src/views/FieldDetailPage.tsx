import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { FIELD_TEXT, type FieldLang } from "../lib/fieldViewModel";
import { getUiLocale } from "../lib/operationLabels";
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
  const [lang] = React.useState<FieldLang>(() => (getUiLocale() === "en" ? "en" : "zh"));
  const labels = FIELD_TEXT[lang];

  const { model, busy, error, technical, refresh } = useFieldDetail({ fieldId, lang });

  if (busy && !model) return <SectionSkeleton kind="detail" />;
  if (!busy && !model) return <EmptyState title="田块信息暂不可用" description="当前未获取到田块详情，请稍后重试。" actionText="重试" onAction={() => void refresh()} />;

  const statusStyle = STATUS_STYLE[model?.status || "ok"];
  const headerStatusLabel = model?.currentTask ? "进行中" : (model?.statusLabel || "正常");
  const fieldSubline = `${model?.areaText || "--"} · ${(model?.currentCropText || "--")}/${(model?.currentPlanText || "--")}`;

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
                {headerStatusLabel}
              </span>
            </div>
            <div className="muted">{fieldSubline}</div>
            <div className="muted">田块编号：{model?.fieldId || fieldId || "--"}</div>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(160px,1fr))", gap: 10 }}>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>土壤湿度</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.soilMoisture || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>温度</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.temperature || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>设备状态</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.deviceOnline || "--"}</div>
          </article>
          <article className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>最近心跳</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{model?.currentStatus.recentHeartbeat || "--"}</div>
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
            {model.currentTask.operationPlanId ? <Link className="btn" to={`/operations/${encodeURIComponent(model.currentTask.operationPlanId)}`}>查看详情 →</Link> : null}
          </div>
        ) : <div className="muted">暂无执行任务</div>}
      </section>

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>执行证据摘要</h3>
        <div className="muted" style={{ marginBottom: 10 }}>先确认最近一次回执与约束校验，再进入地图查看现场轨迹。</div>
        {model?.latestEvidence?.href ? (
          <Link to={model.latestEvidence.href} style={{ textDecoration: "none", color: "inherit" }}>
            <ReceiptEvidenceCard data={model.latestEvidence} />
          </Link>
        ) : (
          model?.latestEvidence ? <ReceiptEvidenceCard data={model.latestEvidence} /> : <div className="muted">暂无执行证据</div>
        )}
      </section>

      <section className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>地图 / 轨迹</h3>
        {model?.map.polygonGeoJson && model?.map.hasTrajectory ? (
          <FieldGisMap
            polygonGeoJson={model.map.polygonGeoJson}
            heatGeoJson={model.map.heatGeoJson}
            markers={model.map.markers}
            trajectorySegments={model.map.trajectorySegments}
            acceptancePoints={model.map.acceptancePoints}
            labels={labels}
          />
        ) : (
          <div className="gisEmptyState">
            <div className="gisEmptyTitle">当前尚未收到带定位的设备轨迹</div>
            <div className="gisEmptyText">地图页会在系统收到 geo telemetry 后，展示设备路径、最近作业点和后续告警热区。页面本身可用，只是现场轨迹数据尚未进入。</div>
            <div className="traceChipRow" style={{ marginTop: 12 }}>
              <span className="traceChip">下一步补数：设备路径</span>
              <span className="traceChip">下一步补数：作业定位点</span>
              <span className="traceChip">下一步补数：告警热区</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
