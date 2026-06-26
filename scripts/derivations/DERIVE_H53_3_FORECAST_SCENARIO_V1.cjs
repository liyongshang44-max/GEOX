'use strict';
const DB = process.env.DATABASE_URL;
console.log(JSON.stringify({ ok: true, db: Boolean(DB) }, null, 2));
