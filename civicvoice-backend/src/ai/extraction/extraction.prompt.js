/**
 * extraction.prompt.js
 * -----------------------------------------------------------------------
 * Prompt generator for structured civic complaint extraction via Tool Calling / Structured Output.
 */

const { URGENCY_LEVELS } = require('./extraction.schema');

function buildSystemPrompt() {
  return `You are an AI civic complaint extraction system for a municipality.
Your task is to analyze raw citizen messages or transcripts (which may be in English, Hindi, Marathi, Kannada, or code-mixed) and invoke the 'extract_complaint' tool with structured data.

CRITICAL RULES FOR UNCERTAINTY & CLARIFICATION:
1. Do NOT force low-confidence guesses. If you are uncertain about EITHER the civic 'category' OR the 'locationMentioned', you MUST set "needsClarification": true.
2. If location is NOT explicitly mentioned or is too vague (e.g., "my area", "here", "near home"), set "locationMentioned": null and "needsClarification": true.
3. If the complaint issue/category is ambiguous or unclear, set "category": "general" and "needsClarification": true.
4. Set "needsClarification": false ONLY when BOTH a clear civic category AND a specific location/landmark/street are present in the text with high confidence.
5. The 'description' field MUST always be a concise 1-2 sentence summary in English regardless of input language.
6. 'urgency' MUST be one of: ${URGENCY_LEVELS.join(', ')}.`;
}

function buildUserPrompt(rawText, metadata = {}) {
  const metadataContext = metadata && Object.keys(metadata).length > 0
    ? `\nMetadata Context: ${JSON.stringify(metadata)}`
    : '';

  return `Extract structured complaint information by invoking the 'extract_complaint' tool for the following citizen input:\n${metadataContext}\n\n"""${rawText}"""`;
}

module.exports = { buildSystemPrompt, buildUserPrompt };
