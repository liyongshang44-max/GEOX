-- P1 minimum closed-loop seed: append demo skill definitions into facts.
-- Target tenant/project/group must match config/auth/ao_act_tokens_v0.json default dev token scope.
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
