#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_DECISION_RECOMMENDATION_SCHEMA_MIGRATION_V1.cjs
// Purpose: prove H16 decision_recommendation_index_v1 migration creates the required projection schema.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ACCEPTANCE = 'ACCEPTANCE_DECISION_RECOMMENDATION_SCHEMA_MIGRATION_V1';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function fail(message, detail) {
  console.error(`[${ACCEPTANCE}] FAIL:`, message);
  if (detail !== undefined) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

(async () => {
  assert(DATABASE_URL, 'DATABASE_URL is required');

  const migrationPath = path.join(process.cwd(), 'apps/server/db/migrations/2026_06_17_decision_recommendation_index_v1.sql');
  assert(fs.existsSync(migrationPath), 'migration file missing', migrationPath);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query(fs.readFileSync(migrationPath, 'utf8'));

    const table = await client.query(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema='public'
         AND table_name='decision_recommendation_index_v1'
    `);
    assert(table.rows.length === 1, 'decision_recommendation_index_v1 table missing', table.rows);

    const columns = await client.query(`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name='decision_recommendation_index_v1'
    `);
    const seen = new Set(columns.rows.map((row) => row.column_name));
    for (const column of [
      'recommendation_id',
      'tenant_id',
      'project_id',
      'group_id',
      'field_id',
      'season_id',
      'recommendation_status',
      'selected_scenario_option_id',
      'source_water_state_estimate_id',
      'source_scenario_set_id',
      'source_requirement_id',
      'suggested_action_json',
      'scenario_summary_json',
      'input_refs_json',
      'evidence_refs_json',
      'derivation_json',
      'quality_json',
      'confidence_json',
      'human_approval_required',
      'source_fact_id',
      'created_at',
      'updated_at',
    ]) {
      assert(seen.has(column), `required column missing: ${column}`, [...seen].sort());
    }

    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conrelid='public.decision_recommendation_index_v1'::regclass
         AND conname IN (
          'decision_recommendation_index_v1_status_check',
          'decision_recommendation_index_v1_unknown_empty_action_check'
         )
    `);
    assert(constraints.rows.length === 2, 'required constraints missing', constraints.rows);

    const primaryKey = await client.query(`
      SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = 'public.decision_recommendation_index_v1'::regclass
         AND i.indisprimary
       ORDER BY array_position(i.indkey, a.attnum)
    `);
    assert(
      primaryKey.rows.map((row) => row.attname).join(', ') === 'tenant_id, project_id, group_id, recommendation_id',
      'primary key must be tenant/project/group scoped',
      primaryKey.rows
    );

    const indexes = await client.query(`
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname='public'
         AND tablename='decision_recommendation_index_v1'
    `);
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const indexName of [
      'decision_recommendation_index_v1_pkey',
      'idx_decision_recommendation_index_v1_scope_latest',
      'idx_decision_recommendation_index_v1_scenario_set',
      'idx_decision_recommendation_index_v1_requirement',
    ]) {
      assert(indexNames.has(indexName), `required index missing: ${indexName}`, [...indexNames].sort());
    }

    console.log(`[${ACCEPTANCE}] PASS`);
  } finally {
    await client.end().catch(() => {});
  }
})().catch((error) => fail(error.message || 'unexpected failure', error.stack || error));
