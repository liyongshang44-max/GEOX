'use strict';
const fs = require('node:fs');
console.log(JSON.stringify({ ok: true, hasFs: Boolean(fs) }, null, 2));
