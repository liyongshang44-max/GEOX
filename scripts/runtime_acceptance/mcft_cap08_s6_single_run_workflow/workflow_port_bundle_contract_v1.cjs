'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const REQUIRED={freshDatabase:['assertFreshDisposable'],materializer:['executeDirectFormalRun'],closureReader:['query'],recovery:['executeVector'],cap07Reader:['request'],artifactWriter:['writeBundle']};
function validateRepoRelativeModulePathV1(value){assert.equal(typeof value,'string','PORT_BUNDLE_PATH_REQUIRED');assert.match(value,/^scripts\/runtime_acceptance\/[A-Za-z0-9_./-]+\.(?:cjs|mjs|js|ts)$/,'PORT_BUNDLE_PATH_INVALID');assert.equal(path.posix.normalize(value),value,'PORT_BUNDLE_PATH_NOT_NORMALIZED');assert.equal(value.includes('..'),false,'PORT_BUNDLE_PATH_TRAVERSAL');return value;}
function validatePortBundleV1(bundle){assert.ok(bundle&&typeof bundle==='object','PORT_BUNDLE_OBJECT_REQUIRED');const ports=typeof bundle.createPortsV1==='function'?bundle.createPortsV1:bundle.default?.createPortsV1;assert.equal(typeof ports,'function','PORT_BUNDLE_FACTORY_REQUIRED');return ports;}
function validateCreatedPortsV1(ports){for(const [name,methods] of Object.entries(REQUIRED)){assert.ok(ports?.[name]&&typeof ports[name]==='object',`PORT_REQUIRED:${name}`);for(const method of methods)assert.equal(typeof ports[name][method],'function',`PORT_METHOD_REQUIRED:${name}.${method}`);}return ports;}
module.exports={REQUIRED,validateRepoRelativeModulePathV1,validatePortBundleV1,validateCreatedPortsV1};
