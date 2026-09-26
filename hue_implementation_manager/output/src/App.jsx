import { useEffect, useState } from 'react';
import './styles.css';
import logo from './assets/logo-39n.png';
import { api } from './api';
import { mapClientResponse, mapDocumentRow, mapContactForGroup, mapBrokerRow, slugify } from './mapClientResponse';
import { buildClientPatch, buildBrokerPatches } from './buildPatch';
import LoginScreen from './pages/LoginScreen';
import AdminClientList from './pages/AdminClientList';
import TemplateDeliverables from './pages/TemplateDeliverables';
import TemplateExpectations from './pages/TemplateExpectations';
import AdminContacts from './pages/AdminContacts';
import AdminManagers from './pages/AdminManagers';
import { NAV_ITEMS } from './data';
import { useDraftEditor } from './hooks/useDraftEditor';
import Overview from './pages/Overview';
import ClientQuestionnaire from './pages/ClientQuestionnaire';
import BrokerQuestionnaire from './pages/BrokerQuestionnaire';
import Contacts from './pages/Contacts';
import Deliverables from './pages/Deliverables';
import WhatToExpect from './pages/WhatToExpect';
import Documents from './pages/Documents';

// Maps a Contacts page group id to the `contacts.category` value a newly-created contact in
// that group gets attached as (see mapClientResponse.js, which reads the same categories back).
const GROUP_CATEGORY = { health: 'internal', client: 'employer', broker: 'broker', partners: 'partner' };

// The admin-level screens a manager sees before picking a client (see the app-shell branch below
// for `authUser.role === 'manager' && !selectedClientId`).
const ADMIN_NAV_ITEMS = [
  { id: 'clients', label: 'Clients' },
  { id: 'template-deliverables', label: 'Deliverables Template' },
  { id: 'template-expectations', label: 'What to Expect Template' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'managers', label: 'Team Accounts' },
];

// Shared contact fields tracked for the diff-on-Done save (see handleDoneEditingContacts).
// `signatory` is handled separately since it lives on client_contacts, not contacts.
const CONTACT_EDIT_FIELDS = ['name', 'title', 'phone', 'email', 'role', 'org', 'category'];

// The local `category` field (partner "type", e.g. "TPA") is named `partnerType` in the API --
// see mapClientResponse.js's partnerContacts mapping, which reads it the other direction.
const toApiContactFields = (contact) => ({
  name: contact.name,
  title: contact.title,
  phone: contact.phone,
  email: contact.email,
  role: contact.role,
  org: contact.org,
  partnerType: contact.category,
});

function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [navOpen, setNavOpen] = useState(false);

  // undefined = still checking for an existing session; null = confirmed signed out;
  // an object = signed in (see auth.js's req.session.user for the shape).
  const [authUser, setAuthUser] = useState(undefined);
  const canEdit = authUser?.role === 'manager';

  useEffect(() => {
    api.me().then(setAuthUser).catch(() => setAuthUser(null));
  }, []);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setAuthUser(null);
    setActiveSection('overview');
    setSelectedClientId(null);
    setAdminSection('clients');
    setContactPool(null);
  };

  // For a manager, this is null until they pick a client from the admin list (or create a new
  // one); a client-role account never uses it, since they only ever have their own client
  // (authUser.clientId is used directly instead -- see the data-fetching effect below).
  const [selectedClientId, setSelectedClientId] = useState(null);
  // Which admin-level screen a manager without a selected client is looking at.
  const [adminSection, setAdminSection] = useState('clients');

  // State for interactive sections lives here so it survives switching sections. Everything
  // starts empty/null and is populated once from the API after login (see the effect below) --
  // data.js's constants are no longer the source, only a fictional client living in Postgres is.
  const [completedDeliverables, setCompletedDeliverables] = useState({});
  const [acknowledgedItems, setAcknowledgedItems] = useState({});
  const [documents, setDocuments] = useState([]);
  const [clientData, setClientData] = useState(null);
  const [brokerData, setBrokerData] = useState(null);
  const [healthContacts, setHealthContacts] = useState([]);
  const [partnerContacts, setPartnerContacts] = useState([]);
  const [preDeliverables, setPreDeliverables] = useState([]);
  const [postDeliverables, setPostDeliverables] = useState([]);
  const [expectationGroups, setExpectationGroups] = useState([]);
  const [dataError, setDataError] = useState(null);
  // Last-persisted snapshot per contact group, diffed against on "Done" to decide which
  // contacts to create/update/remove on the backend (see handleDoneEditingContacts).
  const [contactsBaseline, setContactsBaseline] = useState({ health: [], client: [], broker: [], partners: [] });
  const [contactSaving, setContactSaving] = useState({});
  const [contactSaveErrors, setContactSaveErrors] = useState({});

  // The admin client list -- only fetched while a manager hasn't picked a client yet (that's
  // when AdminClientList is actually shown), and refreshed every time they return to it (e.g.
  // after creating a client) so it never goes stale.
  const [clientList, setClientList] = useState([]);
  const [clientListLoading, setClientListLoading] = useState(false);
  const [clientListError, setClientListError] = useState(null);

  useEffect(() => {
    if (authUser?.role !== 'manager' || selectedClientId || adminSection !== 'clients') return undefined;
    let cancelled = false;
    setClientListLoading(true);
    setClientListError(null);
    api.getClients()
      .then((rows) => {
        if (!cancelled) setClientList(rows);
      })
      .catch((err) => {
        if (!cancelled) setClientListError(err.message || 'Failed to load clients.');
      })
      .finally(() => {
        if (!cancelled) setClientListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, selectedClientId, adminSection]);

  const handleCreateClient = async (fields) => {
    const created = await api.createClient(fields);
    setActiveSection('overview');
    setSelectedClientId(created.id);
  };
  const handleUpdateClientStatus = async (id, status) => {
    await api.updateClient(id, { status });
    setClientList((current) => current.map((client) => (client.id === id ? { ...client, status } : client)));
  };
  const handleDeleteClient = async (id) => {
    await api.removeClient(id);
    setClientList((current) => current.filter((client) => client.id !== id));
  };

  // The deliverables template -- only fetched while the admin is actually looking at it, and
  // refreshed every time they return to it, same pattern as the client list above.
  const [templateDeliverables, setTemplateDeliverables] = useState([]);
  const [templateDeliverablesLoading, setTemplateDeliverablesLoading] = useState(false);
  const [templateDeliverablesError, setTemplateDeliverablesError] = useState(null);

  useEffect(() => {
    if (authUser?.role !== 'manager' || selectedClientId || adminSection !== 'template-deliverables') return undefined;
    let cancelled = false;
    setTemplateDeliverablesLoading(true);
    setTemplateDeliverablesError(null);
    api.getTemplateDeliverables()
      .then((rows) => {
        if (!cancelled) setTemplateDeliverables(rows);
      })
      .catch((err) => {
        if (!cancelled) setTemplateDeliverablesError(err.message || 'Failed to load the template.');
      })
      .finally(() => {
        if (!cancelled) setTemplateDeliverablesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, selectedClientId, adminSection]);

  const handleAddTemplateDeliverable = async (fields) => {
    const created = await api.addTemplateDeliverable(fields);
    setTemplateDeliverables((current) => [...current, created]);
  };
  const handleUpdateTemplateDeliverable = async (id, fields) => {
    const updated = await api.updateTemplateDeliverable(id, fields);
    setTemplateDeliverables((current) => current.map((item) => (item.id === id ? updated : item)));
  };
  const handleRemoveTemplateDeliverable = async (id) => {
    await api.removeTemplateDeliverable(id);
    setTemplateDeliverables((current) => current.filter((item) => item.id !== id));
  };
  const handleReorderTemplateDeliverable = async (id, direction) => {
    setTemplateDeliverables(await api.reorderTemplateDeliverable(id, direction));
  };

  // The expectations template -- same pattern as the deliverables template above.
  const [templateExpectations, setTemplateExpectations] = useState([]);
  const [templateExpectationsLoading, setTemplateExpectationsLoading] = useState(false);
  const [templateExpectationsError, setTemplateExpectationsError] = useState(null);

  useEffect(() => {
    if (authUser?.role !== 'manager' || selectedClientId || adminSection !== 'template-expectations') return undefined;
    let cancelled = false;
    setTemplateExpectationsLoading(true);
    setTemplateExpectationsError(null);
    api.getTemplateExpectations()
      .then((rows) => {
        if (!cancelled) setTemplateExpectations(rows);
      })
      .catch((err) => {
        if (!cancelled) setTemplateExpectationsError(err.message || 'Failed to load the template.');
      })
      .finally(() => {
        if (!cancelled) setTemplateExpectationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, selectedClientId, adminSection]);

  const handleAddTemplateExpectation = async (fields) => {
    const created = await api.addTemplateExpectation(fields);
    setTemplateExpectations((current) => [...current, created]);
  };
  const handleUpdateTemplateExpectation = async (id, fields) => {
    const updated = await api.updateTemplateExpectation(id, fields);
    setTemplateExpectations((current) => current.map((item) => (item.id === id ? updated : item)));
  };
  const handleRemoveTemplateExpectation = async (id) => {
    await api.removeTemplateExpectation(id);
    setTemplateExpectations((current) => current.filter((item) => item.id !== id));
  };
  const handleReorderTemplateExpectation = async (id, direction) => {
    setTemplateExpectations(await api.reorderTemplateExpectation(id, direction));
  };

  useEffect(() => {
    if (!authUser) return undefined;
    // A manager sees the admin list first (see above) and hasn't picked a client yet; a
    // client-role account always uses its own id, known from the moment it logs in.
    const clientId = authUser.role === 'manager' ? selectedClientId : authUser.clientId;
    if (!clientId) return undefined;

    let cancelled = false;
    setClientData(null); // shows the loading gate immediately, so switching clients never flashes stale data
    setDataError(null);

    (async () => {
      try {
        const payload = await api.getClient(clientId);
        if (cancelled) return;

        const mapped = mapClientResponse(payload);
        setClientData(mapped.clientData);
        setBrokerData(mapped.brokerData);
        setHealthContacts(mapped.healthContacts);
        setPartnerContacts(mapped.partnerContacts);
        setPreDeliverables(mapped.preDeliverables);
        setPostDeliverables(mapped.postDeliverables);
        setCompletedDeliverables(mapped.completedDeliverables);
        setExpectationGroups(mapped.expectationGroups);
        setAcknowledgedItems(mapped.acknowledgedItems);
        setDocuments(mapped.documents);
        setContactsBaseline({
          health: mapped.healthContacts,
          client: mapped.clientData.contacts,
          broker: mapped.brokerData.contacts,
          partners: mapped.partnerContacts,
        });
      } catch (err) {
        if (!cancelled) setDataError(err.message || 'Failed to load client data.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, selectedClientId]);

  const clientEditor = useDraftEditor(clientData || {}, setClientData, {
    fields: [
      'companyName', 'address', 'taxId', 'sicCode', 'orgType', 'companySize',
      'effectiveDate', 'waitingPeriod', 'hpNetwork', 'nationalNetwork', 'locations', 'excludedClasses', 'notes',
    ],
    required: ['companyName', 'address', 'effectiveDate'],
    persist: (draft) => api.updateClient(clientData.id, buildClientPatch(draft)),
  });
  const brokerEditor = useDraftEditor(brokerData || {}, setBrokerData, {
    fields: ['brokerName', 'firmName', 'firmAddress', 'firmTaxId', 'notes', 'vendorIntegration'],
    required: ['brokerName', 'firmName'],
    // The broker's own name/firm fields are shared (see PATCH /api/brokers/:id); notes and
    // vendor integration are this client's own columns. Both need to succeed together, so a
    // client with no linked broker yet can't save this section (no id to PATCH) -- creating one
    // is a future admin-portal task, not part of this questionnaire.
    persist: async (draft) => {
      if (!brokerData.id) throw new Error('This client has no broker on file yet -- add one from the admin portal first.');
      const { brokerPatch, clientPatch } = buildBrokerPatches(draft);
      await Promise.all([api.updateBroker(brokerData.id, brokerPatch), api.updateClient(clientData.id, clientPatch)]);
    },
  });
  const [contactEditMode, setContactEditMode] = useState({
    health: false,
    client: false,
    broker: false,
    partners: false,
  });

  // Client and broker contacts live nested inside clientData/brokerData; health and partner
  // contacts are their own top-level lists. This maps each group id to how its list is updated,
  // so the rest of the contact handlers below don't need to know where a group's data lives.
  const updateGroupContacts = (groupId, updater) => {
    if (groupId === 'client') {
      setClientData((current) => ({ ...current, contacts: updater(current.contacts) }));
    } else if (groupId === 'broker') {
      setBrokerData((current) => ({ ...current, contacts: updater(current.contacts) }));
    } else if (groupId === 'health') {
      setHealthContacts(updater);
    } else if (groupId === 'partners') {
      setPartnerContacts(updater);
    }
  };

  const handleContactChange = (groupId, index, field) => (event) => {
    const value = field === 'signatory' ? event.target.checked : event.target.value;
    updateGroupContacts(groupId, (contacts) =>
      contacts.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact))
    );
  };

  const blankContact = (groupId) => {
    if (groupId === 'client') return { name: '', title: '', role: '', phone: '', email: '', signatory: false };
    if (groupId === 'partners') return { org: '', category: '', name: '', title: '', role: '', phone: '', email: '' };
    return { name: '', title: '', role: '', phone: '', email: '' };
  };

  const handleAddContact = (groupId) => {
    updateGroupContacts(groupId, (contacts) => [...contacts, blankContact(groupId)]);
  };

  const handleRemoveContact = (groupId, index) => {
    updateGroupContacts(groupId, (contacts) => contacts.filter((_, contactIndex) => contactIndex !== index));
  };

  const groupContacts = (groupId) => {
    if (groupId === 'client') return clientData.contacts;
    if (groupId === 'broker') return brokerData.contacts;
    if (groupId === 'health') return healthContacts;
    return partnerContacts;
  };

  // Edits happen live in local state (every keystroke), same as before B3 -- only "Done" talks
  // to the backend, diffing the group's current contacts against the last-saved baseline: new
  // contacts (no id yet) are created, changed ones are patched, and ones no longer present are
  // detached. On failure, edit mode stays open so nothing typed is lost.
  const handleDoneEditingContacts = async (groupId) => {
    const current = groupContacts(groupId);
    const baseline = contactsBaseline[groupId];
    const baselineById = new Map(baseline.filter((contact) => contact.id).map((contact) => [contact.id, contact]));
    const currentIds = new Set(current.filter((contact) => contact.id).map((contact) => contact.id));

    setContactSaveErrors((prev) => ({ ...prev, [groupId]: null }));
    setContactSaving((prev) => ({ ...prev, [groupId]: true }));
    try {
      const removed = baseline.filter((contact) => contact.id && !currentIds.has(contact.id));
      await Promise.all(removed.map((contact) => api.removeClientContact(clientData.id, contact.id)));

      const saved = await Promise.all(
        current.map(async (contact) => {
          if (!contact.id) {
            const created = await api.addClientContact(clientData.id, {
              category: GROUP_CATEGORY[groupId],
              ...toApiContactFields(contact),
              signatory: contact.signatory || false,
            });
            return { ...contact, id: created.id };
          }
          const base = baselineById.get(contact.id);
          const fieldsChanged = !base || CONTACT_EDIT_FIELDS.some((field) => contact[field] !== base[field]);
          const signatoryChanged = !base || contact.signatory !== base.signatory;
          if (fieldsChanged || signatoryChanged) {
            const patch = fieldsChanged ? toApiContactFields(contact) : {};
            if (signatoryChanged && 'signatory' in contact) patch.signatory = contact.signatory;
            await api.updateClientContact(clientData.id, contact.id, patch);
          }
          return contact;
        })
      );

      updateGroupContacts(groupId, () => saved);
      setContactsBaseline((prev) => ({ ...prev, [groupId]: saved }));
      setContactEditMode((prev) => ({ ...prev, [groupId]: false }));
    } catch (err) {
      setContactSaveErrors((prev) => ({ ...prev, [groupId]: err.message || 'Failed to save contacts.' }));
    } finally {
      setContactSaving((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  // The reusable contact pool -- independent of any one client. Used both by the admin-level
  // Contacts screen (browse/create/edit/delete) and by a client's own Contacts page (attaching an
  // existing contact, e.g. a TPA rep who already works with other clients, instead of creating a
  // duplicate). Fetched lazily on first use and cached across both.
  const [contactPool, setContactPool] = useState(null);
  const [contactPoolLoading, setContactPoolLoading] = useState(false);
  const [contactPoolError, setContactPoolError] = useState(null);
  const ensureContactPoolLoaded = async () => {
    if (contactPool) return;
    setContactPoolLoading(true);
    setContactPoolError(null);
    try {
      setContactPool(await api.getContactPool());
    } catch (err) {
      setContactPoolError(err.message || 'Failed to load the contact pool.');
    } finally {
      setContactPoolLoading(false);
    }
  };
  useEffect(() => {
    if (authUser?.role === 'manager' && !selectedClientId && adminSection === 'contacts') {
      ensureContactPoolLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureContactPoolLoaded already no-ops once cached
  }, [authUser, selectedClientId, adminSection]);

  // Manager (39N staff) accounts -- the admin-level "Team Accounts" screen. Fetched lazily the
  // first time that screen is opened, same pattern as the contact pool above.
  const [managers, setManagers] = useState(null);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState(null);
  useEffect(() => {
    if (authUser?.role === 'manager' && !selectedClientId && adminSection === 'managers' && !managers) {
      setManagersLoading(true);
      setManagersError(null);
      api.getManagers()
        .then(setManagers)
        .catch((err) => setManagersError(err.message || 'Failed to load accounts.'))
        .finally(() => setManagersLoading(false));
    }
  }, [authUser, selectedClientId, adminSection, managers]);
  const handleAddManager = async (fields) => {
    const created = await api.addManager(fields);
    setManagers((current) => [...(current || []), created]);
  };
  const handleUpdateManager = async (id, patch) => {
    const updated = await api.updateManager(id, patch);
    setManagers((current) => (current || []).map((manager) => (manager.id === id ? updated : manager)));
  };
  const handleRemoveManager = async (id) => {
    await api.removeManager(id);
    setManagers((current) => (current || []).filter((manager) => manager.id !== id));
  };

  const handleAddPoolContact = async (fields) => {
    const created = await api.addPoolContact(fields);
    setContactPool((current) => [...(current || []), created]);
  };
  const handleUpdatePoolContact = async (id, fields) => {
    const updated = await api.updatePoolContact(id, fields);
    setContactPool((current) => (current || []).map((contact) => (contact.id === id ? { ...contact, ...updated } : contact)));
  };
  const handleRemovePoolContact = async (id) => {
    await api.removePoolContact(id);
    setContactPool((current) => (current || []).filter((contact) => contact.id !== id));
  };

  // Attaching (unlike adding a brand-new contact) persists immediately rather than waiting for
  // "Done" -- there's no draft to batch, it's a single, already-final choice from the picker.
  const handleAttachExistingContact = async (groupId, contactId) => {
    const attached = await api.attachClientContact(clientData.id, contactId, false);
    const mapped = mapContactForGroup(groupId, attached);
    updateGroupContacts(groupId, (contacts) => [...contacts, mapped]);
    setContactsBaseline((prev) => ({ ...prev, [groupId]: [...prev[groupId], mapped] }));
  };

  // Portal-access (login) management -- individual logins per person (employer contacts and,
  // per the chat, broker contacts too -- one broker rep working with several clients gets a
  // separate login per client rather than sub-admin access across all of them). A client-role
  // login is tied to one contact record, not a shared credential. These persist immediately,
  // same reasoning as the picker above. Works for any group; the backend doesn't care which
  // category a contact is, it just requires the contact to be attached to this client.
  const applyContactLoginUpdate = (groupId, contactId, loginEmail) => {
    updateGroupContacts(groupId, (contacts) =>
      contacts.map((contact) => (contact.id === contactId ? { ...contact, loginEmail } : contact))
    );
    setContactsBaseline((prev) => ({
      ...prev,
      [groupId]: prev[groupId].map((contact) => (contact.id === contactId ? { ...contact, loginEmail } : contact)),
    }));
  };
  const handleCreateContactLogin = async (groupId, contactId, credentials) => {
    const user = await api.createContactLogin(clientData.id, contactId, credentials);
    applyContactLoginUpdate(groupId, contactId, user.email);
  };
  const handleUpdateContactLogin = async (groupId, contactId, credentials) => {
    const user = await api.updateContactLogin(clientData.id, contactId, credentials);
    applyContactLoginUpdate(groupId, contactId, user.email);
  };
  const handleRemoveContactLogin = async (groupId, contactId) => {
    await api.removeContactLogin(clientData.id, contactId);
    applyContactLoginUpdate(groupId, contactId, null);
  };

  // Brokers are reusable/shared across clients, like the contact pool -- fetched lazily the first
  // time the Broker Questionnaire's link picker opens for a client with none linked yet. Mapped
  // to the same camelCase shape as brokerData (mapBrokerRow) right away so the picker list and
  // brokerData read consistently.
  const [brokerPool, setBrokerPool] = useState(null);
  const [brokerPoolError, setBrokerPoolError] = useState(null);
  const ensureBrokerPoolLoaded = async () => {
    if (brokerPool) return;
    setBrokerPoolError(null);
    try {
      setBrokerPool((await api.getBrokers()).map(mapBrokerRow));
    } catch (err) {
      setBrokerPoolError(err.message || 'Failed to load brokers.');
    }
  };
  const handleLinkBroker = async (brokerId) => {
    await api.updateClient(clientData.id, { brokerId });
    const broker = (brokerPool || []).find((b) => b.id === brokerId);
    setBrokerData((current) => ({ ...current, ...broker }));
  };
  const handleCreateBroker = async (fields) => {
    const created = mapBrokerRow(await api.createBroker(fields));
    await api.updateClient(clientData.id, { brokerId: created.id });
    setBrokerPool((current) => [...(current || []), created]);
    setBrokerData((current) => ({ ...current, ...created }));
  };

  // Unlike the questionnaires/contacts, both roles can toggle these (a client checking off their
  // own deliverables and reviewing expectations is the point), so they persist immediately on
  // click rather than batching behind an Edit/Done or Save step -- optimistic update first for a
  // snappy checkbox, with a rollback + inline error if the PATCH fails.
  const [deliverableSaveError, setDeliverableSaveError] = useState(null);
  const handleToggleDeliverable = async (item) => {
    const nextComplete = !completedDeliverables[item.key];
    setDeliverableSaveError(null);
    setCompletedDeliverables((current) => ({ ...current, [item.key]: nextComplete }));
    try {
      await api.updateClientDeliverable(clientData.id, item.id, { isComplete: nextComplete });
    } catch (err) {
      setCompletedDeliverables((current) => ({ ...current, [item.key]: !nextComplete }));
      setDeliverableSaveError(err.message || 'Failed to update deliverable.');
    }
  };

  // Manager-only content edits (name/due date rule/note/phase), separate from the isComplete
  // toggle above. A client's own deliverables started as a copy of the template but are fully
  // independent rows from here on -- editing one here never touches the template or any other
  // client. Adding/editing/removing may move an item between the pre/post arrays (or add/remove
  // one entirely), so this replaces it in both rather than trying to patch just one in place.
  const replaceDeliverableItem = (id, phase, item) => {
    setPreDeliverables((current) => {
      const filtered = current.filter((d) => d.id !== id);
      return phase === 'pre' ? [...filtered, item] : filtered;
    });
    setPostDeliverables((current) => {
      const filtered = current.filter((d) => d.id !== id);
      return phase === 'post' ? [...filtered, item] : filtered;
    });
  };
  const handleAddDeliverable = async (fields) => {
    const created = await api.addClientDeliverable(clientData.id, fields);
    replaceDeliverableItem(created.id, created.phase, {
      id: created.id, name: created.name, rule: created.due_date_rule, note: created.note || '',
    });
  };
  const handleUpdateDeliverableFields = async (id, fields) => {
    const updated = await api.updateClientDeliverable(clientData.id, id, fields);
    replaceDeliverableItem(id, updated.phase, {
      id: updated.id, name: updated.name, rule: updated.due_date_rule, note: updated.note || '',
    });
  };
  const handleRemoveDeliverable = async (id) => {
    await api.removeClientDeliverable(clientData.id, id);
    setPreDeliverables((current) => current.filter((d) => d.id !== id));
    setPostDeliverables((current) => current.filter((d) => d.id !== id));
    setCompletedDeliverables((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const [expectationSaveError, setExpectationSaveError] = useState(null);
  const handleToggleReviewed = async (item, key) => {
    const previousValue = acknowledgedItems[key] || null;
    const nowReviewed = !previousValue;
    const optimisticValue = nowReviewed ? { by: signedInName, at: new Date().toISOString() } : null;

    setExpectationSaveError(null);
    setAcknowledgedItems((current) => {
      const next = { ...current };
      if (optimisticValue) next[key] = optimisticValue;
      else delete next[key];
      return next;
    });
    try {
      await api.updateClientExpectation(clientData.id, item.id, { reviewed: nowReviewed });
    } catch (err) {
      setAcknowledgedItems((current) => {
        const next = { ...current };
        if (previousValue) next[key] = previousValue;
        else delete next[key];
        return next;
      });
      setExpectationSaveError(err.message || 'Failed to update expectation.');
    }
  };

  // Manager-only content edits (group/audience/title/body), separate from the reviewed toggle
  // above. A client's own expectations started as a copy of the template but are fully
  // independent rows from here on -- editing one here never touches the template or any other
  // client. Unlike deliverables' fixed pre/post phases, a group here is just whatever group_title
  // string is in use, so adding/editing may join an existing group, create a new one, or (if it
  // was the last item) leave a group empty and in need of removal.
  const replaceExpectationItem = (id, groupTitle, audience, item) => {
    setExpectationGroups((current) => {
      const withoutItem = current
        .map((group) => ({ ...group, items: group.items.filter((existing) => existing.id !== id) }))
        .filter((group) => group.items.length > 0);
      const targetIndex = withoutItem.findIndex((group) => group.title === groupTitle);
      if (targetIndex >= 0) {
        return withoutItem.map((group, index) =>
          index === targetIndex ? { ...group, items: [...group.items, item] } : group
        );
      }
      return [...withoutItem, { id: slugify(groupTitle), title: groupTitle, audience, items: [item] }];
    });
  };
  const handleAddExpectation = async (fields) => {
    const created = await api.addClientExpectation(clientData.id, fields);
    replaceExpectationItem(created.id, created.group_title, created.audience, {
      id: created.id, title: created.title, body: created.body,
    });
  };
  const handleUpdateExpectationFields = async (id, fields) => {
    const updated = await api.updateClientExpectation(clientData.id, id, fields);
    replaceExpectationItem(id, updated.group_title, updated.audience, {
      id: updated.id, title: updated.title, body: updated.body,
    });
  };
  const handleRemoveExpectation = async (id) => {
    await api.removeClientExpectation(clientData.id, id);
    setExpectationGroups((current) =>
      current.map((group) => ({ ...group, items: group.items.filter((item) => item.id !== id) })).filter((group) => group.items.length > 0)
    );
    setAcknowledgedItems((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  // Documents.jsx owns its own modal/error UI, so these just do the network call + state update
  // and let it catch whatever rejects (ApiError has a readable .message).
  const handleUploadDocument = async (formData) => {
    const created = await api.addClientDocument(clientData.id, formData);
    setDocuments((current) => [...current, mapDocumentRow(created)]);
  };
  const handleUpdateDocument = async (docId, formData) => {
    const updated = await api.updateClientDocument(clientData.id, docId, formData);
    setDocuments((current) => current.map((doc) => (doc.id === docId ? mapDocumentRow(updated) : doc)));
  };
  const handleRemoveDocument = async (docId) => {
    await api.removeClientDocument(clientData.id, docId);
    setDocuments((current) => current.filter((doc) => doc.id !== docId));
  };
  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const handleDownloadDocument = async (doc) => {
    const { blob, filename } = await api.downloadClientDocument(clientData.id, doc.id);
    triggerDownload(blob, filename);
  };

  // For partners (TPAs, PBMs, stoploss carriers) who need the same demographic information --
  // manager-only, like the questionnaires themselves. No dedicated error UI exists on these two
  // pages yet, so this owns its own saving/error state rather than throwing into the void.
  const [exportingQuestionnaire, setExportingQuestionnaire] = useState(false);
  const [exportError, setExportError] = useState(null);
  const handleExportQuestionnaire = async () => {
    setExportingQuestionnaire(true);
    setExportError(null);
    try {
      const { blob, filename } = await api.downloadQuestionnaireExport(clientData.id);
      triggerDownload(blob, filename);
    } catch (err) {
      setExportError(err.message || 'Failed to export questionnaire.');
    } finally {
      setExportingQuestionnaire(false);
    }
  };

  const managerContact =
    healthContacts.find((contact) => /implementation manager/i.test(contact.title)) || healthContacts[0];

  // Switching to the client preview discards any unsaved edit and closes any open editor, so a
  // manager-only form is never left open under the client view.
  useEffect(() => {
    if (canEdit) return;
    clientEditor.cancel();
    brokerEditor.cancel();
    setContactEditMode({ health: false, client: false, broker: false, partners: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only reacts to role
  }, [canEdit]);

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <Overview
            clientData={clientData}
            preDeliverables={preDeliverables}
            postDeliverables={postDeliverables}
            completedDeliverables={completedDeliverables}
            managerContact={managerContact}
            documents={documents}
            onNavigate={handleNavigate}
          />
        );
      case 'client':
        return (
          <ClientQuestionnaire
            clientData={clientEditor.values}
            onFieldChange={clientEditor.setField}
            isEditing={clientEditor.isEditing}
            editor={clientEditor}
            onNavigate={handleNavigate}
            canEdit={canEdit}
            onExport={handleExportQuestionnaire}
            exporting={exportingQuestionnaire}
            exportError={exportError}
          />
        );
      case 'broker':
        return (
          <BrokerQuestionnaire
            brokerData={brokerEditor.values}
            onFieldChange={brokerEditor.setField}
            onVendorIntegrationChange={(field) => brokerEditor.setNestedField('vendorIntegration', field)}
            isEditing={brokerEditor.isEditing}
            editor={brokerEditor}
            onNavigate={handleNavigate}
            canEdit={canEdit}
            onExport={handleExportQuestionnaire}
            exporting={exportingQuestionnaire}
            exportError={exportError}
            brokerPool={brokerPool || []}
            brokerPoolError={brokerPoolError}
            onOpenBrokerPicker={ensureBrokerPoolLoaded}
            onLinkBroker={handleLinkBroker}
            onCreateBroker={handleCreateBroker}
          />
        );
      case 'contacts':
        return (
          <Contacts
            contactsByGroup={{
              health: healthContacts,
              client: clientData.contacts,
              broker: brokerData.contacts,
              partners: partnerContacts,
            }}
            editMode={contactEditMode}
            onToggleEdit={(groupId) => {
              if (contactEditMode[groupId]) {
                handleDoneEditingContacts(groupId);
              } else {
                setContactEditMode((current) => ({ ...current, [groupId]: true }));
              }
            }}
            onAdd={handleAddContact}
            onRemove={handleRemoveContact}
            onChange={handleContactChange}
            canEdit={canEdit}
            saving={contactSaving}
            saveErrors={contactSaveErrors}
            contactPool={contactPool || []}
            contactPoolError={contactPoolError}
            onOpenPicker={ensureContactPoolLoaded}
            onAttachExisting={handleAttachExistingContact}
            onCreateLogin={handleCreateContactLogin}
            onUpdateLogin={handleUpdateContactLogin}
            onRemoveLogin={handleRemoveContactLogin}
          />
        );
      case 'deliverables':
        return (
          <Deliverables
            effectiveDate={clientData.effectiveDate}
            preDeliverables={preDeliverables}
            postDeliverables={postDeliverables}
            completedDeliverables={completedDeliverables}
            onToggleComplete={handleToggleDeliverable}
            saveError={deliverableSaveError}
            canEdit={canEdit}
            onAdd={handleAddDeliverable}
            onUpdate={handleUpdateDeliverableFields}
            onRemove={handleRemoveDeliverable}
          />
        );
      case 'what-to-expect':
        return (
          <WhatToExpect
            expectationGroups={expectationGroups}
            acknowledgedItems={acknowledgedItems}
            onToggleReviewed={handleToggleReviewed}
            reviewerName={signedInName}
            saveError={expectationSaveError}
            canEdit={canEdit}
            onAdd={handleAddExpectation}
            onUpdate={handleUpdateExpectationFields}
            onRemove={handleRemoveExpectation}
          />
        );
      case 'documents':
        // key={authUser.role}: force a remount if the effective role ever changes without a full
        // page reload, so no open upload modal or overflow menu (local state inside Documents)
        // could survive under a different access level.
        return (
          <Documents
            documents={documents}
            onUpload={handleUploadDocument}
            onUpdate={handleUpdateDocument}
            onRemove={handleRemoveDocument}
            onDownload={handleDownloadDocument}
            canEdit={canEdit}
            key={authUser.role}
          />
        );
      default:
        return null;
    }
  };

  const handleNavigate = (sectionId) => {
    setActiveSection(sectionId);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  if (authUser === undefined) {
    return (
      <div className="auth-loading">
        <img className="login-logo" src={logo} alt="" width="52" height="51" />
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={setAuthUser} />;
  }

  // A manager lands here first every time, until they pick a client (or create one) -- there's
  // no "whichever client comes back first" auto-pick anymore.
  if (authUser.role === 'manager' && !selectedClientId) {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand">
              <img className="brand-logo" src={logo} alt="" width="44" height="43" />
              <div className="brand-text">
                <span className="brand-name">39N Health</span>
                <span className="brand-sub">Admin Portal</span>
              </div>
            </div>
          </div>

          <div className="sidebar-client">Admin</div>

          <nav className="nav" aria-label="Admin sections">
            {ADMIN_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={adminSection === item.id ? 'nav-button active' : 'nav-button'}
                aria-current={adminSection === item.id ? 'page' : undefined}
                onClick={() => setAdminSection(item.id)}
              >
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button type="button" className="logout-button" onClick={handleLogout}>
              Log out
            </button>
            <div className="user-pill">
              Signed in as
              <strong>{authUser.displayName || authUser.email}</strong>
            </div>
          </div>
        </aside>

        <main className="main-panel">
          {adminSection === 'clients' && (
            <AdminClientList
              clients={clientList}
              loading={clientListLoading}
              error={clientListError}
              onSelectClient={(id) => {
                setActiveSection('overview');
                setSelectedClientId(id);
              }}
              onCreateClient={handleCreateClient}
              onUpdateStatus={handleUpdateClientStatus}
              onDeleteClient={handleDeleteClient}
            />
          )}
          {adminSection === 'template-deliverables' && (
            <TemplateDeliverables
              items={templateDeliverables}
              loading={templateDeliverablesLoading}
              error={templateDeliverablesError}
              onAdd={handleAddTemplateDeliverable}
              onUpdate={handleUpdateTemplateDeliverable}
              onRemove={handleRemoveTemplateDeliverable}
              onReorder={handleReorderTemplateDeliverable}
            />
          )}
          {adminSection === 'template-expectations' && (
            <TemplateExpectations
              items={templateExpectations}
              loading={templateExpectationsLoading}
              error={templateExpectationsError}
              onAdd={handleAddTemplateExpectation}
              onUpdate={handleUpdateTemplateExpectation}
              onRemove={handleRemoveTemplateExpectation}
              onReorder={handleReorderTemplateExpectation}
            />
          )}
          {adminSection === 'contacts' && (
            <AdminContacts
              contacts={contactPool || []}
              loading={contactPoolLoading}
              error={contactPoolError}
              onAdd={handleAddPoolContact}
              onUpdate={handleUpdatePoolContact}
              onRemove={handleRemovePoolContact}
            />
          )}
          {adminSection === 'managers' && (
            <AdminManagers
              managers={managers || []}
              loading={managersLoading}
              error={managersError}
              currentUserId={authUser.id}
              onAdd={handleAddManager}
              onUpdate={handleUpdateManager}
              onRemove={handleRemoveManager}
            />
          )}
        </main>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="auth-loading">
        <img className="login-logo" src={logo} alt="" width="52" height="51" />
        <p className="login-error">{dataError}</p>
      </div>
    );
  }

  if (!clientData || !brokerData) {
    return (
      <div className="auth-loading">
        <img className="login-logo" src={logo} alt="" width="52" height="51" />
      </div>
    );
  }

  // The name comes from the real signed-in account now, not inferred from whichever demo
  // record looked like an implementation manager. The title line is still content-derived
  // (the users table has no job-title field of its own).
  const signedInName = authUser.displayName || authUser.email;
  const signedInTitle = canEdit ? managerContact?.title : clientData.mainContact?.title;

  return (
    <div className="app-shell">
      <aside className={navOpen ? 'sidebar nav-open' : 'sidebar'}>
        <div className="sidebar-header">
          <div className="brand">
            <img className="brand-logo" src={logo} alt="" width="44" height="43" />
            <div className="brand-text">
              <span className="brand-name">39N Health</span>
              <span className="brand-sub">Client Portal</span>
            </div>
          </div>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={navOpen}
            aria-controls="primary-nav"
            onClick={() => setNavOpen((current) => !current)}
          >
            {navOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {canEdit && (
          <button
            type="button"
            className="link-action sidebar-back-link"
            onClick={() => {
              setActiveSection('overview');
              setSelectedClientId(null);
              setAdminSection('clients');
            }}
          >
            &larr; All Clients
          </button>
        )}
        <div className="sidebar-client">{clientData.companyName}</div>

        <nav className="nav" id="primary-nav" aria-label="Portal sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? 'nav-button active' : 'nav-button'}
              aria-current={activeSection === item.id ? 'page' : undefined}
              onClick={() => handleNavigate(item.id)}
            >
              <span className="nav-icon" dangerouslySetInnerHTML={{ __html: item.icon }} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="logout-button" onClick={handleLogout}>
            Log out
          </button>
          <div className="user-pill">
            Signed in as
            <strong>{signedInName}</strong>
            {signedInTitle && <span className="user-pill-title">{signedInTitle}</span>}
          </div>
        </div>
      </aside>

      <main className="main-panel">{renderContent()}</main>
    </div>
  );
}

export default App;
