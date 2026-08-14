/**
 * test_extraction.js
 * -----------------------------------------------------------------------
 * Test script for AI Extraction Engine module.
 * Calls extractComplaint() with 3 sample transcripts:
 *   1. Clear complaint (both category and location clear)
 *   2. Ambiguous-category complaint (category unclear -> needsClarification: true)
 *   3. No location mentioned complaint (location missing -> needsClarification: true)
 */

const { extractComplaint } = require('../src/ai/extraction/extraction.service');

const sampleTranscripts = [
  {
    name: 'Sample 1: Clear Complaint (Category & Location Clear)',
    transcript: 'There is a massive water pipe leakage near Central Park main gate, Central Zone Ward 10 since 8 AM today. Water is overflowing onto the street.',
    metadata: { channel: 'whatsapp', senderId: '+919876543210' },
  },
  {
    name: 'Sample 2: Ambiguous-Category Complaint (Unclear Issue)',
    transcript: 'Things are very terrible and noisy around here lately, people are complaining and something needs to be done about this bad situation.',
    metadata: { channel: 'text', senderId: '+919111222333' },
  },
  {
    name: 'Sample 3: No Location Mentioned (Missing Location)',
    transcript: 'The streetlights have not been working for the past 3 days and the whole street is pitch black at night.',
    metadata: { channel: 'whatsapp', senderId: '+919444555666' },
  },
];

async function runExtractionTest() {
  console.log('===========================================================');
  console.log('         CIVICVOICE AI EXTRACTION MODULE TEST             ');
  console.log('===========================================================');

  for (let i = 0; i < sampleTranscripts.length; i++) {
    const sample = sampleTranscripts[i];
    console.log(`\n--- Test Case ${i + 1}: ${sample.name} ---`);
    console.log(`Input Transcript: "${sample.transcript}"`);

    try {
      const result = await extractComplaint(sample.transcript, sample.metadata);

      console.log('\nResult Output:');
      console.log(JSON.stringify({
        structuredComplaint: result.structuredComplaint,
        needsClarification: result.needsClarification,
        rawModelResponseModel: result.rawModelResponse?.model || 'llama-3.3-70b-versatile',
      }, null, 2));

    } catch (err) {
      console.error(`Extraction failed: ${err.message}`, err);
    }
  }

  console.log('\n===========================================================');
  console.log('                  EXTRACTION TEST COMPLETE                 ');
  console.log('===========================================================');
}

runExtractionTest();
