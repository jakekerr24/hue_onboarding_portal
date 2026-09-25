import { computeDueDate } from '../data';
import { daysUntil } from './date';

// Notes in the data start with an emoji: 🔴 = blocking alert, ⚠️ = informational note.
export function parseAlert(note) {
  if (!note) return null;
  if (note.startsWith('🔴')) {
    return { level: 'blocking', text: note.replace(/^🔴\s*(Alert:\s*)?/, '') };
  }
  if (note.startsWith('⚠️') || note.startsWith('Note:')) {
    return { level: 'info', text: note.replace(/^⚠️\s*/, '').replace(/^Note:\s*/, '') };
  }
  return null;
}

export const DUE_SOON_DAYS = 7;

export function pluralDays(count) {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

// "Overdue by 3 days" / "Due today" / "Due in 5 days"
export function dueLabel(daysLeft) {
  if (daysLeft < 0) return `Overdue by ${pluralDays(Math.abs(daysLeft))}`;
  if (daysLeft === 0) return 'Due today';
  return `Due in ${pluralDays(daysLeft)}`;
}

// complete | overdue | due-soon | upcoming
export function getStatus(isComplete, daysLeft) {
  if (isComplete) return 'complete';
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= DUE_SOON_DAYS) return 'due-soon';
  return 'upcoming';
}

// Flat list of every deliverable with its due date, days left and status.
// Deliverables without a computable due date are skipped, matching the timeline.
export function buildDeliverables({ effectiveDate, pre, post, completed, today = new Date() }) {
  return [
    ...pre.map((item, index) => ({ ...item, group: 'pre', index })),
    ...post.map((item, index) => ({ ...item, group: 'post', index })),
  ]
    .map((item) => {
      const dueDate = computeDueDate(effectiveDate, item.rule);
      if (!dueDate) return null;
      // The real client_deliverables row id -- stable across renames, reorders, and unrelated
      // deletes, unlike the old phase-index-name derived key.
      const key = item.id;
      const isComplete = Boolean(completed[key]);
      const daysLeft = daysUntil(dueDate, today);
      return {
        ...item,
        key,
        dueDate,
        daysLeft,
        isComplete,
        status: getStatus(isComplete, daysLeft),
        alert: parseAlert(item.note),
      };
    })
    .filter(Boolean);
}
