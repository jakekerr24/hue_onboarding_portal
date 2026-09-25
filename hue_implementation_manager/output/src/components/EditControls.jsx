// Edit / Cancel / Save controls for a draft editor (see hooks/useDraftEditor).
// `requiredLabels` maps required field keys to the names shown in the validation message.
export default function EditControls({ editor, requiredLabels = {} }) {
  const missingNames = editor.missing.map((key) => requiredLabels[key] || key);
  // "Plan sponsor is required." / "Plan sponsor and effective date are required."
  const missingSentence = `${missingNames.map((name, i) => (i === 0 ? name : name.toLowerCase())).join(' and ')} ${
    missingNames.length > 1 ? 'are' : 'is'
  } required.`;

  let status = null;
  if (missingNames.length > 0) {
    status = <span className="edit-status error">{missingSentence}</span>;
  } else if (editor.saveError) {
    status = <span className="edit-status error">{editor.saveError}</span>;
  } else if (editor.saving) {
    status = <span className="edit-status">Saving&hellip;</span>;
  } else if (editor.isEditing) {
    status = <span className="edit-status">Changes aren&rsquo;t saved until you click Save.</span>;
  } else if (editor.lastSaved) {
    status = (
      <span className="edit-status saved">
        Saved at {editor.lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
    );
  }

  return (
    <div className="edit-controls">
      <div className="edit-buttons">
        {editor.isEditing ? (
          <>
            <button type="button" className="section-edit-toggle" onClick={editor.cancel} disabled={editor.saving}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={editor.save}
              disabled={missingNames.length > 0 || editor.saving}
            >
              {editor.saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        ) : (
          <button type="button" className="section-edit-toggle" onClick={editor.startEdit}>
            Edit
          </button>
        )}
      </div>
      {status}
    </div>
  );
}
