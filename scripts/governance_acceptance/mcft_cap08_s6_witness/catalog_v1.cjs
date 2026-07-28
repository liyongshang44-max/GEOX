#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../../..');
const CAP='docs/digital_twin/mcft/cap_08';
const PATHS={
 ledger:`${CAP}/GEOX-MCFT-CAP-08-HARD-ACCEPTANCE-LEDGER-V1.json`,
 rules:[`${CAP}/GEOX-MCFT-CAP-08-S6-HA-MAPPING-RULES-00-08-V1.json`,`${CAP}/GEOX-MCFT-CAP-08-S6-HA-MAPPING-RULES-09-16-V1.json`,`${CAP}/GEOX-MCFT-CAP-08-S6-HA-MAPPING-RULES-17-23-V1.json`],
 proofs:[`${CAP}/GEOX-MCFT-CAP-08-S6-HA-PROOF-CONTRACTS-00-08-V1.json`,`${CAP}/GEOX-MCFT-CAP-08-S6-HA-PROOF-CONTRACTS-09-16-V1.json`,`${CAP}/GEOX-MCFT-CAP-08-S6-HA-PROOF-CONTRACTS-17-23-V1.json`],
 freeze:`${CAP}/GEOX-MCFT-CAP-08-S6-HA-MAPPING-FREEZE-AUTHORITY-V1.json`,
 authority:`${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-IMPLEMENTATION-AUTHORITY-V1.json`,
};
function readJson(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));}
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function gitBlob(p,ref='HEAD'){return git('rev-parse',`${ref}:${p}`);}
function loadWitnessCatalogV1({localReplay=process.env.MCFT_LOCAL_REPLAY==='1'}={}){
 const ledger=readJson(PATHS.ledger); const freeze=readJson(PATHS.freeze); const authority=readJson(PATHS.authority);
 assert.equal(ledger.record_status,'FROZEN_S0_CONTRACT'); assert.equal(ledger.item_count,24); assert.equal(ledger.items.length,24);
 assert.equal(freeze.record_status,'HA_MAPPING_FROZEN'); assert.equal(freeze.freeze_effect.mapping_frozen,true);
 assert.equal(authority.record_status,'WITNESS_IMPLEMENTATION_AUTHORIZED'); assert.equal(authority.authority_scope.witness_implementation_authorized,true);
 assert.equal(authority.forbidden_scope.dual_run_ci_authorized,false); assert.equal(authority.forbidden_scope.final_formal_closure_run_authorized,false); assert.equal(authority.forbidden_scope.cross_run_comparator_authorized,false);
 const rules=PATHS.rules.flatMap((p)=>readJson(p).rules); assert.equal(rules.length,24);
 const proofContracts={}; for(const p of PATHS.proofs){const shard=readJson(p); for(const [id,c] of Object.entries(shard.proof_contracts)){assert.equal(proofContracts[id],undefined,`DUPLICATE_PROOF_CONTRACT:${id}`); proofContracts[id]=c;}}
 assert.equal(Object.keys(proofContracts).length,25);
 const byContract={}; for(const rule of rules){const identity=ledger.items[rule.ledger_index]; assert.ok(identity,`MISSING_LEDGER_IDENTITY:${rule.ledger_index}`); for(const id of rule.proof_contract_refs){assert.ok(proofContracts[id],`MISSING_PROOF_CONTRACT:${id}`); assert.equal(byContract[id],undefined,`DUPLICATE_PROOF_MAPPING:${id}`); byContract[id]={proof_contract_id:id,ledger_index:rule.ledger_index,item_id:identity.item_id,requirement:identity.requirement,finalization_profile:rule.finalization_profile,...proofContracts[id]};}}
 assert.deepEqual(Object.keys(byContract).sort(),Object.keys(proofContracts).sort());
 const producers=[...new Set(Object.values(byContract).map((c)=>c.producer_id))].sort();
 if(!localReplay){assert.equal(gitBlob(PATHS.freeze),'31ddd43cf161ace780fbf791f164bf59e61c80e1'); assert.equal(gitBlob(PATHS.authority),'163b270eeae9dfc5da5a583ea464540411d51404');}
 return {ledger,freeze,authority,rules,byContract,proofContracts,producerIds:producers,paths:PATHS};
}
module.exports={ROOT,PATHS,readJson,git,gitBlob,loadWitnessCatalogV1};
