import type { Pool } from "pg";

export type VariablePrescriptionModeV1 = "VARIABLE_BY_ZONE";

export type VariableZoneRateV1 = {
  zone_id: string;
  operation_type: "IRRIGATION" | "INSPECTION" | "SAMPLING";
  planned_amount: number;
  unit: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason_codes?: string[];
  source_refs?: string[];
};

export type VariablePrescriptionPlanV1 = {
  mode: VariablePrescriptionModeV1;
  zone_rates: VariableZoneRateV1[];
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function normalizeOperationType(value: unknown): VariableZoneRateV1["operation_type"] {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "IRRIGATION" || normalized === "INSPECTION" || normalized === "SAMPLING") {
    return normalized;
  }
  throw new Error("VARIABLE_OPERATION_TYPE_INVALID");
}

function normalizePriority(value: unknown): VariableZoneRateV1["priority"] | undefined {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return undefined;
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH" || normalized === "CRITICAL") {
    return normalized;
  }
  throw new Error("VARIABLE_PRIORITY_INVALID");
}

export function normalizeVariablePrescriptionPlanV1(input: unknown): VariablePrescriptionPlanV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("VARIABLE_PLAN_INVALID");
  }

  const raw = input as Record<string, unknown>;
  const mode = normalizeText(raw.mode).toUpperCase();
  if (mode !== "VARIABLE_BY_ZONE") {
    throw new Error("VARIABLE_PLAN_MODE_INVALID");
  }

  const zoneRatesRaw = raw.zone_rates;
  if (!Array.isArray(zoneRatesRaw) || zoneRatesRaw.length < 1) {
    throw new Error("VARIABLE_ZONE_RATES_EMPTY");
  }
  if (zoneRatesRaw.length > 50) {
    throw new Error("VARIABLE_ZONE_RATES_TOO_LARGE");
  }

  const seenZoneIds = new Set<string>();
  const zone_rates: VariableZoneRateV1[] = zoneRatesRaw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("VARIABLE_ZONE_RATE_INVALID");
    }
    const zoneRateRaw = item as Record<string, unknown>;
    const zone_id = normalizeText(zoneRateRaw.zone_id);
    if (!zone_id) throw new Error("VARIABLE_ZONE_ID_INVALID");
    if (seenZoneIds.has(zone_id)) throw new Error("VARIABLE_ZONE_ID_DUPLICATE");
    seenZoneIds.add(zone_id);

    const planned_amount = Number(zoneRateRaw.planned_amount);
    if (!Number.isFinite(planned_amount) || planned_amount <= 0) {
      throw new Error("VARIABLE_PLANNED_AMOUNT_INVALID");
    }

    const unit = normalizeText(zoneRateRaw.unit);
    if (!unit) throw new Error("VARIABLE_UNIT_INVALID");

    return {
      zone_id,
      operation_type: normalizeOperationType(zoneRateRaw.operation_type),
      planned_amount,
      unit,
      priority: normalizePriority(zoneRateRaw.priority),
      reason_codes: normalizeStringArray(zoneRateRaw.reason_codes),
      source_refs: normalizeStringArray(zoneRateRaw.source_refs),
    };
  });

  return { mode: "VARIABLE_BY_ZONE", zone_rates };
}

export async function validateVariablePrescriptionZonesV1(
  pool: Pool,
  input: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    variable_plan: VariablePrescriptionPlanV1;
  },
): Promise<void> {
  const tenant_id = normalizeText(input.tenant_id);
  const project_id = normalizeText(input.project_id);
  const group_id = normalizeText(input.group_id);
  const field_id = normalizeText(input.field_id);
  if (!tenant_id || !project_id || !group_id || !field_id) {
    throw new Error("MISSING_TENANT_SCOPE");
  }

  for (const zoneRate of input.variable_plan.zone_rates) {
    const zoneResult = await pool.query(
      `SELECT zone_id, tenant_id, project_id, group_id, field_id
         FROM management_zone_v1
        WHERE zone_id = $1
        LIMIT 1`,
      [zoneRate.zone_id],
    );

    if (!zoneResult.rows?.length) {
      throw new Error("MANAGEMENT_ZONE_NOT_FOUND");
    }

    const zone = zoneResult.rows[0];
    const zoneTenant = normalizeText(zone.tenant_id);
    const zoneProject = normalizeText(zone.project_id);
    const zoneGroup = normalizeText(zone.group_id);
    const zoneField = normalizeText(zone.field_id);

    if (zoneTenant !== tenant_id || zoneProject !== project_id || zoneGroup !== group_id) {
      throw new Error("MANAGEMENT_ZONE_NOT_FOUND");
    }
    if (zoneField !== field_id) {
      throw new Error("MANAGEMENT_ZONE_FIELD_MISMATCH");
    }
  }
}

export function buildVariableOperationAmountV1(input: {
  unit?: string | null;
  variable_plan: VariablePrescriptionPlanV1;
}): Record<string, unknown> {
  const preferredUnit = normalizeText(input.unit);
  const zoneUnits = new Set(input.variable_plan.zone_rates.map((zoneRate) => normalizeText(zoneRate.unit)).filter(Boolean));
  if (zoneUnits.size > 1) {
    throw new Error("VARIABLE_ZONE_UNIT_MISMATCH");
  }

  const unit = preferredUnit || input.variable_plan.zone_rates[0]?.unit || "unit";
  const amount = input.variable_plan.zone_rates.reduce((sum, zoneRate) => sum + Number(zoneRate.planned_amount), 0);

  return {
    amount,
    unit,
    mode: "VARIABLE_BY_ZONE",
    zone_rates: input.variable_plan.zone_rates.map((zoneRate) => ({
      zone_id: zoneRate.zone_id,
      operation_type: zoneRate.operation_type,
      planned_amount: zoneRate.planned_amount,
      unit: zoneRate.unit,
      priority: zoneRate.priority,
      reason_codes: Array.isArray(zoneRate.reason_codes) ? zoneRate.reason_codes : [],
      source_refs: Array.isArray(zoneRate.source_refs) ? zoneRate.source_refs : [],
    })),
    parameters: {
      mode: "VARIABLE_BY_ZONE",
    },
  };
}

export function buildVariableSpatialScopeV1(input: {
  field_boundary_ref?: string | null;
  variable_plan: VariablePrescriptionPlanV1;
}): Record<string, unknown> {
  return {
    mode: "MANAGEMENT_ZONE",
    field_boundary_ref: input.field_boundary_ref ?? null,
    zone_boundary_refs: input.variable_plan.zone_rates.map((zoneRate) => ({
      zone_id: zoneRate.zone_id,
      boundary_ref: `management_zone_v1:${zoneRate.zone_id}`,
    })),
  };
}
