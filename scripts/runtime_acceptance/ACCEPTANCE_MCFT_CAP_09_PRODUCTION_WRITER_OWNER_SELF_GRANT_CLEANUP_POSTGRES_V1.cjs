#!/usr/bin/env node
"use strict";
const cp=require("node:child_process"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const adminUrl=String(process.env.DATABASE_URL||"").trim();assert.ok(adminUrl,"MUTATION_SEQUENCE_ACCEPTANCE_DATABASE_URL_REQUIRED");
const subject=String(process.env.SUBJECT_SHA||"1".repeat(40));assert.match(subject,/^[0-9a-f]{40}$/);
const cleanupAuthorityPath=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-WRITER-OWNER-SELF-GRANT-CLEANUP-AUTHORITY-V1.json");
const cleanupArmPath=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_ARM_V1.json");
const aclAuthorityPath=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACL-CARRYFORWARD-REMEDIATION-AUTHORITY-V1.json");
const aclArmPath=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_ARM_V1.json");
const cleanupPrefOut=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_PREFLIGHT_V1_RESULT.json");
const cleanupRunOut=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1_RESULT.json");
const aclPrefOut=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_PREFLIGHT_V1_RESULT.json");
const aclRunOut=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1_RESULT.json");
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const w=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const run=(script,seed)=>cp.execFileSync("node",[script],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env:{...process.env,SUBJECT_SHA:subject,SEED_DATABASE_URL:seed}});
const targetUrl="postgresql://neondb_owner:neonpass@127.0.0.1:5432/"+TARGET;
const seedUrl="postgresql://neondb_owner:neonpass@127.0.0.1:5432/postgres";

q(adminUrl,[
 "CREATE ROLE cloud_admin CREATEROLE NOLOGIN;",
 "CREATE ROLE neon_superuser NOLOGIN;",
 "CREATE ROLE neondb_owner CREATEROLE LOGIN PASSWORD 'neonpass';",
 "CREATE ROLE geox_mcft_cap09_evidence_writer_owner_v1 NOLOGIN;",
 "CREATE ROLE geox_mcft_cap09_forcing_writer_owner_v1 NOLOGIN;",
 "CREATE ROLE geox_mcft_cap09_twin_writer_owner_v1 NOLOGIN;",
 "CREATE ROLE geox_mcft_cap09_evidence_runtime_v1 NOLOGIN;",
 "CREATE ROLE geox_mcft_cap09_twin_runtime_v1 NOLOGIN;",
 "CREATE ROLE geox_mcft_cap09_evidence_runtime_login_v1 LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'evidencepass';",
 "CREATE ROLE geox_mcft_cap09_twin_runtime_login_v1 LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'twinpass';",
 "GRANT geox_mcft_cap09_evidence_runtime_v1 TO geox_mcft_cap09_evidence_runtime_login_v1 WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;",
 "GRANT geox_mcft_cap09_twin_runtime_v1 TO geox_mcft_cap09_twin_runtime_login_v1 WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;",
 "GRANT geox_mcft_cap09_evidence_writer_owner_v1 TO cloud_admin WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO cloud_admin WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "GRANT geox_mcft_cap09_twin_writer_owner_v1 TO cloud_admin WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "SET ROLE cloud_admin;",
 "GRANT geox_mcft_cap09_evidence_writer_owner_v1 TO neondb_owner WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO neondb_owner WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "GRANT geox_mcft_cap09_twin_writer_owner_v1 TO neondb_owner WITH ADMIN TRUE, INHERIT FALSE, SET FALSE;",
 "RESET ROLE;",
 "SET ROLE neondb_owner;",
 "GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO neondb_owner WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;",
 "RESET ROLE;"
].join("\n"));

const forcingRows=()=>q(adminUrl,[
 "SELECT grantor.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text",
 "FROM pg_catalog.pg_auth_members m",
 "JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
 "JOIN pg_catalog.pg_roles member ON member.oid=m.member",
 "JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor",
 "WHERE granted.rolname='geox_mcft_cap09_forcing_writer_owner_v1' AND member.rolname='neondb_owner'",
 "ORDER BY grantor.rolname"
].join("\n")).split(/\r?\n/).filter(Boolean);
assert.deepEqual(forcingRows(),["cloud_admin|admin=true|inherit=false|set=false","neondb_owner|admin=false|inherit=true|set=true"]);
assert.equal(q(adminUrl,"SELECT pg_catalog.pg_has_role('neondb_owner','geox_mcft_cap09_forcing_writer_owner_v1','SET')::text"),"true");
q(adminUrl,["SET ROLE neondb_owner;","REVOKE geox_mcft_cap09_forcing_writer_owner_v1 FROM CURRENT_USER GRANTED BY CURRENT_USER RESTRICT;","RESET ROLE;"].join("\n"));
assert.deepEqual(forcingRows(),["cloud_admin|admin=true|inherit=false|set=false"]);
assert.equal(q(adminUrl,"SELECT pg_catalog.pg_has_role('neondb_owner','geox_mcft_cap09_forcing_writer_owner_v1','SET')::text"),"false");
q(adminUrl,["SET ROLE neondb_owner;","GRANT geox_mcft_cap09_forcing_writer_owner_v1 TO CURRENT_USER WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;","RESET ROLE;"].join("\n"));
assert.equal(q(adminUrl,"SELECT pg_catalog.pg_has_role('neondb_owner','geox_mcft_cap09_forcing_writer_owner_v1','SET')::text"),"true");

q(adminUrl,"CREATE DATABASE "+TARGET+" OWNER neondb_owner;");

const keyTables=[
 "facts",
 "external_evidence_producer_lease_v1",
 "external_evidence_supply_event_v1",
 "external_evidence_supply_cursor_v1",
 "twin_external_formal_forcing_base_cursor_v1",
 "twin_external_formal_forcing_base_target_v1",
 "twin_external_formal_forcing_controller_lease_v1"
];
const filler=Array.from({length:34},(_,i)=>"fixture_zero_"+String(i+1).padStart(2,"0"));
q(targetUrl,[...keyTables,...filler].map(t=>'CREATE TABLE public."'+t+'" (id bigint PRIMARY KEY);').join("\n"));
q(targetUrl,[
 "CREATE FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;",
 "CREATE FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;",
 "CREATE FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;",
 "REVOKE ALL ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) FROM PUBLIC;",
 "REVOKE ALL ON FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb) FROM PUBLIC;",
 "REVOKE ALL ON FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) FROM PUBLIC;",
 "GRANT EXECUTE ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) TO geox_mcft_cap09_evidence_runtime_v1;",
 "GRANT EXECUTE ON FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb) TO geox_mcft_cap09_evidence_runtime_v1;",
 "GRANT EXECUTE ON FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) TO geox_mcft_cap09_twin_runtime_v1;",
 "GRANT SELECT ON TABLE public.facts TO geox_mcft_cap09_evidence_runtime_v1;",
 "GRANT SELECT,INSERT,UPDATE ON TABLE public.twin_external_formal_forcing_base_cursor_v1,public.twin_external_formal_forcing_base_target_v1,public.twin_external_formal_forcing_controller_lease_v1 TO geox_mcft_cap09_evidence_runtime_v1;"
].join("\n"));
assert.equal(Number(q(targetUrl,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")),41);
assert.equal(Number(q(targetUrl,"SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")),3);

// 1. Unarmed cleanup prestate.
run("scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1.cjs",seedUrl);
assert.equal(j(cleanupPrefOut).status,"PASS_CLEANUP_REQUIRED");
run("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1.cjs",seedUrl);
assert.equal(j(cleanupRunOut).status,"SKIPPED_NOT_ARMED");

// 2. Arm cleanup and execute exact grantor-scoped revoke.
{
 const a=j(cleanupAuthorityPath),arm=j(cleanupArmPath);
 a.status="EXACT_SELF_GRANT_CLEANUP_AUTHORIZED";
 a.authorization.production_writer_owner_self_grant_cleanup_authorized=true;
 arm.armed=true;arm.exact_target_database_name=TARGET;arm.production_writer_owner_self_grant_cleanup_authorized=true;
 w(cleanupAuthorityPath,a);w(cleanupArmPath,arm);
}
run("scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1.cjs",seedUrl);
assert.equal(j(cleanupPrefOut).status,"PASS_CLEANUP_REQUIRED");
run("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1.cjs",seedUrl);
const cleanupApplied=j(cleanupRunOut);
assert.equal(cleanupApplied.status,"PASS_CLEANUP_APPLIED");
assert.equal(cleanupApplied.public_table_acl_unchanged,true);
assert.equal(cleanupApplied.public_function_acl_unchanged,true);
assert.equal(cleanupApplied.service_login_memberships_unchanged,true);

// 3. Disarm cleanup and prove stable poststate.
{
 const a=j(cleanupAuthorityPath),arm=j(cleanupArmPath);
 a.status="EXACT_SELF_GRANT_CLEANUP_APPLIED";
 a.authorization.production_writer_owner_self_grant_cleanup_authorized=false;
 arm.armed=false;arm.exact_target_database_name=null;arm.production_writer_owner_self_grant_cleanup_authorized=false;
 w(cleanupAuthorityPath,a);w(cleanupArmPath,arm);
}
run("scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1.cjs",seedUrl);
assert.equal(j(cleanupPrefOut).status,"PASS_ALREADY_CLEAN");
run("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1.cjs",seedUrl);
assert.equal(j(cleanupRunOut).status,"SKIPPED_NOT_ARMED");

// 4. Establish exact-nine ready/unarmed state.
{
 const a=j(aclAuthorityPath),arm=j(aclArmPath);
 a.status="LIVE_EXACT_NINE_REMEDIATION_READY_NOT_AUTHORIZED";
 a.authorization.production_evidence_acl_carryforward_remediation_authorized=false;
 arm.armed=false;arm.exact_target_database_name=null;arm.production_evidence_acl_carryforward_remediation_authorized=false;
 w(aclAuthorityPath,a);w(aclArmPath,arm);
}
run("scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",seedUrl);
const aclReady=j(aclPrefOut);
assert.equal(aclReady.status,"PASS_REMEDIATION_REQUIRED");
assert.equal(aclReady.missing_privileges.length,9);
run("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",seedUrl);
assert.equal(j(aclRunOut).status,"SKIPPED_NOT_ARMED");

// 5. Arm and execute exact-nine ACL-only remediation.
{
 const a=j(aclAuthorityPath),arm=j(aclArmPath);
 a.status="LIVE_EXACT_NINE_REMEDIATION_AUTHORIZED";
 a.authorization.production_evidence_acl_carryforward_remediation_authorized=true;
 arm.armed=true;arm.exact_target_database_name=TARGET;arm.production_evidence_acl_carryforward_remediation_authorized=true;
 w(aclAuthorityPath,a);w(aclArmPath,arm);
}
run("scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",seedUrl);
assert.equal(j(aclPrefOut).status,"PASS_REMEDIATION_REQUIRED");
run("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",seedUrl);
const aclApplied=j(aclRunOut);
assert.equal(aclApplied.status,"PASS_REMEDIATION_APPLIED");
assert.equal(aclApplied.non_target_table_acl_unchanged,true);
assert.equal(aclApplied.function_acl_unchanged,true);
assert.equal(aclApplied.role_memberships_unchanged,true);

// 6. Disarm and prove exact-nine poststate is stable/idempotent.
{
 const a=j(aclAuthorityPath),arm=j(aclArmPath);
 a.status="LIVE_EXACT_NINE_REMEDIATION_APPLIED";
 a.authorization.production_evidence_acl_carryforward_remediation_authorized=false;
 arm.armed=false;arm.exact_target_database_name=null;arm.production_evidence_acl_carryforward_remediation_authorized=false;
 w(aclAuthorityPath,a);w(aclArmPath,arm);
}
run("scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",seedUrl);
assert.equal(j(aclPrefOut).status,"PASS_ALREADY_MATERIALIZED");
run("scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1.cjs",seedUrl);
assert.equal(j(aclRunOut).status,"SKIPPED_NOT_ARMED");

console.log(JSON.stringify({
 status:"PASS",
 acceptance_id:"MCFT_CAP09_PRODUCTION_ACL_OWNER_MUTATION_SEQUENCE_POSTGRES_V1",
 grantor_scoped_revoke_preserves_management_grant:true,
 cleanup_authority_arm_binding_proven:true,
 cleanup_poststate_disarm_proven:true,
 exact_nine_authority_arm_binding_proven:true,
 exact_nine_partial_state_guard_exercised_by_exact_prestate:true,
 exact_nine_poststate_disarm_proven:true,
 production_database_mutation:false,
 runtime_process_start:false
},null,2));
