// Transforms the /api/clients/:id response (raw database rows) into the exact shapes the
// existing page components already expect (the same shapes data.js's constants used to have).
// Keeping this in one place means App.jsx doesn't need to know about database column names,
// and the page components don't need to change at all -- only where their data comes from does.
import { formatFileSize } from './pages/Documents';

const CONTACT_FIELDS = (row) => ({
  id: row.id,
  name: row.name,
  title: row.title || '',
  role: row.role || '',
  phone: row.phone || '',
  email: row.email || '',
  // Only ever set for employer contacts (see server.js's GET /api/clients/:id join against
  // users.contact_id); harmless elsewhere since nothing else reads it.
  loginEmail: row.login_email || null,
});

// Exported so App.jsx can shape a freshly-attached pool contact (POST .../contacts {contactId})
// the same way an initial load does, without re-mapping the whole client payload.
export function mapContactForGroup(groupId, row) {
  const base = CONTACT_FIELDS(row);
  if (groupId === 'client') return { ...base, signatory: Boolean(row.signatory) };
  if (groupId === 'partners') return { ...base, org: row.org || '', category: row.partner_type || '' };
  return base;
}

// Exported so App.jsx can shape a freshly-linked/created broker (POST /api/brokers, then
// PATCH /api/clients/:id { brokerId }) the same way an initial load does, without re-mapping the
// whole client payload.
export function mapBrokerRow(row) {
  return {
    id: row.id,
    brokerName: row.broker_name || '',
    firmName: row.firm_name || '',
    firmAddress: row.firm_address || '',
    firmTaxId: row.firm_tax_id || '',
  };
}

// Exported so App.jsx can build the same group `id` for a freshly-created/renamed expectation
// group, without re-mapping the whole client payload.
export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Exported separately from mapClientResponse so App.jsx can reuse it to map the single-row
// response from a document create/update PATCH, without re-mapping the whole client payload.
export function mapDocumentRow(doc) {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description || '',
    category: doc.category,
    signatureStatus: doc.signature_status,
    fileType: doc.file_type || 'FILE',
    fileSize: doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : '—',
    uploadedAt: doc.uploaded_at.slice(0, 10),
    owner: doc.owner || '',
    file: null,
  };
}

export function mapClientResponse({ client, broker, contacts, deliverables, expectations, documents }) {
  const employerContacts = contacts
    .filter((c) => c.category === 'employer')
    .map((c) => ({ ...CONTACT_FIELDS(c), signatory: Boolean(c.signatory) }));

  const clientData = {
    id: client.id,
    companyName: client.plan_sponsor_name,
    address: client.address,
    taxId: client.tax_id || '',
    sicCode: client.sic_code || '',
    orgType: client.org_type || '',
    companySize: client.company_size || '',
    locations: client.locations || '',
    effectiveDate: client.effective_date,
    waitingPeriod: client.waiting_period || '',
    excludedClasses: client.excluded_classes || [],
    hpNetwork: client.hp_network || '',
    nationalNetwork: client.national_network || '',
    notes: client.notes || '',
    contacts: employerContacts,
    mainContact: employerContacts.find((c) => c.signatory) || employerContacts[0],
  };

  const brokerData = {
    ...(broker ? mapBrokerRow(broker) : { id: null, brokerName: '', firmName: '', firmAddress: '', firmTaxId: '' }),
    notes: client.broker_notes || '',
    vendorIntegration: {
      required: client.vendor_integration_required ? 'yes' : 'no',
      platform: client.vendor_integration_platform || '',
      cobraVendorName: client.cobra_vendor_name || '',
      cobraVendorContact: client.cobra_vendor_contact || '',
      cobraVendorPhone: client.cobra_vendor_phone || '',
      cobraVendorEmail: client.cobra_vendor_email || '',
    },
    contacts: contacts.filter((c) => c.category === 'broker').map(CONTACT_FIELDS),
  };

  const healthContacts = contacts.filter((c) => c.category === 'internal').map(CONTACT_FIELDS);
  const partnerContacts = contacts
    .filter((c) => c.category === 'partner')
    .map((c) => ({ ...CONTACT_FIELDS(c), org: c.org || '', category: c.partner_type || '' }));

  const preDeliverables = [];
  const postDeliverables = [];
  // Keyed by the real client_deliverables row id (see utils/deliverables.js's buildDeliverables,
  // which reads it back the same way) -- stable across renames/reorders/unrelated deletes, unlike
  // a derived phase-position-name key would be.
  const completedDeliverables = {};
  for (const row of deliverables) {
    const item = { id: row.id, name: row.name, rule: row.due_date_rule, note: row.note || '' };
    (row.phase === 'pre' ? preDeliverables : postDeliverables).push(item);
    if (row.is_complete) completedDeliverables[row.id] = true;
  }

  const expectationGroupsByTitle = new Map();
  // Keyed by the real client_expectations row id, same reasoning as completedDeliverables above --
  // stable across renames/reorders/unrelated deletes, unlike a derived group+title key would be.
  const acknowledgedItems = {};
  for (const row of expectations) {
    if (!expectationGroupsByTitle.has(row.group_title)) {
      expectationGroupsByTitle.set(row.group_title, {
        id: slugify(row.group_title),
        title: row.group_title,
        audience: row.audience,
        items: [],
      });
    }
    expectationGroupsByTitle.get(row.group_title).items.push({ id: row.id, title: row.title, body: row.body });
    if (row.reviewed_by) acknowledgedItems[row.id] = { by: row.reviewed_by, at: row.reviewed_at };
  }
  const expectationGroups = [...expectationGroupsByTitle.values()];

  const mappedDocuments = documents.map(mapDocumentRow);

  return {
    clientData,
    brokerData,
    healthContacts,
    partnerContacts,
    preDeliverables,
    postDeliverables,
    completedDeliverables,
    expectationGroups,
    acknowledgedItems,
    documents: mappedDocuments,
  };
}
