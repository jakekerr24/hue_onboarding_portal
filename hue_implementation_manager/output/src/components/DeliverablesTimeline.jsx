import { useRef, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth';
import { addDays, daysUntil, formatDisplayDate, monthStartsBetween } from '../utils/date';
import { dueLabel } from '../utils/deliverables';

const PADDING_DAYS = 10; // empty space at both ends of the axis
const CLUSTER_PX = 30; // markers closer than this (in pixels) are merged into one
const FLAG_COLLISION_PX = 90; // Today / Effective flags closer than this are pushed apart

// Worst status wins: an unfinished item matters more than a finished one.
const STATUS_RANK = { overdue: 3, 'due-soon': 2, upcoming: 1 };

function clusterStatus(items) {
  const open = items.filter((item) => !item.isComplete);
  if (open.length === 0) return 'complete';
  return open.reduce((worst, item) => (STATUS_RANK[item.status] > STATUS_RANK[worst] ? item.status : worst), 'upcoming');
}

function markerGlyph(status, count) {
  if (count > 1) return count;
  if (status === 'complete') return '✓';
  if (status === 'overdue') return '!';
  return '';
}

// "Jul 31, 2026" or, when a merged marker spans several dates, "Jul 27, 2026 – Jul 31, 2026"
function clusterDateLabel(items) {
  const first = items[0].dueDate;
  const last = items[items.length - 1].dueDate;
  return first === last ? formatDisplayDate(first) : `${formatDisplayDate(first)} – ${formatDisplayDate(last)}`;
}

function markerLabel(cluster) {
  const { items, status } = cluster;
  const date = clusterDateLabel(items);
  if (items.length === 1) return `${date}: ${items[0].name}. ${status === 'complete' ? 'Completed' : dueLabel(items[0].daysLeft)}.`;
  const open = items.filter((item) => !item.isComplete).length;
  return `${date}: ${items.length} deliverables, ${items.length - open} completed, ${open} open.`;
}

function monthLabel(iso, showYear) {
  const [year, month] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

function Legend() {
  return (
    <ul className="timeline-legend" aria-label="Timeline legend">
      <li><span className="legend-dot complete">✓</span>Complete</li>
      <li><span className="legend-dot overdue">!</span>Overdue</li>
      <li><span className="legend-dot due-soon" />Due within 7 days</li>
      <li><span className="legend-dot upcoming" />Upcoming</li>
      <li><span className="legend-line today" />Today</li>
      <li><span className="legend-line effective" />Effective date</li>
    </ul>
  );
}

export default function DeliverablesTimeline({ items, effectiveDate, today }) {
  const plotRef = useRef(null);
  const width = useElementWidth(plotRef);
  const [selectedKey, setSelectedKey] = useState(null);

  if (items.length === 0) return null;

  // Everything is positioned by "days from the effective date".
  const positioned = items.map((item) => ({ ...item, offset: daysUntil(item.dueDate, effectiveDate) }));
  const todayOffset = -daysUntil(effectiveDate, today);
  const offsets = positioned.map((item) => item.offset);
  const min = Math.min(0, todayOffset, ...offsets) - PADDING_DAYS;
  const max = Math.max(0, todayOffset, ...offsets) + PADDING_DAYS;
  const pctOf = (offset) => ((offset - min) / (max - min)) * 100;
  const pxOf = (offset) => (pctOf(offset) / 100) * width;

  // Merge markers that would overlap on screen so no deliverable is ever hidden behind another.
  const clusters = [];
  [...positioned]
    .sort((a, b) => a.offset - b.offset)
    .forEach((item) => {
      const last = clusters[clusters.length - 1];
      if (last && pxOf(item.offset) - pxOf(last.items[last.items.length - 1].offset) < CLUSTER_PX) {
        last.items.push(item);
      } else {
        clusters.push({ items: [item] });
      }
    });
  clusters.forEach((cluster) => {
    cluster.status = clusterStatus(cluster.items);
    cluster.pct = pctOf(cluster.items.reduce((sum, item) => sum + item.offset, 0) / cluster.items.length);
  });

  const selected = clusters.find((cluster) => cluster.items.some((item) => item.key === selectedKey));
  const spansDates = selected ? selected.items[0].dueDate !== selected.items[selected.items.length - 1].dueDate : false;

  const months = monthStartsBetween(addDays(effectiveDate, min), addDays(effectiveDate, max)).map((iso, index) => ({
    iso,
    pct: pctOf(daysUntil(iso, effectiveDate)),
    label: monthLabel(iso, index === 0 || iso.endsWith('-01-01')),
  }));

  const effectivePct = pctOf(0);
  const todayPct = pctOf(todayOffset);
  const flagsClose = Math.abs(todayPct - effectivePct) / 100 * width < FLAG_COLLISION_PX;
  const todayLeftOfEffective = todayPct < effectivePct;

  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-heading">
      <div className="panel-header">
        <h2 id="timeline-heading">Timeline</h2>
      </div>
      <Legend />

      <div className="timeline-plot" ref={plotRef}>
        <div className="timeline-band pre" style={{ left: 0, width: `${effectivePct}%` }}>
          <span>Before effective date</span>
        </div>
        <div className="timeline-band post" style={{ left: `${effectivePct}%`, right: 0 }}>
          <span>After effective date</span>
        </div>

        {months.map((month) => (
          <div key={month.iso} className="timeline-month" style={{ left: `${month.pct}%` }}>
            <span className="timeline-month-line" />
            <span className="timeline-month-label">{month.label}</span>
          </div>
        ))}

        <div className="timeline-line effective" style={{ left: `${effectivePct}%` }} />
        <div
          className={`timeline-flag effective${flagsClose ? (todayLeftOfEffective ? ' align-start' : ' align-end') : ''}`}
          style={{ left: `${effectivePct}%` }}
        >
          Effective
        </div>

        <div className="timeline-line today" style={{ left: `${todayPct}%` }} />
        <div
          className={`timeline-flag today${flagsClose ? (todayLeftOfEffective ? ' align-end' : ' align-start') : ''}`}
          style={{ left: `${todayPct}%` }}
        >
          Today
        </div>

        {clusters.map((cluster) => {
          const isSelected = cluster === selected;
          return (
            <button
              key={cluster.items[0].key}
              type="button"
              className={`timeline-marker ${cluster.status}${isSelected ? ' selected' : ''}`}
              style={{ left: `${cluster.pct}%` }}
              aria-label={markerLabel(cluster)}
              aria-pressed={isSelected}
              onClick={() => setSelectedKey(isSelected ? null : cluster.items[0].key)}
            >
              {markerGlyph(cluster.status, cluster.items.length)}
            </button>
          );
        })}
      </div>

      <div className="timeline-detail" aria-live="polite">
        {selected ? (
          <>
            <div className="timeline-detail-title">
              {clusterDateLabel(selected.items)}
              {selected.items.length > 1 && ` · ${selected.items.length} deliverables`}
            </div>
            <ul className="timeline-detail-list">
              {selected.items.map((item) => (
                <li key={item.key}>
                  <span className="timeline-detail-name">
                    {spansDates && <span className="timeline-detail-date">{formatDisplayDate(item.dueDate)}</span>}
                    {item.name}
                  </span>
                  <span className={`pill pill-${item.status}`}>{item.isComplete ? 'Completed' : dueLabel(item.daysLeft)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className="timeline-detail-hint">Select a marker to see what&rsquo;s due on that date.</span>
        )}
      </div>
    </section>
  );
}
