export type ActuatorAdapterCapabilityV1 = {
  type: "actuator_adapter_capability_v1";
  schema_version: "1.0.0";
  adapter_id: string;
  adapter_version: string;
  actions: string[];
  supports_simulation: boolean;
  tenant_id?: string | null;
};

export type ActuatorDispatchRequestV1 = {
  type: "actuator_dispatch_request_v1";
  schema_version: "1.0.0";
  tenant_id: string;
  field_id?: string | null;
  device_id?: string | null;
  task_id: string;
  recommendation_id?: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
};

export type ActuatorReceiptV1 = {
  type: "actuator_receipt_v1";
  schema_version: "1.0.0";
  tenant_id: string;
  task_id: string;
  accepted: boolean;
  rejected_reason?: string | null;
  executed_ts?: string | null;
  result_summary?: string | null;
  evidence_refs?: string[];
};
