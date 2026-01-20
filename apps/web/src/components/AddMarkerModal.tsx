// GEOX/apps/web/src/components/AddMarkerModal.tsx
import React, { useMemo, useState } from "react";
import { isMarkerKind, MARKER_KIND_ALLOWLIST } from "../lib/contracts";
import { postMarker } from "../lib/api";

export default function AddMarkerModal(props: {
  sensors: string[];
  onClose: () => void;
  onCreated: () => void;
}): React.ReactElement {
  const [sensorId, setSensorId] = useState<string>(props.sensors[0] ?? "");
  const [type, setType] = useState<string>("device_fault");
  const [note, setNote] = useState<string>("");
  const [ts, setTs] = useState<number>(Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const markerTypes = useMemo(() => MARKER_KIND_ALLOWLIST.slice(), []);

  async function submit(): Promise<void> {
    setErr(null);
    if (!sensorId) return setErr("sensorId required");
    if (!isMarkerKind(type)) return setErr("type not allowed");
    if (!Number.isFinite(ts) || !Number.isInteger(ts)) return setErr("ts invalid");
    setBusy(true);
    try {
      await postMarker({
        ts,
        sensorId,
        type,
        note: note.trim() ? note.trim() : null,
        source: "gateway",
      });
      props.onCreated();
      props.onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request failed";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modalBack" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHeader">
          <div>
            <div className="h3">Add Marker</div>
            <div className="hint">Creates a marker record via POST /api/marker.</div>
          </div>
          <button className="btn" onClick={props.onClose}>Close</button>
        </div>

        <div className="modalBody">
          <div className="row">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div className="muted">sensorId</div>
              <select className="select" value={sensorId} onChange={(e) => setSensorId(e.target.value)}>
                {props.sensors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 220 }}>
              <div className="muted">type</div>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {markerTypes.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="muted">ts (unix ms)</div>
            <input
              className="input mono"
              value={String(ts)}
              onChange={(e) => setTs(Number(e.target.value))}
              placeholder="unix ms"
            />
            <div className="hint">Default is current time. This is a timestamp field only.</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="muted">note</div>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="neutral description (no conclusions)"
            />
          </div>

          {err ? <div className="error">{err}</div> : null}

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={props.onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
