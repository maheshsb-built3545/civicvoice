/**
 * phoneHelper.js
 * -----------------------------------------------------------------------
 * Normalizes phone numbers to standard Indian format (+91XXXXXXXXXX).
 */

/**
 * Normalizes any variation of an Indian phone number to +91XXXXXXXXXX format.
 * - Strips all non-digit characters.
 * - Handles 10-digit formats (9876543210 -> +919876543210).
 * - Handles leading 0 formats (09876543210 -> +919876543210).
 * - Handles leading 91 or +91 formats.
 * @param {string|number} phone
 * @returns {string} Normalized phone number in +91XXXXXXXXXX format.
 */
function formatIndianPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, ''); // strip all non-digits
  
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return '+' + cleaned;
  }
  
  // If it's already structured or has some other length, try to format if it ends with 10 digits
  if (cleaned.length > 10) {
    const last10 = cleaned.slice(-10);
    return '+91' + last10;
  }

  // Fallback to original digits with + prefix if it doesn't match above rules
  const rawStr = String(phone).trim();
  return rawStr.startsWith('+') ? rawStr : '+' + rawStr;
}

module.exports = { formatIndianPhoneNumber };
