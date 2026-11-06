"use strict";
// Actual Node modules and resolver objects, with immutable original source bytes.
// No diagnostic filesystem/network proxy can escape this loading boundary.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),{fileURLToPath}=require("node:url");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs");
// Empty JavaScript is valid source (some installed dependencies ship it).
// Keep signed/wire JSON on s.bytes(), which must still reject an empty file.
function moduleBytes(file){
 if(!/\.(?:cjs|mjs|js)$/.test(file))return s.bytes(file,64*1024*1024);
 s.check(typeof file==="string"&&path.isAbsolute(file),"V3_ABSOLUTE_FILE");
 const end=path.resolve(file);
 for(let cursor=end;;){const st=fs.lstatSync(cursor);s.check(!st.isSymbolicLink(),"UNSAFE_SYMLINK");
  if(cursor===end)s.check(st.isFile()&&st.nlink===1&&st.size<=64*1024*1024,"V3_REGULAR_FILE");
  const up=path.dirname(cursor);if(up===cursor)break;cursor=up;
 }
 return fs.readFileSync(file);
}
function install(profile,root){
 s.check(typeof Module.registerHooks==="function","V3_NODE_SYNC_LOAD_HOOK_REQUIRED");
 s.check(path.resolve(root)===profile.root,"V3_LOADING_ROOT");
 const index=new Map(profile.files.map(row=>[row.path,row.sha256]));s.check(index.size===profile.files.length,"V3_LOADING_DUPLICATE_PATH");
 const sources=new Map();
 const manifestPins=profile.files.filter(row=>row.path==="package.json"||row.path.endsWith("/package.json"));
 const relative=file=>{const rel=path.relative(root,file);s.check(rel!==""&&!rel.startsWith(".."+path.sep)&&rel!==".."&&!path.isAbsolute(rel),"V3_MODULE_OUTSIDE_RELEASE");return rel.split(path.sep).join("/");};
 // Material is already fully verified by Native Adoption. Snapshot only module
 // source formats; an actually reachable native addon fails explicitly below.
 for(const row of profile.files){if(!/\.(?:cjs|mjs|js|json)$/.test(row.path))continue;
  const raw=moduleBytes(path.join(root,...row.path.split("/")));s.check(s.sha(raw)===row.sha256,"V3_SOURCE_CHANGED_BEFORE_SECRET");sources.set(row.path,raw);}
 for(const file of Object.keys(require.cache)){
  const rel=relative(file);s.check(index.has(rel)&&s.sha(moduleBytes(file))===index.get(rel),"V3_PRELOADED_MODULE_UNBOUND");
 }
 const hook=Module.registerHooks({
  resolve(specifier,context,nextResolve){
   // Node's resolver reads package metadata separately from load(). Guard it
   // before resolution as well as retaining immutable original module bytes.
   for(const row of manifestPins)s.check(s.sha(s.bytes(path.join(root,...row.path.split("/")),64*1024*1024))===row.sha256,"V3_PACKAGE_ROUTE_METADATA_DRIFT");
   const out=nextResolve(specifier,context);if(out.url.startsWith("node:"))return out;
   s.check(out.url.startsWith("file:"),"V3_MODULE_SCHEME");const file=fileURLToPath(out.url);const rel=relative(file);
   s.check(index.has(rel)&&sources.has(rel),"V3_REACHABLE_MODULE_FORMAT_OR_PATH_UNQUALIFIED");return out;},
  load(url,context,nextLoad){if(url.startsWith("node:"))return nextLoad(url,context);
   const rel=relative(fileURLToPath(url));const raw=sources.get(rel);s.check(raw,"V3_MODULE_NOT_SNAPSHOTTED");
   // Ask Node for the native format. Use the pinned original bytes with that
   // format, preserving real exports, cache, require and import semantics.
   const out=nextLoad(url,context);
   // Native hooks leave format undefined for typeless .js. Pass it through so
   // Node detects CJS/ESM from the pinned bytes; never force a guessed format.
   const nativeUndeterminedJs=out.format===undefined&&path.extname(fileURLToPath(url))===".js";
   s.check(["commonjs","module","json"].includes(out.format)||nativeUndeterminedJs,"V3_MODULE_FORMAT_UNSUPPORTED");
   s.check(s.sha(moduleBytes(fileURLToPath(url)))===index.get(rel),"V3_MODULE_DISK_DRIFT");
   return {...out,source:Buffer.from(raw)};
  }
 });
 let closed=false;
 return Object.freeze({
  async preload(){s.check(!closed,"V3_LOADING_CLOSED");
   for(const rel of require("./MCFT_CAP09_R4285_V3_SOURCE_PATHS.cjs").runtimePaths)require(path.join(root,...rel.split("/")));
   require(require.resolve("pg",{paths:[root]}));require(require.resolve("@aws-sdk/client-s3",{paths:[root]}));
   const target=require.resolve("tsx",{paths:[root]});await import(require("node:url").pathToFileURL(target).href);
   return true;},
  close(){if(closed)return;closed=true;hook.deregister();for(const raw of sources.values())raw.fill(0);sources.clear();}
 });
}
module.exports={install};
