import {
  CheckboxGroupFieldInput,
  EditableFieldInput,
  MaskedFieldInput,
  NumberWithSuffixFieldInput,
  RadioFieldInput,
  SelectFieldInput,
} from '../components/fields';
import EditControls from '../components/EditControls';

const REQUIRED_LABELS = { companyName: 'Plan sponsor', address: 'Business address', effectiveDate: 'Effective date' };

const ORG_TYPES = ['LLC/LLP', 'C-Corp', 'S-Corp', 'Partnership', 'Sole Proprietorship', 'Other'];

const HP_NETWORKS = [
  { value: '39North Network', label: '39North Network' },
  { value: 'None', label: 'None' },
];

const NATIONAL_NETWORKS = [
  { value: 'Logro Network', label: 'Logro Network (recommended)' },
  { value: 'First Health', label: 'First Health' },
  { value: 'PCHS', label: 'PCHS' },
  { value: 'Other', label: 'Other' },
];

const EXCLUDED_CLASS_OPTIONS = ['None', 'Salary', 'Hourly', 'Part-Time', 'Retiree', 'Other'];

export default function ClientQuestionnaireSection({
  clientData,
  onFieldChange,
  isEditing,
  editor,
  onNavigate,
  canEdit,
  onExport,
  exporting,
  exportError,
}) {
  // "None" means no classes are excluded, so it's exclusive with every other option.
  const handleExcludedClassToggle = (option) => () => {
    const current = clientData.excludedClasses || [];
    const next =
      option === 'None'
        ? current.includes('None')
          ? []
          : ['None']
        : (() => {
            const withoutNone = current.filter((value) => value !== 'None');
            return withoutNone.includes(option)
              ? withoutNone.filter((value) => value !== option)
              : [...withoutNone, option];
          })();
    onFieldChange('excludedClasses')({ target: { value: next } });
  };

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Client Questionnaire</h1>
          <div className="muted">Core employer information used across all implementation partners</div>
        </div>
        {canEdit && (
          <div className="section-header-stack">
            <button type="button" className="secondary-button" onClick={onExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </button>
            <EditControls editor={editor} requiredLabels={REQUIRED_LABELS} />
          </div>
        )}
      </div>

      {exportError && <div className="edit-status error">{exportError}</div>}

      <div className="section-kicker">General Information</div>

      <div className="field-block-group">
        <div className="form-grid">
          <EditableFieldInput label="Plan Sponsor" value={clientData.companyName} onChange={onFieldChange('companyName')} isEditing={isEditing} />
          <EditableFieldInput label="Business Address" value={clientData.address} onChange={onFieldChange('address')} isEditing={isEditing} />
          <MaskedFieldInput label="Tax ID (EIN)" value={clientData.taxId} onChange={onFieldChange('taxId')} isEditing={isEditing} />
          <EditableFieldInput label="SIC Code" value={clientData.sicCode} onChange={onFieldChange('sicCode')} isEditing={isEditing} />
          <RadioFieldInput label="Organization Type" value={clientData.orgType} onChange={onFieldChange('orgType')} options={ORG_TYPES} isEditing={isEditing} />
          <NumberWithSuffixFieldInput label="Company Size" value={clientData.companySize} onChange={onFieldChange('companySize')} suffix="employees" isEditing={isEditing} />
          <EditableFieldInput label="Locations" value={clientData.locations} onChange={onFieldChange('locations')} isEditing={isEditing} />
        </div>
      </div>

      <div className="subsection">
        <div className="section-kicker">Plan Information</div>
        <div className="field-block-group">
          <div className="form-grid">
            <EditableFieldInput label="Effective Date" value={clientData.effectiveDate} onChange={onFieldChange('effectiveDate')} type="date" isEditing={isEditing} />
            <EditableFieldInput
              label="Waiting Period for New Hires"
              value={clientData.waitingPeriod}
              onChange={onFieldChange('waitingPeriod')}
              isEditing={isEditing}
              hint="Example: 1st of the month following 30 days after hire."
            />
            <SelectFieldInput label="HP Network" value={clientData.hpNetwork} onChange={onFieldChange('hpNetwork')} options={HP_NETWORKS} isEditing={isEditing} />
            <SelectFieldInput label="National Network" value={clientData.nationalNetwork} onChange={onFieldChange('nationalNetwork')} options={NATIONAL_NETWORKS} isEditing={isEditing} />
            <CheckboxGroupFieldInput
              label="Excluded Classes"
              values={clientData.excludedClasses}
              options={EXCLUDED_CLASS_OPTIONS}
              onToggle={handleExcludedClassToggle}
              isEditing={isEditing}
            />
          </div>
        </div>
      </div>

      <div className="subsection">
        <div className="section-kicker">Points of Contact</div>
        <div className="contacts-link-row">
          <span>
            {clientData.contacts.length} employer {clientData.contacts.length === 1 ? 'contact' : 'contacts'} on file
          </span>
          <button type="button" className="link-action" onClick={() => onNavigate('contacts')}>
            Manage in Contacts &rarr;
          </button>
        </div>
      </div>

      <div className="subsection">
        <div className="section-kicker">Notes</div>
        <textarea
          className="text-area"
          value={clientData.notes}
          onChange={onFieldChange('notes')}
          rows={4}
          readOnly={!isEditing}
        />
      </div>
    </div>
  );
}
