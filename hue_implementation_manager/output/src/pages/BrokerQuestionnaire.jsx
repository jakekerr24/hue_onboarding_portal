import { useState } from 'react';
import { EditableFieldInput, MaskedFieldInput, YesNoFieldInput } from '../components/fields';
import EditControls from '../components/EditControls';

const REQUIRED_LABELS = { brokerName: 'Broker name', firmName: 'Firm name' };
const EMPTY_NEW_BROKER = { brokerName: '', firmName: '', firmAddress: '', firmTaxId: '' };

export default function BrokerQuestionnaireSection({
  brokerData,
  onFieldChange,
  onVendorIntegrationChange,
  isEditing,
  editor,
  onNavigate,
  canEdit,
  onExport,
  exporting,
  exportError,
  brokerPool = [],
  brokerPoolError,
  onOpenBrokerPicker,
  onLinkBroker,
  onCreateBroker,
}) {
  const integrationRequired = brokerData.vendorIntegration.required === 'yes';

  // Linking a broker (existing or brand new) persists immediately rather than joining the
  // editor's draft -- there's no id to PATCH against until this happens, so it can't wait for a
  // Save the way the rest of this page's fields do.
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkMode, setLinkMode] = useState('existing');
  const [pickerQuery, setPickerQuery] = useState('');
  const [newBroker, setNewBroker] = useState(EMPTY_NEW_BROKER);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const openLinkModal = () => {
    setLinkMode('existing');
    setPickerQuery('');
    setNewBroker(EMPTY_NEW_BROKER);
    setLinkError(null);
    setShowLinkModal(true);
    onOpenBrokerPicker();
  };
  const closeLinkModal = () => {
    if (!linking) setShowLinkModal(false);
  };
  const handleLinkExisting = async (brokerId) => {
    setLinking(true);
    setLinkError(null);
    try {
      await onLinkBroker(brokerId);
      setShowLinkModal(false);
    } catch (err) {
      setLinkError(err.message || 'Failed to link broker.');
    } finally {
      setLinking(false);
    }
  };
  const handleCreateBroker = async () => {
    setLinking(true);
    setLinkError(null);
    try {
      await onCreateBroker(newBroker);
      setShowLinkModal(false);
    } catch (err) {
      setLinkError(err.message || 'Failed to create broker.');
    } finally {
      setLinking(false);
    }
  };

  const pickerTerm = pickerQuery.trim().toLowerCase();
  const pickerResults = brokerPool.filter(
    (broker) => !pickerTerm || [broker.brokerName, broker.firmName].filter(Boolean).join(' ').toLowerCase().includes(pickerTerm)
  );

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Broker Questionnaire</h1>
          <div className="muted">Broker and agency details used across enrollment, compliance, and vendor onboarding</div>
        </div>
        {canEdit && (
          <div className="section-header-stack">
            <button type="button" className="secondary-button" onClick={onExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </button>
            {brokerData.id ? (
              <EditControls editor={editor} requiredLabels={REQUIRED_LABELS} />
            ) : (
              <button type="button" className="secondary-button" onClick={openLinkModal}>
                + Link broker
              </button>
            )}
          </div>
        )}
      </div>

      {exportError && <div className="edit-status error">{exportError}</div>}

      {!brokerData.id && (
        <div className="panel panel-empty">
          {canEdit
            ? 'No broker linked to this client yet. Use "+ Link broker" above to attach one already on file, or create a new one.'
            : 'No broker linked to this client yet.'}
        </div>
      )}

      <div className="section-kicker">Broker Profile</div>

      <div className="field-block-group">
        <div className="form-grid">
          <EditableFieldInput label="Broker Name" value={brokerData.brokerName} onChange={onFieldChange('brokerName')} isEditing={isEditing} />
          <EditableFieldInput label="Firm Name" value={brokerData.firmName} onChange={onFieldChange('firmName')} isEditing={isEditing} />
          <EditableFieldInput label="Firm Address" value={brokerData.firmAddress} onChange={onFieldChange('firmAddress')} isEditing={isEditing} />
          <MaskedFieldInput label="Firm Tax ID" value={brokerData.firmTaxId} onChange={onFieldChange('firmTaxId')} isEditing={isEditing} />
        </div>
      </div>

      <div className="subsection">
        <div className="section-kicker">Vendor Integration</div>
        <div className="field-block-group">
          <div className="form-grid">
            <YesNoFieldInput
              label="Benefits Admin Platform Integration Required?"
              value={brokerData.vendorIntegration.required}
              onChange={onVendorIntegrationChange('required')}
              isEditing={isEditing}
            />
            {integrationRequired && (
              <EditableFieldInput
                label="Platform"
                value={brokerData.vendorIntegration.platform}
                onChange={onVendorIntegrationChange('platform')}
                isEditing={isEditing}
              />
            )}
            <EditableFieldInput
              label="COBRA Vendor Name"
              value={brokerData.vendorIntegration.cobraVendorName}
              onChange={onVendorIntegrationChange('cobraVendorName')}
              isEditing={isEditing}
            />
            <EditableFieldInput
              label="COBRA Contact"
              value={brokerData.vendorIntegration.cobraVendorContact}
              onChange={onVendorIntegrationChange('cobraVendorContact')}
              isEditing={isEditing}
            />
            <EditableFieldInput
              label="COBRA Phone"
              value={brokerData.vendorIntegration.cobraVendorPhone}
              onChange={onVendorIntegrationChange('cobraVendorPhone')}
              isEditing={isEditing}
            />
            <EditableFieldInput
              label="COBRA Email"
              value={brokerData.vendorIntegration.cobraVendorEmail}
              onChange={onVendorIntegrationChange('cobraVendorEmail')}
              isEditing={isEditing}
            />
          </div>
        </div>
      </div>

      <div className="subsection">
        <div className="section-kicker">Broker Contacts</div>
        <div className="contacts-link-row">
          <span>
            {brokerData.contacts.length} broker {brokerData.contacts.length === 1 ? 'contact' : 'contacts'} on file
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
          value={brokerData.notes}
          onChange={onFieldChange('notes')}
          rows={4}
          readOnly={!isEditing}
        />
      </div>

      {showLinkModal && (
        <div className="document-modal-backdrop" onClick={closeLinkModal}>
          <div className="document-modal" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal-header">
              <h3>Link a broker</h3>
              <button type="button" className="close-button" onClick={closeLinkModal} disabled={linking}>
                ×
              </button>
            </div>
            <div className="document-modal-body">
              <div className="edit-buttons">
                <button
                  type="button"
                  className={linkMode === 'existing' ? 'primary-button' : 'secondary-button'}
                  onClick={() => setLinkMode('existing')}
                  disabled={linking}
                >
                  Choose existing
                </button>
                <button
                  type="button"
                  className={linkMode === 'new' ? 'primary-button' : 'secondary-button'}
                  onClick={() => setLinkMode('new')}
                  disabled={linking}
                >
                  + New broker
                </button>
              </div>

              {linkError && <div className="edit-status error">{linkError}</div>}

              {linkMode === 'existing' ? (
                <>
                  <label className="modal-field">
                    <span>Search brokers on file</span>
                    <input
                      type="search"
                      value={pickerQuery}
                      onChange={(event) => setPickerQuery(event.target.value)}
                      placeholder="Broker or firm name"
                    />
                  </label>

                  {brokerPoolError && <div className="edit-status error">{brokerPoolError}</div>}

                  {pickerResults.length === 0 ? (
                    <div className="panel-empty">No brokers on file match. Use &ldquo;+ New broker&rdquo; instead.</div>
                  ) : (
                    <ul className="document-list">
                      {pickerResults.map((broker) => (
                        <li key={broker.id} className="document-row">
                          <div className="document-row-body">
                            <div className="document-row-top">
                              <span className="document-row-title">{broker.firmName}</span>
                            </div>
                            <div className="document-row-meta">
                              <span>{broker.brokerName}</span>
                            </div>
                          </div>
                          <div className="document-row-actions">
                            <button type="button" className="secondary-button" onClick={() => handleLinkExisting(broker.id)} disabled={linking}>
                              {linking ? 'Linking…' : 'Link'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="form-grid">
                  <label className="modal-field">
                    <span>Broker Name</span>
                    <input
                      type="text"
                      value={newBroker.brokerName}
                      onChange={(event) => setNewBroker((current) => ({ ...current, brokerName: event.target.value }))}
                    />
                  </label>
                  <label className="modal-field">
                    <span>Firm Name</span>
                    <input
                      type="text"
                      value={newBroker.firmName}
                      onChange={(event) => setNewBroker((current) => ({ ...current, firmName: event.target.value }))}
                    />
                  </label>
                  <label className="modal-field">
                    <span>Firm Address</span>
                    <input
                      type="text"
                      value={newBroker.firmAddress}
                      onChange={(event) => setNewBroker((current) => ({ ...current, firmAddress: event.target.value }))}
                    />
                  </label>
                  <label className="modal-field">
                    <span>Firm Tax ID</span>
                    <input
                      type="text"
                      value={newBroker.firmTaxId}
                      onChange={(event) => setNewBroker((current) => ({ ...current, firmTaxId: event.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="document-modal-footer">
              <button type="button" className="secondary-button" onClick={closeLinkModal} disabled={linking}>
                Close
              </button>
              {linkMode === 'new' && (
                <button type="button" className="primary-button" onClick={handleCreateBroker} disabled={linking || !newBroker.firmName}>
                  {linking ? 'Creating…' : 'Create & link'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
