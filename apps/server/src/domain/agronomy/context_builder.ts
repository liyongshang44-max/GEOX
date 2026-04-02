import { resolveCropStage } from "./stage_resolver";
import type { AgronomyContext } from "./types";

export async function buildAgronomyContext(input: {
  tenantId: string;
  projectId: string;
  groupId: string;
  fieldId: string;
  seasonId?: string;
  programId?: string;
  cropCode: string;
  startDate: string | number | Date;
  currentMetrics?: {
    soil_moisture?: number | null;
    temperature?: number | null;
    humidity?: number | null;
  };
  constraints?: Record<string, unknown>;
}): Promise<AgronomyContext> {
  const cropStage = resolveCropStage({
    cropCode: input.cropCode,
    startDate: input.startDate,
  });

  return {
    tenantId: input.tenantId,
    projectId: input.projectId,
    groupId: input.groupId,
    fieldId: input.fieldId,
    seasonId: input.seasonId,
    programId: input.programId,
    cropCode: input.cropCode,
    cropStage,
    currentMetrics: {
      soil_moisture: input.currentMetrics?.soil_moisture ?? null,
      temperature: input.currentMetrics?.temperature ?? null,
      humidity: input.currentMetrics?.humidity ?? null,
    },
    constraints: input.constraints ?? {},
  };
}
