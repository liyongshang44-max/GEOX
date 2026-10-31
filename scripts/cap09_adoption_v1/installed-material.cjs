'use strict';
// Read-only content verification. No module import from the inspected trees.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const c=require('./contract.cjs');
function inventory(root){
 c.noLinks(root);assert(path.isAbsolute(root)&&fs.statSync(root).isDirectory(),'MATERIAL_ROOT_REQUIRED');
 const rows=[],folded=new Set();
 function visit(dir,prefix){for(const name of fs.readdirSync(dir).sort()){
  assert(name!=='.'&&name!=='..'&&!/[\\:\x00-\x1f]/.test(name)&&!/[. ]$/.test(name),'MATERIAL_PATH_INVALID');
  const file=path.join(dir,name),rel=prefix+name,key=rel.toLowerCase(),s=fs.lstatSync(file);
  assert(!folded.has(key),'MATERIAL_CASE_COLLISION');folded.add(key);
  assert(!s.isSymbolicLink(),'MATERIAL_LINK_FORBIDDEN');
  if(s.isDirectory())visit(file,rel+'/');else{assert(s.isFile()&&s.nlink===1,'MATERIAL_SPECIAL_FILE');rows.push({path:rel,sha256:c.sha(fs.readFileSync(file))});}
 }}visit(root,'');assert(rows.length,'EMPTY_MATERIAL');return rows;
}
function verify(profile,root,environment=process.env){
 c.exact(profile,['schema','root','files','tools','environment']);
 assert.equal(profile.schema,'CAP09_INSTALLED_MATERIAL_V1');
 assert.equal(path.resolve(root),profile.root,'MATERIAL_LOCATION_CHANGED');
 assert.deepEqual(inventory(root),profile.files,'INSTALLED_MATERIAL_DRIFT');
 c.exact(profile.tools,['node','python','powershell']);
 for(const tool of Object.values(profile.tools)){
  c.exact(tool,['path','sha256']);assert(path.isAbsolute(tool.path));c.noLinks(tool.path);c.hash(tool.sha256);
  assert(fs.statSync(tool.path).isFile());assert.equal(c.sha(fs.readFileSync(tool.path)),tool.sha256,'TOOL_BYTES_CHANGED');
 }
 assert.equal(fs.realpathSync(process.execPath),profile.tools.node.path,'NODE_EXECUTABLE_CHANGED');
 c.exact(profile.environment,['allowed_names','public_values']);
 assert(Array.isArray(profile.environment.allowed_names));
 const allowed=new Set(profile.environment.allowed_names.map(k=>k.toUpperCase()));
 for(const k of Object.keys(environment))assert(allowed.has(k.toUpperCase()),'UNDECLARED_ENVIRONMENT_VARIABLE');
 const publicKeys=['PATH','PATHEXT','SYSTEMROOT','WINDIR','MCFT_PYTHON_EXECUTABLE'];
 for(const k of Object.keys(environment).filter(k=>publicKeys.includes(k.toUpperCase())))assert(Object.hasOwn(profile.environment.public_values,k),'SEARCH_ENVIRONMENT_NOT_BOUND');
 for(const [k,value] of Object.entries(profile.environment.public_values)){
  assert(publicKeys.includes(k.toUpperCase()),'SECRET_OR_UNSUPPORTED_PUBLIC_ENVIRONMENT');
  assert.equal(environment[k],value,'EXECUTION_ENVIRONMENT_DRIFT');
 }
 for(const k of Object.keys(environment))assert(!['NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME'].includes(k.toUpperCase()),'LOADER_INJECTION_FORBIDDEN');
 assert.equal(environment.MCFT_PYTHON_EXECUTABLE,profile.tools.python.path,'PYTHON_EXECUTABLE_CHANGED');
 assert.equal(profile.environment.public_values.MCFT_PYTHON_EXECUTABLE,profile.tools.python.path,'PYTHON_BINDING_REQUIRED');
 return Object.freeze({digest:c.digest(profile),root,file_count:profile.files.length});
}
function outside(root,file){const rel=path.relative(path.resolve(root),path.resolve(file));return rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel);}
function tool(file){const p=fs.realpathSync(path.resolve(file));c.noLinks(p);const s=fs.statSync(p);assert(s.isFile(),'TOOL_FILE_REQUIRED');return {path:p,sha256:c.sha(fs.readFileSync(p))};}
const CHILD_STAGE_ENVIRONMENT_NAMES=Object.freeze([
 'MCFT_QUALIFICATION_FIRST_BASE','MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR',
 'MCFT_SUBJECT_SHA','MCFT_GOVERNED_RETRY_BUNDLE','MCFT_GOVERNED_RETRY_STAGE',
 'MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION','MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE',
 'MCFT_TIMING_SAMPLE_DIR','MCFT_TIMING_RUN_ID','MCFT_TIMING_RUN_ATTEMPT',
 'MCFT_TIMING_WAKE_DELAY_MS','MCFT_TIMING_JOB_START_SETUP_MS','MCFT_TIMING_LOCAL_LAUNCH_AT_MS',
 'MCFT_GOVERNED_RETRY_RUN_ID','MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS',
 'MCFT_TIMING_SAMPLE_ID','MCFT_TIMING_BASE_TARGET',
 'MCFT_GOVERNED_RETRY_TICKET','MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256',
 // Attempt-3 V2 uses a separately signed parent/child domain. The inherited
 // material profile must allow these exact child-only keys up front, so the
 // parent cannot introduce an unbound environment surface after collection.
 'MCFT_ATTEMPT3_V2_CHILD','MCFT_ATTEMPT3_V2_LEDGER_ROOT',
 'MCFT_ATTEMPT3_V2_NONCE','MCFT_ATTEMPT3_V2_PERMIT_ENVELOPE_SHA256',
 'MCFT_ATTEMPT3_V2_OBSERVED_FILE','MCFT_ATTEMPT3_V2_OBSERVATIONS_SHA256',
 // Independent R4285 child-only domain. Existing Attempt-3 names remain
 // unchanged and its previously signed installed profiles are not rewritten.
 'MCFT_R4285_CHILD','MCFT_R4285_LEDGER_ROOT','MCFT_R4285_NONCE',
 'MCFT_R4285_PERMIT_ENVELOPE_SHA256','MCFT_R4285_OBSERVED_FILE',
 'MCFT_R4285_OBSERVATIONS_SHA256'
]);
function collect(root,python,powershell,output,environment=process.env){
 root=fs.realpathSync(path.resolve(root));output=path.resolve(output);c.noLinks(root);assert(fs.statSync(root).isDirectory(),'MATERIAL_ROOT_REQUIRED');assert(outside(root,output),'MATERIAL_OUTPUT_MUST_BE_OUTSIDE_RELEASE');
 const node=tool(process.execPath),py=tool(python),ps=tool(powershell);assert.equal(environment.MCFT_PYTHON_EXECUTABLE,py.path,'MCFT_PYTHON_EXECUTABLE_MUST_MATCH_COLLECTED_PYTHON');
 const allowed_names=[...new Set([...Object.keys(environment),...CHILD_STAGE_ENVIRONMENT_NAMES])].sort();assert(allowed_names.length,'ENVIRONMENT_EMPTY');for(const name of allowed_names)assert(!['NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME'].includes(name.toUpperCase()),'LOADER_INJECTION_PRESENT');
 const publicKeys=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','MCFT_PYTHON_EXECUTABLE']),public_values={};for(const name of allowed_names)if(publicKeys.has(name.toUpperCase()))public_values[name]=environment[name];
 const profile={schema:'CAP09_INSTALLED_MATERIAL_V1',root,files:inventory(root),tools:{node,python:py,powershell:ps},environment:{allowed_names,public_values}};const checked=verify(profile,root,environment);c.writeOnce(output,profile);
 return {status:'INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED',profile_sha256:c.digest(profile),file_count:profile.files.length,root,output,execution_authorized:false,production_authorized:false,checked};
}
function parseCollect(args){const out={};for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];assert(k&&k.startsWith('--')&&v&&!v.startsWith('--'),'USAGE: --root --python --powershell --output');assert(!Object.hasOwn(out,k),'DUPLICATE_ARG');out[k]=v;}assert.deepEqual(Object.keys(out).sort(),['--output','--powershell','--python','--root']);return out;}
module.exports={inventory,verify,outside,tool,collect,parseCollect,CHILD_STAGE_ENVIRONMENT_NAMES};
if(require.main===module){try{assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'MATERIAL_COLLECTION_WINDOWS_OFFLINE_ONLY');const a=parseCollect(process.argv.slice(2));console.log(JSON.stringify(collect(a['--root'],a['--python'],a['--powershell'],a['--output'])));}catch(e){console.error(JSON.stringify({status:'INSTALLED_MATERIAL_COLLECTION_REJECTED',reason:String(e.message||e),execution_authorized:false,production_authorized:false}));process.exitCode=1;}}
