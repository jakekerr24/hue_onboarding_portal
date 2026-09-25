import { useState } from 'react';

const AUDIENCES = ['Employer', 'Members', 'Broker'];
const BLANK_FORM = { groupTitle: '', audience: 'Employer', title: '', body: '' };

export default function TemplateExpectations({ items, loading, error, onAdd, onUpdate, onRemove, onReorder }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState(null);

  // Groups are open-ended free text (not a fixed enum like deliverables' phase), so they're
  // derived from whatever group_title values are actually in use -- same as WhatToExpect.jsx.
  const groupTitles = [...new Set(items.map((item) => item.group_title))];
  const existingGroups = groupTitles.map((title) => ({
    title,
    audience: items.find((item) => item.group_title === title)?.audience,
  }));

  const openAddModal = (groupTitle) => {
    setEditingId(null);
    const group = existingGroups.find((g) => g.title === groupTitle);
    setFormState({ ...BLANK_FORM, groupTitle: groupTitle || '', audience: group?.audience || 'Employer' });
    setModalError(null);
    setModalOpen(true);
  };
  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormState({ groupTitle: item.group_title, audience: item.audience, title: item.title, body: item.body });
    setModalError(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };
  const setField = (field) => (event) => setFormState((current) => ({ ...current, [field]: event.target.value }));

  const handleSave = async () => {
    if (!formState.groupTitle.trim() || !formState.title.trim() || !formState.body.trim()) return;
    setSaving(true);
    setModalError(null);
    try {
      const fields = {
        groupTitle: formState.groupTitle.trim(),
        audience: formState.audience,
        title: formState.title.trim(),
        body: formState.body.trim(),
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
      await onRemove(deletingItem.id);
      setDeletingItem(null);
    } catch (err) {
      setListError(err.message || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReorder = async (item, direction) => {
    setListError(null);
    try {
      await onReorder(item.id, direction);
    } catch (err) {
      setListError(err.message || 'Failed to reorder.');
    }
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>What to Expect Template</h1>
          <div className="muted">
            Applied automatically to every new client. Editing it here never changes an existing client&rsquo;s own
            expectations.
          </div>
        </div>
        <button type="button" className="primary-button" onClick={() => openAddModal('')}>
          + New group
        </button>
      </div>

      {(error || listError) && <div className="edit-status error">{error || listError}</div>}

      {loading ? (
        <div className="panel-empty">Loading template&hellip;</div>
      ) : groupTitles.length === 0 ? (
        <div className="panel-empty">No template expectations yet. Click &ldquo;+ New group&rdquo; to add the first one.</div>
      ) : (
        groupTitles.map((groupTitle) => {
          const groupItems = items.filter((item) => item.group_title === groupTitle).sort((a, b) => a.sort_order - b.sort_order);
          const audience = groupItems[0]?.audience;
          return (
            <section key={groupTitle} className="deliverable-group">
              <div className="section-header compact">
                <h3>
                  {groupTitle}
                  <span className="section-count">{audience}</span>
                </h3>
                <button type="button" className="secondary-button" onClick={() => openAddModal(groupTitle)}>
                  + Add to this group
                </button>
              </div>

              <ul className="document-list">
                {groupItems.map((item, index) => (
                  <li key={item.id} className="document-row">
                    <div className="document-row-body">
                      <div className="document-row-top">
                        <span className="document-row-title">{item.title}</span>
                      </div>
                      <div className="document-row-description">{item.body}</div>
                    </div>
                    <div className="document-row-actions">
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => handleReorder(item, 'up')}
                        disabled={index === 0}
                        aria-label={`Move ${item.title} up`}
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => handleReorder(item, 'down')}
                        disabled={index === groupItems.length - 1}
                        aria-label={`Move ${item.title} down`}
                      >
                        &darr;
                      </button>
                      <button type="button" className="secondary-button" onClick={() => openEditModal(item)}>
                        Edit
                      </button>
                      <button type="button" className="mini-button" onClick={() => setDeletingItem(item)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {modalOpen && (
        <div className="document-modal-backdrop" onClick={closeModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>{editingId ? 'Edit template expectation' : 'Add template expectation'}</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Group</span>
                <input type="text" list="template-expectation-groups" value={formState.groupTitle} onChange={setField('groupTitle')} />
                <datalist id="template-expectation-groups">
                  {groupTitles.map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
                <small>Type an existing group name to add to it, or a new one to start a group.</small>
              </label>
              <label className="modal-field">
                <span>Audience</span>
                <select value={formState.audience} onChange={setField('audience')}>
                  {AUDIENCES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal-field">
                <span>Title</span>
                <input type="text" value={formState.title} onChange={setField('title')} />
              </label>
              <label className="modal-field">
                <span>Body</span>
                <textarea rows={5} value={formState.body} onChange={setField('body')} />
              </label>

              {modalError && <div className="edit-status error">{modalError}</div>}
            </div>

            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSave}
                disabled={saving || !formState.groupTitle.trim() || !formState.title.trim() || !formState.body.trim()}
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expectation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingItem && (
        <div className="document-modal-backdrop" onClick={() => !deleting && setDeletingItem(null)}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Delete template expectation</h3>
              <button type="button" className="close-button" onClick={() => setDeletingItem(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Delete &ldquo;{deletingItem.title}&rdquo; from the template? This can&rsquo;t be undone, and won&rsquo;t
                affect any existing client.
              </p>
            </div>
            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setDeletingItem(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
