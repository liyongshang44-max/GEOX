#!/usr/bin/env node
require('tsx/cjs');

const { runFormalScenarioKernelV1 } = require('../../apps/server/src/services/scenarios/formal_scenario_kernel_v1.ts');
const { main } = require('./formal_irrigation_kernel_driver_v1.cjs');

main({ runFormalScenarioKernelV1 }).catch((err) => {
  console.error(err);
  process.exit(1);
});
