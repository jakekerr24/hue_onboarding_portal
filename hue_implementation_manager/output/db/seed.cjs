// Seeds one fictional client ("Acme Manufacturing Co.") straight from the same data the
// frontend prototype uses (src/data.js, bundled to db/seed-data.cjs so nothing is retyped by
// hand). Safe to re-run: it first removes any existing client with the same plan sponsor name.
//
// Usage: node db/seed.cjs   (run from hue_implementation_manager/output/)
require('dotenv').config();
const { Client } = require('pg');
const {
  CLIENT_DATA,
  BROKER_DATA,
  PARTNER_CONTACTS,
  HEALTH_CONTACTS,
  STANDARD_DELIVERABLES,
  EXPECTATION_GROUPS,
  DOCUMENTS,
  DEMO_PROGRESS,
} = require('./seed-data.cjs');
const { deliverableKey, acknowledgementKey } = require('./seed-keys.cjs');

// Same mapping the Documents page uses (pages/Documents.jsx: normalizeSignatureStatus).
function normalizeSignatureStatus(rawStatus) {
  const value = (rawStatus || '').toLowerCase();
  if (value.includes('needs signature') || value.includes('pending signature')) return 'needs-signature';
  if (value.includes('signed')) return 'signed';
  return 'none';
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('begin');

    // --- Clear out any previous seed of the same fictional client, so this is re-runnable. ---
    const existing = await client.query('select id from clients where plan_sponsor_name = $1', [CLIENT_DATA.companyName]);
    for (const row of existing.rows) {
      await client.query('delete from clients where id = $1', [row.id]);
    }
    // Contacts/broker are reusable library records; only remove the exact ones this seed creates,
    // matched by name, so a re-run doesn't accumulate duplicates.
    await client.query('delete from brokers where firm_name = $1', [BROKER_DATA.firmName]);
    const allContactNames = [
      ...HEALTH_CONTACTS.map((c) => c.name),
      ...PARTNER_CONTACTS.map((c) => c.name),
      ...BROKER_DATA.contacts.map((c) => c.name),
      ...CLIENT_DATA.contacts.map((c) => c.name),
    ];
    await client.query('delete from contacts where name = any($1::text[])', [allContactNames]);

    // --- Broker (reusable identity only; vendor integration/notes are client-specific). ---
    const brokerResult = await client.query(
      `insert into brokers (broker_name, firm_name, firm_address, firm_tax_id)
       values ($1, $2, $3, $4) returning id`,
      [BROKER_DATA.brokerName, BROKER_DATA.firmName, BROKER_DATA.firmAddress, BROKER_DATA.firmTaxId]
    );
    const brokerId = brokerResult.rows[0].id;

    // --- Client ---
    const vi = BROKER_DATA.vendorIntegration;
    const clientResult = await client.query(
      `insert into clients (
         plan_sponsor_name, address, tax_id, sic_code, org_type, company_size, locations,
         effective_date, waiting_period, excluded_classes, hp_network, national_network, notes,
         broker_id, broker_notes, vendor_integration_required, vendor_integration_platform,
         cobra_vendor_name, cobra_vendor_contact, cobra_vendor_phone, cobra_vendor_email,
         template_applied_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, now())
       returning id`,
      [
        CLIENT_DATA.companyName, CLIENT_DATA.address, CLIENT_DATA.taxId, CLIENT_DATA.sicCode,
        CLIENT_DATA.orgType, CLIENT_DATA.companySize, CLIENT_DATA.locations,
        CLIENT_DATA.effectiveDate, CLIENT_DATA.waitingPeriod, CLIENT_DATA.excludedClasses,
        CLIENT_DATA.hpNetwork, CLIENT_DATA.nationalNetwork, CLIENT_DATA.notes,
        brokerId, BROKER_DATA.notes, vi.required === 'yes', vi.platform || null,
        vi.cobraVendorName || null, vi.cobraVendorContact || null, vi.cobraVendorPhone || null,
        vi.cobraVendorEmail || null,
      ]
    );
    const clientId = clientResult.rows[0].id;

    // --- Contacts (reusable library) + attachments to this client ---
    const insertContact = async (contact, category, extra = {}) => {
      const result = await client.query(
        `insert into contacts (name, title, phone, email, role, category, org, partner_type)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          contact.name, contact.title || null, contact.phone || null, contact.email || null,
          contact.role || null, category, extra.org || null, extra.partnerType || null,
        ]
      );
      return result.rows[0].id;
    };
    const attach = async (contactId, signatory = false) => {
      await client.query(
        'insert into client_contacts (client_id, contact_id, signatory) values ($1, $2, $3)',
        [clientId, contactId, signatory]
      );
    };

    for (const contact of HEALTH_CONTACTS) {
      await attach(await insertContact(contact, 'internal'));
    }
    for (const contact of PARTNER_CONTACTS) {
      await attach(await insertContact(contact, 'partner', { org: contact.org, partnerType: contact.category }));
    }
    for (const contact of BROKER_DATA.contacts) {
      await attach(await insertContact(contact, 'broker'));
    }
    for (const contact of CLIENT_DATA.contacts) {
      await attach(await insertContact(contact, 'employer'), Boolean(contact.signatory));
    }

    // --- Template deliverables (create if this is the very first seed run) + this client's copy ---
    const templateDeliverableIds = {}; // `${phase}-${index}` -> id
    for (const phase of ['pre', 'post']) {
      const existingTemplate = await client.query(
        'select id from template_deliverables where phase = $1 order by sort_order',
        [phase]
      );
      if (existingTemplate.rows.length === STANDARD_DELIVERABLES[phase].length) {
        existingTemplate.rows.forEach((row, index) => { templateDeliverableIds[`${phase}-${index}`] = row.id; });
      } else {
        await client.query('delete from template_deliverables where phase = $1', [phase]);
        for (const [index, item] of STANDARD_DELIVERABLES[phase].entries()) {
          const result = await client.query(
            `insert into template_deliverables (phase, sort_order, name, due_date_rule, note)
             values ($1,$2,$3,$4,$5) returning id`,
            [phase, index, item.name, item.rule, item.note || null]
          );
          templateDeliverableIds[`${phase}-${index}`] = result.rows[0].id;
        }
      }
    }

    const completedDeliverableKeys = new Set(Object.keys(DEMO_PROGRESS.deliverableCompletion));
    for (const phase of ['pre', 'post']) {
      for (const [index, item] of STANDARD_DELIVERABLES[phase].entries()) {
        const isComplete = completedDeliverableKeys.has(deliverableKey(phase, index, item.name));
        await client.query(
          `insert into client_deliverables
             (client_id, source_template_item_id, phase, sort_order, name, due_date_rule, note, is_complete)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [clientId, templateDeliverableIds[`${phase}-${index}`], phase, index, item.name, item.rule, item.note || null, isComplete]
        );
      }
    }

    // --- Template expectations + this client's copy ---
    const templateExpectationIds = {}; // `${groupTitle}-${index}` -> id
    for (const group of EXPECTATION_GROUPS) {
      const existingTemplate = await client.query(
        'select id from template_expectations where group_title = $1 order by sort_order',
        [group.title]
      );
      if (existingTemplate.rows.length === group.items.length) {
        existingTemplate.rows.forEach((row, index) => { templateExpectationIds[`${group.title}-${index}`] = row.id; });
      } else {
        await client.query('delete from template_expectations where group_title = $1', [group.title]);
        for (const [index, item] of group.items.entries()) {
          const result = await client.query(
            `insert into template_expectations (group_title, audience, sort_order, title, body)
             values ($1,$2,$3,$4,$5) returning id`,
            [group.title, group.audience, index, item.title, item.body]
          );
          templateExpectationIds[`${group.title}-${index}`] = result.rows[0].id;
        }
      }
    }

    for (const group of EXPECTATION_GROUPS) {
      for (const [index, item] of group.items.entries()) {
        const reviewed = DEMO_PROGRESS.whatToExpect[acknowledgementKey(group.title, item.title)];
        await client.query(
          `insert into client_expectations
             (client_id, source_template_item_id, group_title, audience, sort_order, title, body, reviewed_by, reviewed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            clientId, templateExpectationIds[`${group.title}-${index}`], group.title, group.audience, index,
            item.title, item.body, reviewed ? reviewed.by : null, reviewed ? reviewed.at : null,
          ]
        );
      }
    }

    // --- Documents (metadata only; no real files exist for this placeholder client) ---
    for (const doc of DOCUMENTS) {
      await client.query(
        `insert into client_documents (client_id, title, description, category, signature_status, file_type, owner, uploaded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [clientId, doc.name, 'Shared implementation document', doc.category, normalizeSignatureStatus(doc.status), 'PDF', doc.owner, doc.updated]
      );
    }

    await client.query('commit');
    console.log('Seeded client id:', clientId);
    return clientId;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed FAILED, rolled back:', err.message);
  process.exit(1);
});
