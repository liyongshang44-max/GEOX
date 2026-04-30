const fs = require('node:fs');
const path = require('node:path');
const { fetchJson } = require('./_common.cjs');

const SECURITY_TOKEN_FIXTURE_PATH = path.resolve(__dirname, '../../config/auth/security_acceptance_tokens.json');
function readSecurityAcceptanceTokenFixture() { return JSON.parse(fs.readFileSync(SECURITY_TOKEN_FIXTURE_PATH, 'utf8')); }
async function assertSecurityAcceptanceTokensLoaded(base) {
  const probes = [];
  const revoked = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=__security_token_probe__`, { method: 'GET', token: 'revoked_token' });
  probes.push({ token: 'revoked_token', status: revoked.status, error: revoked.json?.error });
  if (!(revoked.status === 403 && revoked.json?.error === 'AUTH_REVOKED')) {
    throw new Error(`SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED ${JSON.stringify({ probes })}`);
  }
  const admin = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=__security_token_probe__`, { method: 'GET', token: 'tenant_a_admin_token' });
  probes.push({ token: 'tenant_a_admin_token', status: admin.status, error: admin.json?.error });
  const tb = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=__security_token_probe__&tenant_id=tenantB&project_id=projectB&group_id=groupB`, { method: 'GET', token: 'tenant_b_admin_token' });
  probes.push({ token: 'tenant_b_admin_token', status: tb.status, error: tb.json?.error });
  const skill = await fetchJson(`${base}/api/v1/skills/rules?tenant_id=tenantA&project_id=projectA&group_id=groupA`, { method: 'GET', token: 'skill_admin_token' });
  probes.push({ token: 'skill_admin_token', status: skill.status, error: skill.json?.error });
  const self = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=__security_token_probe__`, { method: 'GET', token: 'self_approval_admin_token' });
  probes.push({ token: 'self_approval_admin_token', status: self.status, error: self.json?.error });
  const invalid = probes.filter((p) => p.error === 'AUTH_INVALID');
  if (invalid.length) throw new Error(`SECURITY_ACCEPTANCE_TOKEN_FIXTURE_INCOMPLETE ${JSON.stringify({ probes })}`);
  return true;
}
module.exports = { SECURITY_TOKEN_FIXTURE_PATH, readSecurityAcceptanceTokenFixture, assertSecurityAcceptanceTokensLoaded };
