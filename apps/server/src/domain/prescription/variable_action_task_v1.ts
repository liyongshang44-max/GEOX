function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function buildVariableActionTaskPayloadV1(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  prescription: any;
  approval_request_id: string;
  operation_plan_id: string;
  actor_id: string;
  device_id: string;
  now_ts_ms: number;
}): {
  tenant_id: string;
  project_id: string;
  group_id: string;
  operation_plan_id: string;
  approval_request_id: string;
  field_id: string;
  season_id?: string | null;
  device_id: string;
  issuer: { kind: "human"; id: string; namespace: string };
  action_type: "IRRIGATE";
  target: { kind: "field"; ref: string };
  time_window: { start_ts: number; end_ts: number };
  parameter_schema: {
    keys: Array<{
      name: string;
      type: "number";
      min?: number;
      max?: number;
    }>;
  };
  parameters: {
    duration_sec: number;
    duration_min: number;
    amount: number;
    coverage_percent: number;
  };
  constraints: Record<string, number | string | boolean>;
  meta: Record<string, any>;
} {
  const prescription = input.prescription ?? {};
  const operationType = asText(prescription.operation_type).toUpperCase();
  if (operationType !== "IRRIGATION") {
    throw new Error("VARIABLE_PRESCRIPTION_ONLY_SUPPORTS_IRRIGATION");
  }

  const operationAmount = (prescription.operation_amount && typeof prescription.operation_amount === "object")
    ? prescription.operation_amount
    : {};
  const mode = asText(operationAmount.mode).toUpperCase();
  if (mode !== "VARIABLE_BY_ZONE") {
    throw new Error("VARIABLE_PRESCRIPTION_MODE_REQUIRED");
  }

  const zoneRatesRaw = Array.isArray(operationAmount.zone_rates) ? operationAmount.zone_rates : [];
  if (zoneRatesRaw.length < 1) {
    throw new Error("VARIABLE_PRESCRIPTION_ZONE_RATES_REQUIRED");
  }

  const variableRateRequired = Boolean(prescription?.device_requirements?.variable_rate_required);
  if (!variableRateRequired) {
    throw new Error("VARIABLE_RATE_DEVICE_REQUIREMENT_REQUIRED");
  }

  const amount = zoneRatesRaw.reduce((sum, zoneRate) => {
    const plannedAmount = asPositiveNumber(zoneRate?.planned_amount);
    if (plannedAmount == null) throw new Error("VARIABLE_PRESCRIPTION_AMOUNT_INVALID");
    return sum + plannedAmount;
  }, 0);
  if (!(amount > 0)) {
    throw new Error("VARIABLE_PRESCRIPTION_AMOUNT_INVALID");
  }

  const now = Number.isFinite(input.now_ts_ms) ? input.now_ts_ms : Date.now();
  const field_id = asText(prescription.field_id);

  const sanitizedZoneRates = zoneRatesRaw.map((zoneRate) => ({
    zone_id: asText(zoneRate?.zone_id),
    operation_type: asText(zoneRate?.operation_type).toUpperCase(),
    planned_amount: Number(zoneRate?.planned_amount ?? 0),
    unit: asText(zoneRate?.unit),
    priority: asText(zoneRate?.priority).toUpperCase() || undefined,
    reason_codes: Array.isArray(zoneRate?.reason_codes) ? zoneRate.reason_codes.map((x: unknown) => String(x)).filter(Boolean) : [],
    source_refs: Array.isArray(zoneRate?.source_refs) ? zoneRate.source_refs.map((x: unknown) => String(x)).filter(Boolean) : [],
  }));

  return {
    tenant_id: asText(input.tenant_id),
    project_id: asText(input.project_id),
    group_id: asText(input.group_id),
    operation_plan_id: asText(input.operation_plan_id),
    approval_request_id: asText(input.approval_request_id),
    field_id,
    season_id: prescription.season_id == null ? null : asText(prescription.season_id),
    device_id: asText(input.device_id),
    issuer: {
      kind: "human",
      id: asText(input.actor_id),
      namespace: "variable_action_task_v1",
    },
    action_type: "IRRIGATE",
    target: { kind: "field", ref: field_id },
    time_window: {
      start_ts: now,
      end_ts: now + (30 * 60 * 1000),
    },
    parameter_schema: {
      keys: [
        { name: "duration_sec", type: "number", min: 1, max: 7200 },
        { name: "duration_min", type: "number", min: 1, max: 720 },
        { name: "amount", type: "number", min: 1, max: 100000 },
        { name: "coverage_percent", type: "number", min: 0, max: 100 },
      ],
    },
    parameters: {
      duration_sec: 1200,
      duration_min: 20,
      amount,
      coverage_percent: 95,
    },
    constraints: {
  approval_required: true,
  variable_rate_required: true,
  zone_count: sanitizedZoneRates.length,
},
    meta: {
      prescription_id: asText(prescription.prescription_id),
      recommendation_id: asText(prescription.recommendation_id),
      operation_type: operationType,
      device_id: asText(input.device_id),
      device_requirements: prescription.device_requirements ?? {},
      variable_plan: {
        mode: "VARIABLE_BY_ZONE",
        zone_rates: sanitizedZoneRates,
      },

      zone_count: sanitizedZoneRates.length,
    },
  };
}
