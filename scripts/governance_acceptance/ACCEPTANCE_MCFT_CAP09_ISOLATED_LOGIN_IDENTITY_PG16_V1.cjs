"use strict";
// Disposable CI service only: never point this fixture at qualification resources.
const assert = require("node:assert/strict");
const {Pool} = require("pg");
const {verifyEvidenceLogin,EVIDENCE_FUNCTION,TWIN_FUNCTION} = require("../runtime_acceptance/MCFT_CAP09_ISOLATED_LOGIN_IDENTITY_V1.cjs");
async function main() {
  assert.equal(process.env.CAP09_DISPOSABLE_PG16, "CI_FIXTURE_ONLY");
  const run = "000000000009";
  const login = `mcft_cap09_${run}_evidence_login`, priv = `mcft_cap09_${run}_evidence_priv`;
  const targets = {isolated_login_run_id:run,positive:`mcft_cap09_requal_${run}_positive`,negative:`mcft_cap09_requal_${run}_negative`,bucket:`mcft-cap09-requal-${run}`};
  const config = {host:"127.0.0.1",port:55439,user:"postgres",password:"disposable-ci-only",database:"postgres"};
  const admin = new Pool(config);
  let checks = 0;
  try {
    const version = await admin.query("SHOW server_version_num");
    assert.equal(Math.floor(Number(version.rows[0].server_version_num)/10000),16);
    await admin.query(`CREATE ROLE ${priv} NOLOGIN; CREATE ROLE ${login} LOGIN INHERIT PASSWORD 'fixture-login-only' VALID UNTIL '2099-01-01'; GRANT ${priv} TO ${login} WITH ADMIN FALSE, INHERIT TRUE, SET FALSE`);
    for (const database of [targets.positive,targets.negative]) {
      await admin.query(`CREATE DATABASE ${database}`);
      const setup = new Pool({...config,database});
      const pool = new Pool({...config,database,user:login,password:"fixture-login-only"});
      try {
        await setup.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC; CREATE TABLE public.facts(id integer)");
        for (const signature of [EVIDENCE_FUNCTION,TWIN_FUNCTION]) {
          await setup.query(`CREATE FUNCTION ${signature} RETURNS void LANGUAGE sql AS 'SELECT'; REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC`);
        }
        await setup.query(`GRANT EXECUTE ON FUNCTION ${EVIDENCE_FUNCTION} TO ${priv}`);
        await verifyEvidenceLogin(pool,targets,database); checks++;
        await assert.rejects(pool.query(`SET ROLE ${priv}`),e=>e.code==="42501"); checks++;
        await assert.rejects(pool.query("INSERT INTO facts VALUES (1)"),e=>e.code==="42501"); checks++;
        await setup.query(`GRANT INSERT ON facts TO ${login}`);
        await assert.rejects(verifyEvidenceLogin(pool,targets,database),/facts_insert/); checks++;
        await setup.query(`REVOKE INSERT ON facts FROM ${login}; GRANT EXECUTE ON FUNCTION ${TWIN_FUNCTION} TO ${login}`);
        await assert.rejects(verifyEvidenceLogin(pool,targets,database),/twin_execute/); checks++;
        await setup.query(`REVOKE EXECUTE ON FUNCTION ${TWIN_FUNCTION} FROM ${login}`);
        await verifyEvidenceLogin(pool,targets,database); checks++;
      } finally {await pool.end(); await setup.end();}
    }
    await admin.query(`GRANT pg_read_all_data TO ${priv}`);
    const pool = new Pool({...config,database:targets.positive,user:login,password:"fixture-login-only"});
    try {await assert.rejects(verifyEvidenceLogin(pool,targets,targets.positive),/TRANSITIVE/); checks++;}
    finally {await pool.end();}
    console.log(JSON.stringify({status:"PASS",checks,postgres_major:16,scope:"DISPOSABLE_CI_IDENTITY_FIXTURE",provider_calls:0,producer_authorized:false}));
  } finally {await admin.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
