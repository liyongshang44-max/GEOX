INSERT INTO field_index_v1
  (tenant_id, field_id, field_name, name, area_m2, geojson_json, created_ts_ms, updated_ts_ms)
VALUES
  (
    'tenantA',
    'field_demo_001',
    '一号示范田',
    '一号示范田',
    NULL,
    NULL,
    0,
    0
  ),
  (
    'tenantA',
    'field_c8_demo',
    'C8 灌溉示范田',
    'C8 灌溉示范田',
    NULL,
    NULL,
    0,
    0
  )
ON CONFLICT (tenant_id, field_id) DO UPDATE SET
  field_name = EXCLUDED.field_name,
  name = EXCLUDED.name,
  updated_ts_ms = EXCLUDED.updated_ts_ms;

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
  ),
  (
    'tenantA',
    'field_c8_demo',
    '{"type":"Polygon","coordinates":[[[116.397,39.908],[116.401,39.908],[116.401,39.911],[116.397,39.911],[116.397,39.908]]]}',
    NULL,
    0,
    0
  )
ON CONFLICT (tenant_id, field_id) DO UPDATE SET
  polygon_geojson_json = EXCLUDED.polygon_geojson_json,
  area_m2 = EXCLUDED.area_m2,
  updated_ts_ms = EXCLUDED.updated_ts_ms;
