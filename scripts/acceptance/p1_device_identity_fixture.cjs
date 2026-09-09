'use strict';

const crypto = require('node:crypto');
const { Pool } = require('pg');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

async function provisionDeviceIdentityFixture({ databaseUrl, tenant, deviceId, fieldId }) {
  const url = String(databaseUrl || '').trim();
  if (!url) throw new Error('DATABASE_URL_REQUIRED_FOR_DEVICE_IDENTITY_FIXTURE');
  const scope = {
    tenant_id: String(tenant?.tenant_id || '').trim(),
    project_id: String(tenant?.project_id || '').trim(),
    group_id: String(tenant?.group_id || '').trim(),
  };
  if (!scope.tenant_id || !scope.project_id || !scope.group_id || !deviceId || !fieldId) {
    throw new Error('P1_DEVICE_IDENTITY_FIXTURE_SCOPE_REQUIRED');
  }

  const pool = new Pool({ connectionString: url });
  try {
    const ts = Date.now();
    const credentialId = `p1_smoke_${sha256Hex(`${deviceId}|${fieldId}`).slice(0,16)}`;
    const secret = `p1_smoke_secret_${crypto.randomBytes(24).toString('base64url')}`;

    await pool.query(
      `INSERT INTO field_index_v1(tenant_id,field_id,name,area_ha,status,project_id,group_id,created_ts_ms,updated_ts_ms)
       VALUES($1,$2,$3,1,'ACTIVE',$4,$5,$6,$6)
       ON CONFLICT(tenant_id,field_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [scope.tenant_id,fieldId,`P1 smoke ${fieldId}`,scope.project_id,scope.group_id,ts],
    );
    await pool.query(
      `INSERT INTO device_index_v1(tenant_id,device_id,display_name,created_ts_ms,last_credential_id,last_credential_status)
       VALUES($1,$2,$3,$4,$5,'ACTIVE')
       ON CONFLICT(tenant_id,device_id) DO UPDATE SET last_credential_id=EXCLUDED.last_credential_id,last_credential_status='ACTIVE'`,
      [scope.tenant_id,deviceId,`P1 smoke ${deviceId}`,ts,credentialId],
    );
    await pool.query(
      `INSERT INTO device_binding_index_v1(tenant_id,device_id,field_id,bound_ts_ms)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(tenant_id,device_id) DO UPDATE SET field_id=EXCLUDED.field_id,bound_ts_ms=EXCLUDED.bound_ts_ms`,
      [scope.tenant_id,deviceId,fieldId,ts],
    );
    await pool.query(
      `INSERT INTO device_credential_index_v1(tenant_id,device_id,credential_id,credential_hash,status,issued_ts_ms,revoked_ts_ms)
       VALUES($1,$2,$3,$4,'ACTIVE',$5,NULL)
       ON CONFLICT(tenant_id,device_id,credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash,status='ACTIVE',issued_ts_ms=EXCLUDED.issued_ts_ms,revoked_ts_ms=NULL`,
      [scope.tenant_id,deviceId,credentialId,sha256Hex(secret),ts],
    );

    return { credentialId, secret };
  } finally {
    await pool.end();
  }
}

module.exports = { provisionDeviceIdentityFixture };
