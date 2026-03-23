export function buildGeoMetrics(telemetry: Record<string, any>): {
  trackPointCount: number;
  inFieldCount: number;
  inFieldRatio: number;
} {
  const track = Array.isArray(telemetry.track_points) ? telemetry.track_points : [];
  const fieldPolygon = telemetry.field_polygon as any;

  const toRings = (geo: any): Array<Array<[number, number]>> => {
    if (!geo || typeof geo !== "object") return [];
    const type = String(geo.type ?? "");
    if (type === "Feature") return toRings(geo.geometry);
    if (type === "Polygon") {
      return (Array.isArray(geo.coordinates) ? geo.coordinates : [])
        .map((r: any) => (Array.isArray(r) ? r.map((pt: any) => [Number(pt[0]), Number(pt[1])] as [number, number]) : []))
        .filter((r: any) => r.length >= 3);
    }
    if (type === "MultiPolygon") {
      return (Array.isArray(geo.coordinates) ? geo.coordinates : []).flatMap((poly: any) =>
        toRings({ type: "Polygon", coordinates: poly })
      );
    }
    return [];
  };

  const pointInRing = (lon: number, lat: number, ring: Array<[number, number]>): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const rings = toRings(fieldPolygon);
  const pointInsidePolygon = (p: any) => rings.some((ring) => pointInRing(Number(p?.lon), Number(p?.lat), ring));
  let inFieldCount = track.filter((p: any) => pointInsidePolygon(p)).length;

  if (rings.length === 0 && track.length > 0) {
    inFieldCount = track.length;
  } else if (inFieldCount === 0 && rings.length > 0 && track.length > 0) {
    const xs = rings.flat().map((pt) => Number(pt[0]));
    const ys = rings.flat().map((pt) => Number(pt[1]));
    if (xs.length > 0 && ys.length > 0) {
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      inFieldCount = track.filter((p: any) => {
        const lon = Number(p?.lon), lat = Number(p?.lat);
        return Number.isFinite(lon) && Number.isFinite(lat) && lon >= minX && lon <= maxX && lat >= minY && lat <= maxY;
      }).length;
    }
  }

  const trackPointCount = track.length;
  const inFieldRatio = trackPointCount > 0 ? inFieldCount / trackPointCount : 0;
  return { trackPointCount, inFieldCount, inFieldRatio };
}
