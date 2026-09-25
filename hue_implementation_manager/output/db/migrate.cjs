// Applies every .sql file in db/migrations/ that hasn't run yet, in filename order, tracking
// what's already applied in a schema_migrations table -- so setting up a fresh database (or
// bringing an existing one up to date) is one command instead of the manual one-off scripts
// migrations 001-003 were applied with.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('select filename from schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('Database is already up to date (' + files.length + ' migrations applied).');
    return;
  }

  for (const filename of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (filename) values ($1)', [filename]);
      await client.query('commit');
      console.log('Applied ' + filename);
    } catch (err) {
      await client.query('rollback');
      console.error('Failed to apply ' + filename + ':', err.message);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }

  console.log('Done: applied ' + pending.length + ' migration(s).');
}

migrate()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
