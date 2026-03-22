import React from "react";
import { useParams } from "react-router-dom";
import { fetchProgramCost, fetchProgramDetail, fetchProgramEfficiency, fetchProgramSla, fetchProgramTrajectories, fetchSchedulingConflicts, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramDetailDashboardVM } from "../viewmodels/programDashboardViewModel";
import { badgeStyle } from "./badgeStyle";

function resolveDisplayText(value: string, tf: (k: string) => string): string {
  if (value.startsWith("program.") || value.startsWith("portfolio.") || value.startsWith("common.")) return tf(value);
  return value;
}

function conflictLabel(kind: string, tf: (k: string) => string): string {
  const k = String(kind ?? "").toUpperCase();
  if (k === "DEVICE_CONFLICT") return tf("portfolio.deviceConflict");
  if (k === "FIELD_CONFLICT") return tf("portfolio.fieldConflict");
  if (k === "PROGRAM_INTENT_CONFLICT") return tf("portfolio.intentConflict");
  return tf("common.noRecord");
}

export default function ProgramDetailPage(): React.ReactElement {
  const { programId = "" } = useParams();
  const [token] = React.useState(() => readStoredAoActToken());
  const [locale] = React.useState<Locale>(() => resolveLocale());
  const tt = React.useCallback((key: string) => t(locale, key), [locale]);
  const [item, setItem] = React.useState<any>(null);
  const [trajectories, setTrajectories] = React.useState<any[]>([]);
  const [cost, setCost] = React.useState<any>(null);
  const [sla, setSla] = React.useState<any>(null);
  const [efficiency, setEfficiency] = React.useState<any>(null);
  const [conflicts, setConflicts] = React.useState<string[]>([]);

  React.useEffect(() => {
    const id = decodeURIComponent(programId);
    if (!id) return;
    Promise.all([
      fetchProgramDetail(token, id).catch(() => null),
      fetchProgramTrajectories(token, id).catch(() => []),
      fetchProgramCost(token, id).catch(() => null),
      fetchProgramSla(token, id).catch(() => null),
      fetchProgramEfficiency(token, id).catch(() => null),
      fetchSchedulingConflicts(token).catch(() => []),
    ]).then(([detail, traj, costData, slaData, efficiencyData, conflictList]) => {
      setItem(detail);
      setTrajectories(traj);
      setCost(costData);
      setSla(slaData);
      setEfficiency(efficiencyData);
      const kinds = (Array.isArray(conflictList) ? conflictList : [])
        .filter((c: any) => Array.isArray(c?.related_program_ids) && c.related_program_ids.some((pid: unknown) => String(pid) === id))
        .map((c: any) => conflictLabel(String(c?.kind ?? ""), tt));
      setConflicts(Array.from(new Set(kinds)));
    }).catch(() => {
      setItem(null);
      setTrajectories([]);
      setCost(null);
      setSla(null);
      setEfficiency(null);
      setConflicts([]);
    });
  }, [programId, token, tt]);

  const vm = React.useMemo(() => buildProgramDetailDashboardVM({
    programId,
    item,
    trajectories,
    cost,
    sla,
    efficiency,
    conflicts,
    insufficientText: tt("common.insufficientData"),
    noRecordText: tt("common.noRecord"),
  }), [programId, item, trajectories, cost, sla, efficiency, conflicts, tt]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{vm.header.title}</div>
        <div className="muted">{vm.header.subtitle}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="pill" style={badgeStyle(vm.header.statusBadge.tone)}>{tt("program.status")} : {vm.header.statusBadge.text}</span>
          <span className="pill" style={badgeStyle(vm.header.riskBadge.tone)}>{tt("portfolio.risk")} : {resolveDisplayText(vm.header.riskBadge.text, tt)}</span>
          <span className="pill" style={{ background: "#f9fafb", color: "#344054" }}>{tt("program.updatedAt")} : {vm.header.updatedAtText}</span>
        </div>
      </section>

      <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{tt("program.currentIssue")}</h3>
        <div>
          <div className="muted">{tt("program.riskHeadline")}</div>
          <div style={{ fontWeight: 600 }}>{vm.currentIssue.riskHeadline}</div>
        </div>
        <div>
          <div className="muted">{tt("program.currentStage")}</div>
          <div style={{ fontWeight: 600 }}>{vm.currentIssue.stageText}</div>
        </div>
        <div>
          <div className="muted">{tt("program.riskReason")}</div>
          <div>{vm.currentIssue.reasonText}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.nextActions")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {vm.nextActions.map((x) => (
            <article key={x.titleKey} className="card" style={{ padding: 10 }}>
              <div className="muted">{tt(x.titleKey)}</div>
              <div style={{ fontWeight: 600 }}>{resolveDisplayText(x.value, tt)}</div>
              <div className="muted">{tt(x.descriptionKey)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.outcomeCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {vm.outcomeCenter.map((x) => (
            <article key={x.titleKey} className="card" style={{ padding: 10 }}>
              <div className="muted">{tt(x.titleKey)}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{resolveDisplayText(x.value, tt)}</div>
              <div className="muted">{tt(x.descriptionKey)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.resourceCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {vm.resourceCenter.map((x) => (
            <article key={x.titleKey} className="card" style={{ padding: 10 }}>
              <div className="muted">{tt(x.titleKey)}</div>
              <div style={{ fontWeight: 700 }}>{resolveDisplayText(x.value, tt)}</div>
              <div className="muted">{tt(x.descriptionKey)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.mapCenter")}</h3>
        <div className="card" style={{ minHeight: 160, display: "grid", placeItems: "center", background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600 }}>{tt(vm.mapCenter.titleKey)}</div>
            <div className="muted">{tt(vm.mapCenter.descriptionKey)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {vm.mapCenter.metrics.map((m) => (
            <span key={m.titleKey} className="pill" style={{ background: "#f9fafb", color: "#344054" }}>{tt(m.titleKey)} : {resolveDisplayText(m.value, tt)}</span>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.timelineCenter")}</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {vm.timelineCenter.map((e, idx) => (
            <div key={e.key} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 8 }}>
              <div style={{ display: "grid", justifyItems: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#667085", marginTop: 6 }} />
                {idx < vm.timelineCenter.length - 1 ? <span style={{ width: 2, flex: 1, background: "#d0d5dd" }} /> : null}
              </div>
              <article className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{tt(e.titleKey)}</div>
                <div>{resolveDisplayText(e.statusText, tt)}</div>
                <div className="muted">ID : {e.idText}</div>
                <div className="muted">{tt(e.descriptionKey)}</div>
              </article>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
