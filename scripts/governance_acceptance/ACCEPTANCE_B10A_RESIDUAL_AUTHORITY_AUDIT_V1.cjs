#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const repoRoot = process.cwd();
const inventoryPath = path.join(repoRoot,"docs/architecture/semantic_convergence/GEOX-B10A-RESIDUAL-AUTHORITY-INVENTORY-V1.json");
const b02Path = path.join(repoRoot,"docs/architecture/semantic_convergence/GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath,"utf8"));
const b02 = JSON.parse(fs.readFileSync(b02Path,"utf8"));
const normalize=p=>p.split(path.sep).join("/");
const exists=p=>fs.existsSync(path.join(repoRoot,p));
function listFiles(root){const start=path.join(repoRoot,root);if(!fs.existsSync(start))return[];const out=[];const stack=[start];while(stack.length){const d=stack.pop();for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);const rp=normalize(path.relative(repoRoot,p));if(inventory.scan_policy.ignore_path_fragments.some(x=>rp.includes(x)))continue;if(e.isDirectory())stack.push(p);else if(e.isFile()&&inventory.scan_policy.extensions.some(x=>rp.endsWith(x)))out.push(rp);}}return out;}
const b02Paths=new Set();for(const s of b02.semantics||[]){for(const p of s.registered_producers||[])if(p.path)b02Paths.add(p.path);for(const c of s.registered_consumers||[])if(c.path)b02Paths.add(c.path);}for(const g of b02.static_guards||[])for(const p of g.registered_paths||[])b02Paths.add(p);
const residual=new Map((inventory.registered_surfaces||[]).map(x=>[x.path,x]));
const classified=new Set([...b02Paths,...residual.keys()]);
const failures=[];const detections=[];
for(const x of inventory.registered_surfaces||[]){for(const k of inventory.required_surface_fields||[]){if(!(k in x))failures.push(`INVENTORY_FIELD_MISSING:${x.path}:${k}`);}if(x.current_tree!==false&&!exists(x.path))failures.push(`INVENTORY_PATH_MISSING:${x.path}`);}
for(const root of inventory.scan_policy.roots){for(const rp of listFiles(root)){const content=fs.readFileSync(path.join(repoRoot,rp),"utf8");for(const d of inventory.detectors){const all=(d.all_of||[]).every(x=>content.includes(x));const any=(d.any_of||[]).length===0||(d.any_of||[]).some(x=>content.includes(x));if(!all||!any)continue;const capability=(d.capability_any_of||[]).length===0||(d.capability_any_of||[]).some(x=>{if(x.startsWith("re:")){try{return new RegExp(x.slice(3),"m").test(content);}catch{return false;}}return content.includes(x);});if(!capability)continue;detections.push({path:rp,detector_id:d.detector_id,semantic_family:d.semantic_family,kind:d.kind});if(!classified.has(rp))failures.push(`UNREGISTERED_AUTHORITY_CAPABLE_PATH:${d.semantic_family}:${d.kind}:${rp}:${d.detector_id}`);}}}
for(const ext of inventory.out_of_tree_frontiers||[]){for(const k of ["repository","pr","head","semantic_family","classification"]){if(!ext[k])failures.push(`OUT_OF_TREE_FRONTIER_FIELD_MISSING:${ext.pr||"UNKNOWN"}:${k}`);}}
const unique=[...new Map(detections.map(x=>[`${x.path}|${x.detector_id}`,x])).values()];
const detectedPaths=new Set(unique.map(x=>x.path));
for(const [p,s] of residual){if(s.current_tree!==false&&!detectedPaths.has(p)&&s.detection_required===true)failures.push(`REGISTERED_SURFACE_NOT_DETECTED:${p}`);}
console.log("B10A_RESIDUAL_AUTHORITY_AUDIT_STATS "+JSON.stringify({roots:inventory.scan_policy.roots.length,detectors:inventory.detectors.length,b02_classified_paths:b02Paths.size,residual_registered_paths:residual.size,detected_paths:detectedPaths.size,detections:unique.length,failures:failures.length}));
for(const x of unique.sort((a,b)=>a.path.localeCompare(b.path)||a.detector_id.localeCompare(b.detector_id)))console.log(`DETECTED ${x.semantic_family} ${x.kind} ${x.path} ${x.detector_id} classification=${b02Paths.has(x.path)?"B02_REGISTERED":residual.has(x.path)?"B10A_REGISTERED":"UNREGISTERED"}`);
for(const f of [...new Set(failures)].sort())console.error("FAIL "+f);
if(failures.length){console.error(`B10A_RESIDUAL_AUTHORITY_AUDIT_FAIL count=${new Set(failures).size}`);process.exitCode=1;}else console.log("B10A_RESIDUAL_AUTHORITY_AUDIT_PASS");
