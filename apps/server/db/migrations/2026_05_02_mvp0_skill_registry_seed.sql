-- Seed MVP-0 formal skill contracts into existing facts-backed skill registry.
WITH seed_rows AS (
  SELECT
    gen_random_uuid() AS fact_id,
    now()::timestamptz AS occurred_at,
    'db/migration/2026_05_02_mvp0_skill_registry_seed'::text AS source,
    jsonb_build_object(
      'type','skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id','tenantA','project_id','projectA','group_id','groupA',
        'skill_id','irrigation_deficit_skill_v1','version','v1','skill_version','v1',
        'display_name','Irrigation Deficit Skill v1',
        'category','AGRONOMY','skill_category','agronomy','status','ACTIVE',
        'trigger_stage','after_recommendation','scope_type','FIELD','rollout_mode','all',
        'input_schema_digest','mvp0-irrigation-deficit-in-v1','output_schema_digest','mvp0-irrigation-deficit-out-v1',
        'input_schema_ref','geox.schema.agronomy.irrigation_deficit.input.v1',
        'output_schema_ref','geox.schema.agronomy.irrigation_deficit.output.v1',
        'capabilities',jsonb_build_array('irrigation_deficit_detection'),
        'risk_level','MEDIUM',
        'required_evidence',jsonb_build_array('soil_moisture','field_id','crop_stage_or_crop_code'),
        'tenant_scope',jsonb_build_array('*'),'crop_scope',jsonb_build_array('*'),'device_scope','[]'::jsonb,
        'binding_priority',100,'enabled',true,
        'binding_conditions',jsonb_build_object('operation_type','IRRIGATION','recommendation_action','IRRIGATE'),
        'fallback_policy',jsonb_build_object('mode','static_default','reason','manual agronomy review required if evidence is insufficient'),
        'audit_policy',jsonb_build_object('level','standard','include_input_snapshot',true,'include_output_snapshot',true)
      )
    ) AS record_json
  UNION ALL
  SELECT
    gen_random_uuid(), now()::timestamptz, 'db/migration/2026_05_02_mvp0_skill_registry_seed',
    jsonb_build_object(
      'type','skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id','tenantA','project_id','projectA','group_id','groupA',
        'skill_id','mock_valve_control_skill_v1','version','v1','skill_version','v1',
        'display_name','Mock Valve Control Skill v1',
        'category','DEVICE','skill_category','device','status','ACTIVE',
        'trigger_stage','before_acceptance','scope_type','DEVICE','rollout_mode','all',
        'input_schema_digest','mvp0-mock-valve-in-v1','output_schema_digest','mvp0-mock-valve-out-v1',
        'input_schema_ref','geox.schema.device.mock_valve.input.v1',
        'output_schema_ref','geox.schema.device.mock_valve.output.v1',
        'capabilities',jsonb_build_array('valve_open_close_mock','device.irrigation.valve.open'),
        'risk_level','LOW',
        'required_evidence',jsonb_build_array('approval_id','task_id','field_id','device_id'),
        'tenant_scope',jsonb_build_array('*'),'crop_scope',jsonb_build_array('*'),'device_scope',jsonb_build_array('mock_valve','irrigation_simulator'),
        'binding_priority',100,'enabled',true,
        'binding_conditions',jsonb_build_object('operation_type','IRRIGATION','device_type','IRRIGATION_CONTROLLER','adapter_type','irrigation_simulator'),
        'fallback_policy',jsonb_build_object('mode','static_default','reason','fallback to manual execution if mock valve execution is blocked'),
        'audit_policy',jsonb_build_object('level','standard','include_input_snapshot',true,'include_output_snapshot',true)
      )
    )
  UNION ALL
  SELECT
    gen_random_uuid(), now()::timestamptz, 'db/migration/2026_05_02_mvp0_skill_registry_seed',
    jsonb_build_object(
      'type','skill_binding_v1',
      'payload', jsonb_build_object(
        'tenant_id','tenantA','project_id','projectA','group_id','groupA',
        'binding_id','bind_mock_valve_control_default_v1',
        'skill_id','mock_valve_control_skill_v1','version','v1',
        'category','DEVICE','status','ACTIVE',
        'scope_type','DEVICE','rollout_mode','DIRECT','trigger_stage','before_dispatch',
        'bind_target','irrigation_simulator',
        'device_type','IRRIGATION_CONTROLLER',
        'priority',100,
        'config_patch',jsonb_build_object(
          'action_type','IRRIGATE',
          'adapter_type','irrigation_simulator',
          'required_capabilities',jsonb_build_array('device.irrigation.valve.open')
        )
      )
    )
)
INSERT INTO facts (fact_id, occurred_at, source, record_json)
SELECT s.fact_id, s.occurred_at, s.source, s.record_json
FROM seed_rows s
WHERE NOT EXISTS (
  SELECT 1
  FROM facts f
  WHERE (f.record_json::jsonb#>>'{payload,tenant_id}') = 'tenantA'
    AND (f.record_json::jsonb#>>'{payload,project_id}') = 'projectA'
    AND (f.record_json::jsonb#>>'{payload,group_id}') = 'groupA'
    AND (
      (
        (s.record_json::jsonb->>'type') = 'skill_definition_v1'
        AND (f.record_json::jsonb->>'type') = 'skill_definition_v1'
        AND (f.record_json::jsonb#>>'{payload,skill_id}') = (s.record_json::jsonb#>>'{payload,skill_id}')
        AND (f.record_json::jsonb#>>'{payload,version}') = (s.record_json::jsonb#>>'{payload,version}')
      )
      OR
      (
        (s.record_json::jsonb->>'type') = 'skill_binding_v1'
        AND (f.record_json::jsonb->>'type') = 'skill_binding_v1'
        AND (f.record_json::jsonb#>>'{payload,binding_id}') = (s.record_json::jsonb#>>'{payload,binding_id}')
      )
    )
);
