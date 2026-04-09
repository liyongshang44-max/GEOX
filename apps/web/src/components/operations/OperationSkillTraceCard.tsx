import React from "react";
import type { OperationSkillTraceItemV2, OperationSkillTraceStageV2 } from "../../api/operations";
import { StatusPill } from "../../shared/ui";

type SkillRow = {
  key: OperationSkillTraceStageV2;
  label: string;
};

const SKILL_ROWS: SkillRow[] = [
  { key: "sensing", label: "Sensing Skill" },
  { key: "agronomy", label: "Agronomy Skill" },
  { key: "device", label: "Device Skill" },
  { key: "acceptance", label: "Acceptance Skill" },
];

function isMissingSkill(entry: OperationSkillTraceItemV2 | null | undefined): boolean {
  if (!entry) return true;
  return !entry.skill_id;
}

function toStatusTone(value: string): "warning" | "danger" | "success" | "neutral" {
  const code = String(value || "").toUpperCase();
  if (!code) return "neutral";
  if (["SUCCESS", "SUCCEEDED", "OK", "PASSED", "PASS"].includes(code)) return "success";
  if (["FAILED", "ERROR", "TIMEOUT", "CRASHED"].includes(code)) return "danger";
  if (["PENDING", "RUNNING", "SKIPPED", "PARTIAL", "WARNING"].includes(code)) return "warning";
  return "neutral";
}

export default function OperationSkillTraceCard({ trace }: { trace?: OperationSkillTraceItemV2[] | null }): React.ReactElement {
  const byStage = new Map((Array.isArray(trace) ? trace : []).map((item) => [String(item.stage || "").toLowerCase(), item]));
  return (
    <section className="card operationSkillTraceCard" style={{ marginTop: 12 }}>
      <div className="sectionTitle">技能运行追踪</div>
      <div className="decisionItemMeta" style={{ marginTop: 8 }}>
        展示 sensing/agronomy/device/acceptance 四类技能链路与解释码。
      </div>
      <div className="operationSkillTraceList">
        {SKILL_ROWS.map((row) => {
          const item = byStage.get(row.key);
          const missing = isMissingSkill(item);
          const resultStatus = String(item?.status || "");
          const explanationCodes = Array.isArray(item?.explanation_codes) ? item.explanation_codes : [];
          return (
            <article key={row.key} className={`operationSkillTraceItem ${missing ? "isWarning" : ""}`}>
              <div className="operationSkillTraceHeader">
                <strong>{row.label}</strong>
                {missing ? <StatusPill tone="warning">缺失该类 skill</StatusPill> : <StatusPill tone={toStatusTone(resultStatus)}>{resultStatus || "UNKNOWN"}</StatusPill>}
              </div>
              <div className="operationsSummaryGrid" style={{ marginTop: 8 }}>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">skill_id</span><strong>{item?.skill_id || "--"}</strong></div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">stage</span>
                  <strong>{item?.stage || row.key}</strong>
                </div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">explanation_codes</span><strong>{explanationCodes.length > 0 ? explanationCodes.join(", ") : "--"}</strong></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
