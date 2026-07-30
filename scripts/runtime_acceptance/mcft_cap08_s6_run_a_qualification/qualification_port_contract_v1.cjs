'use strict';
const {REQUIRED,validateHarnessPortsV1}=require('../mcft_cap08_s6_single_run_db/port_contract_v1.cjs');
function validatePortBundleV1(ports){return validateHarnessPortsV1(ports);}
module.exports={REQUIRED,validatePortBundleV1};
