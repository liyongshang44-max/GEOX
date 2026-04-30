const fs = require('node:fs');
const path = require('node:path');
const { fetchJson } = require('./_common.cjs');

const SECURITY_TOKEN_FIXTURE_PATH = path.resolve(__dirname, '../../config/auth/security_acceptance_tokens.json');
function readSecurityAcceptanceTokenFixture() { return JSON.parse(fs.readFileSync(SECURITY_TOKEN_FIXTURE_PATH, 'utf8')); }
async function assertSecurityAcceptanceTokensLoaded(base) {
  const resp = await fetchJson(`${base}/api/v1/field-memory/summary?field_id=__security_token_probe__`, { method: 'GET', token: 'revoked_token' });
  if (!(resp.status === 403 && resp.json?.error === 'AUTH_REVOKED')) {
    throw new Error(`SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED ${JSON.stringify({ status: resp.status, body: resp.json })}`);
  }
  return true;
}
module.exports = { SECURITY_TOKEN_FIXTURE_PATH, readSecurityAcceptanceTokenFixture, assertSecurityAcceptanceTokensLoaded };
