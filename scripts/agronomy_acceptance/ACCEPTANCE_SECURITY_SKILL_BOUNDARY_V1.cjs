#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');

(async()=>{
  const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const q='tenant_id=tenantA&project_id=projectA&group_id=groupA';
  const checks={};

  try {
    await assertSecurityAcceptanceTokensLoaded(base);
  } catch (err) {
    console.log(JSON.stringify({ ok:false, error:'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail:String(err?.message||err) }, null, 2));
    process.exit(1);
  }

  const c = await fetchJson(`${base}/api/v1/skills/rules?${q}`, {
    token: 'client_without_skill_read'
  });
  checks.client_without_skill_read_denied =
    c.status === 403 && c.json?.error === 'AUTH_SCOPE_DENIED';

  const a = await fetchJson(`${base}/api/v1/skills/rules?${q}`, {
    token: 'auditor_token'
  });
  checks.auditor_can_read =
    a.ok === true && Array.isArray(a.json);

  const swDenied = await fetchJson(`${base}/api/v1/skills/rules/switch`, {
    method: 'POST',
    token: 'agronomist_token',
    body: {
      skill_id: 'security_boundary_agronomy_v1',
      version: 'v1',
      enabled: true,
      category: 'AGRONOMY',
      scope: {
        tenant_id: 'tenantA',
        project_id: 'projectA',
        group_id: 'groupA',
        scope_type: 'TENANT',
        bind_target: 'tenantA',
        trigger_stage: 'before_recommendation',
        rollout_mode: 'DIRECT'
      },
      reason: 'agronomist should not switch'
    }
  });
  checks.agronomist_cannot_switch =
    swDenied.status === 403;

  const baseSwitchBody = {
    skill_id: 'security_boundary_agronomy_v1',
    version: 'v1',
    enabled: true,
    category: 'AGRONOMY',
    scope: {
      tenant_id: 'tenantA',
      project_id: 'projectA',
      group_id: 'groupA',
      scope_type: 'TENANT',
      bind_target: 'tenantA',
      trigger_stage: 'before_recommendation',
      rollout_mode: 'DIRECT'
    },
    priority: 10
  };

  const noReason = await fetchJson(`${base}/api/v1/skills/rules/switch`, {
    method: 'POST',
    token: 'skill_admin_token',
    body: baseSwitchBody
  });
  checks.skill_admin_reason_required =
    noReason.status === 400 &&
    noReason.json?.error === 'SKILL_CHANGE_REASON_REQUIRED';

  const withReason = await fetchJson(`${base}/api/v1/skills/rules/switch`, {
    method: 'POST',
    token: 'skill_admin_token',
    body: {
      ...baseSwitchBody,
      reason: 'acceptance test switch'
    }
  });
  checks.skill_admin_switch_with_reason_ok =
    withReason.ok === true &&
    withReason.json?.ok === true;

  const forbidden = await fetchJson(`${base}/api/v1/skills/rules/switch`, {
    method: 'POST',
    token: 'skill_admin_token',
    body: {
      ...baseSwitchBody,
      skill_id: 'security_boundary_agronomy_dispatch_forbidden_v1',
      scope: {
        ...baseSwitchBody.scope,
        trigger_stage: 'before_dispatch'
      },
      reason: 'security negative test'
    }
  });
  checks.agronomy_device_command_forbidden =
    forbidden.status === 403 &&
    ['SKILL_CATEGORY_BOUNDARY_VIOLATION', 'SKILL_OUTPUT_FORBIDDEN_ACTION'].includes(forbidden.json?.error);

  const cross = await fetchJson(`${base}/api/v1/skills/rules?${q}`, {
    token: 'tenantB_auditor_token'
  });
  checks.cross_tenant_rules_hidden =
    cross.status === 404 && cross.json?.error === 'NOT_FOUND';

  console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));
})();
