import { useState } from 'react';

export function EditableFieldInput({ label, value, onChange, type = 'text', isEditing = false, hint }) {
  if (!isEditing) {
    return (
      <div className="field-block">
        <label>{label}</label>
        <div className="field-value">{value || '—'}</div>
        {hint && <div className="field-hint">{hint}</div>}
      </div>
    );
  }

  return (
    <div className="field-block">
      <label>{label}</label>
      <input className="field-input" type={type} value={value || ''} onChange={onChange} />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function FieldInput({ label, value, onChange, type = 'text' }) {
  return (
    <div className="field-block">
      <label>{label}</label>
      <input className="field-input" type={type} value={value || ''} onChange={onChange} />
    </div>
  );
}

// A sensitive field (EIN) shown as •••• + last 4 digits by default, with a Show/Hide toggle.
// Editing always shows the raw value — you need to see what you're typing.
export function MaskedFieldInput({ label, value, onChange, isEditing = false }) {
  const [revealed, setRevealed] = useState(false);

  if (isEditing) {
    return (
      <div className="field-block">
        <label>{label}</label>
        <input className="field-input" type="text" placeholder="XX-XXXXXXX" value={value || ''} onChange={onChange} />
      </div>
    );
  }

  const digits = (value || '').replace(/[^0-9]/g, '');
  const masked = digits ? `••••••${digits.slice(-4)}` : '—';

  return (
    <div className="field-block">
      <label>{label}</label>
      <div className="masked-field-row">
        <div className="field-value">{value ? (revealed ? value : masked) : '—'}</div>
        {value && (
          <button type="button" className="link-action" onClick={() => setRevealed((current) => !current)}>
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

// Two-way toggle stored as the strings 'yes' / 'no'. Reuses the filter-chip look as a compact
// segmented control instead of introducing a new toggle-switch component.
export function YesNoFieldInput({ label, value, onChange, isEditing = false }) {
  if (!isEditing) {
    return (
      <div className="field-block">
        <label>{label}</label>
        <div className="field-value">{value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '—'}</div>
      </div>
    );
  }

  return (
    <div className="field-block">
      <label>{label}</label>
      <div className="chip-toggle-row" role="radiogroup" aria-label={label}>
        {['yes', 'no'].map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? 'filter-chip active' : 'filter-chip'}
            aria-pressed={value === option}
            onClick={() => onChange({ target: { value: option } })}
          >
            {option === 'yes' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

// Single choice from a short fixed list, shown as native radio buttons.
export function RadioFieldInput({ label, value, onChange, options, isEditing = false }) {
  if (!isEditing) {
    return (
      <div className="field-block">
        <label>{label}</label>
        <div className="field-value">{value || '—'}</div>
      </div>
    );
  }

  return (
    <div className="field-block">
      <label>{label}</label>
      <div className="radio-group">
        {options.map((option) => (
          <label key={option} className="radio-option">
            <input type="radio" name={label} value={option} checked={value === option} onChange={onChange} />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

// Single choice from a longer list, shown as a native <select>. `options` is [{ value, label }].
export function SelectFieldInput({ label, value, onChange, options, isEditing = false }) {
  if (!isEditing) {
    const match = options.find((option) => option.value === value);
    return (
      <div className="field-block">
        <label>{label}</label>
        <div className="field-value">{match ? match.label : value || '—'}</div>
      </div>
    );
  }

  return (
    <div className="field-block">
      <label>{label}</label>
      <select className="field-input" value={value || ''} onChange={onChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Multiple choice from a short fixed list, shown as checkboxes. `values` is an array;
// `onToggle(option)` returns the change handler for one checkbox.
export function CheckboxGroupFieldInput({ label, values, options, onToggle, isEditing = false }) {
  if (!isEditing) {
    const display = !values || values.length === 0 ? '—' : values.join(', ');
    return (
      <div className="field-block">
        <label>{label}</label>
        <div className="field-value">{display}</div>
      </div>
    );
  }

  return (
    <div className="field-block">
      <label>{label}</label>
      <div className="checkbox-group">
        {options.map((option) => (
          <label key={option} className="checkbox-option">
            <input type="checkbox" checked={(values || []).includes(option)} onChange={onToggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

// A number field with a fixed unit suffix (e.g. "214" -> "214 employees").
export function NumberWithSuffixFieldInput({ label, value, onChange, suffix, isEditing = false }) {
  if (!isEditing) {
    return (
      <div className="field-block">
        <label>{label}</label>
        <div className="field-value">{value ? `${value} ${suffix}` : '—'}</div>
      </div>
    );
  }

  return (
    <div className="field-block">
      <label>{label}</label>
      <div className="input-with-suffix">
        <input className="field-input" type="number" min="0" value={value || ''} onChange={onChange} />
        <span>{suffix}</span>
      </div>
    </div>
  );
}
