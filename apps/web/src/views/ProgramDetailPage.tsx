import React from "react";
import { useParams } from "react-router-dom";
import { fetchProgramCost, fetchProgramDetail, fetchProgramEfficiency, fetchProgramSla, fetchProgramTrajectories, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramDashboardDetailViewModel } from "../viewmodels/programDashboardViewModel";

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

  const vm = React.useMemo(() => buildProgramDashboardDetailViewModel({
    programId,
    item,
    trajectories,
    cost,
    sla,
    efficiency,
  }), [programId, item, trajectories, cost, sla, efficiency]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>{tt("program.header")}</h2>
        <div>{vm.header.title}</div>
        <div className="muted">{tt("program.status")}: {vm.header.status} · {tt("portfolio.risk")}: {vm.header.risk}</div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.actionCenter")}</h3>
        {vm.actionCenter.map((row) => <div key={row.label}>{row.label}: {row.value}</div>)}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.outcomeCenter")}</h3>
        {vm.outcomeCenter.map((row) => <div key={row.label}>{row.label}: {row.value}</div>)}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.resourceCenter")}</h3>
        {vm.resourceCostSlaCenter.map((row) => <div key={row.label}>{row.label}: {row.value}</div>)}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.mapCenter")}</h3>
        {vm.mapCenter.map((row) => <div key={row.label}>{row.label}: {row.value}</div>)}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{tt("program.timelineCenter")}</h3>
        {vm.timelineCenter.map((row) => <div key={row.label}>{row.label}: {row.value}</div>)}
      </section>
    </div>
  );
}
