'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {digest}=require('./shared_v1.cjs');
function createArtifactWriterV1({root}){return{async writeBundle(bundle){const dir=path.join(root,'acceptance-output');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`MCFT_CAP_08_S6_${bundle.spec.run_label}_FINAL_FORMAL_RUN_BUNDLE.json`);const body={schema_version:'geox_mcft_cap08_s6_final_formal_run_artifact_bundle_v1',artifact_ref:bundle.materialization.artifact_ref,artifact_digest:bundle.materialization.artifact_digest,...bundle};fs.writeFileSync(file,JSON.stringify(body,null,2)+'\n');return{artifact_ref:bundle.materialization.artifact_ref,artifact_digest:bundle.materialization.artifact_digest,transport_file:`file://${file}`,transport_digest:digest(fs.readFileSync(file)),retention_days:365};}};}
module.exports={createArtifactWriterV1};
