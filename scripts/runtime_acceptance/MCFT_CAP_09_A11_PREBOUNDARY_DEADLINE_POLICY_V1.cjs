#!/usr/bin/env node
"use strict";

const ROLLING_WORKFLOW = "mcft-cap-09-rolling-preboundary-capture";

function minimumIngressMarginMinutes(workflowName) {
  return workflowName === ROLLING_WORKFLOW ? 0 : 5;
}

function selftest() {
  if (minimumIngressMarginMinutes(ROLLING_WORKFLOW) !== 0) throw new Error("MCFT_CAP09_A11_ROLLING_TARGET_T_DEADLINE_REQUIRED");
  if (minimumIngressMarginMinutes("historical-ea5e2") !== 5) throw new Error("MCFT_CAP09_A11_HISTORICAL_MARGIN_MUST_REMAIN_FIVE");
  console.log(JSON.stringify({ status: "PASS", rolling_margin_minutes: 0, historical_margin_minutes: 5 }));
}

if (require.main === module) selftest();
module.exports = { ROLLING_WORKFLOW, minimumIngressMarginMinutes };
