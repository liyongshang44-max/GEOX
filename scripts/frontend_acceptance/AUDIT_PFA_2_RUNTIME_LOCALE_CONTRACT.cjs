// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs
// Purpose: wire the public PFA-2 runtime audit entry to the browser-local snapshot implementation.

'use strict';

const support = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT.cjs');
support.snapshot = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SNAPSHOT.cjs').snapshot;
require('./AUDIT_PFA_2_RUNTIME_LOCALE_MAIN.cjs');
