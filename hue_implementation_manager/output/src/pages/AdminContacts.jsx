import { useState } from 'react';

const CATEGORIES = [
  { id: 'internal', label: '39N Internal' },
  { id: 'employer', label: 'Employer' },
  { id: 'broker', label: 'Broker' },
  { id: 'partner', label: 'Partner' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((category) => [category.id, category.label]));
const BLANK_FORM = { category: 'internal', name: '', title: '', role: '', phone: '', email: '', org: '', partnerType: '' };

export default function AdminContacts({ contacts, loading, error, onAdd, onUpdate, onRemove }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [deletingContact, setDeletingContact] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState(null);

  const term = query.trim().toLowerCase();
  const visible = contacts
    .filter((contact) => categoryFilter === 'all' || contact.category === categoryFilter)
    .filter(
      (contact) =>
        !term ||
        [contact.name, contact.title, contact.org, contact.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
    );

  const openAddModal = () => {
    setEditingId(null);
    setFormState(BLANK_FORM);
    setModalError(null);
    setModalOpen(true);
  };
  const openEditModal = (contact) => {
    setEditingId(contact.id);
    setFormState({
      category: contact.category,
      name: contact.name || '',
      title: contact.title || '',
      role: contact.role || '',
      phone: contact.phone || '',
      email: contact.email || '',
      org: contact.org || '',
      partnerType: contact.partner_type || '',
    });
    setModalError(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };
  const setField = (field) => (event) => setFormState((current) => ({ ...current, [field]: event.target.value }));

  const handleSave = async () => {
    if (!formState.name.trim()) return;
    setSaving(true);
    setModalError(null);
    try {
      const fields = {
        category: formState.category,
        name: formState.name.trim(),
        title: formState.title.trim(),
        role: formState.role.trim(),
        phone: formState.phone.trim(),
        email: formState.email.trim(),
        org: formState.category === 'partner' ? formState.org.trim() : '',
        partnerType: formState.category === 'partner' ? formState.partnerType.trim() : '',
      };
      if (editingId) await onUpdate(editingId, fields);
      else await onAdd(fields);
      setModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setListError(null);
    try {
      await onRemove(deletingContact.id);
      setDeletingContact(null);
    } catch (err) {
      setListError(err.message || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Contacts</h1>
          <div className="muted">
            The reusable contact library &mdash; attach any of these to a client instead of creating a duplicate.
          </div>
        </div>
        <button type="button" className="primary-button" onClick={openAddModal}>
          + New contact
        </button>
      </div>

      {(error || listError) && <div className="edit-status error">{error || listError}</div>}

      <div className="search-field">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M21 21l-4.5-4.5" />
        </svg>
        <input
          type="search"
          aria-label="Search the contact pool"
          placeholder="Search by name, organization, or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="filter-bar admin-search-spacing" role="group" aria-label="Filter by category">
        {[{ id: 'all', label: 'All' }, ...CATEGORIES].map((category) => {
          const count = contacts.filter((contact) => category.id === 'all' || contact.category === category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              className={category.id === categoryFilter ? 'filter-chip active' : 'filter-chip'}
              aria-pressed={category.id === categoryFilter}
              onClick={() => setCategoryFilter(category.id)}
            >
              {category.label}
              <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="panel-empty">Loading contacts&hellip;</div>
      ) : visible.length === 0 ? (
        <div className="panel-empty">
          {contacts.length === 0 ? 'No contacts yet. Click "+ New contact" to add the first one.' : 'No contacts match.'}
        </div>
      ) : (
        <ul className="document-list">
          {visible.map((contact) => (
            <li key={contact.id} className="document-row">
              <span className="document-type-badge" aria-hidden="true">
                {CATEGORY_LABEL[contact.category]}
              </span>
              <div className="document-row-body">
                <div className="document-row-top">
                  <span className="document-row-title">{contact.name}</span>
                  {contact.clients?.length > 0 && (
                    <span className="category-tag">
                      Used by {contact.clients.length} {contact.clients.length === 1 ? 'client' : 'clients'}
                    </span>
                  )}
                </div>
                <div className="document-row-meta">
                  <span>
                    {[contact.title, contact.org, contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
              </div>
              <div className="document-row-actions">
                <button type="button" className="secondary-button" onClick={() => openEditModal(contact)}>
                  Edit
                </button>
                <button type="button" className="mini-button" onClick={() => setDeletingContact(contact)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className="document-modal-backdrop" onClick={closeModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>{editingId ? 'Edit contact' : 'New contact'}</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Category</span>
                <select value={formState.category} onChange={setField('category')}>
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal-field">
                <span>Name</span>
                <input type="text" value={formState.name} onChange={setField('name')} />
              </label>
              <label className="modal-field">
                <span>Title</span>
                <input type="text" value={formState.title} onChange={setField('title')} />
              </label>
              <label className="modal-field">
                <span>Contact for</span>
                <input type="text" value={formState.role} onChange={setField('role')} />
              </label>
              <label className="modal-field">
                <span>Phone</span>
                <input type="text" value={formState.phone} onChange={setField('phone')} />
              </label>
              <label className="modal-field">
                <span>Email</span>
                <input type="email" value={formState.email} onChange={setField('email')} />
              </label>
              {formState.category === 'partner' && (
                <>
                  <label className="modal-field">
                    <span>Organization</span>
                    <input type="text" value={formState.org} onChange={setField('org')} />
                  </label>
                  <label className="modal-field">
                    <span>Type (e.g. TPA, PBM)</span>
                    <input type="text" value={formState.partnerType} onChange={setField('partnerType')} />
                  </label>
                </>
              )}

              {modalError && <div className="edit-status error">{modalError}</div>}
            </div>

            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={saving || !formState.name.trim()}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingContact && (
        <div className="document-modal-backdrop" onClick={() => !deleting && setDeletingContact(null)}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Delete contact</h3>
              <button type="button" className="close-button" onClick={() => setDeletingContact(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Delete &ldquo;{deletingContact.name}&rdquo; from the contact pool? This can&rsquo;t be undone.
                {deletingContact.clients?.length > 0 && (
                  <>
                    {' '}
                    This contact is still attached to {deletingContact.clients.length}{' '}
                    {deletingContact.clients.length === 1 ? 'client' : 'clients'} and can&rsquo;t be deleted until it&rsquo;s
                    removed from each one.
                  </>
                )}
              </p>
            </div>
            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setDeletingContact(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDelete}
                disabled={deleting || deletingContact.clients?.length > 0}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
