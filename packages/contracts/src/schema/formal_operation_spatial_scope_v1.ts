export type FormalOperationSpatialScopeKindV1 =
  | "field"
  | "management_zone"
  | "prescription_zone"
  | "device_affected_fields"
  | "aggregate_only";

export type FormalOperationSpatialScopeV1 = {
  kind: FormalOperationSpatialScopeKindV1;
  field_id?: string | null;
  field_ids?: string[] | null;
  zone_id?: string | null;
  source: string;
};

export const FORMAL_OPERATION_BOUND_SPATIAL_SCOPE_KINDS_V1 = [
  "field",
  "management_zone",
  "prescription_zone",
  "device_affected_fields"
] as const;

export const FORMAL_OPERATION_UNBOUND_SPATIAL_SCOPE_KIND_V1 = "aggregate_only" as const;

export const FORMAL_OPERATION_NEEDS_FIELD_BINDING_ERROR_V1 = "NEEDS_FIELD_BINDING" as const;

export function hasFormalOperationFieldBindingV1(scope: FormalOperationSpatialScopeV1 | null | undefined): boolean {
  if (!scope) return false;
  if (scope.kind === "aggregate_only") return false;
  if (typeof scope.field_id === "string" && scope.field_id.trim().length > 0 && scope.field_id.trim() !== "...") return true;
  if (Array.isArray(scope.field_ids) && scope.field_ids.some((fieldId) => typeof fieldId === "string" && fieldId.trim().length > 0 && fieldId.trim() !== "...")) return true;
  return false;
}
