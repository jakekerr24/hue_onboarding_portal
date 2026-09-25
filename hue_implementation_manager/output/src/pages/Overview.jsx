import { useMemo } from 'react';
import { daysUntil, formatDisplayDate } from '../utils/date';
import { DUE_SOON_DAYS, buildDeliverables, dueLabel, pluralDays } from '../utils/deliverables';
import { initials } from '../utils/text';

const MAX_ATTENTION_ITEMS = 5;
const MAX_UPCOMING_ITEMS = 3;
const MAX_RECENT_DOCUMENTS = 3;

function effectiveDateMessage(daysToEffective) {
  if (daysToEffective > 0) return `${pluralDays(daysToEffective)} until your plan starts`;
  if (daysToEffective === 0) return 'Your plan starts today';
  return `Your plan has been in effect for ${pluralDays(Math.abs(daysToEffective))}`;
}

function ProgressRing({ percent }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="progress-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="progress-ring-track" cx="50" cy="50" r={radius} />
      <circle
        className="progress-ring-fill"
        cx="50"
        cy="50"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        transform="rotate(-90 50 50)"
      />
      <text className="progress-ring-text" x="50" y="50" textAnchor="middle" dominantBaseline="central">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

function GroupProgress({ label, done, total }) {
  const percent = total ? (done / total) * 100 : 0;
  return (
    <div className="group-progress">
      <div className="group-progress-label">
        <span>{label}</span>
        <span>
          {done} of {total}
        </span>
      </div>
      <div className="group-progress-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function Overview({
  clientData,
  preDeliverables,
  postDeliverables,
  completedDeliverables,
  managerContact,
  documents,
  onNavigate,
}) {
  const today = new Date();

  const deliverables = useMemo(
    () =>
      buildDeliverables({
        effectiveDate: clientData.effectiveDate,
        pre: preDeliverables,
        post: postDeliverables,
        completed: completedDeliverables,
      }),
    [clientData.effectiveDate, preDeliverables, postDeliverables, completedDeliverables]
  );

  const total = deliverables.length;
  const completeCount = deliverables.filter((item) => item.isComplete).length;
  const percentComplete = total ? (completeCount / total) * 100 : 0;
  const countFor = (group) => {
    const items = deliverables.filter((item) => item.group === group);
    return { done: items.filter((item) => item.isComplete).length, total: items.length };
  };
  const preCount = countFor('pre');
  const postCount = countFor('post');

  const byDueDate = (a, b) => a.dueDate.localeCompare(b.dueDate);
  const needsAttention = deliverables
    .filter((item) => item.status === 'overdue' || item.status === 'due-soon')
    // blocking items first, then oldest due date first
    .sort((a, b) => Number(b.alert?.level === 'blocking') - Number(a.alert?.level === 'blocking') || byDueDate(a, b));
  const comingUp = deliverables
    .filter((item) => item.status === 'upcoming')
    .sort(byDueDate)
    .slice(0, MAX_UPCOMING_ITEMS);

  const recentDocuments = [...documents]
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, MAX_RECENT_DOCUMENTS);

  const daysToEffective = daysUntil(clientData.effectiveDate, today);

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <h1>Overview</h1>
          <div className="muted">
            {clientData.companyName} · Policy effective {formatDisplayDate(clientData.effectiveDate)}
          </div>
        </div>
      </div>

      <div className="overview-hero">
        <section className="panel overview-progress" aria-label="Implementation progress">
          <ProgressRing percent={percentComplete} />
          <div className="overview-progress-body">
            <div className="panel-eyebrow">Implementation progress</div>
            <div className="overview-progress-headline">
              {completeCount} of {total} deliverables complete
            </div>
            <GroupProgress label="Before effective date" done={preCount.done} total={preCount.total} />
            <GroupProgress label="After effective date" done={postCount.done} total={postCount.total} />
          </div>
        </section>

        <section className="panel overview-effective" aria-label="Effective date">
          <div className="panel-eyebrow">Policy effective date</div>
          <div className="overview-effective-date">{formatDisplayDate(clientData.effectiveDate)}</div>
          <div className="overview-effective-message">{effectiveDateMessage(daysToEffective)}</div>
        </section>
      </div>

      <div className="overview-grid">
        <div className="overview-column">
          <section className="panel" aria-labelledby="attention-heading">
            <div className="panel-header">
              <h2 id="attention-heading">
                Needs your attention
                {needsAttention.length > 0 && <span className="count-chip">{needsAttention.length}</span>}
              </h2>
              <button type="button" className="link-action" onClick={() => onNavigate('deliverables')}>
                View all deliverables
              </button>
            </div>

            {needsAttention.length === 0 ? (
              <div className="panel-empty">
                You&rsquo;re all caught up. Nothing is overdue or due in the next {DUE_SOON_DAYS} days.
              </div>
            ) : (
              <>
                <ul className="item-list">
                  {needsAttention.slice(0, MAX_ATTENTION_ITEMS).map((item) => (
                    <li key={item.key} className="item-row">
                      <div className="item-main">
                        <div className="item-name">{item.name}</div>
                        <div className="item-meta">Due {formatDisplayDate(item.dueDate)}</div>
                      </div>
                      <div className="item-badges">
                        {item.alert?.level === 'blocking' && (
                          <span className="pill pill-blocking">{item.alert.text}</span>
                        )}
                        <span className={`pill pill-${item.status}`}>{dueLabel(item.daysLeft)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {needsAttention.length > MAX_ATTENTION_ITEMS && (
                  <button type="button" className="link-action more-link" onClick={() => onNavigate('deliverables')}>
                    + {needsAttention.length - MAX_ATTENTION_ITEMS} more in Deliverables &amp; Timeline
                  </button>
                )}
              </>
            )}
          </section>

          <section className="panel" aria-labelledby="upcoming-heading">
            <div className="panel-header">
              <h2 id="upcoming-heading">Coming up next</h2>
            </div>
            {comingUp.length === 0 ? (
              <div className="panel-empty">No further deliverables are scheduled.</div>
            ) : (
              <ul className="item-list">
                {comingUp.map((item) => (
                  <li key={item.key} className="item-row">
                    <div className="item-main">
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">Due {formatDisplayDate(item.dueDate)}</div>
                    </div>
                    <div className="item-badges">
                      <span className="pill pill-upcoming">{dueLabel(item.daysLeft)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="overview-column">
          {managerContact && (
            <section className="panel" aria-labelledby="manager-heading">
              <div className="panel-header">
                <h2 id="manager-heading">Your implementation manager</h2>
              </div>
              <div className="person">
                <div className="person-avatar" aria-hidden="true">
                  {initials(managerContact.name)}
                </div>
                <div className="person-body">
                  <div className="person-name">{managerContact.name}</div>
                  <div className="person-title">{managerContact.title}</div>
                </div>
              </div>
              <div className="person-links">
                {managerContact.email && <a href={`mailto:${managerContact.email}`}>{managerContact.email}</a>}
                {managerContact.phone && (
                  <a href={`tel:${managerContact.phone.replace(/[^\d+]/g, '')}`}>{managerContact.phone}</a>
                )}
              </div>
            </section>
          )}

          <section className="panel" aria-labelledby="documents-heading">
            <div className="panel-header">
              <h2 id="documents-heading">Recent documents</h2>
              <button type="button" className="link-action" onClick={() => onNavigate('documents')}>
                Open Document Center
              </button>
            </div>
            {recentDocuments.length === 0 ? (
              <div className="panel-empty">No documents have been shared yet.</div>
            ) : (
              <ul className="item-list">
                {recentDocuments.map((document) => (
                  <li key={document.id} className="item-row">
                    <div className="item-main">
                      <div className="item-name">{document.title}</div>
                      <div className="item-meta">Added {formatDisplayDate(document.uploadedAt)}</div>
                    </div>
                    <div className="item-badges">
                      <span className="document-type-badge">{document.fileType}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
