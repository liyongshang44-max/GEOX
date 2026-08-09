// apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts
// Purpose: freeze the Amendment-05 External Formal Evidence binding identities and soil observation authority as an additive Runtime profile.
// Boundary: constants/types only; no Evidence fetch, canonicalization, persistence, Runtime execution, clock, environment, filesystem or network.

export const MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1 =
  "kbs_lter_variate25_vwc_100mm_v1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1 =
  "kbs_lter_raw_hourly_rain_mm_v1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1 =
  "kbs_lter_asce_short_reference_et_hourly_v1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1 =
  "noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1 =
  "noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1 =
  "POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_FORCING_BINDING_IDS_V1 = [
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
] as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_ALL_BINDING_IDS_V1 = [
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
] as const;

export type ExternalFormalEvidenceBindingProfileV1 = {
  profile_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1;
  soil_moisture_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  observed_rainfall_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1;
  historical_et0_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1;
  future_weather_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1;
  future_et0_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  soil_observation_operator_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1;
  soil_measurement_depth_mm: 100;
  soil_spatial_support: "NEAR_SITE_POINT_SUPPORT";
  soil_direct_state_equivalence: false;
  soil_direct_field_equivalence: false;
  soil_direct_root_zone_equivalence: false;
  soil_root_zone_representativeness: "PARTIAL";
  model_parameter_authority: "MODEL_PRIOR_FROM_CAP08";
  field_calibration_status: "NOT_FIELD_CALIBRATED";
};

export const MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_V1:
ExternalFormalEvidenceBindingProfileV1 = Object.freeze({
  profile_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1,
  soil_moisture_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  observed_rainfall_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  historical_et0_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  future_weather_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  future_et0_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  soil_observation_operator_id:
    MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
  soil_measurement_depth_mm: 100,
  soil_spatial_support: "NEAR_SITE_POINT_SUPPORT",
  soil_direct_state_equivalence: false,
  soil_direct_field_equivalence: false,
  soil_direct_root_zone_equivalence: false,
  soil_root_zone_representativeness: "PARTIAL",
  model_parameter_authority: "MODEL_PRIOR_FROM_CAP08",
  field_calibration_status: "NOT_FIELD_CALIBRATED",
});
