/**
 * complaint.state.js
 * -----------------------------------------------------------------------
 * Status constants and state machine transition rules for complaints.
 */

const COMPLAINT_STATUS = {
  RECEIVED: 'received',
  PROCESSING: 'processing',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected',
  NEEDS_CLARIFICATION: 'needsClarification',
  UNASSIGNED_WARD: 'unassigned_ward',
};

const ALLOWED_STATUS_TRANSITIONS = {
  received: ['processing', 'assigned', 'needsClarification', 'rejected', 'in_progress', 'resolved', 'closed'],
  processing: ['assigned', 'needsClarification', 'rejected', 'in_progress', 'resolved', 'closed'],
  needsClarification: ['received', 'processing', 'assigned', 'rejected', 'in_progress', 'resolved', 'closed'],
  unassigned_ward: ['received', 'assigned', 'needsClarification', 'rejected', 'in_progress', 'resolved', 'closed'],
  assigned: ['in_progress', 'resolved', 'rejected', 'needsClarification', 'closed'],
  in_progress: ['resolved', 'assigned', 'rejected', 'needsClarification', 'closed'],
  resolved: ['closed', 'in_progress', 'assigned', 'received'],
  closed: [], // Terminal state
  rejected: [], // Terminal state
};

/**
 * Validates whether transitioning from currentStatus to newStatus is allowed by state machine.
 * Case-insensitive key lookup ensures status strings like 'needsClarification' match correctly.
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {boolean}
 */
function isValidStatusTransition(currentStatus, newStatus) {
  if (!currentStatus || !newStatus) return false;
  const currentRaw = currentStatus.toString().trim();
  const nextRaw = newStatus.toString().trim();

  if (currentRaw.toLowerCase() === nextRaw.toLowerCase()) return true;

  // Case-insensitive key lookup against ALLOWED_STATUS_TRANSITIONS
  const matchingKey = Object.keys(ALLOWED_STATUS_TRANSITIONS).find(
    (key) => key.toLowerCase() === currentRaw.toLowerCase()
  );

  if (!matchingKey) return false;

  const allowed = ALLOWED_STATUS_TRANSITIONS[matchingKey] || [];
  return allowed.some((s) => s.toLowerCase() === nextRaw.toLowerCase());
}

module.exports = {
  COMPLAINT_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
  isValidStatusTransition,
};
