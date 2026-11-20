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
 const sync=typeof Module.registerHooks==="function";
 s.check(sync||(process.version==="v20.20.2"&&typeof Module.register==="function"),"V3_NODE_SYNC_LOAD_HOOK_REQUIRED");
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
 const hooks={
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
 };
 const hook=sync?Module.registerHooks(hooks):installNode20(root,index,sources,manifestPins);
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

// Node 20 async hooks do not intercept legacy CJS require. Keep the real CJS
// loader/Module/cache and guard its resolve, load and compile boundaries too.
// Never provide CJS source through async hooks: that removes native CJS APIs.
function installNode20(root,index,sources,manifestPins){
 const {MessageChannel}=require("node:worker_threads"),{pathToFileURL}=require("node:url");
 const original={load:Module._load,resolve:Module._resolveFilename,compile:Module.prototype._compile,json:Module._extensions[".json"]};
 let closed=false;
 const relative=file=>{const rel=path.relative(root,file);s.check(rel!==""&&!rel.startsWith(".."+path.sep)&&rel!==".."&&!path.isAbsolute(rel),"V3_MODULE_OUTSIDE_RELEASE");return rel.split(path.sep).join("/");};
 const builtin=Module.isBuiltin;
 const metadata=()=>{for(const row of manifestPins)s.check(s.sha(s.bytes(path.join(root,...row.path.split("/")),64*1024*1024))===row.sha256,"V3_PACKAGE_ROUTE_METADATA_DRIFT");};
 function pinned(file){const rel=relative(file),raw=sources.get(rel);s.check(index.has(rel)&&raw,"V3_REACHABLE_MODULE_FORMAT_OR_PATH_UNQUALIFIED");s.check(s.sha(moduleBytes(file))===index.get(rel),"V3_MODULE_DISK_DRIFT");return raw;}
 function resolve(request,parent,isMain,options){if(closed)return Reflect.apply(original.resolve,this,arguments);metadata();const file=Reflect.apply(original.resolve,this,arguments);if(!builtin(file))pinned(file);return file;}
 function load(request,parent,isMain){if(closed)return Reflect.apply(original.load,this,arguments);metadata();if(!builtin(request)){const file=Reflect.apply(original.resolve,Module,[request,parent,isMain]);pinned(file);}return Reflect.apply(original.load,this,arguments);}
 function compile(content,filename,format){if(closed)return Reflect.apply(original.compile,this,arguments);metadata();const raw=pinned(filename);s.check(typeof content==="string"&&s.sha(Buffer.from(content))===s.sha(raw),"V3_MODULE_DISK_DRIFT");return Reflect.apply(original.compile,this,[raw.toString("utf8"),filename,format]);}
 function json(module,filename){if(closed)return Reflect.apply(original.json,this,arguments);metadata();const raw=pinned(filename);try{module.exports=JSON.parse(raw.toString("utf8").replace(/^\uFEFF/,""));}catch(error){error.message=filename+": "+error.message;throw error;}}
 const flag=new Int32Array(new SharedArrayBuffer(4));Atomics.store(flag,0,1);
 const {port1,port2}=new MessageChannel();port1.unref();
 const source=`const hooks=(${node20AsyncHooks.toString()})();export const initialize=hooks.initialize;export const resolve=hooks.resolve;export const load=hooks.load;`;
 // Register before changing CJS state. A registration failure leaves no CJS hook.
 Module.register("data:text/javascript,"+encodeURIComponent(source),{parentURL:pathToFileURL(__filename).href,data:{root,files:[...index],sources:[...sources],manifests:manifestPins,flag:flag.buffer,port:port2},transferList:[port2]});
 Module._resolveFilename=resolve;Module._load=load;Module.prototype._compile=compile;Module._extensions[".json"]=json;
 return {deregister(){if(closed)return;closed=true;
  const intact=Module._load===load&&Module.prototype._compile===compile;
  // Qualified tsx legitimately wraps resolution/extensions during preload.
  // Preserve its wrappers; our enclosed delegates become inactive on close.
  if(Module._resolveFilename===resolve)Module._resolveFilename=original.resolve;
  if(Module._load===load)Module._load=original.load;
  if(Module.prototype._compile===compile)Module.prototype._compile=original.compile;
  if(Module._extensions[".json"]===json)Module._extensions[".json"]=original.json;
  Atomics.store(flag,0,0);port1.postMessage("close");
  const deadline=Date.now()+5000;while(Atomics.load(flag,0)!==2&&Date.now()<deadline)Atomics.wait(flag,0,0,Math.max(1,deadline-Date.now()));
  port1.close();s.check(Atomics.load(flag,0)===2,"V3_NODE20_LOADER_CLOSE_TIMEOUT");s.check(intact,"V3_NODE20_LOADER_HOOK_CHANGED");
 }};
}

// Serialized into Node's real asynchronous loader thread. This is trusted
// code in this same qualified file, not a caller supplied verifier or module.
function node20AsyncHooks(){
 let state,fs,path,fileURLToPath,crypto;
 const check=(ok,code)=>{if(!ok)throw Error(code);};
 const sha=raw=>crypto.createHash("sha256").update(raw).digest("hex");
 function bytes(file){for(let cursor=file;;){const st=fs.lstatSync(cursor);check(!st.isSymbolicLink(),"UNSAFE_SYMLINK");if(cursor===file)check(st.isFile()&&st.nlink===1&&st.size<=64*1024*1024,"V3_REGULAR_FILE");const up=path.dirname(cursor);if(up===cursor)break;cursor=up;}return fs.readFileSync(file);}
 function relative(file){const rel=path.relative(state.root,file);check(rel!==""&&!rel.startsWith(".."+path.sep)&&rel!==".."&&!path.isAbsolute(rel),"V3_MODULE_OUTSIDE_RELEASE");return rel.split(path.sep).join("/");}
 function active(){return !!state&&Atomics.load(state.flag,0)===1;}
 function metadata(){for(const row of state.manifests)check(sha(bytes(path.join(state.root,...row.path.split("/"))))===row.sha256,"V3_PACKAGE_ROUTE_METADATA_DRIFT");}
 function pinned(file){const rel=relative(file),raw=state.sources.get(rel);check(state.index.has(rel)&&raw,"V3_REACHABLE_MODULE_FORMAT_OR_PATH_UNQUALIFIED");check(sha(bytes(file))===state.index.get(rel),"V3_MODULE_DISK_DRIFT");return raw;}
 return {
  async initialize(data){({default:fs}=await import("node:fs"));({default:path}=await import("node:path"));({fileURLToPath}=await import("node:url"));({default:crypto}=await import("node:crypto"));
   state={root:data.root,index:new Map(data.files),sources:new Map(data.sources.map(([k,v])=>[k,Buffer.from(v)])),manifests:data.manifests,flag:new Int32Array(data.flag)};
   data.port.on("message",message=>{if(message!=="close")return;for(const raw of state.sources.values())raw.fill(0);state.sources.clear();state.index.clear();state.manifests=[];Atomics.store(state.flag,0,2);Atomics.notify(state.flag,0);data.port.close();});data.port.unref();
  },
  async resolve(specifier,context,nextResolve){if(!active())return nextResolve(specifier,context);metadata();const out=await nextResolve(specifier,context);if(out.url.startsWith("node:"))return out;check(out.url.startsWith("file:"),"V3_MODULE_SCHEME");pinned(fileURLToPath(out.url));return out;},
  async load(url,context,nextLoad){if(!active()||url.startsWith("node:"))return nextLoad(url,context);const raw=pinned(fileURLToPath(url)),out=await nextLoad(url,context);
   const undetermined=out.format===undefined&&path.extname(fileURLToPath(url))===".js";check(["commonjs","module","json"].includes(out.format)||undetermined,"V3_MODULE_FORMAT_UNSUPPORTED");pinned(fileURLToPath(url));
   // Native CJS execution is independently guarded on the main thread.
   return out.format==="commonjs"?{...out,source:null}:{...out,source:Buffer.from(raw)};
  }
 };
}
module.exports={install};
