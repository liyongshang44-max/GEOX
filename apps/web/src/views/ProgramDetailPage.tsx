import React from "react";
import { useParams } from "react-router-dom";
import { useProgramDetail } from "../hooks/useProgramDetail";
import { badgeStyle } from "./badgeStyle";

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const { vm, label, displayText } = useProgramDetail(programId);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{vm.header.title}</div>
        <div className="muted">{vm.header.subtitle}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="pill" style={badgeStyle(vm.header.statusBadge.tone)}>{label("program.status")} : {vm.header.statusBadge.text}</span>
          <span className="pill" style={badgeStyle(vm.header.riskBadge.tone)}>{label("portfolio.risk")} : {displayText(vm.header.riskBadge.text)}</span>
          <span className="pill" style={{ background: "#f9fafb", color: "#344054" }}>{label("program.updatedAt")} : {vm.header.updatedAtText}</span>
        </div>
      </section>

      <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{label("program.currentIssue")}</h3>
        <div>
          <div className="muted">{label("program.riskHeadline")}</div>
          <div style={{ fontWeight: 600 }}>{vm.currentIssue.riskHeadline}</div>
        </div>
        <div>
          <div className="muted">{label("program.currentStage")}</div>
          <div style={{ fontWeight: 600 }}>{vm.currentIssue.stageText}</div>
        </div>
        <div>
          <div className="muted">{label("program.riskReason")}</div>
          <div>{vm.currentIssue.reasonText}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{label("program.nextActions")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {vm.nextActions.map((x) => (
            <article key={x.titleKey} className="card" style={{ padding: 10 }}>
              <div className="muted">{label(x.titleKey)}</div>
              <div style={{ fontWeight: 600 }}>{displayText(x.value)}</div>
              <div className="muted">{label(x.descriptionKey)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{label("program.outcomeCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {vm.outcomeCenter.map((x) => (
            <article key={x.titleKey} className="card" style={{ padding: 10 }}>
              <div className="muted">{label(x.titleKey)}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{displayText(x.value)}</div>
              <div className="muted">{label(x.descriptionKey)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{label("program.resourceCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {vm.resourceCenter.map((x) => (
            <article key={x.titleKey} className="card" style={{ padding: 10 }}>
              <div className="muted">{label(x.titleKey)}</div>
              <div style={{ fontWeight: 700 }}>{displayText(x.value)}</div>
              <div className="muted">{label(x.descriptionKey)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{label("program.mapCenter")}</h3>
        <div className="card" style={{ minHeight: 160, display: "grid", placeItems: "center", background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600 }}>{label(vm.mapCenter.titleKey)}</div>
            <div className="muted">{label(vm.mapCenter.descriptionKey)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {vm.mapCenter.metrics.map((m) => (
            <span key={m.titleKey} className="pill" style={{ background: "#f9fafb", color: "#344054" }}>{label(m.titleKey)} : {displayText(m.value)}</span>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{label("program.timelineCenter")}</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {vm.timelineCenter.map((e, idx) => (
            <div key={e.key} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 8 }}>
              <div style={{ display: "grid", justifyItems: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#667085", marginTop: 6 }} />
                {idx < vm.timelineCenter.length - 1 ? <span style={{ width: 2, flex: 1, background: "#d0d5dd" }} /> : null}
              </div>
              <article className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{label(e.titleKey)}</div>
                <div>{displayText(e.statusText)}</div>
                <div className="muted">ID : {e.idText}</div>
                <div className="muted">{label(e.descriptionKey)}</div>
              </article>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
