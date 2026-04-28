const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const field_id = env('FIELD_ID', `field_zone_${Date.now()}`);
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');

  const zoneA = {
    tenant_id,
    project_id,
    group_id,
    zone_id: 'zone_low_moisture_north',
    zone_name: 'North low moisture zone',
    zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] },
    area_ha: 3.2,
    risk_tags: ['LOW_MOISTURE'],
    agronomy_tags: ['SANDY_SOIL', 'FAST_DRAINAGE'],
    source_refs: ['obs_x', 'judge_y'],
  };

  const zoneB = {
    tenant_id,
    project_id,
    group_id,
    zone_id: 'zone_normal_south',
    zone_name: 'South normal zone',
    zone_type: 'MANAGEMENT_ZONE',
    geometry: { type: 'Polygon', coordinates: [] },
    area_ha: 4.6,
    risk_tags: ['NORMAL'],
    agronomy_tags: ['BALANCED_SOIL'],
    source_refs: ['obs_z'],
  };

  const healthz = await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token });
  const healthz_ok = Boolean(healthz.ok && healthz.json?.ok === true);

  const createZoneAResp = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, {
    method: 'POST',
    token,
    body: zoneA,
  });
  const createZoneAJson = requireOk(createZoneAResp, 'create management zone A');

  const createZoneBResp = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, {
    method: 'POST',
    token,
    body: zoneB,
  });
  requireOk(createZoneBResp, 'create management zone B');

  const listResp = await fetchJson(
    `${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const listJson = requireOk(listResp, 'list management zones by field');

  const readResp = await fetchJson(
    `${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones/${encodeURIComponent(zoneA.zone_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readJson = requireOk(readResp, 'read management zone by id');

  const upsertAgainResp = await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, {
    method: 'POST',
    token,
    body: { ...zoneA, zone_name: 'North low moisture zone v2' },
  });
  const upsertAgainJson = requireOk(upsertAgainResp, 'upsert management zone idempotent');

  const tenantMismatchResp = await fetchJson(
    `${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones?tenant_id=${encodeURIComponent('tenant_mismatch')}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapi_contains_management_zone = Boolean(
    openapi.ok
    && openapi.json?.components?.schemas?.ManagementZoneV1
    && openapi.json?.paths?.['/api/v1/fields/{field_id}/zones']
    && openapi.json?.paths?.['/api/v1/fields/{field_id}/zones/{zone_id}']
  );

  const listItems = Array.isArray(listJson.items) ? listJson.items : [];
  const zoneAInList = listItems.find((item) => item?.zone_id === zoneA.zone_id) || null;
  const zoneBInList = listItems.find((item) => item?.zone_id === zoneB.zone_id) || null;

  const checks = {
    zone_created: Boolean(createZoneAJson.zone?.zone_id === zoneA.zone_id && createZoneAJson.zone?.field_id === field_id),
    zone_upsert_idempotent: Boolean(upsertAgainJson.zone?.zone_id === zoneA.zone_id && upsertAgainJson.zone?.field_id === field_id),
    zone_list_by_field: Boolean(zoneAInList && zoneBInList),
    zone_read_by_id: Boolean(readJson.zone?.zone_id === zoneA.zone_id && readJson.zone?.field_id === field_id),
    zone_geometry_preserved: Boolean(readJson.zone?.geometry && readJson.zone.geometry.type === 'Polygon'),
    zone_tags_preserved: Boolean(
      Array.isArray(readJson.zone?.risk_tags) && readJson.zone.risk_tags.includes('LOW_MOISTURE')
      && Array.isArray(readJson.zone?.agronomy_tags) && readJson.zone.agronomy_tags.includes('SANDY_SOIL')
      && Array.isArray(readJson.zone?.source_refs) && readJson.zone.source_refs.includes('obs_x')
    ),
    tenant_scope_enforced: Boolean(tenantMismatchResp.status === 404),
    openapi_contains_management_zone,
    healthz_ok,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
