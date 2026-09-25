import { useState } from 'react';

// Draft-based editing for a data section. Changes stay in a draft until save() is called,
// so nothing else in the portal (Overview, sidebar, ...) changes while the user is typing.
// `fields` whitelists what the form edits; anything else (e.g. contacts, which are managed
// on the Contacts page) is never overwritten by a save.
//
// `persist`, when given, is an async function called with the draft before it's committed to
// local state -- the real PATCH to the backend. If it throws, the draft is kept open (nothing
// is lost) and the error is exposed via `saveError` for EditControls to show. Without `persist`,
// save() commits to local state only (used for sections that don't have a backend endpoint yet).
export function useDraftEditor(saved, setSaved, { fields, required = [], persist }) {
  const [draft, setDraft] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const isEditing = draft !== null;

  const missing = isEditing ? required.filter((key) => !String(draft[key] ?? '').trim()) : [];

  const startEdit = () => {
    setSaveError(null);
    setDraft(Object.fromEntries(fields.map((key) => [key, saved[key]])));
  };

  const cancel = () => {
    setDraft(null);
    setSaveError(null);
  };

  const save = async () => {
    if (!draft || missing.length > 0 || saving) return;

    if (!persist) {
      setSaved((current) => ({ ...current, ...draft }));
      setDraft(null);
      setLastSaved(new Date());
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await persist(draft);
      setSaved((current) => ({ ...current, ...draft }));
      setDraft(null);
      setLastSaved(new Date());
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (field) => (event) => {
    const { value } = event.target;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const setNestedField = (parent, field) => (event) => {
    const { value } = event.target;
    setDraft((current) => ({ ...current, [parent]: { ...current[parent], [field]: value } }));
  };

  return {
    values: isEditing ? { ...saved, ...draft } : saved,
    isEditing,
    missing,
    lastSaved,
    saving,
    saveError,
    startEdit,
    cancel,
    save,
    setField,
    setNestedField,
  };
}
