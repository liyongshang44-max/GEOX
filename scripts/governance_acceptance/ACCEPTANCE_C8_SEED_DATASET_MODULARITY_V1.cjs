#!/usr/bin/env node
'use strict';

// path: scripts/governance_acceptance/ACCEPTANCE_C8_SEED_DATASET_MODULARITY_V1.cjs
// Purpose: enforce that the C8 controlled-pilot seed dataset is built by a pure dataset builder, not inline seed-runner logic.

const fs = require('node:fs');
const path = require('node:path');
const