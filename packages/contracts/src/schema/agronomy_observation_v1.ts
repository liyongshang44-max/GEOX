export type AgronomyObservationTypeV1 = "DISEASE_SPOT" | "PEST" | "CROP_VIGOR" | "LODGING" | "MISSING_SEEDLINGS";
export type AgronomyMediaTypeV1 = "LEAF_IMAGE" | "FIELD_IMAGE" | "FIELD_VIDEO" | "UAV_SCOUT_IMAGE" | "UAV_SCOUT_VIDEO";
export type AgronomyDeviceTypeV1 = "UAV" | "MOBILE_CAMERA" | "FIELD_CAMERA" | "SCOUT_TERMINAL" | "IOT_GATEWAY";
export type AgronomySourceTypeV1 = "HUMAN_SCOUT" | "DRONE_PATROL" | "DEVICE_AUTO_CAPTURE" | "SYSTEM_IMPORT" | "THIRD_PARTY";

export type AgronomyObservationV1 = {
  type: "agronomy_observation_v1";
  schema_version: "1.0.0";
  occurred_at: string;
  entity: {
    tenant_id: string;
    field_id: string;
    season_id?: string | null;
    observation_id: string;
    telemetry_id?: string | null;
    media_id: string;
  };
  payload: {
    observation_type: AgronomyObservationTypeV1;
    severity?: number | null;
    confidence?: number | null;
    note?: string | null;
    observation_object: {
      disease_spot: boolean;
      pest: boolean;
      crop_vigor: boolean;
      lodging: boolean;
      missing_seedlings: boolean;
    };
    media: {
      media_key: string;
      mime: string;
      filename: string;
      media_type: AgronomyMediaTypeV1;
    };
    source: {
      source_type: AgronomySourceTypeV1;
      source_id?: string | null;
      device_type: AgronomyDeviceTypeV1;
      device_id?: string | null;
    };
    associations: {
      field_id: string;
      season_id?: string | null;
      telemetry_id?: string | null;
      media_key: string;
    };
  };
  refs: {
    media_url: string;
  };
};
