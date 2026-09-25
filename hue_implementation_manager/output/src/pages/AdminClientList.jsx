import { useState } from 'react';
import { formatDisplayDate } from '../utils/date';

const REQUIRED_LABELS = { companyName: 'Plan sponsor', address: 'Business address', effectiveDate: 'Effective date' };
const BLANK_FORM = { companyName: '', address: '', effectiveDate: '' };

function matchesTerm(client, term) {
  if (!term) return true;
  const haystack = [client.plan_sponsor_name, client.effective_date && formatDisplayDate(client.effective_date), client.effective_date]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

export default function AdminClientList({ clients, loading, error, onSelectClient, onCreateClient }) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  const term = query.trim().toLowerCase();
  const visible = clients.filter((client) => matchesTerm(client, term));

  const missing = Object.keys(REQUIRED_LABELS).filter((key) => !formState[key].trim());

  const openModal = () => {
    setFormState(BLANK_FORM);
    setModalError(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };
  const setField = (field) => (event) => setFormState((current) => ({ ...current, [field]: event.target.value }));

  const handleCreate = async () => {
    if (missing.length > 0 || saving) return;
    setSaving(true);
    setModalError(null);
    try {
      await onCreateClient(formState);
      setModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Failed to create client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>All Clients</h1>
          <div className="muted">Select a client to manage their implementation, or onboard a new one</div>
        </div>
        <button type="button" className="primary-button" onClick={openModal}>
          + New client
        </button>
      </div>

      {error && <div className="edit-status error">{error}</div>}

      {!loading && clients.length > 0 && (
        <div className="search-field admin-search-spacing">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M21 21l-4.5-4.5" />
          </svg>
          <input
            type="search"
            aria-label="Search clients"
            placeholder="Search by name or effective date"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="panel-empty">Loading clients&hellip;</div>
      ) : clients.length === 0 ? (
        <div className="panel-empty">No clients yet. Click &ldquo;+ New client&rdquo; to onboard the first one.</div>
      ) : visible.length === 0 ? (
        <div className="panel-empty">
          No clients match &ldquo;{query.trim()}&rdquo;.{' '}
          <button type="button" className="link-action" onClick={() => setQuery('')}>
            Clear search
          </button>
        </div>
      ) : (
        <ul className="document-list">
          {visible.map((client) => (
            <li key={client.id} className="document-row">
              <div className="document-row-body">
                <div className="document-row-top">
                  <span className="document-row-title">{client.plan_sponsor_name}</span>
                </div>
                {client.effective_date && (
                  <div className="document-row-meta">
                    <span>Effective {formatDisplayDate(client.effective_date)}</span>
                  </div>
                )}
              </div>
              <div className="document-row-actions">
                <button type="button" className="secondary-button" onClick={() => onSelectClient(client.id)}>
                  Open
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
              <h3>New client</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Plan sponsor</span>
                <input type="text" value={formState.companyName} onChange={setField('companyName')} />
              </label>
              <label className="modal-field">
                <span>Business address</span>
                <input type="text" value={formState.address} onChange={setField('address')} />
              </label>
              <label className="modal-field">
                <span>Effective date</span>
                <input type="date" value={formState.effectiveDate} onChange={setField('effectiveDate')} />
              </label>
              <p className="muted">
                The standard deliverables and what-to-expect template are applied automatically. You can fill in the
                rest of the client&rsquo;s details, contacts, and documents after creating them.
              </p>
              {modalError && <div className="edit-status error">{modalError}</div>}
            </div>

            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleCreate} disabled={saving || missing.length > 0}>
                {saving ? 'Creating…' : 'Create client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
