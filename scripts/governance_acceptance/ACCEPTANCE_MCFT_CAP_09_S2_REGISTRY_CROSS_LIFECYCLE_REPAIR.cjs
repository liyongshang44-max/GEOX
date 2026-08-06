#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs';
const SOURCE_COMMIT='f1cd8ea7d569a6b1e87834ba3336c3969ac57494';
const SOURCE_BLOB='21350ca178bba4968ffe3f0358008138de486db3';
function blob(value){const b=Buffer.from(value);return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');}
function replaceExact(source,from,to,count,code){
 const actual=source.split(from).length-1;
 if(actual!==count)throw new Error(`${code}_CARDINALITY:${actual}`);
 return source.split(from).join(to);
}
let source=cp.execFileSync('git',['show',`${SOURCE_COMMIT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});
if(blob(source)!==SOURCE_BLOB)throw new Error('FROZEN_FAILED_WRAPPER_BLOB_MISMATCH');
source=replaceExact(source,
 "must(run(['rev-list','--count',\\`${base}..HEAD\\`])==='1','ONE_COMMIT_REQUIRED');",
 "must(run(['rev-list','--count',base+'..HEAD'])==='1','ONE_COMMIT_REQUIRED');",
 2,'REV_LIST_INTERPOLATION');
source=replaceExact(source,
 "must(run(['rev-parse',\\`${base}:${file}\\`])===run(['rev-parse',\\`HEAD:${file}\\`]),\\`FROZEN_BLOB_DRIFT:${file}\\`);",
 "must(run(['rev-parse',base+':'+file])===run(['rev-parse','HEAD:'+file]),'FROZEN_BLOB_DRIFT:'+file);",
 1,'FROZEN_BLOB_INTERPOLATION');
source=replaceExact(source,
 "must(classifier.includes(token),\\`CLASSIFIER_TOKEN:${token}\\`);",
 "must(classifier.includes(token),'CLASSIFIER_TOKEN:'+token);",
 1,'CLASSIFIER_INTERPOLATION');
source=replaceExact(source,
 "must(router.includes(token),\\`ROUTER_TOKEN:${token}\\`);",
 "must(router.includes(token),'ROUTER_TOKEN:'+token);",
 1,'ROUTER_INTERPOLATION');
for(const forbidden of ['\\`${base}..HEAD\\`','\\`${base}:${file}\\`','\\`HEAD:${file}\\`','\\`FROZEN_BLOB_DRIFT:${file}\\`','\\`CLASSIFIER_TOKEN:${token}\\`','\\`ROUTER_TOKEN:${token}\\`']){
 if(source.includes(forbidden))throw new Error(`NESTED_INTERPOLATION_REMAINS:${forbidden}`);
}
const temp=path.join(__dirname,`.mcft-cap09-s4-cross-r2-${process.pid}.cjs`);
try{
 fs.writeFileSync(temp,source);
 const syntax=cp.spawnSync(process.execPath,['--check',temp],{cwd:ROOT,encoding:'utf8'});
 if(syntax.status!==0)throw new Error(`GENERATED_WRAPPER_SYNTAX:${syntax.stderr||syntax.stdout}`);
 const result=cp.spawnSync(process.execPath,[temp,...process.argv.slice(2)],{cwd:ROOT,env:process.env,stdio:'inherit'});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}finally{try{fs.unlinkSync(temp);}catch{}}
