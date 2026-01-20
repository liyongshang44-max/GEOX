// GEOX/apps/web/src/components/UPlotSeries.tsx
import React, { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { OverlaySegment, SeriesSampleV1 } from "../lib/contracts";

type LineKey = { sensorId: string; metric: string };
function keyOf(s: LineKey): string {
  return `${s.sensorId}::${s.metric}`;
}

const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

export type PlotHover =
  | {
      ts: number; // ms
      values: Array<{ sensorId: string; metric: string; value: number }>;
    }
  | null;

export function UPlotSeries(props: {
  samples: SeriesSampleV1[];
  overlays: OverlaySegment[];
  metrics: string[];
  sensors?: string[];
  range?: { startTs: number; endTs: number };
  onHover?: (h: PlotHover) => void;
}): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<HTMLDivElement[]>([]);
  const plotsRef = useRef<uPlot[]>([]);
  const syncingRef = useRef(false);

  const metricsToRender = useMemo(() => props.metrics.slice(), [props.metrics]);

  const model = useMemo(() => {
    const rows = props.samples.slice().sort((a, b) => a.ts - b.ts);

    const sensors =
      props.sensors && props.sensors.length > 0
        ? props.sensors.slice()
        : Array.from(new Set(rows.map((r) => r.sensorId)));

    const xMs = Array.from(new Set(rows.map((r) => r.ts))).sort((a, b) => a - b);
    const xSec = xMs.map((t) => t / 1000);

    const indexByTs = new Map<number, number>();
    xMs.forEach((ts, idx) => indexByTs.set(ts, idx));

    const panels = metricsToRender.map((metric) => {
      const lineKeys: LineKey[] = sensors.map((s) => ({ sensorId: s, metric }));
      const yByKey: Record<string, Array<number | null>> = {};
      for (const k of lineKeys) yByKey[keyOf(k)] = new Array(xMs.length).fill(null);

      for (const r of rows) {
        if (r.metric !== metric) continue;
        const idx = indexByTs.get(r.ts);
        if (idx == null) continue;
        const k = keyOf({ sensorId: r.sensorId, metric: r.metric });
        if (k in yByKey) yByKey[k][idx] = r.value;
      }

      // ✅ 关键修复：强制 stroke / points stroke&fill，避免“hover 有值但没线”
      const seriesDefs: uPlot.Series[] = [
        { label: "ts" },
        ...lineKeys.map((k, idx) => {
          const c = PALETTE[idx % PALETTE.length];
          return {
            label: `${k.sensorId}`,
            value: (_u, v) => (v == null ? "" : String(v)),
            width: 2,
            stroke: c,
            spanGaps: true, // ✅ 跨 null 连线
            points: {
              show: true,
              size: 6, // ✅ 点大一点，便于确认确实在画
              stroke: c,
              fill: c,
            },
          } as uPlot.Series;
        }),
      ];

      const data: Array<Array<number | null>> = [
        xSec as unknown as number[],
        ...lineKeys.map((k) => yByKey[keyOf(k)]),
      ];

      return { metric, sensors, seriesDefs, data };
    });

    return { xMs, xSec, sensors, panels };
  }, [props.samples, props.metrics, props.sensors, metricsToRender]);

  const overlaySet = useMemo(() => props.overlays, [props.overlays]);

  useEffect(() => {
    if (!rootRef.current) return;

    // destroy old plots
    for (const p of plotsRef.current) {
      try {
        p.destroy();
      } catch {}
    }
    plotsRef.current = [];

    panelsRef.current = panelsRef.current.slice(0, model.panels.length);
    const panelHeight = Math.max(220, Math.floor(520 / Math.max(1, model.panels.length)));

    const makeOpts = (metric: string, series: uPlot.Series[], height: number): uPlot.Options => {
      const wantStartSec = props.range ? props.range.startTs / 1000 : undefined;
      const wantEndSec = props.range ? props.range.endTs / 1000 : undefined;

      const spanSec =
        wantStartSec != null && wantEndSec != null
          ? wantEndSec - wantStartSec
          : model.xSec.length >= 2
            ? model.xSec[model.xSec.length - 1] - model.xSec[0]
            : 0;

      let fmt: (u: uPlot, vals: number[]) => string[];
      let incrs: number[] | undefined;

      if (spanSec <= 36 * 3600) {
        const f = uPlot.fmtDate("{HH}:{mm}");
        fmt = (_u, vals) => vals.map((v) => f(new Date(v * 1000)));
        incrs = [3600, 2 * 3600, 3 * 3600, 6 * 3600, 12 * 3600];
      } else if (spanSec <= 10 * 86400) {
        const f = uPlot.fmtDate("{M}/{D}");
        fmt = (_u, vals) => vals.map((v) => f(new Date(v * 1000)));
        incrs = [86400, 2 * 86400, 3 * 86400, 7 * 86400];
      } else {
        const f = uPlot.fmtDate("{YYYY}-{MM}");
        fmt = (_u, vals) => vals.map((v) => f(new Date(v * 1000)));
        incrs = [30 * 86400, 60 * 86400, 90 * 86400, 180 * 86400];
      }

      return {
        width: 100,
        height,
        padding: [16, 12, 12, 12],
        legend: { show: true },
        scales: {
          x: {
            time: true,
            incrs,
            // ✅ 强制 X 轴覆盖请求窗口（铺满）
            range: (_u, _min, _max) => {
              if (wantStartSec == null || wantEndSec == null) return [_min, _max];
              return [wantStartSec, wantEndSec];
            },
          },

          // ✅ 关键兜底：y 轴 min==max/极窄时扩展范围，避免“hover 有值但没线”
          y: {
            auto: true,
            range: (_u, min, max) => {
              if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];

              if (min === max) {
                const pad = min === 0 ? 1 : Math.abs(min) * 0.01;
                return [min - pad, max + pad];
              }

              const span = max - min;
              if (span > 0 && span < 1e-9) {
                const pad = Math.abs(min) * 0.01 + 1e-6;
                return [min - pad, max + pad];
              }

              return [min, max];
            },
          },
        },
        axes: [
          { stroke: "rgba(0,0,0,0.35)", grid: { show: true, stroke: "rgba(0,0,0,0.06)" }, values: fmt },
          { stroke: "rgba(0,0,0,0.35)", grid: { show: true, stroke: "rgba(0,0,0,0.06)" }, label: metric },
        ],
        series,
        hooks: {
          draw: [(u) => drawOverlays(u, overlaySet)],
          setCursor: [
            (u) => {
              const idx = u.cursor.idx;

              if (!syncingRef.current && idx != null) {
                syncingRef.current = true;
                for (const other of plotsRef.current) {
                  if (other === u) continue;
                  other.setCursor({ left: u.cursor.left, top: other.cursor.top });
                }
                syncingRef.current = false;
              }

              if (!props.onHover) return;
              if (idx == null || idx < 0) return props.onHover(null);

              const tsMs = model.xMs[idx];
              const values: Array<{ sensorId: string; metric: string; value: number }> = [];

              for (let si = 1; si < u.series.length; si++) {
                const v = u.data[si][idx];
                if (typeof v !== "number") continue;
                const sensorId = u.series[si].label ?? "";
                values.push({ sensorId, metric, value: v });
              }

              props.onHover({ ts: tsMs, values });
            },
          ],
        },
      };
    };

    // --- mount only when container has width, then force setSize on next frame ---
    for (let i = 0; i < model.panels.length; i++) {
      const host = panelsRef.current[i];
      if (!host) continue;

      const { metric, seriesDefs, data } = model.panels[i];
      const opts = makeOpts(metric, seriesDefs, panelHeight);

      const mount = () => {
        const w0 = Math.floor(host.getBoundingClientRect().width);
        const w = w0 > 0 ? w0 : 900; // fallback if first layout is 0
        opts.width = w;

        const p = new uPlot(opts, data as unknown as uPlot.AlignedData, host);
        plotsRef.current.push(p);

        requestAnimationFrame(() => {
          try {
            const w1 = Math.floor(host.getBoundingClientRect().width);
            if (w1 > 0) p.setSize({ width: w1, height: p.height });
          } catch {}
        });
      };

      if (Math.floor(host.getBoundingClientRect().width) <= 0) {
        requestAnimationFrame(mount);
      } else {
        mount();
      }
    }

    // ResizeObserver keep plots in sync
    const ros: ResizeObserver[] = [];
    const rafIds: number[] = [];

    for (let i = 0; i < model.panels.length; i++) {
      const wrap = panelsRef.current[i];
      const plot = plotsRef.current[i];
      if (!wrap || !plot) continue;

      let lastW = Math.floor(wrap.getBoundingClientRect().width);

      const ro = new ResizeObserver(() => {
        const rafId = window.requestAnimationFrame(() => {
          const w = Math.floor(wrap.getBoundingClientRect().width);
          if (w <= 0) return;
          if (w !== lastW) {
            lastW = w;
            plot.setSize({ width: w, height: plot.height });
          }
        });
        rafIds.push(rafId);
      });

      ro.observe(wrap);
      ros.push(ro);
    }

    return () => {
      for (const ro of ros) ro.disconnect();
      for (const id of rafIds) cancelAnimationFrame(id);
      for (const p of plotsRef.current) {
        try {
          p.destroy();
        } catch {}
      }
      plotsRef.current = [];
    };
  }, [model, overlaySet, props.onHover, props.range]);

  return (
    <div ref={rootRef} className="plotFrame" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {model.panels.map((p, idx) => (
        <div
          key={p.metric}
          ref={(el) => {
            if (el) panelsRef.current[idx] = el;
          }}
          style={{ width: "100%" }}
        />
      ))}
    </div>
  );
}

export default UPlotSeries;

function drawOverlays(u: uPlot, overlays: OverlaySegment[]): void {
  const ctx = u.ctx;
  ctx.save();

  for (const o of overlays) {
    const startSec = o.startTs / 1000;
    const endSec = o.endTs / 1000;
    const x0 = u.valToPos(startSec, "x", true);
    const x1 = u.valToPos(endSec, "x", true);

    if (o.kind === "drift_candidate" && endSec > startSec) {
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(left, u.bbox.top, right - left, u.bbox.height);
    } else {
      const x = x0;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, u.bbox.top);
      ctx.lineTo(x, u.bbox.top + u.bbox.height);
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.arc(x, u.bbox.top + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}