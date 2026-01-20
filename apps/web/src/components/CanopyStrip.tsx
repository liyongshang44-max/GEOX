// GEOX/apps/web/src/components/CanopyStrip.tsx
import React, { useMemo, useState } from "react";
import type { CanopyFrameV1 } from "@geox/contracts";
import { fmtTs } from "../lib/time";
import { withMediaBase } from "../lib/api";

function thumbUrl(frame: CanopyFrameV1): string {
  return withMediaBase(frame.url);
}

export default function CanopyStrip(props: {
  frames: CanopyFrameV1[];
  onJumpToTs?: (ts: number) => void;
}): React.ReactElement {
  const frames = useMemo(() => props.frames.slice().sort((a, b) => a.ts - b.ts), [props.frames]);
  const [active, setActive] = useState<CanopyFrameV1 | null>(null);

  return (
    <div className="canopyCard">
      <div className="trackHeader">
        <div className="h3">Canopy Frames</div>
        <div className="muted">/api/canopy/frames</div>
      </div>

      <div className="canopyStrip">
        {frames.length === 0 ? (
          <div className="muted">(empty)</div>
        ) : (
          frames.map((f) => (
            <button
              key={f.frameId}
              className="canopyThumb"
              onClick={() => {
                setActive(f);
                props.onJumpToTs?.(f.ts);
              }}
              title={fmtTs(f.ts)}
            >
              <img src={thumbUrl(f)} alt={String(f.frameId)} loading="lazy" />
              <div className="canopyTs mono">{fmtTs(f.ts)}</div>
            </button>
          ))
        )}
      </div>

      {active ? (
        <div className="modalBack" role="dialog" aria-modal="true" onClick={() => setActive(null)}>
          <div className="modal" style={{ maxWidth: 980 }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div className="h3">Frame {active.frameId}</div>
                <div className="muted mono">{fmtTs(active.ts)} · {active.cameraId} · {active.source}</div>
              </div>
              <button className="btn" onClick={() => setActive(null)}>Close</button>
            </div>
            <div className="modalBody" style={{ paddingTop: 10 }}>
              <img src={thumbUrl(active)} alt={String(active.frameId)} style={{ width: "100%", borderRadius: 12 }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
