INSERT INTO field_index_v1
  (tenant_id, field_id, field_name, area_m2, geojson_json, created_ts_ms, updated_ts_ms)
VALUES
  (
    'tenantA',
    'field_demo_001',
    'field_demo_001',
    NULL,
    NULL,
    0,
    0
  )
ON CONFLICT (tenant_id, field_id) DO NOTHING;

INSERT INTO field_polygon_v1
  (tenant_id, field_id, polygon_geojson_json, area_m2, created_ts_ms, updated_ts_ms)
VALUES
  (
    'tenantA',
    'field_demo_001',
    '{"type":"Polygon","coordinates":[[[116.397,39.908],[116.401,39.908],[116.401,39.911],[116.397,39.911],[116.397,39.908]]]}',
    NULL,
    0,
    0
  )
ON CONFLICT (tenant_id, field_id) DO NOTHING;
