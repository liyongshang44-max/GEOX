import React from "react";
import { Link } from "react-router-dom";
import type { DashboardRecommendationItem } from "../../../api/dashboard";
import EmptyState from "../../../components/common/EmptyState";
import ErrorState from "../../../components/common/ErrorState";
import { mapFieldDisplayName } from "../../../lib/operationLabels";
import SectionCard from "./SectionCard";

type EvidenceItem = {
  id: string;
  href?: string;
  fieldName?: string;
  operationName?: string;
  hasReceipt?: boolean;
  acceptanceVerdict?: string;
  card?: {
    statusLabel?: string;
    statusTone?: "success" | "warning" | "danger" | "neutral";
    constraintCheckLabel?: string;
    waterLabel?: string;
  };
};

type GroupKey = "PASS" | "PENDING_ACCEPTANCE" | "EXECUTION_EXCEPTION" | "EVIDENCE_MISSING";

function classifyGroup(item: EvidenceItem): GroupKey {
  const verdict = String(item?.acceptanceVerdict ?? "").toUpperCase();
  const tone = String(item?.card?.statusTone ?? "").toLowerCase();
  const status = String(item?.card?.statusLabel ?? "").toUpperCase();

  if (!item?.hasReceipt) return "EVIDENCE_MISSING";
  if (verdict === "FAIL" || verdict === "INVALID_EXECUTION" || tone === "danger" || status.includes("失败")) return "EXECUTION_EXCEPTION";
  if (verdict === "PASS") return "PASS";
  return "PENDING_ACCEPTANCE";
}

const GROUP_META: Record<GroupKey, { title: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PASS: { title: "通过验收", tone: "success" },
  PENDING_ACCEPTANCE: { title: "待验收", tone: "warning" },
  EXECUTION_EXCEPTION: { title: "执行异常", tone: "danger" },
  EVIDENCE_MISSING: { title: "证据缺失", tone: "danger" },
};

function toneStyle(tone: "success" | "warning" | "danger" | "neutral"): React.CSSProperties {
  if (tone === "success") return { color: "#067647", background: "#ecfdf3", border: "1px solid #abefc6" };
  if (tone === "warning") return { color: "#b54708", background: "#fffaeb", border: "1px solid #fedf89" };
  if (tone === "danger") return { color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca" };
  return { color: "#344054", background: "#f9fafb", border: "1px solid #eaecf0" };
}

export default function EvidenceOutcomeSection({
  evidenceItems,
  smartRecommendations,
  latestMetrics,
  loadError,
}: {
  evidenceItems: EvidenceItem[];
  smartRecommendations: {
    todayCount: number;
    latest: (DashboardRecommendationItem & {
      normalized_metrics?: { soil_moisture: number | null; temperature: number | null; humidity: number | null };
    }) | null;
  };
  latestMetrics: { soil_moisture?: number | null; temperature?: number | null; humidity?: number | null };
  loadError?: string | null;
}): React.ReactElement {
  if (loadError) {
    return (
      <SectionCard title="EvidenceOutcomeSection" subtitle="证据先过，再进验收。">
        <ErrorState
          title="证据结果读取失败"
          message="暂时无法完成证据分组，请稍后重试。"
          technical={loadError}
        />
      </SectionCard>
    );
  }

  const groups: Record<GroupKey, EvidenceItem[]> = {
    PASS: [],
    PENDING_ACCEPTANCE: [],
    EXECUTION_EXCEPTION: [],
    EVIDENCE_MISSING: [],
  };

  evidenceItems.forEach((item) => {
    groups[classifyGroup(item)].push(item);
  });

  const orderedKeys: GroupKey[] = ["PASS", "PENDING_ACCEPTANCE", "EXECUTION_EXCEPTION", "EVIDENCE_MISSING"];

  return (
    <SectionCard title="EvidenceOutcomeSection" subtitle="按验收状态分组管理，优先补齐异常与缺失证据。">
      {!evidenceItems.length ? (
        <EmptyState
          title="暂无证据结果"
          description="当前还没有可分组的证据项。建议先检查作业执行与回执回传状态。"
        />
      ) : (
        <div className="decisionList" style={{ marginTop: 8 }}>
          {orderedKeys.map((groupKey) => {
            const items = groups[groupKey];
            const meta = GROUP_META[groupKey];
            return (
              <div key={groupKey} className="decisionItemStatic" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div className="decisionItemTitle">{meta.title}</div>
                  <span style={{ ...toneStyle(meta.tone), borderRadius: 999, fontSize: 12, lineHeight: "18px", padding: "2px 8px", fontWeight: 700 }}>
                    {items.length} 项
                  </span>
                </div>
                {!items.length ? <div className="muted" style={{ fontSize: 13 }}>当前分组暂无数据</div> : null}
                {items.map((item) => {
                  const card = item?.card || {};
                  const detailHref = item?.href || "/operations";
                  const downloadHref = `/evidence?operation_plan_id=${encodeURIComponent(String(item?.id ?? ""))}`;
                  const missingEvidence = classifyGroup(item) === "EVIDENCE_MISSING";
                  return (
                    <div key={`${groupKey}_${item?.id}`} style={{ borderTop: "1px solid #eaecf0", paddingTop: 8, marginTop: 8 }}>
                      <div className="decisionItemTitle">{mapFieldDisplayName(item?.fieldName, item?.fieldName)} · {String(item?.operationName || "作业")}</div>
                      <div className="decisionItemMeta">{card?.constraintCheckLabel || card?.statusLabel || "待验收"} · {card?.waterLabel || "--"}</div>
                      {missingEvidence ? (
                        <div style={{ marginTop: 6, color: "#b42318", fontWeight: 700 }}>⚠ 缺失执行回执或证据文件，请优先补传后再验收。</div>
                      ) : null}
                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link className="btn" to={detailHref}>查看详情</Link>
                        <Link className="btn" to={downloadHref}>下载证据</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn primary" to="/operations?status=done_unaccepted">进入证据验收</Link>
        <Link className="btn" to="/evidence">查看证据详情</Link>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary>诊断信息（折叠）</summary>
        <div className="decisionList" style={{ marginTop: 8 }}>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">今日自动建议</div>
            <div className="decisionItemMeta">{smartRecommendations.todayCount} 条</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">soil_moisture</div>
            <div className="decisionItemMeta">{latestMetrics.soil_moisture == null ? "--" : `${Number(latestMetrics.soil_moisture).toFixed(1)}%`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">temperature</div>
            <div className="decisionItemMeta">{latestMetrics.temperature == null ? "--" : `${Number(latestMetrics.temperature).toFixed(1)}°C`}</div>
          </div>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">humidity</div>
            <div className="decisionItemMeta">{latestMetrics.humidity == null ? "--" : `${Number(latestMetrics.humidity).toFixed(1)}%`}</div>
          </div>
        </div>
      </details>
    </SectionCard>
  );
}
