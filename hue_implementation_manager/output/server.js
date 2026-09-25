require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const pool = require('./db');
const { sessionMiddleware, requireAuth, requireManager, canAccessClient, registerAuthRoutes } = require('./auth');

const app = express();
// credentials: true + an explicit origin (not '*') are both required for the session cookie to
// be sent cross-origin, which matters in dev where the Vite app (5173) calls this API (3000).
// CORS_ORIGIN is a comma-separated allowlist (e.g. "https://39n.co,https://www.39n.co" in
// production); it defaults to the local Vite dev server so `npm run dev` keeps working untouched.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header means a same-origin or non-browser request (curl, server-to-server
    // health checks) -- nothing to restrict there, only cross-origin browser calls matter.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(sessionMiddleware());

// Documents live on local disk for now (client_documents.storage_path is just a filename here);
// the schema comment already anticipates swapping this for S3 once Phase D adds real hosting --
// nothing else about the API shape needs to change when that happens.
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const DOCUMENT_CATEGORIES = ['plan-documents', 'resources-education', 'contracts-agreements'];
const SIGNATURE_STATUSES = ['none', 'needs-signature', 'signed'];

registerAuthRoutes(app);

// The admin client list -- manager-only. Enough to render a picker (name + effective date);
// anything more detailed is a click away via GET /api/clients/:id.
app.get('/api/clients', requireManager, async (req, res) => {
  const result = await pool.query(
    'select id, plan_sponsor_name, effective_date, created_at from clients order by plan_sponsor_name'
  );
  res.json(result.rows);
});

// Returns one client with everything the portal needs in a single call: the client record,
// its broker, attached contacts, its own copy of deliverables/expectations, and documents.
app.get('/api/clients/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!canAccessClient(req, id)) return res.status(403).json({ error: 'Forbidden' });

  const clientResult = await pool.query('select * from clients where id = $1', [id]);
  const clientRow = clientResult.rows[0];
  if (!clientRow) return res.status(404).json({ error: 'Not found' });

  const [broker, contacts, deliverables, expectations, documents] = await Promise.all([
    clientRow.broker_id
      ? pool.query('select * from brokers where id = $1', [clientRow.broker_id]).then((r) => r.rows[0])
      : null,
    pool.query(
      `select co.*, cc.signatory, u.email as login_email
       from client_contacts cc
       join contacts co on co.id = cc.contact_id
       left join users u on u.contact_id = co.id and u.client_id = cc.client_id
       where cc.client_id = $1 order by co.category, co.name`,
      [id]
    ).then((r) => r.rows),
    pool.query('select * from client_deliverables where client_id = $1 order by phase, sort_order', [id]).then((r) => r.rows),
    pool.query('select * from client_expectations where client_id = $1 order by group_title, sort_order', [id]).then((r) => r.rows),
    pool.query('select * from client_documents where client_id = $1 order by uploaded_at desc', [id]).then((r) => r.rows),
  ]);

  res.json({ client: clientRow, broker, contacts, deliverables, expectations, documents });
});

// Whitelisted client-editable fields. Keys are the camelCase names the frontend sends (matching
// mapClientResponse.js's clientData/brokerData shapes); values are the `clients` table columns.
// Both the Client Questionnaire's own fields and the client-owned half of the Broker
// Questionnaire (vendor integration + broker notes -- the broker's own name/firm fields live on
// the shared `brokers` row instead, see PATCH /api/brokers/:id) go through this one endpoint.
const CLIENT_PATCH_FIELDS = {
  companyName: 'plan_sponsor_name',
  address: 'address',
  taxId: 'tax_id',
  sicCode: 'sic_code',
  orgType: 'org_type',
  companySize: 'company_size',
  locations: 'locations',
  effectiveDate: 'effective_date',
  waitingPeriod: 'waiting_period',
  excludedClasses: 'excluded_classes',
  hpNetwork: 'hp_network',
  nationalNetwork: 'national_network',
  notes: 'notes',
  brokerId: 'broker_id',
  brokerNotes: 'broker_notes',
  vendorIntegrationRequired: 'vendor_integration_required',
  vendorIntegrationPlatform: 'vendor_integration_platform',
  cobraVendorName: 'cobra_vendor_name',
  cobraVendorContact: 'cobra_vendor_contact',
  cobraVendorPhone: 'cobra_vendor_phone',
  cobraVendorEmail: 'cobra_vendor_email',
};

// Onboards a new client: creates the clients row, then copies the single global template
// (template_deliverables / template_expectations) into that client's own independent
// client_deliverables / client_expectations rows -- the copy-on-create design means editing the
// template later never retroactively changes this or any other existing client.
app.post('/api/clients', requireManager, async (req, res) => {
  const { companyName, address, effectiveDate } = req.body;
  if (!companyName || !address || !effectiveDate) {
    return res.status(400).json({ error: 'companyName, address, and effectiveDate are required' });
  }

  const columns = [];
  const placeholders = [];
  const values = [];
  for (const [key, column] of Object.entries(CLIENT_PATCH_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      columns.push(column);
      placeholders.push(`$${values.length}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const clientResult = await client.query(
      `insert into clients (${columns.join(', ')}, template_applied_at) values (${placeholders.join(', ')}, now()) returning *`,
      values
    );
    const newClient = clientResult.rows[0];

    await client.query(
      `insert into client_deliverables (client_id, source_template_item_id, phase, sort_order, name, due_date_rule, note)
       select $1, id, phase, sort_order, name, due_date_rule, note from template_deliverables`,
      [newClient.id]
    );
    await client.query(
      `insert into client_expectations (client_id, source_template_item_id, group_title, audience, sort_order, title, body)
       select $1, id, group_title, audience, sort_order, title, body from template_expectations`,
      [newClient.id]
    );

    await client.query('commit');
    res.status(201).json(newClient);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
});

// The single global deliverables template -- manager-only, and deliberately separate from any
// client. Editing it here never touches an existing client's own client_deliverables copy (that's
// the whole point of copy-on-create); it only changes what future POST /api/clients calls copy.
app.get('/api/template/deliverables', requireManager, async (req, res) => {
  const result = await pool.query('select * from template_deliverables order by phase, sort_order');
  res.json(result.rows);
});

app.post('/api/template/deliverables', requireManager, async (req, res) => {
  const { phase, name, dueDateRule, note } = req.body;
  if (!phase || !name || !dueDateRule) {
    return res.status(400).json({ error: 'phase, name, and dueDateRule are required' });
  }
  if (!['pre', 'post'].includes(phase)) return res.status(400).json({ error: 'phase must be "pre" or "post"' });

  const maxResult = await pool.query(
    'select coalesce(max(sort_order), -1) as max from template_deliverables where phase = $1',
    [phase]
  );
  const result = await pool.query(
    `insert into template_deliverables (phase, sort_order, name, due_date_rule, note)
     values ($1, $2, $3, $4, $5) returning *`,
    [phase, maxResult.rows[0].max + 1, name, dueDateRule, note || null]
  );
  res.status(201).json(result.rows[0]);
});

const TEMPLATE_DELIVERABLE_FIELDS = { name: 'name', dueDateRule: 'due_date_rule', note: 'note', phase: 'phase' };

app.patch('/api/template/deliverables/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const setClauses = [];
  const values = [];
  for (const [key, column] of Object.entries(TEMPLATE_DELIVERABLE_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(id);
  const result = await pool.query(
    `update template_deliverables set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

app.delete('/api/template/deliverables/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('delete from template_deliverables where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Swaps sort_order with the next item up/down within the same phase; a no-op at either edge.
// Returns the whole freshly-ordered list, which is simpler for the frontend to just replace state
// with than computing the swap itself.
app.post('/api/template/deliverables/:id/reorder', requireManager, async (req, res) => {
  const { id } = req.params;
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction must be "up" or "down"' });

  const current = await pool.query('select * from template_deliverables where id = $1', [id]);
  const item = current.rows[0];
  if (!item) return res.status(404).json({ error: 'Not found' });

  const comparator = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'desc' : 'asc';
  const neighborResult = await pool.query(
    `select * from template_deliverables where phase = $1 and sort_order ${comparator} $2 order by sort_order ${order} limit 1`,
    [item.phase, item.sort_order]
  );
  const neighbor = neighborResult.rows[0];
  if (neighbor) {
    await pool.query('update template_deliverables set sort_order = $1 where id = $2', [neighbor.sort_order, item.id]);
    await pool.query('update template_deliverables set sort_order = $1 where id = $2', [item.sort_order, neighbor.id]);
  }

  const result = await pool.query('select * from template_deliverables order by phase, sort_order');
  res.json(result.rows);
});

// The single global expectations template -- same reasoning as the deliverables template above.
// Groups are open-ended free text (not a fixed enum like phase), so "group" here just means
// "whatever group_title value the admin used" -- adding an item with an existing title joins that
// group, a new title creates one.
app.get('/api/template/expectations', requireManager, async (req, res) => {
  const result = await pool.query('select * from template_expectations order by group_title, sort_order');
  res.json(result.rows);
});

app.post('/api/template/expectations', requireManager, async (req, res) => {
  const { groupTitle, audience, title, body } = req.body;
  if (!groupTitle || !audience || !title || !body) {
    return res.status(400).json({ error: 'groupTitle, audience, title, and body are required' });
  }

  const maxResult = await pool.query(
    'select coalesce(max(sort_order), -1) as max from template_expectations where group_title = $1',
    [groupTitle]
  );
  const result = await pool.query(
    `insert into template_expectations (group_title, audience, sort_order, title, body)
     values ($1, $2, $3, $4, $5) returning *`,
    [groupTitle, audience, maxResult.rows[0].max + 1, title, body]
  );
  res.status(201).json(result.rows[0]);
});

const TEMPLATE_EXPECTATION_FIELDS = { groupTitle: 'group_title', audience: 'audience', title: 'title', body: 'body' };

app.patch('/api/template/expectations/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const setClauses = [];
  const values = [];
  for (const [key, column] of Object.entries(TEMPLATE_EXPECTATION_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(id);
  const result = await pool.query(
    `update template_expectations set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

app.delete('/api/template/expectations/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('delete from template_expectations where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Swaps sort_order with the next item up/down within the same group; a no-op at either edge.
app.post('/api/template/expectations/:id/reorder', requireManager, async (req, res) => {
  const { id } = req.params;
  const { direction } = req.body;
  if (!['up', 'down'].includes(direction)) return res.status(400).json({ error: 'direction must be "up" or "down"' });

  const current = await pool.query('select * from template_expectations where id = $1', [id]);
  const item = current.rows[0];
  if (!item) return res.status(404).json({ error: 'Not found' });

  const comparator = direction === 'up' ? '<' : '>';
  const order = direction === 'up' ? 'desc' : 'asc';
  const neighborResult = await pool.query(
    `select * from template_expectations where group_title = $1 and sort_order ${comparator} $2 order by sort_order ${order} limit 1`,
    [item.group_title, item.sort_order]
  );
  const neighbor = neighborResult.rows[0];
  if (neighbor) {
    await pool.query('update template_expectations set sort_order = $1 where id = $2', [neighbor.sort_order, item.id]);
    await pool.query('update template_expectations set sort_order = $1 where id = $2', [item.sort_order, neighbor.id]);
  }

  const result = await pool.query('select * from template_expectations order by group_title, sort_order');
  res.json(result.rows);
});

// Manager-only, like every other write in this portal -- clients are read-only for the client
// role (canEdit on the frontend is derived from the same role check).
app.patch('/api/clients/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const setClauses = [];
  const values = [];
  for (const [key, column] of Object.entries(CLIENT_PATCH_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(id);
  const result = await pool.query(
    `update clients set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// Brokers are a reusable/shared entity (like contacts) -- editing one here updates it for every
// client that references it, which is the intended behavior, not a bug.
const BROKER_PATCH_FIELDS = {
  brokerName: 'broker_name',
  firmName: 'firm_name',
  firmAddress: 'firm_address',
  firmTaxId: 'firm_tax_id',
};

// Lists every broker so a client with none linked yet can pick one already on file (e.g. the
// same brokerage working with several other clients) instead of creating a duplicate row.
app.get('/api/brokers', requireManager, async (req, res) => {
  const result = await pool.query('select * from brokers order by firm_name');
  res.json(result.rows);
});

// Creates a brand-new broker, unattached to any client -- the caller links it via
// PATCH /api/clients/:id { brokerId } right after, same two-step shape as attaching a pool
// contact (create, then attach).
app.post('/api/brokers', requireManager, async (req, res) => {
  if (!req.body.firmName) return res.status(400).json({ error: 'firmName is required' });

  const columns = [];
  const placeholders = [];
  const values = [];
  for (const [key, column] of Object.entries(BROKER_PATCH_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      columns.push(column);
      placeholders.push(`$${values.length}`);
    }
  }
  const result = await pool.query(
    `insert into brokers (${columns.join(', ')}) values (${placeholders.join(', ')}) returning *`,
    values
  );
  res.status(201).json(result.rows[0]);
});

app.patch('/api/brokers/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const setClauses = [];
  const values = [];
  for (const [key, column] of Object.entries(BROKER_PATCH_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(id);
  const result = await pool.query(
    `update brokers set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// Contacts are a reusable/shared library (like brokers) -- client_contacts is just the
// attachment, so removing a contact from a client never deletes the underlying record, and
// editing a contact's own fields (name/title/phone/email/role/org/partnerType) updates it for
// every client that happens to reference the same row, which is intended. `signatory` is the one
// field that's specific to a single client's relationship with a contact, so it lives on
// client_contacts instead and is handled separately from the shared-field update below.
const CONTACT_PATCH_FIELDS = {
  name: 'name', title: 'title', phone: 'phone', email: 'email', role: 'role', org: 'org', partnerType: 'partner_type',
  category: 'category',
};
const CONTACT_CATEGORIES = ['internal', 'partner', 'broker', 'employer'];

// Creates a new contact and attaches it to this client in one step, OR -- when the body carries
// a contactId -- attaches an existing pool contact instead of creating a duplicate. This is the
// "reuse a contact across clients" path (e.g. the same TPA rep for ten different clients).
app.post('/api/clients/:clientId/contacts', requireManager, async (req, res) => {
  const { clientId } = req.params;

  if (req.body.contactId) {
    const { contactId, signatory } = req.body;
    const existing = await pool.query('select * from contacts where id = $1', [contactId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    try {
      await pool.query('insert into client_contacts (client_id, contact_id, signatory) values ($1, $2, $3)', [
        clientId,
        contactId,
        Boolean(signatory),
      ]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'This contact is already attached to this client' });
      throw err;
    }
    return res.status(201).json({ ...existing.rows[0], signatory: Boolean(signatory) });
  }

  const { category, name, title, phone, email, role, org, partnerType, signatory } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });

  const client = await pool.connect();
  try {
    await client.query('begin');
    const contactResult = await client.query(
      `insert into contacts (name, title, phone, email, role, category, org, partner_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [name || '', title || null, phone || null, email || null, role || null, category, org || null, partnerType || null]
    );
    const contact = contactResult.rows[0];
    await client.query('insert into client_contacts (client_id, contact_id, signatory) values ($1, $2, $3)', [
      clientId,
      contact.id,
      Boolean(signatory),
    ]);
    await client.query('commit');
    res.status(201).json({ ...contact, signatory: Boolean(signatory) });
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
});

// Updates an attached contact's shared fields and/or this client's own signatory flag on it.
app.patch('/api/clients/:clientId/contacts/:contactId', requireManager, async (req, res) => {
  const { clientId, contactId } = req.params;
  if ('category' in req.body && !CONTACT_CATEGORIES.includes(req.body.category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  const attached = await pool.query('select 1 from client_contacts where client_id = $1 and contact_id = $2', [
    clientId,
    contactId,
  ]);
  if (!attached.rows[0]) return res.status(404).json({ error: 'Not found' });

  const setClauses = [];
  const values = [];
  for (const [key, column] of Object.entries(CONTACT_PATCH_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  let contact;
  if (setClauses.length > 0) {
    values.push(contactId);
    const result = await pool.query(
      `update contacts set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
      values
    );
    contact = result.rows[0];
  }
  if ('signatory' in req.body) {
    await pool.query('update client_contacts set signatory = $1 where client_id = $2 and contact_id = $3', [
      Boolean(req.body.signatory),
      clientId,
      contactId,
    ]);
  }
  if (!contact) {
    contact = (await pool.query('select * from contacts where id = $1', [contactId])).rows[0];
  }
  const signatoryRow = await pool.query('select signatory from client_contacts where client_id = $1 and contact_id = $2', [
    clientId,
    contactId,
  ]);
  res.json({ ...contact, signatory: signatoryRow.rows[0].signatory });
});

// Detaches a contact from this client. The underlying contacts row is never deleted, since other
// clients (or this one, later) may still reference it.
app.delete('/api/clients/:clientId/contacts/:contactId', requireManager, async (req, res) => {
  const { clientId, contactId } = req.params;
  const result = await pool.query('delete from client_contacts where client_id = $1 and contact_id = $2', [clientId, contactId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// The reusable contact pool -- independent of any one client, so an admin can browse/search
// everyone on file (which clients already have each contact) before deciding to reuse one via
// POST /api/clients/:clientId/contacts {contactId} or create a new one.
app.get('/api/contacts', requireManager, async (req, res) => {
  const result = await pool.query(
    `select co.*,
            coalesce(
              json_agg(json_build_object('id', cl.id, 'planSponsorName', cl.plan_sponsor_name))
                filter (where cl.id is not null),
              '[]'
            ) as clients
     from contacts co
     left join client_contacts cc on cc.contact_id = co.id
     left join clients cl on cl.id = cc.client_id
     group by co.id
     order by co.category, co.name`
  );
  res.json(result.rows);
});

app.post('/api/contacts', requireManager, async (req, res) => {
  const { category, name, title, phone, email, role, org, partnerType } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });
  if (!CONTACT_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  const result = await pool.query(
    `insert into contacts (name, title, phone, email, role, category, org, partner_type)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [name || '', title || null, phone || null, email || null, role || null, category, org || null, partnerType || null]
  );
  res.status(201).json({ ...result.rows[0], clients: [] });
});

app.patch('/api/contacts/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  if ('category' in req.body && !CONTACT_CATEGORIES.includes(req.body.category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  const setClauses = [];
  const values = [];
  for (const [key, column] of Object.entries(CONTACT_PATCH_FIELDS)) {
    if (key in req.body) {
      values.push(req.body[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });
  values.push(id);
  const result = await pool.query(
    `update contacts set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// Refuses to delete a contact still attached to any client, rather than silently cascading --
// detaching from each client first is an explicit, separate action.
app.delete('/api/contacts/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const attached = await pool.query('select count(*)::int as count from client_contacts where contact_id = $1', [id]);
  if (attached.rows[0].count > 0) {
    return res.status(409).json({ error: 'This contact is still attached to one or more clients. Remove it from each client first.' });
  }
  const result = await pool.query('delete from contacts where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Grants portal access for a specific contact on a specific client. A client-role login is always
// tied to the contact record it belongs to (migration 003) rather than a freestanding account --
// individual logins per person, not a shared client-wide credential (see chat).
app.post('/api/clients/:clientId/contacts/:contactId/users', requireManager, async (req, res) => {
  const { clientId, contactId } = req.params;
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const attached = await pool.query('select 1 from client_contacts where client_id = $1 and contact_id = $2', [clientId, contactId]);
  if (!attached.rows[0]) return res.status(404).json({ error: 'This contact is not attached to this client' });

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      `insert into users (email, password_hash, role, client_id, contact_id, display_name)
       select $1, $2, 'client', $3, co.id, co.name from contacts co where co.id = $4
       returning id, email, role, client_id, contact_id, display_name`,
      [email, passwordHash, clientId, contactId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const onContact = err.constraint && err.constraint.includes('contact_id');
      return res.status(409).json({ error: onContact ? 'This contact already has a login' : 'A login with this email already exists' });
    }
    throw err;
  }
});

app.patch('/api/clients/:clientId/contacts/:contactId/users', requireManager, async (req, res) => {
  const { clientId, contactId } = req.params;
  const { email, password } = req.body;
  const setClauses = [];
  const values = [];
  if (email) {
    values.push(email);
    setClauses.push(`email = $${values.length}`);
  }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
    values.push(await bcrypt.hash(password, 10));
    setClauses.push(`password_hash = $${values.length}`);
  }
  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(clientId, contactId);
  try {
    const result = await pool.query(
      `update users set ${setClauses.join(', ')}
       where client_id = $${values.length - 1} and contact_id = $${values.length}
       returning id, email, role, client_id, contact_id, display_name`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No login exists for this contact' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A login with this email already exists' });
    throw err;
  }
});

app.delete('/api/clients/:clientId/contacts/:contactId/users', requireManager, async (req, res) => {
  const { clientId, contactId } = req.params;
  const result = await pool.query('delete from users where client_id = $1 and contact_id = $2', [clientId, contactId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No login exists for this contact' });
  res.status(204).send();
});

// A client's own deliverables start as a copy of the template (see POST /api/clients), but from
// here on they're fully independent rows -- a manager can add, edit, or remove them for just this
// client without ever touching template_deliverables or any other client.
app.post('/api/clients/:clientId/deliverables', requireManager, async (req, res) => {
  const { clientId } = req.params;
  const { phase, name, dueDateRule, note } = req.body;
  if (!phase || !name || !dueDateRule) {
    return res.status(400).json({ error: 'phase, name, and dueDateRule are required' });
  }
  if (!['pre', 'post'].includes(phase)) return res.status(400).json({ error: 'phase must be "pre" or "post"' });

  const maxResult = await pool.query(
    'select coalesce(max(sort_order), -1) as max from client_deliverables where client_id = $1 and phase = $2',
    [clientId, phase]
  );
  const result = await pool.query(
    `insert into client_deliverables (client_id, phase, sort_order, name, due_date_rule, note)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [clientId, phase, maxResult.rows[0].max + 1, name, dueDateRule, note || null]
  );
  res.status(201).json(result.rows[0]);
});

const CLIENT_DELIVERABLE_FIELDS = { name: 'name', dueDateRule: 'due_date_rule', note: 'note', phase: 'phase' };

// Both roles can toggle isComplete -- a client checking off their own deliverables is the whole
// point of the portal, not just a manager-facing admin action (requireAuth + canAccessClient,
// same as GET /api/clients/:id). Editing the deliverable's own content (name/rule/note/phase) is
// manager-only, checked separately below since it's a different kind of write on the same row.
app.patch('/api/clients/:clientId/deliverables/:id', requireAuth, async (req, res) => {
  const { clientId, id } = req.params;
  if (!canAccessClient(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

  const setClauses = [];
  const values = [];

  if ('isComplete' in req.body) {
    if (typeof req.body.isComplete !== 'boolean') return res.status(400).json({ error: 'isComplete must be a boolean' });
    const completedBy = req.body.isComplete ? req.session.user.displayName || req.session.user.email : null;
    values.push(req.body.isComplete);
    setClauses.push(`is_complete = $${values.length}`);
    values.push(req.body.isComplete ? new Date() : null);
    setClauses.push(`completed_at = $${values.length}`);
    values.push(completedBy);
    setClauses.push(`completed_by = $${values.length}`);
  }

  const hasContentEdits = Object.keys(CLIENT_DELIVERABLE_FIELDS).some((key) => key in req.body);
  if (hasContentEdits) {
    if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
    for (const [key, column] of Object.entries(CLIENT_DELIVERABLE_FIELDS)) {
      if (key in req.body) {
        values.push(req.body[key]);
        setClauses.push(`${column} = $${values.length}`);
      }
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(id, clientId);
  const result = await pool.query(
    `update client_deliverables set ${setClauses.join(', ')}, updated_at = now()
     where id = $${values.length - 1} and client_id = $${values.length}
     returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

app.delete('/api/clients/:clientId/deliverables/:id', requireManager, async (req, res) => {
  const { clientId, id } = req.params;
  const result = await pool.query('delete from client_deliverables where id = $1 and client_id = $2', [id, clientId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// A client's own expectations start as a copy of the template (see POST /api/clients), but from
// here on they're fully independent rows -- a manager can add, edit, or remove them for just this
// client without ever touching template_expectations or any other client.
app.post('/api/clients/:clientId/expectations', requireManager, async (req, res) => {
  const { clientId } = req.params;
  const { groupTitle, audience, title, body } = req.body;
  if (!groupTitle || !audience || !title || !body) {
    return res.status(400).json({ error: 'groupTitle, audience, title, and body are required' });
  }

  const maxResult = await pool.query(
    'select coalesce(max(sort_order), -1) as max from client_expectations where client_id = $1 and group_title = $2',
    [clientId, groupTitle]
  );
  const result = await pool.query(
    `insert into client_expectations (client_id, group_title, audience, sort_order, title, body)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [clientId, groupTitle, audience, maxResult.rows[0].max + 1, title, body]
  );
  res.status(201).json(result.rows[0]);
});

const CLIENT_EXPECTATION_FIELDS = { groupTitle: 'group_title', audience: 'audience', title: 'title', body: 'body' };

// Both roles can toggle `reviewed` -- a client reviewing their own expectations is the whole
// point of the portal. Editing the expectation's own content (group/audience/title/body) is
// manager-only, checked separately below since it's a different kind of write on the same row.
app.patch('/api/clients/:clientId/expectations/:id', requireAuth, async (req, res) => {
  const { clientId, id } = req.params;
  if (!canAccessClient(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

  const setClauses = [];
  const values = [];

  if ('reviewed' in req.body) {
    if (typeof req.body.reviewed !== 'boolean') return res.status(400).json({ error: 'reviewed must be a boolean' });
    const reviewedBy = req.body.reviewed ? req.session.user.displayName || req.session.user.email : null;
    values.push(reviewedBy);
    setClauses.push(`reviewed_by = $${values.length}`);
    values.push(req.body.reviewed ? new Date() : null);
    setClauses.push(`reviewed_at = $${values.length}`);
  }

  const hasContentEdits = Object.keys(CLIENT_EXPECTATION_FIELDS).some((key) => key in req.body);
  if (hasContentEdits) {
    if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
    for (const [key, column] of Object.entries(CLIENT_EXPECTATION_FIELDS)) {
      if (key in req.body) {
        values.push(req.body[key]);
        setClauses.push(`${column} = $${values.length}`);
      }
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: 'No recognized fields in request body' });

  values.push(id, clientId);
  const result = await pool.query(
    `update client_expectations set ${setClauses.join(', ')}, updated_at = now()
     where id = $${values.length - 1} and client_id = $${values.length}
     returning *`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

app.delete('/api/clients/:clientId/expectations/:id', requireManager, async (req, res) => {
  const { clientId, id } = req.params;
  const result = await pool.query('delete from client_expectations where id = $1 and client_id = $2', [id, clientId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Manager-only, matching the PRD: clients mainly download, managers upload/edit/delete (the
// frontend already only shows those controls when canEdit).
app.post('/api/clients/:clientId/documents', requireManager, upload.single('file'), async (req, res) => {
  const { clientId } = req.params;
  const { title, description, category, signatureStatus } = req.body;
  if (!title || !DOCUMENT_CATEGORIES.includes(category)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'title and a valid category are required' });
  }

  const owner = req.session.user.displayName || req.session.user.email;
  const result = await pool.query(
    `insert into client_documents
       (client_id, title, description, category, signature_status, file_type, file_size_bytes, storage_path, owner)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      clientId,
      title,
      description || null,
      category,
      SIGNATURE_STATUSES.includes(signatureStatus) ? signatureStatus : 'none',
      req.file ? (path.extname(req.file.originalname).replace('.', '').toUpperCase() || 'FILE') : null,
      req.file ? req.file.size : null,
      req.file ? req.file.filename : null,
      owner,
    ]
  );
  res.status(201).json(result.rows[0]);
});

app.patch('/api/clients/:clientId/documents/:id', requireManager, upload.single('file'), async (req, res) => {
  const { clientId, id } = req.params;
  const existing = await pool.query('select * from client_documents where id = $1 and client_id = $2', [id, clientId]);
  const doc = existing.rows[0];
  if (!doc) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Not found' });
  }

  const setClauses = [];
  const values = [];
  const push = (column, value) => {
    values.push(value);
    setClauses.push(`${column} = $${values.length}`);
  };

  if ('title' in req.body) push('title', req.body.title);
  if ('description' in req.body) push('description', req.body.description || null);
  if ('category' in req.body && DOCUMENT_CATEGORIES.includes(req.body.category)) push('category', req.body.category);
  if ('signatureStatus' in req.body && SIGNATURE_STATUSES.includes(req.body.signatureStatus)) {
    push('signature_status', req.body.signatureStatus);
  }
  if (req.file) {
    push('file_type', path.extname(req.file.originalname).replace('.', '').toUpperCase() || 'FILE');
    push('file_size_bytes', req.file.size);
    push('storage_path', req.file.filename);
    push('uploaded_at', new Date());
  }

  if (setClauses.length === 0) return res.json(doc);

  values.push(id);
  const result = await pool.query(
    `update client_documents set ${setClauses.join(', ')}, updated_at = now() where id = $${values.length} returning *`,
    values
  );

  // Only remove the old file once the DB row referencing it has been successfully repointed.
  if (req.file && doc.storage_path) fs.unlink(path.join(UPLOADS_DIR, doc.storage_path), () => {});

  res.json(result.rows[0]);
});

app.delete('/api/clients/:clientId/documents/:id', requireManager, async (req, res) => {
  const { clientId, id } = req.params;
  const result = await pool.query(
    'delete from client_documents where id = $1 and client_id = $2 returning storage_path',
    [id, clientId]
  );
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.storage_path) fs.unlink(path.join(UPLOADS_DIR, row.storage_path), () => {});
  res.status(204).send();
});

// Both roles can download (this is the client-facing point of the document center), scoped the
// same way GET /api/clients/:id is -- streamed through the server rather than a static file URL
// so an unauthenticated request (or a different client) can't fetch it by guessing a path.
app.get('/api/clients/:clientId/documents/:id/download', requireAuth, async (req, res) => {
  const { clientId, id } = req.params;
  if (!canAccessClient(req, clientId)) return res.status(403).json({ error: 'Forbidden' });

  const result = await pool.query('select * from client_documents where id = $1 and client_id = $2', [id, clientId]);
  const doc = result.rows[0];
  if (!doc || !doc.storage_path) return res.status(404).json({ error: 'No file attached to this document' });

  const filePath = path.join(UPLOADS_DIR, doc.storage_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

  res.download(filePath, `${doc.title}${path.extname(doc.storage_path)}`);
});

// A single workbook with the Client and Broker Questionnaire data in the same shape/order as the
// two questionnaire pages, for submitting to external partners (TPAs, PBMs, stoploss carriers)
// who need the same demographic information. Manager-only, like the questionnaires themselves.
app.get('/api/clients/:clientId/questionnaire-export', requireManager, async (req, res) => {
  const { clientId } = req.params;
  const clientResult = await pool.query('select * from clients where id = $1', [clientId]);
  const client = clientResult.rows[0];
  if (!client) return res.status(404).json({ error: 'Not found' });

  const [broker, contacts] = await Promise.all([
    client.broker_id
      ? pool.query('select * from brokers where id = $1', [client.broker_id]).then((r) => r.rows[0])
      : null,
    pool.query(
      `select co.*, cc.signatory from client_contacts cc
       join contacts co on co.id = cc.contact_id
       where cc.client_id = $1 order by co.category, co.name`,
      [clientId]
    ).then((r) => r.rows),
  ]);
  const employerContacts = contacts.filter((c) => c.category === 'employer');
  const brokerContacts = contacts.filter((c) => c.category === 'broker');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '39N Health';
  workbook.created = new Date();

  const addFieldValueSheet = (name, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'Field', key: 'field', width: 32 },
      { header: 'Value', key: 'value', width: 55 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach(([field, value]) => sheet.addRow({ field, value: value ?? '' }));
    return sheet;
  };
  const addContactRows = (sheet, heading, contactRows) => {
    if (contactRows.length === 0) return;
    sheet.addRow({});
    const headingRow = sheet.addRow({ field: heading, value: '' });
    headingRow.font = { bold: true };
    contactRows.forEach((c) => {
      sheet.addRow({
        field: c.signatory ? `${c.name} (Signatory)` : c.name,
        value: [c.title, c.phone, c.email].filter(Boolean).join(' | '),
      });
    });
  };

  const clientSheet = addFieldValueSheet('Client Questionnaire', [
    ['Plan Sponsor', client.plan_sponsor_name],
    ['Business Address', client.address],
    ['Tax ID (EIN)', client.tax_id],
    ['SIC Code', client.sic_code],
    ['Organization Type', client.org_type],
    ['Company Size', client.company_size],
    ['Locations', client.locations],
    ['Effective Date', client.effective_date],
    ['Waiting Period for New Hires', client.waiting_period],
    ['HP Network', client.hp_network],
    ['National Network', client.national_network],
    ['Excluded Classes', (client.excluded_classes || []).join(', ')],
    ['Notes', client.notes],
  ]);
  addContactRows(clientSheet, 'Employer Contacts', employerContacts);

  const brokerSheet = addFieldValueSheet('Broker Questionnaire', [
    ['Broker Name', broker?.broker_name],
    ['Firm Name', broker?.firm_name],
    ['Firm Address', broker?.firm_address],
    ['Firm Tax ID', broker?.firm_tax_id],
    ['Vendor Integration Required', client.vendor_integration_required ? 'Yes' : 'No'],
    ['Integration Platform', client.vendor_integration_platform],
    ['COBRA Vendor Name', client.cobra_vendor_name],
    ['COBRA Vendor Contact', client.cobra_vendor_contact],
    ['COBRA Vendor Phone', client.cobra_vendor_phone],
    ['COBRA Vendor Email', client.cobra_vendor_email],
    ['Broker Notes', client.broker_notes],
  ]);
  addContactRows(brokerSheet, 'Broker Contacts', brokerContacts);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${client.plan_sponsor_name.replace(/[^a-z0-9]+/gi, '-')}-questionnaire.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Serves the Vite production build (npm run build -> dist/), if one exists -- not __dirname
// itself, which also holds the *dev* index.html (the one referencing unbundled /src/main.jsx),
// so serving __dirname directly would return that broken dev entry point instead of the real app.
// There's no client-side router (App.jsx manages navigation via internal state, not URL paths),
// so a plain catch-all back to index.html is enough -- no route-specific rewriting needed. This
// must be registered last so it never shadows an API route or /health above.
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
