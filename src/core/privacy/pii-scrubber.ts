/**
 * PII scrubber for strict work-privacy mode.
 *
 * When privacy mode is enabled, all outbound text sent to LLM providers
 * gets PII stripped so sensitive data never leaves the browser.
 */

import { loadRouterSettings } from '../storage/local-cache';

// ── PII patterns ──

interface PIIPattern {
  regex: RegExp;
  replacement: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    // Email addresses
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    // US Social Security Numbers: 123-45-6789 or 123456789
    regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    replacement: '[REDACTED_SSN]',
  },
  {
    // Credit card numbers (13-19 digits, with optional dashes/spaces)
    regex: /\b(?:\d[ \-]*?){13,19}\b/g,
    replacement: '[REDACTED_CC]',
  },
  {
    // US/International phone numbers
    regex:
      /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    // IPv4 addresses
    regex:
      /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replacement: '[REDACTED_IP]',
  },
];

/**
 * Strip PII from text using regex patterns.
 * Returns the scrubbed text with redaction markers.
 */
export function scrubPII(text: string): string {
  let result = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Check whether strict work-privacy mode is enabled in router settings.
 */
export async function isPrivacyModeEnabled(): Promise<boolean> {
  try {
    const settings = await loadRouterSettings();
    return settings.strictWorkPrivacyMode;
  } catch {
    // Default to safe — privacy ON if we can't read settings
    return true;
  }
}
