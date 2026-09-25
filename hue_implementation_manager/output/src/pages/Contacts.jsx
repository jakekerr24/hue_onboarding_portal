import { useState } from 'react';
import ContactCard from '../components/ContactCard';
import ContactEditorCard from '../components/ContactEditorCard';

const GROUPS = [
  { id: 'health', title: '39N Health Contacts', emptyLabel: '39N Contact', showOrg: false, showSignatory: false, category: 'internal' },
  { id: 'client', title: 'Employer Contacts', emptyLabel: 'Employer Contact', showOrg: false, showSignatory: true, category: 'employer' },
  { id: 'broker', title: 'Broker Contacts', emptyLabel: 'Broker Contact', showOrg: false, showSignatory: false, category: 'broker' },
  { id: 'partners', title: 'Partners', emptyLabel: 'Partner Contact', showOrg: true, showSignatory: false, category: 'partner' },
];

function matchesTerm(contact, term) {
  if (!term) return true;
  return [contact.name, contact.title, contact.org, contact.category, contact.role]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
}

export default function ContactsSection({
  contactsByGroup,
  editMode,
  onToggleEdit,
  onAdd,
  onRemove,
  onChange,
  canEdit,
  saving = {},
  saveErrors = {},
  contactPool = [],
  contactPoolError,
  onOpenPicker,
  onAttachExisting,
  onCreateLogin,
  onUpdateLogin,
  onRemoveLogin,
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();

  // Reusing an existing pool contact instead of creating a duplicate (e.g. the same TPA rep
  // across many clients) -- a single click on a picker result, not a draft that waits for Done.
  const [pickerGroupId, setPickerGroupId] = useState(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerError, setPickerError] = useState(null);
  const [attaching, setAttaching] = useState(false);

  const openPicker = (groupId) => {
    setPickerGroupId(groupId);
    setPickerQuery('');
    setPickerError(null);
    onOpenPicker();
  };
  const closePicker = () => {
    if (!attaching) setPickerGroupId(null);
  };
  const handleAttach = async (contactId) => {
    setAttaching(true);
    setPickerError(null);
    try {
      await onAttachExisting(pickerGroupId, contactId);
      setPickerGroupId(null);
    } catch (err) {
      setPickerError(err.message || 'Failed to attach contact.');
    } finally {
      setAttaching(false);
    }
  };

  // Portal-access (login) management -- employer and broker contacts, see ContactCard's
  // showPortalAccess. Persists immediately, same reasoning as attaching above. One broker rep
  // working with several clients gets a separate login per client (see chat), not shared access.
  const [accessContact, setAccessContact] = useState(null);
  const [accessGroupId, setAccessGroupId] = useState(null);
  const [accessForm, setAccessForm] = useState({ email: '', password: '' });
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState(null);

  const openAccessModal = (contact, groupId) => {
    setAccessContact(contact);
    setAccessGroupId(groupId);
    setAccessForm({ email: contact.loginEmail || contact.email || '', password: '' });
    setAccessError(null);
  };
  const closeAccessModal = () => {
    if (!accessSaving) setAccessContact(null);
  };
  const handleSaveAccess = async () => {
    if (!accessForm.email.trim()) return;
    setAccessSaving(true);
    setAccessError(null);
    try {
      if (accessContact.loginEmail) {
        const patch = { email: accessForm.email.trim() };
        if (accessForm.password) patch.password = accessForm.password;
        await onUpdateLogin(accessGroupId, accessContact.id, patch);
      } else {
        if (accessForm.password.length < 8) {
          setAccessError('Password must be at least 8 characters.');
          setAccessSaving(false);
          return;
        }
        await onCreateLogin(accessGroupId, accessContact.id, { email: accessForm.email.trim(), password: accessForm.password });
      }
      setAccessContact(null);
    } catch (err) {
      setAccessError(err.message || 'Failed to save.');
    } finally {
      setAccessSaving(false);
    }
  };
  const handleRevokeAccess = async () => {
    setAccessSaving(true);
    setAccessError(null);
    try {
      await onRemoveLogin(accessGroupId, accessContact.id);
      setAccessContact(null);
    } catch (err) {
      setAccessError(err.message || 'Failed to revoke access.');
    } finally {
      setAccessSaving(false);
    }
  };

  const totalContacts = GROUPS.reduce((sum, group) => sum + contactsByGroup[group.id].length, 0);
  // A group counts as "showing something" if it's being edited (always visible), genuinely
  // has no contacts yet (shows its own empty state), or has at least one search match.
  const anyGroupVisible = GROUPS.some(
    (group) =>
      editMode[group.id] ||
      contactsByGroup[group.id].length === 0 ||
      contactsByGroup[group.id].some((contact) => matchesTerm(contact, term))
  );

  const pickerGroup = GROUPS.find((group) => group.id === pickerGroupId);
  const attachedIds = pickerGroup ? new Set(contactsByGroup[pickerGroup.id].map((contact) => contact.id)) : new Set();
  const pickerTerm = pickerQuery.trim().toLowerCase();
  const pickerResults = pickerGroup
    ? contactPool
        .filter((contact) => contact.category === pickerGroup.category)
        .filter((contact) => !attachedIds.has(contact.id))
        .filter((contact) => !pickerTerm || matchesTerm(contact, pickerTerm))
    : [];

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Contacts</h1>
          <div className="muted">Internal and external contacts for the employer and implementation team</div>
        </div>
        <div className="section-summary">
          <strong>{totalContacts}</strong> contacts
        </div>
      </div>

      <div className="search-field">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M21 21l-4.5-4.5" />
        </svg>
        <input
          type="search"
          aria-label="Search contacts"
          placeholder="Search by name, company, or what they help with"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {term && !anyGroupVisible && (
        <div className="panel panel-empty">
          No contacts match &ldquo;{query.trim()}&rdquo;.{' '}
          <button type="button" className="link-action" onClick={() => setQuery('')}>
            Clear search
          </button>
        </div>
      )}

      {GROUPS.map((group) => {
        const contacts = contactsByGroup[group.id];
        const editing = editMode[group.id];
        const visible = contacts.filter((contact) => matchesTerm(contact, term));

        // While searching, a group with no matches is skipped entirely (no empty header).
        if (!editing && term && visible.length === 0) return null;

        return (
          <section key={group.id} className="subsection" aria-labelledby={`contacts-${group.id}`}>
            <div className="section-header compact">
              <h3 id={`contacts-${group.id}`}>{group.title}</h3>
              {canEdit &&
                (editing ? (
                  <div className="edit-buttons">
                    <button type="button" className="secondary-button" onClick={() => openPicker(group.id)} disabled={saving[group.id]}>
                      + Existing contact
                    </button>
                    <button type="button" className="secondary-button" onClick={() => onAdd(group.id)} disabled={saving[group.id]}>
                      + New contact
                    </button>
                    <button type="button" className="section-edit-toggle" onClick={() => onToggleEdit(group.id)} disabled={saving[group.id]}>
                      {saving[group.id] ? 'Saving…' : 'Done'}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="section-edit-toggle" onClick={() => onToggleEdit(group.id)}>
                    Edit
                  </button>
                ))}
            </div>

            {editing && saveErrors[group.id] && <div className="edit-status error">{saveErrors[group.id]}</div>}

            {contacts.length === 0 && !editing && (
              <div className="panel-empty">No {group.title.toLowerCase()} yet.</div>
            )}

            {editing && (
              // Wider 2-up grid in edit mode: the nested Organization/Name/Phone fields need
              // more room than the compact read-only cards do.
              <div className="grid-2">
                {contacts.map((contact, index) => (
                  <ContactEditorCard
                    key={index}
                    contact={contact}
                    label={contact.name || `${group.emptyLabel} ${index + 1}`}
                    showOrg={group.showOrg}
                    showSignatory={group.showSignatory}
                    onChange={(field) => onChange(group.id, index, field)}
                    onRemove={() => onRemove(group.id, index)}
                  />
                ))}
              </div>
            )}

            {!editing && contacts.length > 0 && (
              <div className="contact-grid">
                {visible.map((contact, index) => (
                  <ContactCard
                    key={`${contact.email || contact.name}-${index}`}
                    contact={contact}
                    fallbackName={`${group.emptyLabel} ${index + 1}`}
                    showOrg={group.showOrg}
                    showSignatory={group.showSignatory}
                    showPortalAccess={canEdit && (group.id === 'client' || group.id === 'broker')}
                    onManageAccess={() => openAccessModal(contact, group.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {pickerGroupId && (
        <div className="document-modal-backdrop" onClick={closePicker}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Add existing contact</h3>
              <button type="button" className="close-button" onClick={closePicker} disabled={attaching}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <label className="modal-field">
                <span>Search the contact pool</span>
                <input
                  type="search"
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder="Name, title, or organization"
                />
              </label>

              {contactPoolError && <div className="edit-status error">{contactPoolError}</div>}
              {pickerError && <div className="edit-status error">{pickerError}</div>}

              {pickerResults.length === 0 ? (
                <div className="panel-empty">
                  No available {pickerGroup.title.toLowerCase()} match. Use &ldquo;+ New contact&rdquo; instead.
                </div>
              ) : (
                <ul className="document-list">
                  {pickerResults.map((contact) => (
                    <li key={contact.id} className="document-row">
                      <div className="document-row-body">
                        <div className="document-row-top">
                          <span className="document-row-title">{contact.name}</span>
                        </div>
                        <div className="document-row-meta">
                          <span>{[contact.title, contact.org].filter(Boolean).join(' · ') || contact.email}</span>
                        </div>
                      </div>
                      <div className="document-row-actions">
                        <button type="button" className="secondary-button" onClick={() => handleAttach(contact.id)} disabled={attaching}>
                          {attaching ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closePicker} disabled={attaching}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {accessContact && (
        <div className="document-modal-backdrop" onClick={closeAccessModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Portal access for {accessContact.name}</h3>
              <button type="button" className="close-button" onClick={closeAccessModal} disabled={accessSaving}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <label className="modal-field">
                <span>Login email</span>
                <input
                  type="email"
                  value={accessForm.email}
                  onChange={(event) => setAccessForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label className="modal-field">
                <span>{accessContact.loginEmail ? 'New password (leave blank to keep current)' : 'Password'}</span>
                <input
                  type="password"
                  value={accessForm.password}
                  onChange={(event) => setAccessForm((current) => ({ ...current, password: event.target.value }))}
                />
                <small>At least 8 characters.</small>
              </label>

              {accessError && <div className="edit-status error">{accessError}</div>}
            </div>
            <div className="document-modal-footer">
              {accessContact.loginEmail && (
                <button type="button" className="danger-button" onClick={handleRevokeAccess} disabled={accessSaving}>
                  Revoke access
                </button>
              )}
              <button type="button" className="secondary-button" onClick={closeAccessModal} disabled={accessSaving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSaveAccess} disabled={accessSaving || !accessForm.email.trim()}>
                {accessSaving ? 'Saving…' : accessContact.loginEmail ? 'Save changes' : 'Grant access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
