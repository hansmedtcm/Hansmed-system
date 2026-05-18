<?php

namespace App\Support;

/**
 * PhiScrubber — strip Malaysian PHI patterns from error log payloads
 * before they're stored or surfaced to the in-house IT agent.
 *
 * Why this exists: the error monitoring system (POST /api/errors and
 * the report() callback in bootstrap/app.php) captures arbitrary
 * exception messages, stack traces, and URLs. Those fields can
 * incidentally include PHI — e.g.:
 *   • "Duplicate entry '950101-14-5678' for key 'users_ic_number_unique'"
 *     (a Malaysian NRIC in a SQL collision message)
 *   • "TypeError: Cannot read property 'ic_number' of undefined at
 *     https://hansmedtcm.com/patient/12345/medical-history"
 *     (a patient ID in the URL)
 *   • Validation errors that echo back the email or phone field value
 *
 * Under PDPA, personal data must only be processed for the original
 * purpose. Error logs are a SECONDARY purpose — they're a forensic
 * tool, not consented to by the user. So we strip the patterns we
 * know are personal before storage.
 *
 * Patterns scrubbed (Malaysian-specific):
 *   • NRIC          12-digit with dashes: `\d{6}-\d{2}-\d{4}` → [NRIC]
 *   • Email         simple RFC-5322-ish     → [EMAIL]
 *   • MY phone      +60 or 0-prefix mobile  → [PHONE]
 *
 * What we DON'T scrub (intentionally, because false positives are
 * worse than the leak risk in error context):
 *   • Names (Latin or CJK) — no reliable regex
 *   • Addresses — would scrub too aggressively
 *   • Medical conditions / allergies — language-specific, dictionary
 *     would need maintenance
 *
 * Same threat model applies regardless of who consumes the error log
 * (admin dashboard vs in-house IT agent). The scrubber runs at the
 * INGEST and the REPORT step so the storage itself is clean.
 */
class PhiScrubber
{
    /** Malaysian NRIC: YYMMDD-PB-####. Two letters with dashes. */
    private const NRIC_PATTERN = '/\b\d{6}-\d{2}-\d{4}\b/';

    /** Simplified email regex — catches common shapes, not RFC-strict. */
    private const EMAIL_PATTERN = '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/';

    /**
     * Malaysian mobile phone numbers:
     *   +60 12 345 6789    (international)
     *   012-345 6789       (local)
     *   01x-xxxxxxx        (with or without space/dash)
     * Mobile prefix is 01[0-9]. Land lines (03-, 04-, etc.) are less
     * personal-identifying and we don't scrub them — too many false
     * positives with random 9-10 digit numbers in stack traces.
     */
    private const PHONE_PATTERN = '/(?:\+?60|0)1\d[\s-]?\d{3}[\s-]?\d{4}/';

    /**
     * Strip PHI patterns from a string. Safe to call on null/empty.
     * Returns the input unchanged if no patterns match.
     */
    public static function scrub(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return $text;
        }

        $text = preg_replace(self::NRIC_PATTERN,  '[NRIC]',  $text);
        $text = preg_replace(self::EMAIL_PATTERN, '[EMAIL]', $text);
        $text = preg_replace(self::PHONE_PATTERN, '[PHONE]', $text);

        return $text;
    }
}
