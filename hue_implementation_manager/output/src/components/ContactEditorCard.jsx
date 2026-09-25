import { FieldInput } from './fields';

// Editable contact card used while a contact group is in edit mode.
export default function ContactEditorCard({ contact, label, showOrg = false, showSignatory = false, onChange, onRemove }) {
  return (
    <div className="contact-editor-card">
      <div className="contact-editor-header">
        <div className="contact-name">{label}</div>
        <div className="contact-actions">
          {showSignatory && contact.signatory && <span className="tag">Signatory</span>}
          <button type="button" className="link-button" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      <div className="form-grid nested">
        {showOrg && <FieldInput label="Organization" value={contact.org} onChange={onChange('org')} />}
        {showOrg && <FieldInput label="Type (e.g. TPA, PBM)" value={contact.category} onChange={onChange('category')} />}
        <FieldInput label="Name" value={contact.name} onChange={onChange('name')} />
        <FieldInput label="Title" value={contact.title} onChange={onChange('title')} />
        <FieldInput label="Contact for" value={contact.role} onChange={onChange('role')} />
        <FieldInput label="Phone" value={contact.phone} onChange={onChange('phone')} />
        <FieldInput label="Email" value={contact.email} onChange={onChange('email')} />
      </div>

      {showSignatory && (
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(contact.signatory)} onChange={onChange('signatory')} />
          Signatory contact
        </label>
      )}
    </div>
  );
}
