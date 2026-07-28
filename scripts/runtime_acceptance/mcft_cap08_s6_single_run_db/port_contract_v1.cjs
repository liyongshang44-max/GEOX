'use strict';
const assert=require('node:assert/strict');
const REQUIRED={freshDatabase:['assertFreshDisposable'],materializer:['executeDirectFormalRun'],closureReader:['query'],recovery:['executeVector'],cap07Reader:['request'],artifactWriter:['writeBundle']};
function validateHarnessPortsV1(ports){for(const [name,methods] of Object.entries(REQUIRED)){assert.ok(ports?.[name]&&typeof ports[name]==='object',`HARNESS_PORT_REQUIRED:${name}`);for(const method of methods)assert.equal(typeof ports[name][method],'function',`HARNESS_PORT_METHOD_REQUIRED:${name}.${method}`);}return ports;}
function forbiddenPortInvocationV1(){throw new Error('SINGLE_RUN_DATABASE_EXECUTION_NOT_AUTHORIZED');}
module.exports={REQUIRED,validateHarnessPortsV1,forbiddenPortInvocationV1};
