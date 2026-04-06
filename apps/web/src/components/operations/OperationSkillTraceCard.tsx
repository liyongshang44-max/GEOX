import React from "react";
import { Link } from "react-router-dom";
import type { OperationSkillTraceEntryV1, OperationSkillTraceV1 } from "../../api/operations";
import { StatusPill } from "../../shared/ui";

type SkillRow = {
  key: keyof OperationSkillTraceV1;
  label: string;
};

const SKILL_ROWS: SkillRow[] = [
  { key: "crop_skill", label: "Crop Skill" },
  { key: "agronomy_skill", label: "Agronomy Skill" },
  { key: "device_skill", label: "Device Skill" },
  { key: "acceptance_skill", label: "Acceptance Skill" },
];

function isMissingSkill(entry: OperationSkillTraceEntryV1 | null | undefined): boolean {
  if (!entry) return true;
  return !entry.skill_id && !entry.version && !entry.run_id;
}

function toStatusTone(value: string): "warning" | "danger" | "success" | "neutral" {
  const code = String(value || "").toUpperCase();
  if (!code) return "neutral";
  if (["SUCCESS", "SUCCEEDED", "OK", "PASSED", "PASS"].includes(code)) return "success";
  if (["FAILED", "ERROR", "TIMEOUT", "CRASHED"].includes(code)) return "danger";
  if (["PENDING", "RUNNING", "SKIPPED", "PARTIAL", "WARNING"].includes(code)) return "warning";
  return "neutral";
}

export default function OperationSkillTraceCard({ trace }: { trace?: OperationSkillTraceV1 | null }): React.ReactElement {
  return (
    <section className="card operationSkillTraceCard" style={{ marginTop: 12 }}>
      <div className="sectionTitle">技能运行追踪</div>
      <div className="decisionItemMeta" style={{ marginTop: 8 }}>
        展示 crop/agronomy/device/acceptance 四类技能链路，点击 run_id 可进入运行详情。
      </div>
      <div className="operationSkillTraceList">
        {SKILL_ROWS.map((row) => {
          const item = trace?.[row.key];
          const missing = isMissingSkill(item);
          const resultStatus = String(item?.result_status || "");
          const errorCode = String(item?.error_code || "");
          return (
            <article key={row.key} className={`operationSkillTraceItem ${missing ? "isWarning" : ""}`}>
              <div className="operationSkillTraceHeader">
                <strong>{row.label}</strong>
                {missing ? <StatusPill tone="warning">缺失该类 skill</StatusPill> : <StatusPill tone={toStatusTone(resultStatus)}>{resultStatus || "UNKNOWN"}</StatusPill>}
              </div>
              <div className="operationsSummaryGrid" style={{ marginTop: 8 }}>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">skill_id</span><strong>{item?.skill_id || "--"}</strong></div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">version</span><strong>{item?.version || "--"}</strong></div>
                <div className="operationsSummaryMetric">
                  <span className="operationsSummaryLabel">run_id</span>
                  <strong>
                    {item?.run_id
                      ? <Link to={`/skills/runs/${encodeURIComponent(item.run_id)}`}>{item.run_id}</Link>
                      : "--"}
                  </strong>
                </div>
                <div className="operationsSummaryMetric"><span className="operationsSummaryLabel">error_code</span><strong>{errorCode || "--"}</strong></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
