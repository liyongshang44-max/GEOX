#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");

const CONTRACT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-QUALIFICATION-COMPATIBILITY-CONTRACT-V1.json";
const FROZEN_V11_SUBJECT = "abf0aa121001480f01ad4e39364b1df13f3c26eb";
const REQUIRED_SUCCESSOR_GOVERNED_PATHS = [
  "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.ts",
  "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T4R1_AMENDMENT_19_PERSISTENT_24T_SUCCESSOR.ts",
  "scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_arm_v1.ts",
];

function fail(code) { throw new Error(code); }
function need(v, code) { if (!v) fail(code); }
function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function exactSha(value, code) { const s=String(value||"").trim(); if(!/^[0-9a-f]{40}$/.test(s))fail(code); return s; }
function isGoverned(rel, c) {
  return c.governed_semantic_exact_paths.includes(rel) || c.governed_semantic_path_prefixes.some(prefix => rel.startsWith(prefix));
}
function snapshot(sha, c) {
  const raw=git("ls-tree","-r",sha);
  const entries=raw.split("\n").filter(Boolean).map(line=>{const m=line.match(/^\d+\s+\w+\s+([0-9a-f]{40})\t(.+)$/);if(!m)fail(`MCFT_CAP09_FRESH_QUAL_TREE_PARSE:${line}`);return{blob_sha:m[1],path:m[2]};}).filter(e=>isGoverned(e.path,c)).sort((a,b)=>a.path.localeCompare(b.path));
  need(entries.length>0,"MCFT_CAP09_FRESH_QUAL_GOVERNED_SET_EMPTY");
  const canonical=entries.map(e=>`${e.path}\0${e.blob_sha}`).join("\n");
  return { entries, digest:`sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}` };
}

function main() {
  const head=exactSha(git("rev-parse","HEAD"),"MCFT_CAP09_FRESH_QUAL_HEAD_REQUIRED");
  const base=FROZEN_V11_SUBJECT;
  const ancestor=spawnSync("git",["merge-base","--is-ancestor",base,head]);
  need(ancestor.status===0,"MCFT_CAP09_FRESH_QUAL_V11_ANCESTOR_REQUIRED");
  const c=JSON.parse(fs.readFileSync(CONTRACT,"utf8"));
  need(c.schema_version==="geox_mcft_cap09_amendment19_qualification_compatibility_contract_v1","MCFT_CAP09_FRESH_QUAL_CONTRACT_REQUIRED");
  const source=snapshot(base,c), deployment=snapshot(head,c);
  const changedRaw=git("diff","--name-only",`${base}..${head}`);
  const changed=changedRaw?changedRaw.split("\n").filter(Boolean).sort():[];
  const governedChanged=changed.filter(p=>isGoverned(p,c));
  need(source.digest!==deployment.digest,"MCFT_CAP09_FRESH_QUAL_SEMANTIC_DIGEST_MUST_CHANGE");
  need(governedChanged.length>0,"MCFT_CAP09_FRESH_QUAL_GOVERNED_CHANGE_REQUIRED");
  for(const p of REQUIRED_SUCCESSOR_GOVERNED_PATHS) need(governedChanged.includes(p),`MCFT_CAP09_FRESH_QUAL_REQUIRED_GOVERNED_PATH_MISSING:${p}`);
  const result={
    schema_version:"geox_mcft_cap09_fresh_qualification_required_classification_v1",
    status:"PASS",
    classification:"FRESH_QUALIFICATION_REQUIRED",
    source_qualification_generation:"v11",
    source_qualification_subject_sha:base,
    deployment_subject_sha:head,
    source_governed_semantic_digest:source.digest,
    deployment_governed_semantic_digest:deployment.digest,
    governed_changed_paths:governedChanged,
    qualification_reexecution_required:true,
    target_qualification_generation:"v12",
    target_formal_store_generation:"v4",
    qualification_database_rewrite_authorized:false,
    predecessor_v11_reuse_authorized:false,
    predecessor_failed_v3_continuation_authorized:false,
    formal_database_write_count:0,
    scheduler_write_count:0,
    runtime_write_count:0,
    formal_effect:false,
  };
  fs.mkdirSync("acceptance-output",{recursive:true});
  fs.writeFileSync("acceptance-output/MCFT_CAP_09_FRESH_QUALIFICATION_REQUIRED_CLASSIFICATION_V1.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
}

try { main(); } catch (e) { console.error(e instanceof Error?e.message:String(e)); process.exitCode=1; }
