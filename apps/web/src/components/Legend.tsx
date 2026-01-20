// GEOX/apps/web/src/components/Legend.tsx
import React, { useMemo } from "react";

export type LegendItem = {
  key: string;
  label: string;
  color?: string;
};

export function Legend(props:
  | { title?: string; items: LegendItem[] }
  | { title?: string; metrics: string[]; sensors: string[] }
): React.ReactElement {
  const title = (props as any).title ?? "Legend";

  const items: LegendItem[] = useMemo(() => {
    // 新用法：直接 items
    if ("items" in props) return props.items ?? [];

    // 兼容用法：metrics + sensors
    const metrics = props.metrics ?? [];
    const sensors = props.sensors ?? [];
    const out: LegendItem[] = [];
    for (const m of metrics) {
      for (const s of sensors) {
        out.push({ key: `${s}::${m}`, label: `${s} • ${m}` });
      }
    }
    return out;
  }, [props]);

  return (
    <div className="legendCard">
      <div className="legendHeader">
        <div className="h3">{title}</div>
      </div>

      <div className="legendBody" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {items.length === 0 ? <div className="muted">No legend items.</div> : null}

        {items.map((it) => (
          <div key={it.key} className="pill" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: it.color ?? "rgba(0,0,0,0.35)",
                display: "inline-block",
              }}
            />
            <span className="mono">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}