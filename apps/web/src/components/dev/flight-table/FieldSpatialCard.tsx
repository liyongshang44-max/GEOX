import React from "react";
import type { CreateFlightTableGeometryResponseV1, FlightTableWeatherLocationV1 } from "../../../api/flightTable";

export type FieldSpatialDraftV1 = {
  field_id: string;
  geometryText: string;
  weatherLat: string;
  weatherLng: string;
};

type Props = {
  geometryId?: string | null;
  fieldId?: string | null;
  draft: FieldSpatialDraftV1;
  geometryResult: CreateFlightTableGeometryResponseV1 | null;
  loading: boolean;
  error: string | null;
  onDraftChange: (patch: Partial<FieldSpatialDraftV1>) => void;
  onSubmitGeometry: () => void;
};

const FIELD_POLYGON_FIXTURE = {
  type: "Polygon",
  coordinates: [[
    [121.5669, 31.2339],
    [121.5682, 31.2341],
    [121.5680, 31.2351],
    [121.5667, 31.2349],
    [121.5669, 31.2339],
  ]],
};

function readCoordinatePairs(raw: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(raw)) return;
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
    out.push([Number(raw[0]), Number(raw[1])]);
    return;
  }
  for (const item of raw) readCoordinatePairs(item, out);
}

function unwrapGeometry(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type === "Feature") return unwrapGeometry(obj.geometry);
  if (obj.type === "FeatureCollection") {
    const features = Array.isArray(obj.features) ? obj.features : [];
    for (const feature of features) {
      const geometry = unwrapGeometry(feature);
      if (geometry) return geometry;
    }
    return null;
  }
  if ((obj.type === "Polygon" || obj.type === "MultiPolygon") && Array.isArray(obj.coordinates)) return obj;
  return null;
}

function previewPointsFromText(text: string): string | null {
  try {
    const parsed = JSON.parse(text);
    const geometry = unwrapGeometry(parsed);
    if (!geometry) return null;
    const points: Array<[number, number]> = [];
    readCoordinatePairs((geometry as any).coordinates, points);
    if (points.length < 3) return null;
    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const width = Math.max(0.000001, maxLon - minLon);
    const height = Math.max(0.000001, maxLat - minLat);
    return points
      .map(([lon, lat]) => {
        const x = 20 + ((lon - minLon) / width) * 260;
        const y = 180 - ((lat - minLat) / height) * 140;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  } catch {
    return null;
  }
}

function weatherLocationText(location: FlightTableWeatherLocationV1 | null | undefined): string {
  if (!location) return "未接入";
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}

export default function FieldSpatialCard(props: Props): React.ReactElement {
  const { geometryId, fieldId, draft, geometryResult, loading, error } = props;
  const points = previewPointsFromText(draft.geometryText);
  const status = geometryResult?.geometry_status ?? (geometryId ? "AVAILABLE" : "MISSING");

  const handleFile = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => props.onDraftChange({ geometryText: text }));
  }, [props]);

  return (
    <section className="flight-card flight-spatial-card">
      <div className="flight-card-head">
        <h3>田块空间 / GIS</h3>
        <span>{status}</span>
      </div>
      <p className="flight-muted">无 geometry 时展示空态，不伪造地图。weather provider/location 只展示真实返回状态。</p>
      <div className="flight-spatial-grid">
        <div className="flight-spatial-editor">
          <label><span>field_id</span><input value={draft.field_id} placeholder={fieldId ?? "ft_field_..."} onChange={(event) => props.onDraftChange({ field_id: event.target.value })} /></label>
          <label><span>weather lat</span><input value={draft.weatherLat} onChange={(event) => props.onDraftChange({ weatherLat: event.target.value })} /></label>
          <label><span>weather lng</span><input value={draft.weatherLng} onChange={(event) => props.onDraftChange({ weatherLng: event.target.value })} /></label>
          <div className="flight-actions flight-card-actions">
            <button type="button" onClick={() => props.onDraftChange({ geometryText: JSON.stringify(FIELD_POLYGON_FIXTURE, null, 2), weatherLat: "31.234567", weatherLng: "121.567890" })}>选择 GeoJSON fixture</button>
            <label className="flight-link-button">上传 GeoJSON<input type="file" accept=".json,.geojson,application/geo+json,application/json" onChange={handleFile} /></label>
          </div>
          <textarea value={draft.geometryText} onChange={(event) => props.onDraftChange({ geometryText: event.target.value })} spellCheck={false} placeholder="粘贴 GeoJSON Polygon / MultiPolygon" />
          <button type="button" className="flight-primary-button" onClick={props.onSubmitGeometry} disabled={loading || !fieldId}>写入田块空间</button>
          {error ? <p className="flight-error-text">{error}</p> : null}
        </div>
        <div>
          <div className="flight-map-preview">
            {points ? (
              <svg viewBox="0 0 300 200" role="img" aria-label="field polygon preview">
                <rect x="0" y="0" width="300" height="200" rx="14" />
                <polyline points={points} />
                <polygon points={points} />
              </svg>
            ) : (
              <div className="flight-empty-map">No geometry</div>
            )}
          </div>
          <dl className="flight-field-state">
            <dt>geometry_id</dt><dd>{geometryId ?? geometryResult?.geometry_id ?? "未写入"}</dd>
            <dt>geometry_status</dt><dd>{status}</dd>
            <dt>centroid</dt><dd>{geometryResult?.centroid ? `${geometryResult.centroid.lat.toFixed(6)}, ${geometryResult.centroid.lng.toFixed(6)}` : "未计算"}</dd>
            <dt>area</dt><dd>{geometryResult?.area_mu != null ? `${geometryResult.area_mu} 亩` : (geometryResult?.area_m2 != null ? `${geometryResult.area_m2} m²` : "未计算")}</dd>
            <dt>weather location</dt><dd>{weatherLocationText(geometryResult?.weather_location)}</dd>
            <dt>weather provider</dt><dd>{geometryResult?.weather_provider_status ?? "UNAVAILABLE"}</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
