"use strict";
// Identity derives only from targets returned by the consumed, signed child gate.
// This module grants nothing, switches no roles, and performs no writer call.
const assert = require("node:assert/strict");
const EVIDENCE_FUNCTION = "public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)";
const TWIN_FUNCTION = "public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)";
function binding(targets, database) {
  const run = targets.isolated_login_run_id;
  assert.match(run || "", /^[a-f0-9]{12}$/, "ISOLATED_SIGNED_LOGIN_RUN_REQUIRED");
  assert.equal(targets.positive, `mcft_cap09_requal_${run}_positive`);
  assert.equal(targets.negative, `mcft_cap09_requal_${run}_negative`);
  assert.equal(targets.bucket, `mcft-cap09-requal-${run}`);
  assert([targets.positive, targets.negative].includes(database), "ISOLATED_LOGIN_DATABASE_FORBIDDEN");
  return { database, login: `mcft_cap09_${run}_evidence_login`, privilege: `mcft_cap09_${run}_evidence_priv` };
}
const SNAPSHOT_SQL = `SELECT current_database() AS database, current_user AS current_role,
 session_user AS session_role, r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolcreatedb,
 r.rolcreaterole, r.rolreplication, r.rolbypassrls,
 (r.rolvaliduntil IS NOT NULL AND r.rolvaliduntil > clock_timestamp()) AS unexpired,
 has_table_privilege(current_user,'public.facts','INSERT') AS facts_insert,
 has_schema_privilege(current_user,'public','CREATE') AS schema_create,
 has_function_privilege(current_user,$1,'EXECUTE') AS evidence_execute,
 has_function_privilege(current_user,$2,'EXECUTE') AS twin_execute,
 COALESCE((SELECT json_agg(json_build_object('role',g.rolname,'admin',m.admin_option,
   'inherit',m.inherit_option,'set',m.set_option)) FROM pg_catalog.pg_auth_members m
   JOIN pg_catalog.pg_roles g ON g.oid=m.roleid WHERE m.member=r.oid),'[]'::json) AS memberships,
 COALESCE((SELECT json_agg(g.rolname ORDER BY g.rolname) FROM pg_catalog.pg_roles g
   WHERE g.oid<>r.oid AND pg_has_role(r.oid,g.oid,'USAGE')),'[]'::json) AS effective_roles,
 EXISTS(SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname=$3 AND NOT g.rolcanlogin
   AND NOT g.rolsuper AND NOT g.rolcreatedb AND NOT g.rolcreaterole
   AND NOT g.rolreplication AND NOT g.rolbypassrls) AS privilege_role_safe
 FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`;
function validateSnapshot(row, expected) {
  assert(row, "ISOLATED_LOGIN_IDENTITY_MISSING");
  assert.equal(row.database, expected.database, "ISOLATED_LOGIN_WRONG_DATABASE");
  assert.equal(row.current_role, expected.login, "ISOLATED_LOGIN_WRONG_CURRENT_ROLE");
  assert.equal(row.session_role, expected.login, "ISOLATED_LOGIN_WRONG_SESSION_ROLE");
  for (const key of ["rolcanlogin", "rolinherit", "unexpired", "evidence_execute", "privilege_role_safe"])
    assert.equal(row[key], true, "ISOLATED_LOGIN_REQUIRED:" + key);
  for (const key of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls", "facts_insert", "schema_create", "twin_execute"])
    assert.equal(row[key], false, "ISOLATED_LOGIN_FORBIDDEN:" + key);
  assert.deepEqual(row.memberships, [{role: expected.privilege, admin: false, inherit: true, set: false}], "ISOLATED_LOGIN_MEMBERSHIP_CHANGED");
  assert.deepEqual(row.effective_roles, [expected.privilege], "ISOLATED_LOGIN_TRANSITIVE_PRIVILEGE_CHANGED");
}
async function verifyEvidenceLogin(pool, targets, database) {
  const expected = binding(targets, database);
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(SNAPSHOT_SQL, [EVIDENCE_FUNCTION, TWIN_FUNCTION, expected.privilege]);
    assert.equal(result.rows.length, 1, "ISOLATED_LOGIN_IDENTITY_COUNT");
    validateSnapshot(result.rows[0], expected);
    return {status: "ISOLATED_LOGIN_IDENTITY_PASS_NOT_EXECUTION_AUTHORITY", ...expected};
  } finally {
    // Destroy this client if rollback fails, rather than return an open transaction.
    try { await client.query("ROLLBACK"); } catch (error) { client.release(error); throw error; }
    client.release();
  }
}
module.exports = {binding, validateSnapshot, verifyEvidenceLogin, SNAPSHOT_SQL, EVIDENCE_FUNCTION, TWIN_FUNCTION};
