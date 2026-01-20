// GEOX/packages/contracts/src/schema/canopy_frame_v1.ts
export type CanopySubjectRefV1 = {
  projectId: string;
  plotId?: string;
  blockId?: string;
};

export type CanopyFrameV1 = {
  frameId: number;
  ts: number; // unix ms
  subjectRef: CanopySubjectRefV1;
  cameraId: string;
  storageKey: string; // relative key under /media
  url: string; // readable URL, e.g. /media/...
  note?: string | null;
  source: "device" | "gateway" | "system";
  ingestedAt: number; // unix ms
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function isCanopySubjectRefV1(x: unknown): x is CanopySubjectRefV1 {
  if (!isRecord(x)) return false;
  if (typeof x.projectId !== "string" || x.projectId.length === 0) return false;
  if (x.plotId !== undefined && typeof x.plotId !== "string") return false;
  if (x.blockId !== undefined && typeof x.blockId !== "string") return false;
  return true;
}

export function isCanopyFrameV1(x: unknown): x is CanopyFrameV1 {
  if (!isRecord(x)) return false;
  if (!isFiniteNumber(x.frameId)) return false;
  if (!isFiniteNumber(x.ts)) return false;
  if (!isCanopySubjectRefV1(x.subjectRef)) return false;
  if (typeof x.cameraId !== "string" || x.cameraId.length === 0) return false;
  if (typeof x.storageKey !== "string" || x.storageKey.length === 0) return false;
  if (typeof x.url !== "string" || x.url.length === 0) return false;
  if (x.note !== undefined && x.note !== null && typeof x.note !== "string") return false;
  if (x.source !== "device" && x.source !== "gateway" && x.source !== "system") return false;
  if (!isFiniteNumber(x.ingestedAt)) return false;
  return true;
}