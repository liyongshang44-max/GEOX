import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(process.cwd());
const PIN_PATH = join(REPO_ROOT, 'scripts/adr_adoption/qualified-consumer-source.v1.json');
const PRODUCTION_SOURCE_PATH = join(REPO_ROOT, 'apps/server/src/integrations/adr/read_only_shadow_adoption_v1.ts');
const COMPILED_SEAM_PATH = join(REPO_ROOT, 'apps/server/dist/apps/server/src/integrations/adr/read_only_shadow_adoption_v1.js');
const PLANTING_MILESTONE = 'REAL_WORLD_HETEROGENEITY_PLANTING_D02_D04_D05_D06_STRICT_POSITIVE';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} must succeed`);
  return result;
}

function sha256File(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function exactHead() {
  const expected = process.env.GEOX_ADR_QUALIFICATION_HEAD?.trim();
  const actual = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  if (expected) assert.equal(actual, expected, 'GEOX qualification must run on exact candidate head');
  assert.match(actual, /^[0-9a-f]{40}$/);
  return actual;
}

function assertNoAdrDependency(packagePath) {
  const pkg = readJson(packagePath);
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.equal(Object.hasOwn(pkg[key] ?? {}, '@adr/geox-adapter'), false, `${packagePath} must not persist ADR package dependency`);
  }
}

const geoxHead = exactHead();
const pin = readJson(PIN_PATH);
assert.equal(pin.contract_version, 'geox.adr-qualified-consumer-source.v1');
assert.equal(pin.adoption_mode, 'READ_ONLY_SHADOW_QUALIFICATION_ONLY');
assert.equal(pin.claims.real_geox_repository_consumer, true);
assert.equal(pin.claims.live_production_read_model_observed, false);
assert.equal(pin.claims.geox_field_equals_adr_target, false);
assert.equal(pin.claims.same_domain_decision_equivalence_established, false);
assert.equal(pin.release_candidate.lifecycle_transition_from_predecessor.decision, 'REVIEW_REQUIRED');
for (const value of Object.values(pin.authority)) assert.equal(value, false, 'adoption pin must not create deployment/write authority');

const adrSourceDir = resolve(process.env.ADR_SOURCE_DIR ?? '');
const tarballPath = resolve(process.env.ADR_PACKAGE_TARBALL ?? '');
assert.ok(process.env.ADR_SOURCE_DIR, 'ADR_SOURCE_DIR is required');
assert.ok(process.env.ADR_PACKAGE_TARBALL, 'ADR_PACKAGE_TARBALL is required');
const adrHead = run('git', ['-C', adrSourceDir, 'rev-parse', 'HEAD']).stdout.trim();
assert.equal(adrHead, pin.source_commit, 'ADR producer checkout must equal GEOX-owned exact source pin');
assert.equal(sha256File(tarballPath), pin.package.tarball_sha256, 'installed tarball must equal GEOX-owned qualified package hash');

assertNoAdrDependency(join(REPO_ROOT, 'package.json'));
assertNoAdrDependency(join(REPO_ROOT, 'apps/server/package.json'));

const productionSource = readFileSync(PRODUCTION_SOURCE_PATH, 'utf8');
for (const forbidden of [
  '@adr/geox-adapter',
  'ensureDerivedSensingStateProjectionV1',
  'appendDerivedSensingStateV1',
  'INSERT INTO',
  'UPDATE ',
  'DELETE FROM',
  'CREATE TABLE',
  'ALTER TABLE'
]) {
  assert.equal(productionSource.includes(forbidden), false, `production shadow seam must not contain ${forbidden}`);
}
assert.ok(productionSource.includes('getLatestDerivedSensingStatesByFieldV1'), 'production seam must reuse the existing GEOX read primitive');

const root = mkdtempSync(join(tmpdir(), 'geox-adr-readonly-shadow-'));
try {
  const producerWrapper = join(root, 'producer.mjs');
  const producerAcceptance = join(adrSourceDir, 'acceptance/real-kbs-soybean-planting-population-target/run-decision-result-v1.mjs');
  writeFileSync(producerWrapper, `
import { pathToFileURL } from 'node:url';
const captured = [];
const originalLog = console.log;
console.log = (...args) => {
  if (args.length === 1 && typeof args[0] === 'string') captured.push(args[0]);
};
try {
  await import(pathToFileURL(${JSON.stringify(producerAcceptance)}).href);
} finally {
  console.log = originalLog;
}
const parsed = captured.flatMap((entry) => {
  try { return [JSON.parse(entry)]; } catch { return []; }
});
const selected = parsed.find((entry) => entry?.milestone === ${JSON.stringify(PLANTING_MILESTONE)});
if (!selected) throw new Error('GOVERNED_ADR_DECISION_RESULT_NOT_FOUND');
process.stdout.write(JSON.stringify(selected));
`, 'utf8');

  const produced = JSON.parse(run(process.execPath, [producerWrapper], { cwd: adrSourceDir }).stdout.trim());
  assert.equal(produced.ok, true);
  assert.equal(produced.milestone, PLANTING_MILESTONE);
  assert.equal(produced.decisionResult.disposition, 'ACT');
  assert.equal(produced.decisionResult.structuredAction.actionCode, 'SET_SOYBEAN_SEEDING_RATE');
  assert.equal(produced.nonclaims.executionReceiptCreated, false);
  assert.equal(produced.nonclaims.outcomeCreated, false);

  const ref = produced.decisionResult.decisionResultRef;
  const event = {
    contract_version: 'adr.result-sink-event.v1',
    event_id: 'geox-real-repository-readonly-shadow-adoption-1',
    event_type: 'DECISION_RESULT_PUBLISHED',
    authority_ref: {
      kind: ref.kind,
      logical_id: ref.logicalId,
      version: ref.version,
      semantic_hash: ref.semanticHash
    },
    payload: {
      decision_disposition: produced.decisionResult.disposition,
      structured_action: produced.decisionResult.structuredAction,
      human_approval_authority: produced.decisionResult.humanApprovalAuthority,
      machine_execution_authority: produced.decisionResult.machineExecutionAuthority,
      target_binding: {
        mode: 'ADR_TARGET_UNBOUND_TO_GEOX_FIELD',
        reason_code: 'REAL_GEOX_REPOSITORY_HAS_NO_GOVERNED_ADR_TO_GEOX_FIELD_BINDING'
      }
    }
  };

  const consumerDir = join(root, 'consumer');
  mkdirSync(consumerDir, { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), `${JSON.stringify({
    name: 'geox-adr-readonly-shadow-qualification-consumer',
    private: true,
    type: 'module'
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(consumerDir, 'event.json'), `${JSON.stringify(event, null, 2)}\n`, 'utf8');
  writeFileSync(join(consumerDir, 'consumer.mjs'), `
import { readFileSync } from 'node:fs';
import { consumeAdrDecisionResultForGeox } from '@adr/geox-adapter/decision-result-sink';
let networkAttempted = false;
globalThis.fetch = async () => {
  networkAttempted = true;
  throw new Error('NETWORK_FORBIDDEN_DURING_ADR_SHADOW_CONSUMPTION');
};
const event = JSON.parse(readFileSync('event.json', 'utf8'));
const projection = consumeAdrDecisionResultForGeox({
  event,
  consumerScope: {
    tenantId: 'tenantA',
    projectId: 'projectA',
    groupId: 'groupA'
  }
});
process.stdout.write(JSON.stringify({ projection, networkAttempted }));
`, 'utf8');

  const installEnv = {
    ...process.env,
    NODE_PATH: '',
    npm_config_offline: 'true',
    npm_config_update_notifier: 'false',
    GITHUB_TOKEN: '',
    GH_TOKEN: ''
  };
  const install = run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', tarballPath], {
    cwd: consumerDir,
    env: installEnv
  });
  assert.match(install.stdout, /added 1 package/);

  const consumed = JSON.parse(run(process.execPath, ['consumer.mjs'], {
    cwd: consumerDir,
    env: installEnv
  }).stdout.trim());
  assert.equal(consumed.networkAttempted, false);
  assert.equal(consumed.projection.contract_version, 'adr.geox-decision-result-sink.v1');
  assert.equal(consumed.projection.target_binding.status, 'UNRESOLVED');
  assert.equal(consumed.projection.field_actionable, false);
  assert.equal(consumed.projection.dispatch_authorized, false);
  assert.equal(consumed.projection.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');

  const seam = await import(pathToFileURL(COMPILED_SEAM_PATH).href);
  const sqlStatements = [];
  const fakeDb = {
    async query(text, values) {
      const sql = String(text);
      const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
      sqlStatements.push({ sql, values: [...(values ?? [])] });
      assert.ok(normalized.startsWith('SELECT DISTINCT ON (STATE_TYPE)'), 'ADR adoption DB seam must issue only the governed latest-state SELECT');
      assert.ok(normalized.includes('FROM DERIVED_SENSING_STATE_INDEX_V1'));
      assert.equal(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/.test(normalized), false, 'ADR adoption DB seam must never issue writes or DDL');
      return {
        rows: [
          {
            tenant_id: 'tenantA',
            project_id: 'projectA',
            group_id: 'groupA',
            field_id: 'field_c8_demo',
            state_type: 'irrigation_need_state',
            payload_json: { level: 'HIGH', action_hint: 'SHADOW_CONTEXT_ONLY' },
            confidence: 0.82,
            explanation_codes_json: ['ADR_SHADOW_FIXTURE_IRRIGATION_NEED'],
            source_observation_ids_json: ['obs_shadow_irrigation_001'],
            source_device_ids_json: ['dev_onboard_accept_001'],
            computed_at_ts_ms: 1788600000000,
            fact_id: 'fact_shadow_irrigation_001'
          },
          {
            tenant_id: 'tenantA',
            project_id: 'projectA',
            group_id: 'groupA',
            field_id: 'field_c8_demo',
            state_type: 'canopy_temperature_state',
            payload_json: { level: 'ELEVATED', canopy_temp_c: 31.2, ambient_temp_c: 28.4, relative_humidity_pct: 52 },
            confidence: 0.77,
            explanation_codes_json: ['ADR_SHADOW_FIXTURE_CANOPY_TEMPERATURE'],
            source_observation_ids_json: ['obs_shadow_canopy_001'],
            source_device_ids_json: ['dev_onboard_accept_001'],
            computed_at_ts_ms: 1788600001000,
            fact_id: 'fact_shadow_canopy_001'
          }
        ]
      };
    }
  };

  const context = await seam.exportGeoxAdrReadOnlyShadowContextV1({
    db: fakeDb,
    tenant_id: 'tenantA',
    project_id: 'projectA',
    group_id: 'groupA',
    field_id: 'field_c8_demo'
  });
  assert.equal(sqlStatements.length, 1, 'P2 must perform exactly one read-model query');
  assert.equal(context.reality_rows.length, 2);
  assert.equal(context.identity_boundary.geox_field_is_adr_target_identity, false);
  assert.equal(context.identity_boundary.correspondence_or_equality_established, false);
  assert.equal(context.authority_boundary.database_operation, 'READ_ONLY_SELECT');

  const observation = seam.createGeoxAdrReadOnlyShadowObservationV1({
    geox_context: context,
    adr_projection: consumed.projection
  });
  assert.equal(observation.contract_version, 'geox.adr-read-only-shadow-observation.v1');
  assert.equal(observation.comparison_status, 'NOT_ESTABLISHED_NO_SAME_DOMAIN_INPUT_EQUIVALENCE_PROOF');
  assert.equal(observation.target_relationship, 'UNRESOLVED_NO_GEOX_FIELD_TO_ADR_TARGET_EQUALITY_CLAIM');
  assert.equal(observation.consumer_mode, 'READ_ONLY_SHADOW_OBSERVATION_ONLY');
  for (const value of Object.values(observation.authority_boundary)) assert.equal(value, false);

  const promoted = structuredClone(consumed.projection);
  promoted.field_actionable = true;
  assert.throws(
    () => seam.createGeoxAdrReadOnlyShadowObservationV1({ geox_context: context, adr_projection: promoted }),
    /ADR_SHADOW_ACTIONABILITY_PROMOTION_FORBIDDEN/
  );

  const mismatchedScope = structuredClone(consumed.projection);
  mismatchedScope.routing_scope.group_id = 'other-group';
  assert.throws(
    () => seam.createGeoxAdrReadOnlyShadowObservationV1({ geox_context: context, adr_projection: mismatchedScope }),
    /ADR_SHADOW_ROUTING_SCOPE_MISMATCH/
  );

  const evidence = {
    ok: true,
    milestone: 'REAL_GEOX_REPOSITORY_ADR_READONLY_SHADOW_ADOPTION_V1',
    geoxSourceCommit: geoxHead,
    adrSourceRepository: pin.source_repository,
    adrSourceCommit: adrHead,
    adrCandidateId: pin.release_candidate.candidate_id,
    adrQualificationReceiptHash: pin.release_candidate.qualification_receipt_hash,
    adrPackageName: pin.package.name,
    adrPackageVersion: pin.package.version,
    adrPackageTarballHash: sha256File(tarballPath),
    adrCompatibilityEnvelopeHash: pin.package.compatibility_envelope_sha256,
    qualifiedNodeEngine: pin.package.node_engine,
    lifecycleTransitionDecision: pin.release_candidate.lifecycle_transition_from_predecessor.decision,
    sourceWorld: produced.milestone,
    governedDecisionResultConsumed: true,
    installedPackagePublicSubpathOnly: true,
    consumerNetworkReads: 0,
    realGeoxRepositoryConsumer: true,
    liveProductionReadModelObserved: false,
    geoxProductionSeamCompiled: true,
    geoxReadPrimitive: 'getLatestDerivedSensingStatesByFieldV1',
    geoxReadModel: 'derived_sensing_state_index_v1',
    geoxDatabaseStatementCount: sqlStatements.length,
    geoxDatabaseSelectCount: sqlStatements.length,
    geoxDatabaseWriteCount: 0,
    geoxRealityRowCount: context.reality_rows.length,
    provenancePreserved: context.reality_rows.every((row) => row.fact_id && row.source_observation_ids.length > 0),
    targetBindingStatus: consumed.projection.target_binding.status,
    geoxFieldEqualsAdrTarget: false,
    correspondenceOrEqualityEstablished: false,
    sameDomainDecisionEquivalenceEstablished: false,
    comparisonStatus: observation.comparison_status,
    fieldActionable: false,
    recommendationWriteAuthorized: false,
    approvalAuthorized: false,
    operationPlanOrTaskCreationAuthorized: false,
    dispatchAuthorized: false,
    machineExecutionAuthorized: false,
    executionReceiptCreated: false,
    outcomeCreated: false,
    packagePublicationAuthorized: false,
    productionInstallAuthorized: false,
    runtimeActivationAuthorized: false,
    persistentAdrPackageDependencyAdded: false,
    mcftRuntimeModified: false,
    bLineRuntimeModified: false,
    newArchitectureDecisionRequired: false
  };

  const evidencePath = process.env.GEOX_ADR_EVIDENCE_PATH?.trim();
  if (evidencePath) {
    mkdirSync(dirname(resolve(evidencePath)), { recursive: true });
    writeFileSync(resolve(evidencePath), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
