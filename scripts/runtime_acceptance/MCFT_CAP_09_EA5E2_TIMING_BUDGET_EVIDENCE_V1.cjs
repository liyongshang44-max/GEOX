#!/usr/bin/env node
"use strict";

// Compatibility entrypoint retained for existing EA5E2 call sites.
// Historical V1 evidence remains immutable. Current successor/live qualification
// is governed by the exact-main T3R1 V2 timing evidence validator.
const current = require("./MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V2.cjs");

module.exports = {
  EVIDENCE_PATH: current.EVIDENCE_PATH,
  validateTimingBudgetEvidence: current.validateTimingBudgetEvidence,
};

if (require.main === module) console.log(JSON.stringify(current.validateTimingBudgetEvidence()));
