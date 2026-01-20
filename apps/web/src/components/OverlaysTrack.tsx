// GEOX/apps/web/src/components/OverlaysTrack.tsx
import React, { useMemo, useState } from "react";
import type { OverlaySegment } from "../lib/contracts";
import { fmtTs } from "../lib/time";

const KIND_ALLOW = new Set([
  "device_fault",
  "local_anomaly",
  "step_candidate",
  "drift_candidate",
]);

function isAllowedKind(kind: string): boolean {
  return KIND_ALLOW.has(kind);
}

export default function OverlaysTrack(props: {
  overlays: OverlaySegment[];
  range: { startTs: number; endTs: number };

  // ✅ 兼容：不传也不崩
  enabledKinds?: Record<string, boolean>;

  // ✅ 兼容：你页面传了 cursorTs
  cursorTs?: number | null;

  // ✅ 兼容：你页面传了 onSelectTs
  onSelectTs?: (ts: number) => void;
}): React.ReactElement {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const enabledKinds = props.enabledKinds ?? {};

  const visible = useMemo(() => {
    return props.overlays.filter((o) => isAllowedKind(o.kind) && enabledKinds[o.kind] !== false);
  }, [props.overlays, enabledKinds]);

  const items = useMemo(() => {
    const span = Math.max(1, props.range.endTs - props.range.startTs);
    return visible.map((o) => {
      const isPoint = o.endTs === o.startTs;
      const left = ((o.startTs - props.range.startTs) / span) * 100;
      const width = isPoint ? 0.6 : ((o.endTs - o.startTs) / span) * 100;
      return { o, isPoint, left, width: Math.max(0.6, width) };
    });
  }, [visible, props.range.startTs, props.range.endTs]);

  const hovered = hoverIdx == null ? null : items[hoverIdx]?.o ?? null;

  return (
    <div className="trackCard">
      <div className="trackHeader">
        <div className="h3">Overlays</div>
        <div className="muted">markers + derived candidates</div>
      </div>

      <div className="track" style={{ height: 54 }}>
        {props.cursorTs != null && props.cursorTs >= props.range.startTs && props.cursorTs <= props.range.endTs ? (
          <div
            className="cursorLine"
            style={{
              left: `${((props.cursorTs - props.range.startTs) / Math.max(1, props.range.endTs - props.range.startTs)) * 100}%`,
            }}
          />
        ) : null}

        {items.map((it, idx) => (
          <div
            key={`${it.o.kind}-${it.o.sensorId}-${it.o.startTs}-${idx}`}
            className={it.isPoint ? "overlayPoint" : "overlayBand"}
            style={{ left: `${it.left}%`, width: `${it.width}%` }}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx((prev) => (prev === idx ? null : prev))}
            onClick={() => props.onSelectTs?.(it.o.startTs)}
            title={it.o.kind}
          >
            <div className="overlayKind mono">{it.o.kind}</div>
          </div>
        ))}
      </div>

      {hovered ? (
        <div className="trackHover">
          <div className="mono">
            {fmtTs(hovered.startTs)}
            {hovered.endTs !== hovered.startTs ? ` → ${fmtTs(hovered.endTs)}` : ""}
          </div>
          <div className="row" style={{ marginTop: 6, gap: 10, flexWrap: "wrap" }}>
            <div className="pill">
              <span className="muted">kind</span>
              <span className="mono">{hovered.kind}</span>
            </div>
            <div className="pill">
              <span className="muted">sensorId</span>
              <span className="mono">{hovered.sensorId}</span>
            </div>
            <div className="pill">
              <span className="muted">metric</span>
              <span className="mono">{hovered.metric ?? "(none)"}</span>
            </div>
            <div className="pill">
              <span className="muted">source</span>
              <span className="mono">{hovered.source}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const OVERLAY_KIND_ALLOWLIST = Array.from(KIND_ALLOW);