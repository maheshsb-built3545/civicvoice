const test = require('node:test');
const assert = require('node:assert/strict');

const complaintService = require('../src/domain/complaints/complaint.service');
const officerPortalService = require('../src/domain/officers/officer-portal.service');
const Complaint = require('../src/models/Complaint');
const Officer = require('../src/models/Officer');
const { COMPLAINT_STATUS } = require('../src/domain/complaints/complaint.state');

test('updates complaint status and lifecycle log for admins', async () => {
  const originalFindById = Complaint.findById;
  let saveCalled = false;
  let savedStatus = null;
  let savedLifecycleLog = null;

  try {
    Complaint.findById = async () => ({
      _id: 'complaint-1',
      status: COMPLAINT_STATUS.RECEIVED,
      lifecycleLog: [],
      save: async function() {
        saveCalled = true;
        savedStatus = this.status;
        savedLifecycleLog = this.lifecycleLog;
        return this;
      }
    });

    const result = await complaintService.updateComplaintStatus(
      'complaint-1',
      COMPLAINT_STATUS.IN_PROGRESS,
      'admin-1',
      'Working on it'
    );

    assert.ok(saveCalled);
    assert.equal(savedStatus, COMPLAINT_STATUS.IN_PROGRESS);
    assert.equal(savedLifecycleLog[0].note, 'Working on it');
    assert.equal(savedLifecycleLog[0].stage, COMPLAINT_STATUS.IN_PROGRESS);
    assert.equal(savedLifecycleLog[0].actorId, 'admin-1');
  } finally {
    Complaint.findById = originalFindById;
  }
});

test('permits assigned officer to update status', async () => {
  const originalFindById = Complaint.findById;
  const originalOfficerFindOne = Officer.findOne;
  let saveCalled = false;

  try {
    Complaint.findById = async () => ({
      _id: 'complaint-1',
      assignedOfficerId: 'officer-mongodb-id',
      status: COMPLAINT_STATUS.ASSIGNED,
      lifecycleLog: [],
      save: async function() {
        saveCalled = true;
        return this;
      }
    });

    Officer.findOne = async () => ({
      _id: 'officer-mongodb-id',
      officerId: 'officer-1'
    });

    const result = await officerPortalService.updateAssignedComplaintStatus({
      officerId: 'officer-1',
      complaintId: 'complaint-1',
      status: COMPLAINT_STATUS.IN_PROGRESS,
      note: 'Working on it'
    });

    assert.ok(saveCalled);
    assert.equal(result.status, COMPLAINT_STATUS.IN_PROGRESS);
  } finally {
    Complaint.findById = originalFindById;
    Officer.findOne = originalOfficerFindOne;
  }
});

test('rejects officer not assigned to the complaint', async () => {
  const originalFindById = Complaint.findById;
  const originalOfficerFindOne = Officer.findOne;

  try {
    Complaint.findById = async () => ({
      _id: 'complaint-1',
      assignedOfficerId: 'other-officer-id',
      status: COMPLAINT_STATUS.ASSIGNED,
      lifecycleLog: []
    });

    Officer.findOne = async () => ({
      _id: 'officer-mongodb-id',
      officerId: 'officer-1'
    });

    await assert.rejects(
      officerPortalService.updateAssignedComplaintStatus({
        officerId: 'officer-1',
        complaintId: 'complaint-1',
        status: COMPLAINT_STATUS.IN_PROGRESS,
        note: 'Working on it'
      }),
      (error) => error.code === 'FORBIDDEN' && error.statusCode === 403
    );
  } finally {
    Complaint.findById = originalFindById;
    Officer.findOne = originalOfficerFindOne;
  }
});

test('rejects statuses outside the public status-update contract', async () => {
  const originalFindById = Complaint.findById;

  try {
    Complaint.findById = async () => ({
      _id: 'complaint-1',
      status: COMPLAINT_STATUS.CLOSED,
      lifecycleLog: []
    });

    await assert.rejects(
      complaintService.updateComplaintStatus(
        'complaint-1',
        COMPLAINT_STATUS.IN_PROGRESS,
        'admin-1'
      ),
      (error) => error.code === 'INVALID_TRANSITION' && error.statusCode === 400
    );
  } finally {
    Complaint.findById = originalFindById;
  }
});
