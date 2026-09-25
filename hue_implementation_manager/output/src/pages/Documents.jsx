import { useEffect, useRef, useState } from 'react';
import { formatDisplayDate } from '../utils/date';

const CATEGORIES = [
  { id: 'plan-documents', label: 'Plan Documents' },
  { id: 'resources-education', label: 'Resources & Education' },
  { id: 'contracts-agreements', label: 'Contracts & Agreements' },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((category) => [category.id, category.label]));

// What actually matters for tracking signed partner contracts (the #1 pain point) is just: does
// this still need a signature, or not.
const SIGNATURE_STATUS = {
  none: { label: null },
  'needs-signature': { label: 'Needs signature' },
  signed: { label: 'Signed' },
};

export function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesTerm(document, term) {
  if (!term) return true;
  return [document.title, document.description, document.owner, CATEGORY_LABEL[document.category]]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
}

// "⋮" menu with Edit / Delete. Closes on an outside click or Escape.
function DocumentRowMenu({ open, onToggle, onClose, onEdit, onDelete }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button type="button" className="mini-button menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={onToggle}>
        <span aria-hidden="true">⋮</span>
        <span className="sr-only">More actions</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={onEdit}>
            Edit
          </button>
          <button type="button" role="menuitem" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function DocumentsSection({ documents, onUpload, onUpdate, onRemove, onDownload, canEdit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [dragActive, setDragActive] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    category: 'plan-documents',
    signatureStatus: 'none',
  });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletingDocument, setDeletingDocument] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [listError, setListError] = useState(null);

  const term = searchTerm.trim().toLowerCase();
  const visibleDocuments = documents
    .filter((document) => categoryId === 'all' || document.category === categoryId)
    .filter((document) => matchesTerm(document, term))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const openUploadModal = (file, existingDoc = null) => {
    setPendingFile(file);
    setFormState({
      title: existingDoc ? existingDoc.title : file ? file.name.replace(/\.[^/.]+$/, '') : '',
      description: existingDoc ? existingDoc.description : '',
      category: existingDoc ? existingDoc.category : 'plan-documents',
      signatureStatus: existingDoc ? existingDoc.signatureStatus : 'none',
    });
    setEditingDocumentId(existingDoc ? existingDoc.id : null);
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setPendingFile(null);
    setUploadModalOpen(false);
    setEditingDocumentId(null);
    setModalError(null);
    setFormState({ title: '', description: '', category: 'plan-documents', signatureStatus: 'none' });
  };

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    openUploadModal(file);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    setDragDepth(0);
    if (!canEdit) return;
    const file = event.dataTransfer.files?.[0];
    if (file) openUploadModal(file);
  };

  // Only a newly picked file is sent for storage; editing without picking a new one leaves the
  // `file` field out of the form entirely, so the backend keeps the document's existing file
  // (see server.js's PATCH handler, which only touches file_type/file_size/storage_path when
  // req.file is present).
  const handleSaveDocument = async () => {
    const title = formState.title.trim();
    if (!title) return;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', formState.description.slice(0, 50));
    formData.append('category', formState.category);
    formData.append('signatureStatus', formState.signatureStatus);
    if (pendingFile) formData.append('file', pendingFile);

    setSaving(true);
    setModalError(null);
    try {
      if (editingDocumentId) {
        await onUpdate(editingDocumentId, formData);
      } else {
        await onUpload(formData);
      }
      closeUploadModal();
    } catch (err) {
      setModalError(err.message || 'Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setListError(null);
    try {
      await onRemove(deletingDocument.id);
      setDeletingDocument(null);
    } catch (err) {
      setListError(err.message || 'Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (doc) => {
    setListError(null);
    try {
      await onDownload(doc);
    } catch (err) {
      setListError(err.message || 'Failed to download document.');
    }
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Document Center</h1>
          <div className="muted">Shared plan documents and implementation materials</div>
        </div>
        <div className="section-summary">
          <strong>{documents.length}</strong> documents
        </div>
      </div>

      {listError && <div className="edit-status error">{listError}</div>}

      <div className="document-toolbar">
        <div className="search-field">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M21 21l-4.5-4.5" />
          </svg>
          <input
            type="search"
            aria-label="Search documents"
            placeholder="Search by name, description, or category"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        {canEdit && (
          <label className="secondary-button upload-button">
            + Upload document
            <input type="file" onChange={handleFileSelection} />
          </label>
        )}
      </div>

      <div className="filter-bar" role="group" aria-label="Filter by category">
        {[{ id: 'all', label: 'All' }, ...CATEGORIES].map((category) => {
          const count = documents.filter((document) => category.id === 'all' || document.category === category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              className={category.id === categoryId ? 'filter-chip active' : 'filter-chip'}
              aria-pressed={category.id === categoryId}
              onClick={() => setCategoryId(category.id)}
            >
              {category.label}
              <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        className={dragActive ? 'document-drop-zone drag-active' : 'document-drop-zone'}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!canEdit) return;
          setDragDepth((depth) => depth + 1);
          setDragActive(true);
        }}
        onDragLeave={() => {
          if (!canEdit) return;
          setDragDepth((depth) => {
            const next = Math.max(0, depth - 1);
            if (next === 0) setDragActive(false);
            return next;
          });
        }}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="drop-overlay" aria-hidden="true">
            Drop to upload
          </div>
        )}

        {visibleDocuments.length === 0 ? (
          <div className="panel panel-empty">
            {documents.length === 0 ? (
              canEdit ? 'No documents yet. Drag a file here or use Upload document above.' : 'No documents have been shared yet.'
            ) : (
              <>
                No documents match your search.{' '}
                <button
                  type="button"
                  className="link-action"
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryId('all');
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="document-list">
            {visibleDocuments.map((document) => {
              const statusLabel = SIGNATURE_STATUS[document.signatureStatus]?.label;
              return (
                <li key={document.id} className="document-row">
                  <span className="document-type-badge" aria-hidden="true">
                    {document.fileType}
                  </span>

                  <div className="document-row-body">
                    <div className="document-row-top">
                      <span className="document-row-title">{document.title}</span>
                      {statusLabel && (
                        <span className={`pill pill-${document.signatureStatus}`}>{statusLabel}</span>
                      )}
                    </div>

                    <div className="document-row-meta">
                      <span className="category-tag">{CATEGORY_LABEL[document.category]}</span>
                      <span>
                        {[
                          document.fileSize,
                          `Uploaded ${formatDisplayDate(document.uploadedAt)}`,
                          document.owner && `Provided by ${document.owner}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>

                    {document.description && (
                      <div className="document-row-description">{document.description}</div>
                    )}
                  </div>

                  <div className="document-row-actions">
                    <button type="button" className="secondary-button" onClick={() => handleDownload(document)}>
                      Download
                    </button>
                    {canEdit && (
                      <DocumentRowMenu
                        open={openMenuId === document.id}
                        onToggle={() => setOpenMenuId((current) => (current === document.id ? null : document.id))}
                        onClose={() => setOpenMenuId(null)}
                        onEdit={() => {
                          setOpenMenuId(null);
                          openUploadModal(null, document);
                        }}
                        onDelete={() => {
                          setOpenMenuId(null);
                          setDeletingDocument(document);
                        }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {uploadModalOpen && (
        <div className="document-modal-backdrop" onClick={closeUploadModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>{editingDocumentId ? 'Edit document' : 'Upload document'}</h3>
              <button type="button" className="close-button" onClick={closeUploadModal}>
                ×
              </button>
            </div>

            <div className="document-modal-body">
              <label className="modal-field">
                <span>Document title</span>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                />
              </label>

              <label className="modal-field">
                <span>Document description</span>
                <textarea
                  maxLength={50}
                  rows={3}
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                />
                <small>{formState.description.length}/50</small>
              </label>

              <label className="modal-field">
                <span>Document category</span>
                <select
                  value={formState.category}
                  onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="modal-field">
                <span>Signature status</span>
                <select
                  value={formState.signatureStatus}
                  onChange={(event) => setFormState((current) => ({ ...current, signatureStatus: event.target.value }))}
                >
                  <option value="none">No signature needed</option>
                  <option value="needs-signature">Needs signature</option>
                  <option value="signed">Signed</option>
                </select>
              </label>

              {modalError && <div className="edit-status error">{modalError}</div>}
            </div>

            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closeUploadModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSaveDocument} disabled={saving}>
                {saving ? 'Saving…' : editingDocumentId ? 'Save changes' : 'Upload document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingDocument && (
        <div className="document-modal-backdrop" onClick={() => !deleting && setDeletingDocument(null)}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Delete document</h3>
              <button type="button" className="close-button" onClick={() => setDeletingDocument(null)} disabled={deleting}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <p>
                Delete &ldquo;{deletingDocument.title}&rdquo;? This can&rsquo;t be undone.
              </p>
            </div>
            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setDeletingDocument(null)} disabled={deleting}>
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
