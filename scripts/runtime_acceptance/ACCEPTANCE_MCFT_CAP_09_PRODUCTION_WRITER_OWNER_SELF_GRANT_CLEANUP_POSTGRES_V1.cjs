#!/usr/bin/env node
"use strict";
const cp=require("node:child_process"),assert=require("node:assert/strict");
const url=String(process.env.DATABASE_URL||"").trim();assert.ok(url,"WRITER_OWNER_CLEANUP_ACCEPTANCE_DATABASE_URL_REQUIRED");
const q=sql=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
q([
 "CREATE ROLE cloud_admin CREATEROLE NOLOGIN;",
 "CREATE ROLE neondb_owner CREATEROLE NOLOGIN;",
 "CREATE ROLE geox_mcft_cap09_forcing_writer_owner_v1 NOLOGIN;",
 "GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO cloud_admin WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "SET ROLE cloud_admin;",
 "GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO neondb_owner WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "RESET ROLE;",
 "SET ROLE neondb_owner;",
 "GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO neondb_owner WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;",
 "RESET ROLE;"
].join("\n"));
const rows=()=>q([
 "SELECT grantor.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text",
 "FROM pg_catalog.pg_auth_members m",
 "JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
 "JOIN pg_catalog.pg_roles member ON member.oid=m.member",
 "JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor",
 "WHERE granted.rolname='geox_mcft_cap09_forcing_writer_owner_v1' AND member.rolname='neondb_owner'",
 "ORDER BY grantor.rolname"
].join("\n")).split(/\r?\n/).filter(Boolean);
assert.deepEqual(rows(),["cloud_admin|admin=true|inherit=false|set=false","neondb_owner|admin=false|inherit=true|set=true"]);
assert.equal(q("SELECT pg_catalog.pg_has_role('neondb_owner','geox_mcft_cap09_forcing_writer_owner_v1','SET')::text"),"true");
q(["SET ROLE neondb_owner;","REVOKE geox_mcft_cap09_forcing_writer_owner_v1 FROM CURRENT_USER GRANTED BY CURRENT_USER RESTRICT;","RESET ROLE;"].join("\n"));
assert.deepEqual(rows(),["cloud_admin|admin=true|inherit=false|set=false"]);
assert.equal(q("SELECT pg_catalog.pg_has_role('neondb_owner','geox_mcft_cap09_forcing_writer_owner_v1','SET')::text"),"false");
console.log(JSON.stringify({status:"PASS",acceptance_id:"MCFT_CAP09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_POSTGRES_V1",grantor_scoped_revoke_preserves_management_grant:true,effective_set_removed:true,runtime_process_start:false,production_database_mutation:false},null,2));
