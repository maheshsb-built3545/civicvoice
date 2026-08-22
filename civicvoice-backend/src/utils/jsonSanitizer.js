/**
 * jsonSanitizer.js
 * -----------------------------------------------------------------------
 * Robust utility to parse JSON strings returned by LLMs. Handles markdown
 * code blocks, leading/trailing text, and extracts the outermost JSON object.
 */

/**
 * Strips markdown code blocks, backticks, leading/trailing whitespace,
 * and extracts the outermost valid JSON object { ... }.
 * @param {string} str - Raw string output from LLM
 * @returns {object} Parsed JSON object
 */
function cleanAndParseJSON(str) {
  if (typeof str !== 'string') {
    throw new Error('Input must be a string');
  }

  let cleanStr = str.trim();

  // Strip Markdown JSON code block syntax (e.g. ```json ... ``` or ``` ... ```)
  cleanStr = cleanStr.replace(/^```(?:json)?\s*/i, '');
  cleanStr = cleanStr.replace(/\s*```$/, '');
  cleanStr = cleanStr.trim();

  // Try parsing directly first
  try {
    return JSON.parse(cleanStr);
  } catch (initialErr) {
    // If direct parse fails, try to extract the outermost valid JSON object
    const startIdx = cleanStr.indexOf('{');
    const endIdx = cleanStr.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const extracted = cleanStr.substring(startIdx, endIdx + 1);
      try {
        return JSON.parse(extracted);
      } catch (nestedErr) {
        throw new Error(`Failed to parse extracted JSON block: ${nestedErr.message}. Original content: ${str}`);
      }
    }
    throw new Error(`Failed to parse JSON (no matching braces found): ${initialErr.message}. Original content: ${str}`);
  }
}

module.exports = { cleanAndParseJSON };
