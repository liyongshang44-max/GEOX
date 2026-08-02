'use strict';

const assert = require('node:assert/strict');
const { digest } = require('./shared_v1.cjs');
const {
  materializePhysicalDatabaseNameV1,
} = require('../mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs');

const EXPECTED_BOOTSTRAP_FACT_COUNT_V1 = 11;
const RUNTIME_RELATIONS_V1 = Object.freeze([
  'twin_active_lineage_index_v1',
  'twin_runtime_checkpoint_latest_index_v1',
  'twin_state_latest_index_v1',
  'twin_forecast_result_latest_index_v1',
  'twin_scenario_latest_index_v1',
]);

function n(row, code) {
  const value = Number(row?.n);
  assert.equal(Number.isInteger(value), true, code);
  return value;
}

function createFreshDatabasePortV1({ pool, adminPool, authority }) {
  return {
    async assertFreshDisposable({ spec }) {
      const db = (
        await pool.query('SELECT current_database() AS database_name,current_user AS user_name')
      ).rows[0];
      const expectedDatabaseName = materializePhysicalDatabaseNameV1(
        authority,
        process.env.GITHUB_RUN_ID,
      );
      assert.equal(
        String(db.database_name),
        expectedDatabaseName,
        'FRESH_DISPOSABLE_DATABASE_IDENTITY_MISMATCH',
      );
      assert.equal(String(db.user_name), 'geox_mcft_cap08_runner_v1', 'CAP08_RUNNER_ROLE_REQUIRED');
      const required = [
        'facts',
        'twin_fact_visibility_epoch_v1',
        'twin_fact_visibility_index_v1',
        ...RUNTIME_RELATIONS_V1,
      ];
      for (const relation of required) {
        const row = (
          await adminPool.query('SELECT to_regclass($1) AS relation', [`public.${relation}`])
        ).rows[0];
        assert.equal(String(row.relation), relation, `REQUIRED_RELATION:${relation}`);
      }
      const facts = n(
        (await adminPool.query('SELECT count(*)::int AS n FROM public.facts')).rows[0],
        'FACT_COUNT_INTEGER',
      );
      const activeEpochs = n(
        (
          await adminPool.query(
            "SELECT count(*)::int AS n FROM public.twin_fact_visibility_epoch_v1 WHERE status='ACTIVE'",
          )
        ).rows[0],
        'ACTIVE_EPOCH_COUNT_INTEGER',
      );
      const visibility = n(
        (
          await adminPool.query(
            "SELECT count(*)::int AS n FROM public.twin_fact_visibility_index_v1 WHERE visibility_epoch_id=(SELECT min(visibility_epoch_id) FROM public.twin_fact_visibility_epoch_v1 WHERE status='ACTIVE')",
          )
        ).rows[0],
        'VISIBILITY_COUNT_INTEGER',
      );
      const missingVisibility = n(
        (
          await adminPool.query(
            "SELECT count(*)::int AS n FROM public.facts f LEFT JOIN public.twin_fact_visibility_index_v1 v ON v.visibility_epoch_id=(SELECT min(visibility_epoch_id) FROM public.twin_fact_visibility_epoch_v1 WHERE status='ACTIVE') AND v.fact_id=f.fact_id WHERE v.fact_id IS NULL",
          )
        ).rows[0],
        'MISSING_VISIBILITY_COUNT_INTEGER',
      );
      assert.equal(facts, EXPECTED_BOOTSTRAP_FACT_COUNT_V1, 'BOOTSTRAP_FACT_BASELINE_DRIFT');
      assert.equal(activeEpochs, 1, 'BOOTSTRAP_ACTIVE_VISIBILITY_EPOCH_DRIFT');
      assert.equal(
        visibility,
        EXPECTED_BOOTSTRAP_FACT_COUNT_V1,
        'BOOTSTRAP_VISIBILITY_BASELINE_DRIFT',
      );
      assert.equal(missingVisibility, 0, 'BOOTSTRAP_FACT_VISIBILITY_INCOMPLETE');
      for (const relation of RUNTIME_RELATIONS_V1) {
        const count = n(
          (
            await adminPool.query(`SELECT count(*)::int AS n FROM public.${relation}`)
          ).rows[0],
          `RUNTIME_COUNT_INTEGER:${relation}`,
        );
        assert.equal(count, 0, `FORMAL_RUNTIME_RELATION_NOT_FRESH:${relation}`);
      }
      const identity = n(
        (
          await adminPool.query(
            'SELECT count(*)::int AS n FROM public.facts WHERE strpos(record_json::text,$1)>0 OR strpos(record_json::text,$2)>0 OR strpos(record_json::text,$3)>0 OR strpos(source::text,$1)>0 OR strpos(source::text,$2)>0 OR strpos(source::text,$3)>0',
            [
              String(spec.operational_run_instance_id),
              String(spec.exact_subject_sha),
              String(spec.formal_run_id),
            ],
          )
        ).rows[0],
        'RUN_IDENTITY_FACT_COUNT_INTEGER',
      );
      assert.equal(identity, 0, 'FORMAL_RUN_IDENTITY_FACT_NOT_FRESH');
      return {
        status: 'PASS',
        fresh: true,
        database_name: db.database_name,
        expected_database_name: expectedDatabaseName,
        logical_database_identity: authority.logical_database_identity.identity_id,
        runner_role: db.user_name,
        bootstrap_fact_count: facts,
        bootstrap_visibility_count: visibility,
        canonical_runtime_row_count: 0,
        database_instance_seed_digest: digest({
          database_name: db.database_name,
          logical_database_identity: authority.logical_database_identity.identity_id,
          operational_run_instance_id: spec.operational_run_instance_id,
          bootstrap_fact_count: facts,
        }),
      };
    },
  };
}

module.exports = {
  EXPECTED_BOOTSTRAP_FACT_COUNT_V1,
  RUNTIME_RELATIONS_V1,
  createFreshDatabasePortV1,
};
