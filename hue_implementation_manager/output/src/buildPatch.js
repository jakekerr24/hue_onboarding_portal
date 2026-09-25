// The write-side counterpart to mapClientResponse.js: turns a useDraftEditor draft (already in
// the page components' camelCase shape) into the request body PATCH /api/clients/:id and
// PATCH /api/brokers/:id expect. Kept separate from mapClientResponse.js since one reads and one
// writes, but the two should be read together when either shape changes.

// ClientQuestionnaire's draft maps field-for-field onto PATCH /api/clients/:id.
export function buildClientPatch(draft) {
  return {
    companyName: draft.companyName,
    address: draft.address,
    taxId: draft.taxId,
    sicCode: draft.sicCode,
    orgType: draft.orgType,
    companySize: draft.companySize,
    locations: draft.locations,
    effectiveDate: draft.effectiveDate,
    waitingPeriod: draft.waitingPeriod,
    excludedClasses: draft.excludedClasses,
    hpNetwork: draft.hpNetwork,
    nationalNetwork: draft.nationalNetwork,
    notes: draft.notes,
  };
}

// BrokerQuestionnaire's draft is split across two backend resources: the broker's own
// name/firm fields live on the shared `brokers` row, while vendor integration + broker notes
// are this client's own columns on `clients` (see mapClientResponse.js's brokerData shape).
export function buildBrokerPatches(draft) {
  const brokerPatch = {
    brokerName: draft.brokerName,
    firmName: draft.firmName,
    firmAddress: draft.firmAddress,
    firmTaxId: draft.firmTaxId,
  };
  const clientPatch = {
    brokerNotes: draft.notes,
    vendorIntegrationRequired: draft.vendorIntegration?.required === 'yes',
    vendorIntegrationPlatform: draft.vendorIntegration?.platform,
    cobraVendorName: draft.vendorIntegration?.cobraVendorName,
    cobraVendorContact: draft.vendorIntegration?.cobraVendorContact,
    cobraVendorPhone: draft.vendorIntegration?.cobraVendorPhone,
    cobraVendorEmail: draft.vendorIntegration?.cobraVendorEmail,
  };
  return { brokerPatch, clientPatch };
}
