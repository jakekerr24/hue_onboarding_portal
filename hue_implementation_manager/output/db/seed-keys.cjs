// CJS mirror of src/utils/keys.js (kept identical) so the seed script can match
// DEMO_PROGRESS's keys without needing an ESM/bundler loader for a two-line module.
function deliverableKey(group, index, name) {
  return `${group}-${index}-${name}`;
}

function acknowledgementKey(groupTitle, itemTitle) {
  return `${groupTitle}-${itemTitle}`;
}

module.exports = { deliverableKey, acknowledgementKey };
