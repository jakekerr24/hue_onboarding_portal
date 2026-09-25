// Seeds two throwaway test accounts for exercising the auth flow end to end. Fictional
// .example emails, obviously-a-placeholder password — change or remove before any real use.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const TEST_PASSWORD = 'TestPass123!';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const acme = (
      await client.query("select id from clients where plan_sponsor_name = 'Acme Manufacturing Co.'")
    ).rows[0];
    if (!acme) throw new Error('Acme Manufacturing Co. not found — run db/seed.cjs first.');

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const emails = ['maya@39nhealth.example', 'denise@acmemfg.example'];
    await client.query('delete from users where email = any($1::text[])', [emails]);

    await client.query(
      'insert into users (email, password_hash, role, display_name) values ($1, $2, $3, $4)',
      ['maya@39nhealth.example', passwordHash, 'manager', 'Maya Thompson']
    );
    await client.query(
      'insert into users (email, password_hash, role, client_id, display_name) values ($1, $2, $3, $4, $5)',
      ['denise@acmemfg.example', passwordHash, 'client', acme.id, 'Denise Whitfield']
    );

    console.log('Seeded test users (password for both: ' + TEST_PASSWORD + '):');
    console.log('  manager: maya@39nhealth.example');
    console.log('  client:  denise@acmemfg.example  (scoped to client', acme.id + ')');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed FAILED:', err.message);
  process.exit(1);
});
