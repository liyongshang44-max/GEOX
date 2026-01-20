// GEOX/apps/web/src/components/StateWindowsTrack.tsx
import React, { useMemo, useState } from "react";
import type { StateWindow } from "../lib/state_windows";
import { fmtTs } from "../lib/time";

function colorFor(label: StateWindow["label"]): string {
  // Strongest visual layer: high contrast, but neutral.
  switch (label) {
    case "检测到局部异常，未计入趋势":
      return "rgba(220, 38, 38, 0.24)";
    case "地下状态已发生明显偏移":
      return "rgba(59, 130, 246, 0.24)";
    case "地下状态已发生明显偏移，冠层尚未出现回应":
      return "rgba(234, 179, 8, 0.28)";
    case "当前变化仍在自然波动区间内":
      return "rgba(16, 185, 129, 0.20)";
    default:
      return "rgba(15, 23, 42, 0.10)";
  }
}

export default function StateWindowsTrack(props: {
  windows: StateWindow[];
  range: { startTs: number; endTs: number };
  cursorTs?: number | null;
}): React.ReactElement {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const items = useMemo(() => {
    const span = Math.max(1, props.range.endTs - props.range.startTs);
    return props.windows.map((w) => {
      const left = ((w.startTs - props.range.startTs) / span) * 100;
      const width = ((w.endTs - w.startTs) / span) * 100;
      return { w, left, width };
    });
  }, [props.windows, props.range.startTs, props.range.endTs]);

  const hovered = hoverIdx == null ? null : items[hoverIdx]?.w ?? null;

  return (
    <div className="trackCard">
      <div className="trackHeader">
        <div className="h3">State Windows</div>
        <div className="muted mono">{fmtTs(props.range.startTs)} → {fmtTs(props.range.endTs)}</div>
      </div>

      <div className="track" style={{ height: 92 }}>
        {props.cursorTs != null && props.cursorTs >= props.range.startTs && props.cursorTs <= props.range.endTs ? (
          <div
            className="cursorLine"
            style={{ left: `${((props.cursorTs - props.range.startTs) / Math.max(1, props.range.endTs - props.range.startTs)) * 100}%` }}
          />
        ) : null}
        {items.map((it, idx) => (
          <div
            key={`${it.w.startTs}-${it.w.endTs}-${idx}`}
            className="trackSeg"
            style={{ left: `${it.left}%`, width: `${it.width}%`, background: colorFor(it.w.label) }}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx((prev) => (prev === idx ? null : prev))}
            title={it.w.label}
          >
            <div className="trackSegLabel">{it.w.label}</div>
          </div>
        ))}
      </div>

      {hovered ? (
        <div className="trackHover">
          <div className="mono">{fmtTs(hovered.startTs)} → {fmtTs(hovered.endTs)}</div>
          <div className="row" style={{ marginTop: 6, gap: 10, flexWrap: "wrap" }}>
            <div className="pill"><span className="muted">groupId</span><span className="mono">{hovered.meta?.groupId ?? ""}</span></div>
            <div className="pill"><span className="muted">metric</span><span className="mono">{hovered.meta?.metric ?? "(all)"}</span></div>
            <div className="pill"><span className="muted">source</span><span className="mono">{hovered.meta?.source ?? ""}</span></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
