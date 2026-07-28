#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');}
function deriveFormalIdentityV1(contracts){const basis={scope:contracts.run.scope,run_contract_blob:'7a5feecbdb204c8fdf8c21ee8ea66576133c17dd',dataset_semantic_digest:contracts.dataset.semantic_digest,s6_contract_blob:'9cecc1aa6bd4063b770304f2539bc68a1ed2390c'};const h=sha(basis);return{formal_run_id:`cap08_${h.slice(0,32)}`,lineage_id:`twin_lineage_${h.slice(0,24)}`,revision_id:`twin_revision_${h.slice(24,48)}`,identity_basis:basis,identity_digest:`sha256:${h}`};}
function validateRunInstanceV1(runLabel,operationalRunInstanceId){assert.ok(['RUN_A','RUN_B'].includes(runLabel),'RUN_LABEL');assert.match(operationalRunInstanceId,/^[A-Za-z0-9._:-]{8,128}$/,'OPERATIONAL_RUN_INSTANCE_ID');}
module.exports={canonical,sha,deriveFormalIdentityV1,validateRunInstanceV1};
