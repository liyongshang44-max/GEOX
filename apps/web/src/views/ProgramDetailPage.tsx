import React from "react";
import { useParams } from "react-router-dom";
import { fetchProgramCost, fetchProgramDetail, fetchProgramEfficiency, fetchProgramSla, fetchProgramTrajectories, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramDetailDashboardVM, type BadgeTone } from "../viewmodels/programDashboardViewModel";

function badgeStyle(tone: BadgeTone): React.CSSProperties {
  if (tone === "success") return { background: "#ecfdf3", color: "#067647" };
  if (tone === "warning") return { background: "#fffaeb", color: "#b54708" };
  if (tone === "danger") return { background: "#fef3f2", color: "#b42318" };
  return { background: "#f2f4f7", color: "#344054" };
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

  React.useEffect(() => {
    const id = decodeURIComponent(programId);
    if (!id) return;
    Promise.all([
      fetchProgramDetail(token, id).catch(() => null),
      fetchProgramTrajectories(token, id).catch(() => []),
      fetchProgramCost(token, id).catch(() => null),
      fetchProgramSla(token, id).catch(() => null),
      fetchProgramEfficiency(token, id).catch(() => null),
    ]).then(([detail, traj, costData, slaData, efficiencyData]) => {
      setItem(detail);
      setTrajectories(traj);
      setCost(costData);
      setSla(slaData);
      setEfficiency(efficiencyData);
    }).catch(() => {
      setItem(null);
      setTrajectories([]);
      setCost(null);
      setSla(null);
      setEfficiency(null);
    });
  }, [programId, token]);

  const vm = React.useMemo(() => buildProgramDetailDashboardVM({
    programId,
    item,
    trajectories,
    cost,
    sla,
    efficiency,
    insufficientText: tt("common.insufficientData"),
    noRecordText: tt("common.noRecord"),
  }), [programId, item, trajectories, cost, sla, efficiency, tt]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>{tt("program.header")}</h2>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{vm.header.title}</div>
        <div className="muted">{vm.header.subtitle}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="pill" style={badgeStyle(vm.header.statusBadge.tone)}>{tt("program.status")}: {vm.header.statusBadge.text}</span>
          <span className="pill" style={badgeStyle(vm.header.riskBadge.tone)}>{tt("portfolio.risk")}: {vm.header.riskBadge.text}</span>
          <span className="pill" style={{ background: "#f9fafb", color: "#344054" }}>{tt("program.updatedAt")}: {vm.header.updatedAtText}</span>
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.actionCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {vm.actionCenter.map((x) => (
            <article key={x.title} className="card" style={{ padding: 10 }}>
              <div className="muted">{x.title}</div>
              <div style={{ fontWeight: 600 }}>{x.value}</div>
              <div className="muted">{x.description}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.outcomeCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {vm.outcomeCenter.map((x) => (
            <article key={x.title} className="card" style={{ padding: 10 }}>
              <div className="muted">{x.title}</div>
              <div style={{ fontWeight: 600 }}>{x.value}</div>
              <div className="muted">{x.description}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.resourceCenter")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {vm.resourceCenter.map((x) => (
            <article key={x.title} className="card" style={{ padding: 10 }}>
              <div className="muted">{x.title}</div>
              <div style={{ fontWeight: 600 }}>{x.value}</div>
              <div className="muted">{x.description}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.mapCenter")}</h3>
        <div className="card" style={{ minHeight: 180, display: "grid", placeItems: "center", background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600 }}>{vm.mapCenter.title}</div>
            <div className="muted">{vm.mapCenter.description}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {vm.mapCenter.metrics.map((m) => (
            <span key={m.title} className="pill" style={{ background: "#f9fafb", color: "#344054" }}>{m.title}: {m.value}</span>
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
                <div style={{ fontWeight: 600 }}>{e.title}</div>
                <div>{e.value}</div>
                <div className="muted">{e.description}</div>
              </article>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
