"use strict";
/*
 * Exact, bounded-concurrency V2 read-only installed-material verifier.
 * Same SHA256 for EVERY registered file, same complete path inventory,
 * same tool byte/environment binding as installed-material.verify.
 * No manifest cache, trust shortcut, mutation or Permit/Owner handling.
 * Native Adoption still runs its original full synchronous verifier first.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const c=require("../cap09_adoption_v1/contract.cjs");
const MAX_IN_FLIGHT=8;
async function concurrentInventory(root){
 c.noLinks(root);
 assert(path.isAbsolute(root)&&fs.statSync(root).isDirectory(),"MATERIAL_ROOT_REQUIRED");
 const rows=[],paths=[],folded=new Set();
 function visit(dir,prefix){
  for(const name of fs.readdirSync(dir).sort()){
   assert(name!=="."&&name!==".."&&!/[\\:\x00-\x1f]/.test(name)&&!/[. ]$/.test(name),"MATERIAL_PATH_INVALID");
   const file=path.join(dir,name),rel=prefix+name,key=rel.toLowerCase(),st=fs.lstatSync(file);
   assert(!folded.has(key),"MATERIAL_CASE_COLLISION");folded.add(key);
   assert(!st.isSymbolicLink(),"MATERIAL_LINK_FORBIDDEN");
   if(st.isDirectory())visit(file,rel+"/");
   else {assert(st.isFile()&&st.nlink===1,"MATERIAL_SPECIAL_FILE");
    paths.push(file);rows.push({path:rel,sha256:null});}
  }
 }
 visit(root,"");assert(rows.length,"EMPTY_MATERIAL");
 let cursor=0;
 async function worker(){
  for(;;){
   const index=cursor++;if(index>=paths.length)return;
   const bytes=await fs.promises.readFile(paths[index]);
   rows[index].sha256=c.sha(bytes);
  }
 }
 await Promise.all(Array.from({length:Math.min(MAX_IN_FLIGHT,paths.length)},()=>worker()));
 return rows;
}
async function verify(profile,root,environment=process.env){
 c.exact(profile,["schema","root","files","tools","environment"]);
 assert.equal(profile.schema,"CAP09_INSTALLED_MATERIAL_V1");
 assert.equal(path.resolve(root),profile.root,"MATERIAL_LOCATION_CHANGED");
 assert.deepEqual(await concurrentInventory(root),profile.files,"INSTALLED_MATERIAL_DRIFT");
 c.exact(profile.tools,["node","python","powershell"]);
 for(const tool of Object.values(profile.tools)){
  c.exact(tool,["path","sha256"]);assert(path.isAbsolute(tool.path));c.noLinks(tool.path);c.hash(tool.sha256);
  assert(fs.statSync(tool.path).isFile());
  assert.equal(c.sha(await fs.promises.readFile(tool.path)),tool.sha256,"TOOL_BYTES_CHANGED");
 }
 assert.equal(fs.realpathSync(process.execPath),profile.tools.node.path,"NODE_EXECUTABLE_CHANGED");
 c.exact(profile.environment,["allowed_names","public_values"]);
 assert(Array.isArray(profile.environment.allowed_names));
 const allowed=new Set(profile.environment.allowed_names.map(k=>k.toUpperCase()));
 for(const k of Object.keys(environment))assert(allowed.has(k.toUpperCase()),"UNDECLARED_ENVIRONMENT_VARIABLE");
 const publicKeys=["PATH","PATHEXT","SYSTEMROOT","WINDIR","MCFT_PYTHON_EXECUTABLE"];
 for(const k of Object.keys(environment).filter(k=>publicKeys.includes(k.toUpperCase())))
  assert(Object.hasOwn(profile.environment.public_values,k),"SEARCH_ENVIRONMENT_NOT_BOUND");
 for(const [k,value] of Object.entries(profile.environment.public_values)){
  assert(publicKeys.includes(k.toUpperCase()),"SECRET_OR_UNSUPPORTED_PUBLIC_ENVIRONMENT");
  assert.equal(environment[k],value,"EXECUTION_ENVIRONMENT_DRIFT");
 }
 for(const k of Object.keys(environment))
  assert(!["NODE_OPTIONS","NODE_PATH","PYTHONPATH","PYTHONHOME"].includes(k.toUpperCase()),
   "LOADER_INJECTION_FORBIDDEN");
 assert.equal(environment.MCFT_PYTHON_EXECUTABLE,profile.tools.python.path,"PYTHON_EXECUTABLE_CHANGED");
 assert.equal(profile.environment.public_values.MCFT_PYTHON_EXECUTABLE,profile.tools.python.path,
  "PYTHON_BINDING_REQUIRED");
 return Object.freeze({digest:c.digest(profile),root,file_count:profile.files.length,
  concurrency:MAX_IN_FLIGHT,full_sha256:true});
}
module.exports={MAX_IN_FLIGHT,concurrentInventory,verify};
