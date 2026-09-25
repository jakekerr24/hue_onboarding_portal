import { useState } from 'react';
import Collapsible from '../components/Collapsible';
import { EXPECTATION_AUDIENCES } from '../data';
import { formatTimestamp } from '../utils/date';

// Wraps every match of `term` in <mark> so results are easy to spot while searching.
function highlight(text, term) {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .split(new RegExp(`(${escaped})`, 'gi'))
    .map((part, index) => (index % 2 === 1 ? <mark key={index}>{part}</mark> : part));
}

const BLANK_FORM = { groupTitle: '', audience: 'Employer', title: '', body: '' };

export default function WhatToExpectSection({
  expectationGroups,
  acknowledgedItems,
  onToggleReviewed,
  reviewerName,
  saveError,
  canEdit,
  onAdd,
  onUpdate,
  onRemove,
}) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('all');
  const [openItems, setOpenItems] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Manager-only add/edit/delete of this client's own expectations -- independent of the
  // template from the moment they're copied, so editing here never touches it or any other
  // client. Modeled closely on the admin What to Expect Template editor's own CRUD modal.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [manageError, setManageError] = useState(null);

  const term = query.trim();
  const isSearching = term.length > 0;
  const matchesTerm = (item) =>
    !isSearching || `${item.title} ${item.body}`.toLowerCase().includes(term.toLowerCase());

  const allItems = expectationGroups.flatMap((group) =>
    group.items.map((item) => ({ group, item, key: item.id }))
  );
  const reviewedTotal = allItems.filter(({ key }) => acknowledgedItems[key]).length;

  const visibleGroups = expectationGroups.filter((group) => audience === 'all' || group.audience === audience)
    .map((group) => ({ group, items: group.items.filter(matchesTerm) }))
    .filter(({ items }) => items.length > 0);
  const visibleKeys = visibleGroups.flatMap(({ items }) => items.map((item) => item.id));
  // While searching, every match is shown open so the matching text is visible.
  const isItemOpen = (key) => isSearching || Boolean(openItems[key]);
  const allOpen = visibleKeys.length > 0 && visibleKeys.every(isItemOpen);

  const toggleItem = (key) => setOpenItems((current) => ({ ...current, [key]: !current[key] }));
  const toggleGroup = (id) => setCollapsedGroups((current) => ({ ...current, [id]: !current[id] }));
  const setAllOpen = (open) => setOpenItems(open ? Object.fromEntries(allItems.map(({ key }) => [key, true])) : {});

  // The existing groups, for the "add to this group" datalist and to pre-fill a group's audience
  // when adding to it -- groups here are just whatever group titles are in use, not a fixed set.
  const knownGroups = expectationGroups.map((group) => ({ title: group.title, audience: group.audience }));

  const openAddModal = (groupTitle) => {
    setEditingId(null);
    const group = knownGroups.find((g) => g.title === groupTitle);
    setFormState({ ...BLANK_FORM, groupTitle: groupTitle || '', audience: group?.audience || 'Employer' });
    setModalError(null);
    setModalOpen(true);
  };
  const openEditModal = (group, item) => {
    setEditingId(item.id);
    setFormState({ groupTitle: group.title, audience: group.audience, title: item.title, body: item.body });
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
          <h1>What to Expect</h1>
          <div className="muted">Implementation expectations and common FAQs</div>
        </div>
        <div className="section-header-actions">
          <div className="section-summary">
            <strong>{reviewedTotal}</strong> of {allItems.length} reviewed
          </div>
          {canEdit && (
            <button type="button" className="primary-button" onClick={() => openAddModal('')}>
              + New group
            </button>
          )}
        </div>
      </div>

      {(saveError || manageError) && <div className="edit-status error">{saveError || manageError}</div>}

      <div className="expect-toolbar">
        <div className="search-field">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M21 21l-4.5-4.5" />
          </svg>
          <input
            type="search"
            aria-label="Search expectations"
            placeholder="Search, e.g. “ID cards”, “denial”, “COBRA”"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="filter-bar" role="group" aria-label="Filter by audience">
          {['all', ...EXPECTATION_AUDIENCES].map((option) => {
            const count = expectationGroups.filter((group) => option === 'all' || group.audience === option).reduce(
              (sum, group) => sum + group.items.filter(matchesTerm).length,
              0
            );
            return (
              <button
                key={option}
                type="button"
                className={option === audience ? 'filter-chip active' : 'filter-chip'}
                aria-pressed={option === audience}
                onClick={() => setAudience(option)}
              >
                {option === 'all' ? 'All' : option}
                <span className="filter-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="expect-toolbar-meta">
          <span aria-live="polite">
            {isSearching ? `${visibleKeys.length} ${visibleKeys.length === 1 ? 'result' : 'results'}` : ''}
          </span>
          {!isSearching && visibleKeys.length > 0 && (
            <button type="button" className="link-action" onClick={() => setAllOpen(!allOpen)}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
      </div>

      {visibleGroups.length === 0 && (
        <div className="panel panel-empty">
          No expectations match &ldquo;{term}&rdquo;
          {audience !== 'all' && <> for {audience}</>}.{' '}
          <button
            type="button"
            className="link-action"
            onClick={() => {
              setQuery('');
              setAudience('all');
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {visibleGroups.map(({ group, items }) => {
        const groupOpen = isSearching || !collapsedGroups[group.id];
        const reviewedCount = group.items.filter((item) => acknowledgedItems[item.id]).length;
        const percent = (reviewedCount / group.items.length) * 100;

        return (
          <section key={group.id} className="expect-group" aria-labelledby={`expect-group-${group.id}`}>
            <div className="expect-group-header">
              <h3 id={`expect-group-${group.id}`}>
                <button
                  type="button"
                  className={groupOpen ? 'expect-group-toggle open' : 'expect-group-toggle'}
                  aria-expanded={groupOpen}
                  aria-controls={`expect-list-${group.id}`}
                  disabled={isSearching}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="chevron" aria-hidden="true">›</span>
                  {group.title}
                </button>
              </h3>
              <span className={`audience-tag audience-${group.id}`}>{group.audience}</span>
              <div className="expect-progress" aria-label={`${reviewedCount} of ${group.items.length} reviewed`}>
                <div className="expectation-progress-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <span className="expect-progress-label">
                  {reviewedCount} of {group.items.length} reviewed
                </span>
              </div>
              {canEdit && (
                <button type="button" className="secondary-button" onClick={() => openAddModal(group.title)}>
                  + Add to this group
                </button>
              )}
            </div>

            <Collapsible open={groupOpen} id={`expect-list-${group.id}`}>
              <ul className="expect-list">
                {items.map((item) => {
                  const key = item.id;
                  const bodyId = `expect-body-${group.id}-${group.items.indexOf(item)}`;
                  const open = isItemOpen(key);
                  const reviewedMeta = acknowledgedItems[key];
                  const reviewed = Boolean(reviewedMeta);

                  return (
                    <li key={key} className={`expect-item${reviewed ? ' reviewed' : ''}${open ? ' open' : ''}`}>
                      <div className="expect-item-head">
                        <button
                          type="button"
                          className="expect-item-toggle"
                          aria-expanded={open}
                          aria-controls={bodyId}
                          disabled={isSearching}
                          onClick={() => toggleItem(key)}
                        >
                          <span className="chevron" aria-hidden="true">›</span>
                          <span className="expect-item-title">{highlight(item.title, term)}</span>
                        </button>
                        <label className="reviewed-check">
                          <input
                            type="checkbox"
                            checked={reviewed}
                            aria-label={`Mark as reviewed: ${item.title}`}
                            onChange={() => onToggleReviewed(item, key)}
                          />
                          <span>Reviewed</span>
                        </label>
                        {canEdit && (
                          <div className="expect-item-manage-actions">
                            <button type="button" className="mini-button" onClick={() => openEditModal(group, item)}>
                              Edit
                            </button>
                            <button type="button" className="mini-button" onClick={() => setDeletingItem(item)}>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      <Collapsible open={open} id={bodyId}>
                        <p className="expect-item-body">{highlight(item.body, term)}</p>
                      </Collapsible>
                      {reviewedMeta && (
                        <div className="expect-item-reviewed-tag">
                          Reviewed by {reviewedMeta.by} on {formatTimestamp(new Date(reviewedMeta.at))}.
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Collapsible>
          </section>
        );
      })}

      {modalOpen && (
        <div className="document-modal-backdrop" onClick={closeModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>{editingId ? 'Edit expectation' : 'Add expectation'}</h3>
              <button type="button" className="close-button" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Group</span>
                <input type="text" list="expectation-groups" value={formState.groupTitle} onChange={setField('groupTitle')} />
                <datalist id="expectation-groups">
                  {knownGroups.map((group) => (
                    <option key={group.title} value={group.title} />
                  ))}
                </datalist>
                <small>Type an existing group name to add to it, or a new one to start a group.</small>
              </label>
              <label className="modal-field">
                <span>Audience</span>
                <select value={formState.audience} onChange={setField('audience')}>
                  {EXPECTATION_AUDIENCES.map((option) => (
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
              <h3>Delete expectation</h3>
              <button type="button" className="close-button" onClick={() => setDeletingItem(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Delete &ldquo;{deletingItem.title}&rdquo;? This can&rsquo;t be undone.
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
