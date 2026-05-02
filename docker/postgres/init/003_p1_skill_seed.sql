-- P1 minimum closed-loop seed: append demo skill definitions into facts.
-- Target tenant/project/group must match config/auth/example_tokens.json default dev token scope.
INSERT INTO facts (fact_id, occurred_at, source, record_json)
VALUES
  (
    'seed_skill_definition_v1_demo_soil_moisture_001',
    '2026-04-10T00:00:01Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'skill_id', 'soil_moisture_inference_v1',
        'version', '1.0.0',
        'category', 'sensing',
        'status', 'ACTIVE',
        'trigger_stage', 'before_recommendation',
        'scope_type', 'FIELD',
        'rollout_mode', 'DIRECT',
        'display_name', 'Soil Moisture Inference v1'
      )
    )
  ),
  (
    'seed_skill_definition_v1_demo_irrigation_001',
    '2026-04-10T00:00:02Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'skill_id', 'irrigation_advice_v1',
        'version', '1.0.0',
        'category', 'agronomy',
        'status', 'ACTIVE',
        'trigger_stage', 'after_recommendation',
        'scope_type', 'FIELD',
        'rollout_mode', 'DIRECT',
        'display_name', 'Irrigation Advice v1'
      )
    )
  ),
  (
    'seed_skill_definition_v1_demo_pump_safety_001',
    '2026-04-10T00:00:03Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'skill_id', 'pump_safety_guard_v1',
        'version', '1.0.0',
        'category', 'device',
        'status', 'ACTIVE',
        'trigger_stage', 'before_dispatch',
        'scope_type', 'DEVICE',
        'rollout_mode', 'GRADUAL',
        'display_name', 'Pump Safety Guard v1'
      )
    )
  ),
  (
    'seed_skill_definition_v1_demo_acceptance_001',
    '2026-04-10T00:00:04Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'skill_id', 'operation_acceptance_gate_v1',
        'version', '1.0.0',
        'category', 'acceptance',
        'status', 'ACTIVE',
        'trigger_stage', 'before_acceptance',
        'scope_type', 'TENANT',
        'rollout_mode', 'DIRECT',
        'display_name', 'Operation Acceptance Gate v1'
      )
    )
  )
ON CONFLICT (fact_id) DO NOTHING;

-- Same seed flow: append baseline skill bindings used by querySkillBindingProjectionV1 verification.
INSERT INTO facts (fact_id, occurred_at, source, record_json)
VALUES
  (
    'seed_skill_binding_v1_demo_soil_moisture_001',
    '2026-04-10T00:00:11Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_binding_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'binding_id', 'bind_soil_field_demo_001_v1',
        'skill_id', 'soil_moisture_inference_v1',
        'version', '1.0.0',
        'category', 'AGRONOMY',
        'status', 'ACTIVE',
        'scope_type', 'FIELD',
        'rollout_mode', 'DIRECT',
        'trigger_stage', 'before_recommendation',
        'bind_target', 'field_demo_001',
        'priority', 100,
        'config_patch', jsonb_build_object('threshold_low_pct', 22, 'window_minutes', 30)
      )
    )
  ),
  (
    'seed_skill_binding_v1_demo_irrigation_001',
    '2026-04-10T00:00:12Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_binding_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'binding_id', 'bind_irrigation_field_demo_001_v1',
        'skill_id', 'irrigation_advice_v1',
        'version', '1.0.0',
        'category', 'AGRONOMY',
        'status', 'ACTIVE',
        'scope_type', 'FIELD',
        'rollout_mode', 'DIRECT',
        'trigger_stage', 'after_recommendation',
        'bind_target', 'field_demo_001',
        'priority', 90,
        'config_patch', jsonb_build_object('max_irrigation_mm', 12, 'cooldown_hours', 6)
      )
    )
  ),
  (
    'seed_skill_binding_v1_demo_pump_safety_001',
    '2026-04-10T00:00:13Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_binding_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'binding_id', 'bind_pump_safety_device_demo_001_v1',
        'skill_id', 'pump_safety_guard_v1',
        'version', '1.0.0',
        'category', 'DEVICE',
        'status', 'ACTIVE',
        'scope_type', 'DEVICE',
        'rollout_mode', 'DIRECT',
        'trigger_stage', 'before_dispatch',
        'bind_target', 'device_demo_pump_001',
        'priority', 110,
        'config_patch', jsonb_build_object('pressure_upper_kpa', 380, 'min_cycle_sec', 25)
      )
    )
  ),
  (
    'seed_skill_binding_v1_demo_acceptance_001',
    '2026-04-10T00:00:14Z'::timestamptz,
    'seed:p1_minimal_closure',
    jsonb_build_object(
      'type', 'skill_binding_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'binding_id', 'bind_acceptance_tenant_demo_v1',
        'skill_id', 'operation_acceptance_gate_v1',
        'version', '1.0.0',
        'category', 'ACCEPTANCE',
        'status', 'ACTIVE',
        'scope_type', 'TENANT',
        'rollout_mode', 'DIRECT',
        'trigger_stage', 'before_acceptance',
        'bind_target', 'tenantA',
        'priority', 80,
        'config_patch', jsonb_build_object('strict_mode', true, 'min_evidence_count', 2)
      )
    )
  )
ON CONFLICT (fact_id) DO NOTHING;

-- MVP-0 formal skills: ensure baseline registry has irrigation deficit + mock valve control contracts.
INSERT INTO facts (fact_id, occurred_at, source, record_json)
VALUES
  (
    'seed_skill_definition_v1_mvp0_irrigation_deficit_001',
    '2026-05-02T00:00:01Z'::timestamptz,
    'seed:mvp0_skill_registry',
    jsonb_build_object(
      'type', 'skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'skill_id', 'irrigation_deficit_skill_v1',
        'version', 'v1',
        'skill_version', 'v1',
        'display_name', 'Irrigation Deficit Skill v1',
        'category', 'AGRONOMY',
        'skill_category', 'agronomy',
        'status', 'ACTIVE',
        'trigger_stage', 'after_recommendation',
        'scope_type', 'FIELD',
        'rollout_mode', 'all',
        'input_schema_digest', 'mvp0-irrigation-deficit-in-v1',
        'output_schema_digest', 'mvp0-irrigation-deficit-out-v1',
        'input_schema_ref', 'geox.schema.agronomy.irrigation_deficit.input.v1',
        'output_schema_ref', 'geox.schema.agronomy.irrigation_deficit.output.v1',
        'capabilities', jsonb_build_array('irrigation_deficit_detection'),
        'risk_level', 'MEDIUM',
        'required_evidence', jsonb_build_array('soil_moisture', 'field_id', 'crop_stage_or_crop_code'),
        'tenant_scope', jsonb_build_array('*'),
        'crop_scope', jsonb_build_array('*'),
        'device_scope', '[]'::jsonb,
        'binding_priority', 100,
        'enabled', true,
        'binding_conditions', jsonb_build_object('operation_type', 'IRRIGATION', 'recommendation_action', 'IRRIGATE'),
        'fallback_policy', jsonb_build_object('mode', 'static_default', 'reason', 'manual agronomy review required if evidence is insufficient'),
        'audit_policy', jsonb_build_object('level', 'standard', 'include_input_snapshot', true, 'include_output_snapshot', true)
      )
    )
  ),
  (
    'seed_skill_definition_v1_mvp0_mock_valve_control_001',
    '2026-05-02T00:00:02Z'::timestamptz,
    'seed:mvp0_skill_registry',
    jsonb_build_object(
      'type', 'skill_definition_v1',
      'payload', jsonb_build_object(
        'tenant_id', 'tenantA',
        'project_id', 'projectA',
        'group_id', 'groupA',
        'skill_id', 'mock_valve_control_skill_v1',
        'version', 'v1',
        'skill_version', 'v1',
        'display_name', 'Mock Valve Control Skill v1',
        'category', 'DEVICE',
        'skill_category', 'device',
        'status', 'ACTIVE',
        'trigger_stage', 'before_acceptance',
        'scope_type', 'DEVICE',
        'rollout_mode', 'all',
        'input_schema_digest', 'mvp0-mock-valve-in-v1',
        'output_schema_digest', 'mvp0-mock-valve-out-v1',
        'input_schema_ref', 'geox.schema.device.mock_valve.input.v1',
        'output_schema_ref', 'geox.schema.device.mock_valve.output.v1',
        'capabilities', jsonb_build_array('valve_open_close_mock', 'device.irrigation.valve.open'),
        'risk_level', 'LOW',
        'required_evidence', jsonb_build_array('approval_id', 'task_id', 'field_id', 'device_id'),
        'tenant_scope', jsonb_build_array('*'),
        'crop_scope', jsonb_build_array('*'),
        'device_scope', jsonb_build_array('mock_valve', 'irrigation_simulator'),
        'binding_priority', 100,
        'enabled', true,
        'binding_conditions', jsonb_build_object('operation_type', 'IRRIGATION', 'device_type', 'IRRIGATION_CONTROLLER', 'adapter_type', 'irrigation_simulator'),
        'fallback_policy', jsonb_build_object('mode', 'static_default', 'reason', 'fallback to manual execution if mock valve execution is blocked'),
        'audit_policy', jsonb_build_object('level', 'standard', 'include_input_snapshot', true, 'include_output_snapshot', true)
      )
    )
  )
ON CONFLICT (fact_id) DO NOTHING;
