import { useState } from 'react';
import DeliverablesTimeline from '../components/DeliverablesTimeline';
import { formatDisplayDate } from '../utils/date';
import { buildDeliverables, dueLabel } from '../utils/deliverables';

const FILTERS = [
  { id: 'all', label: 'All', matches: () => true },
  { id: 'open', label: 'Open', matches: (item) => !item.isComplete },
  { id: 'overdue', label: 'Overdue', matches: (item) => item.status === 'overdue' },
  { id: 'complete', label: 'Complete', matches: (item) => item.isComplete },
];

const GROUPS = [
  { id: 'pre', title: 'Before effective date' },
  { id: 'post', title: 'After effective date' },
];
const BLANK_FORM = { phase: 'pre', name: '', dueDateRule: '', note: '' };

export default function DeliverablesSection({
  effectiveDate,
  preDeliverables,
  postDeliverables,
  completedDeliverables,
  onToggleComplete,
  saveError,
  canEdit,
  onAdd,
  onUpdate,
  onRemove,
}) {
  // Opens on what still needs doing; the timeline above shows the full picture.
  const [filterId, setFilterId] = useState('open');
  const today = new Date();

  // Manager-only add/edit/delete of this client's own deliverables -- independent of the
  // template from the moment they're copied, so editing here never touches it or any other
  // client. Modeled closely on the admin Deliverables Template editor's own CRUD modal.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [manageError, setManageError] = useState(null);

  const deliverables = buildDeliverables({
    effectiveDate,
    pre: preDeliverables,
    post: postDeliverables,
    completed: completedDeliverables,
    today,
  });

  const activeFilter = FILTERS.find((filter) => filter.id === filterId);
  const completeCount = deliverables.filter((item) => item.isComplete).length;

  const openAddModal = (phase) => {
    setEditingId(null);
    setFormState({ ...BLANK_FORM, phase });
    setModalError(null);
    setModalOpen(true);
  };
  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormState({ phase: item.group, name: item.name, dueDateRule: item.rule, note: item.note || '' });
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
    setManageError(null);
    try {
      await onRemove(deletingItem.id);
      setDeletingItem(null);
    } catch (err) {
      setManageError(err.message || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Deliverables &amp; Timeline</h1>
          <div className="muted">
            Due dates are calculated from your effective date, {formatDisplayDate(effectiveDate)}
          </div>
        </div>
        <div className="section-summary">
          <strong>{completeCount}</strong> of {deliverables.length} complete
        </div>
      </div>

      {(saveError || manageError) && <div className="edit-status error">{saveError || manageError}</div>}

      <DeliverablesTimeline items={deliverables} effectiveDate={effectiveDate} today={today} />

      <div className="filter-bar" role="group" aria-label="Filter deliverables">
        {FILTERS.map((filter) => {
          const count = deliverables.filter(filter.matches).length;
          return (
            <button
              key={filter.id}
              type="button"
              className={filter.id === filterId ? 'filter-chip active' : 'filter-chip'}
              aria-pressed={filter.id === filterId}
              onClick={() => setFilterId(filter.id)}
            >
              {filter.label}
              <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {GROUPS.map((group) => {
        const inGroup = deliverables.filter((item) => item.group === group.id);
        const visible = inGroup.filter(activeFilter.matches);
        // A manager keeps seeing the group (and its Add button) even when the current filter
        // hides everything in it; a client still sees it disappear, same as before.
        if (visible.length === 0 && !canEdit) return null;

        return (
          <section key={group.id} className="deliverable-group" aria-labelledby={`group-${group.id}`}>
            <div className="section-header compact">
              <h3 id={`group-${group.id}`}>
                {group.title}
                <span className="section-count">
                  {inGroup.filter((item) => item.isComplete).length} of {inGroup.length} complete
                </span>
              </h3>
              {canEdit && (
                <button type="button" className="secondary-button" onClick={() => openAddModal(group.id)}>
                  + Add deliverable
                </button>
              )}
            </div>

            {visible.length > 0 && (
              <ul className="deliverable-list">
                {visible.map((item) => (
                  <li key={item.key} className={`deliverable-row status-${item.status}`}>
                    <div className="deliverable-row-main">
                      <label className="deliverable-row-label">
                        <input
                          type="checkbox"
                          checked={item.isComplete}
                          aria-label={`Mark complete: ${item.name}`}
                          onChange={() => onToggleComplete(item)}
                        />
                        <div className="deliverable-row-body">
                          <div className="deliverable-row-top">
                            <span className="deliverable-row-name">{item.name}</span>
                            <span className={`pill pill-${item.status}`}>
                              {item.isComplete ? 'Completed' : dueLabel(item.daysLeft)}
                            </span>
                          </div>
                          <div className="deliverable-row-meta">
                            Due <strong>{formatDisplayDate(item.dueDate)}</strong> · {item.rule}
                          </div>
                          {item.alert && !(item.isComplete && item.alert.level === 'blocking') && (
                            <div className="deliverable-row-alert">
                              <span className={item.alert.level === 'blocking' ? 'pill pill-blocking' : 'pill pill-info'}>
                                {item.alert.text}
                              </span>
                            </div>
                          )}
                        </div>
                      </label>
                      {canEdit && (
                        <div className="deliverable-row-manage-actions">
                          <button type="button" className="mini-button" onClick={() => openEditModal(item)}>
                            Edit
                          </button>
                          <button type="button" className="mini-button" onClick={() => setDeletingItem(item)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {deliverables.filter(activeFilter.matches).length === 0 && (
        <div className="panel panel-empty">
          {filterId === 'overdue'
            ? 'Nothing is overdue. You’re on track.'
            : filterId === 'complete'
              ? 'No deliverables have been completed yet.'
              : 'Everything is complete.'}
        </div>
      )}

      {modalOpen && (
        <div className="document-modal-backdrop" onClick={closeModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>{editingId ? 'Edit deliverable' : 'Add deliverable'}</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Phase</span>
                <select value={formState.phase} onChange={setField('phase')}>
                  {GROUPS.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title}
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
              <h3>Delete deliverable</h3>
              <button type="button" className="close-button" onClick={() => setDeletingItem(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Delete &ldquo;{deletingItem.name}&rdquo;? This can&rsquo;t be undone.
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
