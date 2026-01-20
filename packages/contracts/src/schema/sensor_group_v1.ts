// GEOX/packages/contracts/src/schema/sensor_group_v1.ts

export type SensorGroupSubjectRef = {
  projectId: string;
  plotId?: string;
  blockId?: string;
};

export type SensorGroupV1 = {
  groupId: string;
  subjectRef: SensorGroupSubjectRef;
  sensors: string[]; // >= 2, unique
  createdAt: number; // unix ms
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function uniqNonEmptyStrings(xs: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    if (!isNonEmptyString(x)) continue;
    const t = x.trim();
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function isSensorGroupV1(x: unknown): x is SensorGroupV1 {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;

  if (!isNonEmptyString(o.groupId)) return false;

  if (typeof o.subjectRef !== "object" || o.subjectRef === null) return false;
  const s = o.subjectRef as Record<string, unknown>;
  if (!isNonEmptyString(s.projectId)) return false;
  if (s.plotId !== undefined && !isNonEmptyString(s.plotId)) return false;
  if (s.blockId !== undefined && !isNonEmptyString(s.blockId)) return false;

  if (!Array.isArray(o.sensors)) return false;
  const sensors = uniqNonEmptyStrings(o.sensors as unknown[]);
  if (sensors.length < 2) return false;

  if (typeof o.createdAt !== "number" || !Number.isInteger(o.createdAt)) return false;

  return true;
}