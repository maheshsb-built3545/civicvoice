const {
  getCitizenAckMessage,
  getCitizenStatusChangeMessage
} = require('../src/notifications/templates/complaintTemplates');

const mockComplaint = {
  _id: '607f1f77bcf86cd799439001',
  status: 'received',
  rawText: 'Heavy water pipeline leakage near Central Park main gate, Central Zone Ward 10 since morning.',
  structured: {
    category: 'water_supply',
    description: 'Heavy water pipeline leakage near Central Park main gate overflowing onto streets.',
    language: 'en'
  }
};

console.log('=== TEST 1: COMPLAINT CREATION ACKNOWLEDGEMENT ===');
const ackMsg = getCitizenAckMessage(mockComplaint);
console.log(ackMsg);
console.log('\n==================================================\n');

console.log('=== TEST 2: COMPLAINT STATUS UPDATE (IN PROGRESS) ===');
mockComplaint.status = 'in_progress';
const progressMsg = getCitizenStatusChangeMessage(mockComplaint);
console.log(progressMsg);
console.log('\n==================================================\n');

console.log('=== TEST 3: COMPLAINT STATUS UPDATE (RESOLVED) ===');
mockComplaint.status = 'resolved';
const resolvedMsg = getCitizenStatusChangeMessage(mockComplaint);
console.log(resolvedMsg);
console.log('\n==================================================\n');
