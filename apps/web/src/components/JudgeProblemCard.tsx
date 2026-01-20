import React from "react";
import {
  fmtIso,
  fmtWindow,
  safeList,
  labelForProblemType,
  labelForUncertainty,
  labelForEvidenceKind,
  labelForSenseFocus,
  summarizeProblem,
  pickAoSenseForProblem,
  ruleForSection,
  ruleForProblemType,
  ruleForUncertainty,
  ruleForEvidenceKind,
  sanitizeAoNote,
} from "../lib/judge_humanize";

export default function JudgeProblemCard(props: {
  problemState: any;
  aoSense?: any[];
  showAudit?: boolean;
}): React.ReactElement {
  const ps = props.problemState ?? null;
  const ao = safeList<any>(props.aoSense);
  const showAudit = !!props.showAudit;

  // --- 标题与引导语 ---
  const problemType = ps?.problem_type ?? ps?.problemType;
  const title = labelForProblemType(problemType);
  const lead = summarizeProblem(ps);

  // --- Subject ---
  const subject = ps?.subjectRef ?? {};
  const subjectBits = [
    subject.projectId ? `project ${subject.projectId}` : null,
    subject.groupId ? `group ${subject.groupId}` : null,
    subject.plotId ? `plot ${subject.plotId}` : null,
    subject.blockId ? `block ${subject.blockId}` : null,
  ].filter(Boolean);

  // --- Window ---
  const window = ps?.window ?? null;

  // --- 不确定性来源 ---
  const reasonsRaw = safeList(ps?.uncertainty_sources ?? ps?.uncertaintySources);
  const reasonItems = reasonsRaw
    .map((r: any) => ({ raw: r, label: labelForUncertainty(r) }))
    .filter((x) => x.label);
  const reasons = Array.from(new Map(reasonItems.map((x) => [x.label, x])).values());

  // --- 证据类型 ---
  const evidenceRefs = safeList(ps?.supporting_evidence_refs ?? ps?.supportingEvidenceRefs);
  const evidenceItems = evidenceRefs
    .map((r: any) => ({ kind: r?.kind, label: labelForEvidenceKind(r?.kind) }))
    .filter((x) => x.label);
  const evidences = Array.from(new Map(evidenceItems.map((x) => [x.label, x])).values());

  // --- AO-SENSE ---
  const psId = String(ps?.problem_state_id ?? ps?.problemStateId ?? "");
  const aoForThis = pickAoSenseForProblem(ao, psId || null);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="judgeTitle" title={ruleForProblemType(problemType)}>{title}</div>
      <div className="judgeLead">{lead}</div>

      <div className="judgeMetaRow" style={{ marginTop: 10 }}>
        <div className="pill">
          <span className="muted">Window</span>
          <span className="mono">{fmtWindow(window)}</span>
        </div>

        {subjectBits.length ? (
          <div className="pill">
            <span className="muted">Subject</span>
            <span className="mono">{subjectBits.join(" · ")}</span>
          </div>
        ) : null}
      </div>

      <details style={{ marginTop: 12 }}>
        <summary className="judgeSummary">展开详情</summary>

        {/* 为什么看不懂 */}
        <div className="judgeSection">
          <div className="judgeSectionTitle" title={ruleForSection("why")}>为什么系统目前看不懂</div>
          {reasons.length ? (
            <div className="judgeTags">
              {reasons.map((x) => (
                <span key={x.label} className="tag" title={ruleForUncertainty(x.raw)}>
                  {x.label}
                </span>
              ))}
            </div>
          ) : (
            <div className="muted">未提供不确定性来源。</div>
          )}
        </div>

        {/* 基于什么 */}
        <div className="judgeSection">
          <div className="judgeSectionTitle" title={ruleForSection("evidence")}>系统基于什么说这句话</div>
          {evidences.length ? (
            <ul className="judgeList">
              {evidences.map((x) => (
                <li key={x.label} title={ruleForEvidenceKind(x.kind)}>{x.label}</li>
              ))}
            </ul>
          ) : (
            <div className="muted">未提供可展示的证据类型。</div>
          )}
        </div>

        {/* AO-SENSE */}
        {aoForThis.length ? (
          <div className="judgeSection">
            <div className="judgeSectionTitle" title={ruleForSection("ao_sense")}>系统现在希望多看什么</div>
            <div className="muted" style={{ marginBottom: 6 }}>
              为了减少不确定性，系统希望补充以下观测信息：
            </div>
            <ul className="judgeList">
              {aoForThis.map((s: any, idx: number) => {
                const focus = labelForSenseFocus(s?.sense_focus ?? s?.senseFocus);
                const note = sanitizeAoNote(typeof s?.note === "string" ? s.note : "");
                return (
                  <li key={String(s?.ao_sense_id ?? s?.aoSenseId ?? idx)}>
                    {focus}
                    {note ? `：${note}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* 审计 */}
        {showAudit ? (
          <div className="judgeSection">
            <div className="judgeSectionTitle">审计（开发 / 回放用）</div>
            <div className="judgeAuditGrid">
              <div>
                <div className="muted">problem_state_id</div>
                <div className="mono">{psId || "—"}</div>
              </div>
              <div>
                <div className="muted">created_at_ts</div>
                <div className="mono">
                  {typeof ps?.created_at_ts === "number"
                    ? fmtIso(ps.created_at_ts)
                    : "—"}
                </div>
              </div>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary className="judgeSummary">查看原始 JSON</summary>
              <pre className="judgeJson">{JSON.stringify(ps, null, 2)}</pre>
            </details>
          </div>
        ) : null}
      </details>
    </div>
  );
}