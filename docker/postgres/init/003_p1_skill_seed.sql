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
