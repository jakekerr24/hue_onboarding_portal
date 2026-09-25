import { useState } from 'react';

const BLANK_FORM = { displayName: '', email: '', password: '' };

// Manager account management -- any signed-in manager can create, reset the password of, or
// remove another manager's login (see server.js's /api/users -- no tiered "owner" role, matching
// how the rest of the app has no permission granularity beyond manager/client). Passwords are
// admin-set only, same as contact logins -- there's no self-service signup or reset flow.
export default function AdminManagers({ managers, loading, error, currentUserId, onAdd, onUpdate, onRemove }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [deletingManager, setDeletingManager] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [listError, setListError] = useState(null);

  const openAddModal = () => {
    setEditingId(null);
    setFormState(BLANK_FORM);
    setModalError(null);
    setModalOpen(true);
  };
  const openEditModal = (manager) => {
    setEditingId(manager.id);
    setFormState({ displayName: manager.display_name || '', email: manager.email || '', password: '' });
    setModalError(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };
  const setField = (field) => (event) => setFormState((current) => ({ ...current, [field]: event.target.value }));

  const canSave = editingId
    ? formState.displayName.trim() && formState.email.trim() && (!formState.password || formState.password.length >= 8)
    : formState.displayName.trim() && formState.email.trim() && formState.password.length >= 8;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setModalError(null);
    try {
      if (editingId) {
        const patch = { displayName: formState.displayName.trim(), email: formState.email.trim() };
        if (formState.password) patch.password = formState.password;
        await onUpdate(editingId, patch);
      } else {
        await onAdd({
          displayName: formState.displayName.trim(),
          email: formState.email.trim(),
          password: formState.password,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onRemove(deletingManager.id);
      setDeletingManager(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to remove.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Team Accounts</h1>
          <div className="muted">Manager logins for 39N staff -- passwords are set here, not by the account holder.</div>
        </div>
        <button type="button" className="primary-button" onClick={openAddModal}>
          + New account
        </button>
      </div>

      {(error || listError) && <div className="edit-status error">{error || listError}</div>}

      {loading ? (
        <div className="panel-empty">Loading accounts&hellip;</div>
      ) : managers.length === 0 ? (
        <div className="panel-empty">No manager accounts yet.</div>
      ) : (
        <ul className="document-list admin-search-spacing">
          {managers.map((manager) => (
            <li key={manager.id} className="document-row">
              <div className="document-row-body">
                <div className="document-row-top">
                  <span className="document-row-title">{manager.display_name}</span>
                  {manager.id === currentUserId && <span className="category-tag">You</span>}
                </div>
                <div className="document-row-meta">
                  <span>{manager.email}</span>
                </div>
              </div>
              <div className="document-row-actions">
                <button type="button" className="secondary-button" onClick={() => openEditModal(manager)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingManager(manager);
                  }}
                >
                  Remove
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
              <h3>{editingId ? 'Edit account' : 'New manager account'}</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Name</span>
                <input type="text" value={formState.displayName} onChange={setField('displayName')} />
              </label>
              <label className="modal-field">
                <span>Email</span>
                <input type="email" value={formState.email} onChange={setField('email')} />
              </label>
              <label className="modal-field">
                <span>{editingId ? 'New password (leave blank to keep current)' : 'Password'}</span>
                <input type="password" value={formState.password} onChange={setField('password')} placeholder="At least 8 characters" />
              </label>

              {modalError && <div className="edit-status error">{modalError}</div>}
            </div>

            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={saving || !canSave}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingManager && (
        <div className="document-modal-backdrop" onClick={() => !deleting && setDeletingManager(null)}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Remove account</h3>
              <button type="button" className="close-button" onClick={() => setDeletingManager(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Remove {deletingManager.display_name}&rsquo;s login ({deletingManager.email})? They won&rsquo;t be able to
                sign in anymore. This can&rsquo;t be undone.
              </p>
              {deleteError && <div className="edit-status error">{deleteError}</div>}
            </div>
            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setDeletingManager(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
