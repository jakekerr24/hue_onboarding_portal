import { useEffect, useRef, useState } from 'react';
import { initials } from '../utils/text';

const COPIED_TIMEOUT_MS = 1500;

// A link plus a "Copy" button, so a phone or email can be used without leaving the portal
// (dialing on a phone, or copying to paste into another app on desktop).
function CopyLink({ href, value, label }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // Clipboard API unavailable (older browser, permissions, non-secure context).
      // The link itself still works, so this is silently ignored.
    }
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), COPIED_TIMEOUT_MS);
  };

  return (
    <div className="contact-link-row">
      <a href={href}>{value}</a>
      <button type="button" className="copy-button" onClick={handleCopy} aria-label={`Copy ${label}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// Read-only contact card: avatar, name/title, what they help with, and click-to-contact links.
export default function ContactCard({
  contact,
  fallbackName,
  showOrg = false,
  showSignatory = false,
  showPortalAccess = false,
  onManageAccess,
}) {
  const name = contact.name || fallbackName;
  const titleLine = [contact.title, showOrg ? contact.category : null].filter(Boolean).join(' · ');

  return (
    <div className="contact-card">
      <div className="contact-card-head">
        <div className="person-avatar" aria-hidden="true">
          {initials(name)}
        </div>
        <div className="contact-card-id">
          <div className="contact-card-name">
            {name}
            {showSignatory && contact.signatory && <span className="tag">Signatory</span>}
          </div>
          {titleLine && <div className="contact-card-title">{titleLine}</div>}
          {showOrg && contact.org && <div className="contact-card-org">{contact.org}</div>}
        </div>
      </div>

      {contact.role && <div className="contact-card-role">Contact for: {contact.role}</div>}

      {(contact.email || contact.phone) && (
        <div className="contact-card-links">
          {contact.email && <CopyLink href={`mailto:${contact.email}`} value={contact.email} label="email" />}
          {contact.phone && (
            <CopyLink href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} value={contact.phone} label="phone" />
          )}
        </div>
      )}

      {showPortalAccess && (
        <div className="contact-card-access">
          {contact.loginEmail ? (
            <span className="tag tag-access-granted">Portal access: {contact.loginEmail}</span>
          ) : (
            <span className="tag tag-access-none">No portal access</span>
          )}
          <button type="button" className="link-action" onClick={onManageAccess}>
            {contact.loginEmail ? 'Manage' : 'Grant access'}
          </button>
        </div>
      )}
    </div>
  );
}
