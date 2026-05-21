/**
 * Phone number utilities — international format support.
 *
 * Rules (per brief):
 *   - Accept any phone: min 7, max 15 digits
 *   - Allow +, spaces, dashes — stored exactly as entered
 *   - No Nigeria-specific validation on forms
 *   - WhatsApp normalization handled separately (edge functions)
 */

/** Returns true if the phone number has 7–15 digits (international-safe) */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-\(\)+]/g, '');
  return digits.length >= 7 && digits.length <= 15 && /^\d+$/.test(digits);
}

/**
 * Normalizes any phone number to plain digits for the Evolution API (WhatsApp).
 * Rules:
 *   +...    → strip leading +, use digits as-is
 *   00...   → strip 00, use rest as-is
 *   0...    → replace 0 with 234 (Nigeria local fallback)
 *   other   → use as-is
 */
export function normalizeForWhatsApp(raw: string): string {
  let phone = raw.replace(/[\s\-\(\)]/g, '');      // strip spaces/dashes/brackets
  if (phone.startsWith('+'))   phone = phone.slice(1);          // +234... → 234...
  if (phone.startsWith('00'))  phone = phone.slice(2);          // 00234... → 234...
  else if (phone.startsWith('0')) phone = '234' + phone.slice(1); // 0701... → 234701...
  return phone;
}

// ── Legacy exports (kept for backward compatibility) ──────────────────────────

/** @deprecated Use isValidPhone — accepts any international number */
export const isValidNigerianPhone = isValidPhone;

/** @deprecated Use normalizeForWhatsApp — returns plain digits */
export function formatNigerianPhone(phone: string): string {
  return `+${normalizeForWhatsApp(phone)}`;
}
