"use strict";
/* Synthetic temp files only; no Host, Permit or production installed material. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const original=require("../cap09_adoption_v1/installed-material.cjs");
const parallel=require("./MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs");
const c=require("../cap09_adoption_v1/contract.cjs");
function fixture(){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"mcft-r4285-parallel-")));
 fs.mkdirSync(path.join(root,"dir"));
 fs.writeFileSync(path.join(root,"a.txt"),"original");
 fs.writeFileSync(path.join(root,"dir","b.txt"),Buffer.from([0,1,2,3,255]));
 const executable=fs.realpathSync(process.execPath);
 const t={path:executable,sha256:c.sha(fs.readFileSync(executable))};
 const environment={MCFT_PYTHON_EXECUTABLE:executable};
 const profile={schema:"CAP09_INSTALLED_MATERIAL_V1",root,
  files:original.inventory(root),tools:{node:t,python:t,powershell:t},
  environment:{allowed_names:["MCFT_PYTHON_EXECUTABLE"],public_values:{...environment}}};
 return {root,profile,environment};
}
test("V2 full concurrent verifier equals original V1 complete profile and tool digest",async()=>{
 const f=fixture();
 try{
  const before=original.verify(f.profile,f.root,f.environment);
  const after=await parallel.verify(f.profile,f.root,f.environment);
  assert.equal(after.digest,before.digest);
  assert.equal(after.file_count,before.file_count);
  assert.equal(after.full_sha256,true);
  assert.deepEqual(await parallel.concurrentInventory(f.root),f.profile.files);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test("modified material bytes cannot pass fast full verifier",async()=>{
 const f=fixture();
 try{
  fs.writeFileSync(path.join(f.root,"dir","b.txt"),Buffer.from([0,1,2,4,255]));
  await assert.rejects(parallel.verify(f.profile,f.root,f.environment),/INSTALLED_MATERIAL_DRIFT/);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test("new unseen file, missing file and unexpected environment fail closed",async()=>{
 const f=fixture();
 try{
  fs.writeFileSync(path.join(f.root,"unexpected.txt"),"x");
  await assert.rejects(parallel.verify(f.profile,f.root,f.environment),/INSTALLED_MATERIAL_DRIFT/);
  fs.rmSync(path.join(f.root,"unexpected.txt"));
  fs.rmSync(path.join(f.root,"a.txt"));
  await assert.rejects(parallel.verify(f.profile,f.root,f.environment),/INSTALLED_MATERIAL_DRIFT/);
  fs.writeFileSync(path.join(f.root,"a.txt"),"original");
  await assert.rejects(parallel.verify(f.profile,f.root,{...f.environment,EXTRA:"1"}),/UNDECLARED_ENVIRONMENT_VARIABLE/);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test("tampered tool digest and public environment bindings fail closed",async()=>{
 const f=fixture();
 try{
  const tampered={...f.profile,tools:{...f.profile.tools,
   python:{...f.profile.tools.python,sha256:"f".repeat(64)}}};
  await assert.rejects(parallel.verify(tampered,f.root,f.environment),/TOOL_BYTES_CHANGED/);
  await assert.rejects(parallel.verify(f.profile,f.root,
   {MCFT_PYTHON_EXECUTABLE:"C:\\wrong\\python.exe"}),/EXECUTION_ENVIRONMENT_DRIFT/);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
