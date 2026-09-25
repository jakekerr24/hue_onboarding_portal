import { useState } from 'react';

const PHASES = [
  { id: 'pre', title: 'Before Effective Date' },
  { id: 'post', title: 'After Effective Date' },
];
const BLANK_FORM = { phase: 'pre', name: '', dueDateRule: '', note: '' };

export default function TemplateDeliverables({ items, loading, error, onAdd, onUpdate, onRemove, onReorder }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState(null);

  const openAddModal = (phase) => {
    setEditingId(null);
    setFormState({ ...BLANK_FORM, phase });
    setModalError(null);
    setModalOpen(true);
  };
  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormState({ phase: item.phase, name: item.name, dueDateRule: item.due_date_rule, note: item.note || '' });
    setModalError(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };
  const setField = (field) => (event) => setFormState((current) => ({ ...current, [field]: event.target.value }));

  const handleSave = async () => {
    if (!formState.name.trim() || !formState.dueDateRule.trim()) return;
    setSaving(true);
    setModalError(null);
    try {
      const fields = {
        phase: formState.phase,
        name: formState.name.trim(),
        dueDateRule: formState.dueDateRule.trim(),
        note: formState.note.trim(),
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
          <h1>Deliverables Template</h1>
          <div className="muted">
            Applied automatically to every new client. Editing it here never changes an existing client&rsquo;s own
            deliverables.
          </div>
        </div>
      </div>

      {(error || listError) && <div className="edit-status error">{error || listError}</div>}

      {loading ? (
        <div className="panel-empty">Loading template&hellip;</div>
      ) : (
        PHASES.map((phase) => {
          const phaseItems = items.filter((item) => item.phase === phase.id).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <section key={phase.id} className="deliverable-group">
              <div className="section-header compact">
                <h3>
                  {phase.title}
                  <span className="section-count">{phaseItems.length}</span>
                </h3>
                <button type="button" className="secondary-button" onClick={() => openAddModal(phase.id)}>
                  + Add deliverable
                </button>
              </div>

              {phaseItems.length === 0 && <div className="panel-empty">No template deliverables in this phase yet.</div>}

              {phaseItems.length > 0 && (
                <ul className="document-list">
                  {phaseItems.map((item, index) => (
                    <li key={item.id} className="document-row">
                      <div className="document-row-body">
                        <div className="document-row-top">
                          <span className="document-row-title">{item.name}</span>
                        </div>
                        <div className="document-row-meta">
                          <span>{item.due_date_rule}</span>
                        </div>
                        {item.note && <div className="document-row-description">{item.note}</div>}
                      </div>
                      <div className="document-row-actions">
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => handleReorder(item, 'up')}
                          disabled={index === 0}
                          aria-label={`Move ${item.name} up`}
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => handleReorder(item, 'down')}
                          disabled={index === phaseItems.length - 1}
                          aria-label={`Move ${item.name} down`}
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
              )}
            </section>
          );
        })
      )}

      {modalOpen && (
        <div className="document-modal-backdrop" onClick={closeModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>{editingId ? 'Edit template deliverable' : 'Add template deliverable'}</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Phase</span>
                <select value={formState.phase} onChange={setField('phase')}>
                  {PHASES.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal-field">
                <span>Deliverable name</span>
                <input type="text" value={formState.name} onChange={setField('name')} />
              </label>
              <label className="modal-field">
                <span>Due date rule</span>
                <input type="text" value={formState.dueDateRule} onChange={setField('dueDateRule')} />
                <small>
                  Examples: &ldquo;On effective date&rdquo;, &ldquo;30 days before effective date&rdquo;, &ldquo;within
                  15 days after effective date&rdquo;.
                </small>
              </label>
              <label className="modal-field">
                <span>Note (optional)</span>
                <textarea rows={3} value={formState.note} onChange={setField('note')} />
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
                disabled={saving || !formState.name.trim() || !formState.dueDateRule.trim()}
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingItem && (
        <div className="document-modal-backdrop" onClick={() => !deleting && setDeletingItem(null)}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Delete template deliverable</h3>
              <button type="button" className="close-button" onClick={() => setDeletingItem(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Delete &ldquo;{deletingItem.name}&rdquo; from the template? This can&rsquo;t be undone, and won&rsquo;t
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
