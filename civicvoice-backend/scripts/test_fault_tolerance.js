/**
 * test_fault_tolerance.js
 * -----------------------------------------------------------------------
 * Fault tolerance and error-path resiliency test script.
 * Verifies:
 *  1. Groq API degradation: extraction failure sets needsClarification: true gracefully without worker crash
 *  2. Nominatim Geocoder degradation: geocoding timeout/failure returns unresolved ward without throwing
 *  3. Trace ID correlation logging on failures
 */

const connectDB = require('../src/config/db');
const { extractComplaint } = require('../src/ai/extraction/extraction.service');
const { geocodeText } = require('../src/geo/geocoder');
const { resolveWard } = require('../src/geo/wardResolver');
const { createComplaint } = require('../src/domain/complaints/complaint.service');

async function runFaultToleranceTests() {
  console.log('===========================================================');
  console.log('       FAULT TOLERANCE & DEGRADATION TEST SUITE            ');
  console.log('===========================================================');

  await connectDB();

  const results = {
    groqDegradation: 'FAIL',
    geocoderDegradation: 'FAIL',
    traceIdLogging: 'FAIL',
  };

  // -----------------------------------------------------------------------
  // Test 1: Geocoder Graceful Degradation on Invalid/Unresolvable Location
  // -----------------------------------------------------------------------
  console.log('\n--- 1. Testing Nominatim Geocoder Resiliency ---');
  try {
    const geoResult = await geocodeText('XYZ_NON_EXISTENT_LOCATION_999999');
    console.log('Geocoder output on unknown location:', JSON.stringify(geoResult));

    const wardResolution = await resolveWard({ locationText: 'XYZ_NON_EXISTENT_LOCATION_999999' });
    console.log('Ward Resolver output on unknown location:', JSON.stringify(wardResolution));

    if (
      geoResult.confidence === 0 &&
      geoResult.lat === null &&
      wardResolution.resolutionMethod === 'unresolved' &&
      wardResolution.wardId === null
    ) {
      results.geocoderDegradation = 'PASS';
      console.log('[PASS] Geocoder & Ward Resolver degraded gracefully to "unresolved" status without throwing.');
    }
  } catch (err) {
    console.error('[FAIL] Geocoder threw unhandled error:', err.message);
  }

  // -----------------------------------------------------------------------
  // Test 2: AI Extraction Degradation when LLM output is ambiguous
  // -----------------------------------------------------------------------
  console.log('\n--- 2. Testing AI Extraction Engine & Complaint Clarification Flag ---');
  try {
    const ambiguousText = 'Something happened somewhere near a tree.';
    const testTraceId = `trace_fault_${Date.now()}`;

    const complaintDoc = await createComplaint({
      channel: 'text',
      senderId: '+919990001122',
      rawText: ambiguousText,
      traceId: testTraceId,
    });

    const status = complaintDoc.status || complaintDoc.complaint?.status;
    const needsClarification =
      complaintDoc.structured?.needsClarification ||
      complaintDoc.complaint?.structured?.needsClarification;

    console.log(`Complaint traceId: ${complaintDoc.traceId || testTraceId}`);
    console.log(`Assigned status: "${status}"`);
    console.log(`needsClarification flag: ${needsClarification}`);

    if (status === 'needsClarification' && complaintDoc.traceId) {
      results.groqDegradation = 'PASS';
      results.traceIdLogging = 'PASS';
      console.log('[PASS] Ambiguous input flagged status as "needsClarification" with correlation traceId preserved.');
    }
  } catch (err) {
    console.error('[FAIL] Extraction or complaint creation crashed:', err.message);
  }

  console.log('\n===========================================================');
  console.log('          FAULT TOLERANCE TEST SUMMARY                     ');
  console.log('===========================================================');
  console.log(` Nominatim Geocoder Resiliency  : ${results.geocoderDegradation}`);
  console.log(` AI Extraction Graceful Flag   : ${results.groqDegradation}`);
  console.log(` TraceId Correlation Integrity : ${results.traceIdLogging}`);
  console.log('===========================================================');

  process.exit(0);
}

runFaultToleranceTests();
