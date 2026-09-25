// Shared Postgres connection pool for the server. A Pool (not a one-off Client, which is what
// the db/ scripts use for one-shot migration/seed runs) is the right primitive here since the
// server handles many concurrent requests.
const { Pool, types } = require('pg');

// pg's default behavior for the `date` type (OID 1082) constructs a JS Date at local midnight
// in the SERVER PROCESS's own timezone, then JSON.stringify renders that in UTC -- so the same
// stored "2026-08-10" comes out as a different timestamp (and can shift to a different calendar
// day entirely) depending on what timezone the server happens to run in. effective_date is a
// pure calendar date with no time-of-day meaning, so skip that conversion and return the raw
// "YYYY-MM-DD" string unchanged. (Same class of bug already fixed once in the frontend's own
// date math -- see utils/date.js.)
types.setTypeParser(1082, (value) => value);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
