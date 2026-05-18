<?php

namespace App\Console\Commands;

use App\Mail\BreachNotificationMail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Dispatch HM-BR-2026-001 breach notifications.
 *
 * Usage:
 *   php artisan breach:notify --role=patient            # PRODUCTION send
 *   php artisan breach:notify --role=patient --dry-run  # Preview only
 *   php artisan breach:notify --role=practitioner       # Practitioner side
 *   php artisan breach:notify --role=patient --only=42  # Single user (testing)
 *
 * Behaviour:
 *   - Refuses to run unless en/zh lang files for the relevant kind
 *     have identical key sets (catches translation drift before it ships).
 *   - Idempotent via uq_notification_per_user — re-runs skip already-sent
 *     rows rather than double-sending.
 *   - Writes one row to notification_dispatch_log per recipient with the
 *     SHA-256 digest of the rendered body + subject line, the Resend
 *     message-id (if available), the OS user that ran the command, and
 *     the recipient email captured at send time.
 *   - Excludes internal accounts (admin@hansmed.com, pharma@hansmed.com,
 *     audit-dr-*@test.com) on the same basis as the s.12B Q13 count.
 */
class DispatchBreachNotification extends Command
{
    protected $signature = 'breach:notify
                            {--role= : patient|practitioner — required}
                            {--dry-run : list recipients, render one preview, do not send}
                            {--only= : single user_id, for testing}
                            {--kind= : override notification_kind (default derives from role)}';

    protected $description = 'Dispatch HM-BR-2026-001 breach notification to affected data subjects';

    /**
     * Hard-coded exclude list — mirrors the Annex B Q13 affected-subjects
     * scoping. These are HansMed-controlled internal accounts.
     */
    private const EXCLUDE_EMAILS = [
        'admin@hansmed.com',
        'pharma@hansmed.com',
    ];
    private const EXCLUDE_LIKE = 'audit-dr-%@test.com';

    public function handle(): int
    {
        $role = $this->option('role');
        if (!in_array($role, ['patient', 'practitioner'], true)) {
            $this->error('--role is required and must be one of: patient, practitioner');
            return self::FAILURE;
        }

        $kind = $this->option('kind')
              ?: 'breach:HM-BR-2026-001:' . $role;

        $langFile = $role === 'patient'
            ? 'breach_notification'
            : 'breach_notification_practitioner';

        // ── 1. Key-parity check between en and zh lang files ──
        if (!$this->verifyLangFileParity($langFile)) {
            return self::FAILURE;
        }

        // ── 2. Build recipient query ──
        $query = User::query()
            ->whereNotIn('email', self::EXCLUDE_EMAILS)
            ->where('email', 'not like', self::EXCLUDE_LIKE);

        if ($role === 'patient') {
            $query->where('role', User::ROLE_PATIENT);
        } else {
            $query->whereIn('role', ['doctor', 'pharmacy']);
        }

        if ($only = $this->option('only')) {
            $query->where('id', (int) $only);
        }

        $recipients = $query->get();
        $this->info(sprintf('Recipients: %d', $recipients->count()));

        if ($recipients->isEmpty()) {
            $this->warn('No recipients matched. Nothing to do.');
            return self::SUCCESS;
        }

        // ── 3. Dispatch (or dry-run) ──
        $resetUrl     = config('app.url') . '/#/login/forgot';
        $privacyEmail = 'privacy@hansmedtcm.com';

        $sent      = 0;
        $skipped   = 0;
        $failed    = 0;
        // Web context — null in CLI. OS user — populated whether web or CLI.
        $triggerWebId = optional(auth()->user())->id;
        $triggerOsUser = $this->captureOsUser();

        foreach ($recipients as $user) {
            // Idempotency check
            $already = DB::table('notification_dispatch_log')
                ->where('notification_kind', $kind)
                ->where('user_id', $user->id)
                ->where('status', 'sent')
                ->exists();

            if ($already) {
                $skipped++;
                continue;
            }

            // Build the Mailable (used for both render-preview and send)
            $mailable = $role === 'patient'
                ? new BreachNotificationMail($user, $resetUrl, $privacyEmail)
                : new \App\Mail\BreachNotificationPractitionerMail($user, $privacyEmail);

            // Dry-run: render once for the first recipient and stop early
            if ($this->option('dry-run')) {
                $rendered = $mailable->render();
                $this->info('---- DRY RUN PREVIEW (' . $user->email . ') ----');
                $this->line(substr(strip_tags($rendered), 0, 800) . '...');
                $this->info('---- END PREVIEW ----');
                $this->info('Would send to ' . $recipients->count() . ' recipients. No mail sent. No log rows written.');
                return self::SUCCESS;
            }

            // Real send + log
            try {
                $rendered = $mailable->render();
                $subject  = $mailable->envelope()->subject;
                // SHA-256 of subject + body. Including the subject in the
                // hash answers the auditor's "prove the subject we sent
                // matches counsel's wording" question, which the body
                // alone cannot.
                $digest = hash('sha256', $subject . "\n" . $rendered);

                $sentMessage = Mail::to($user->email)->send($mailable);

                // Capture mailer message-id when available. Laravel's
                // Mail::send() returns a SentMessage wrapping a Symfony
                // SentMessage. For Resend (the configured driver per
                // composer.json) this includes the Resend message-id
                // in the response headers.
                $messageId = $this->extractMessageId($sentMessage);

                DB::table('notification_dispatch_log')->insert([
                    'notification_kind'       => $kind,
                    'user_id'                 => $user->id,
                    'recipient_email_at_send' => $user->email,
                    'status'                  => 'sent',
                    'locale'                  => 'en',  // bilingual stacked; EN canonical
                    'mailer_message_id'       => $messageId,
                    'dispatched_at'           => now(),
                    'payload_digest'          => $digest,
                    'triggered_by_user_id'    => $triggerWebId,
                    'triggered_by_os_user'    => $triggerOsUser,
                    'triggered_via'           => 'artisan',
                    'created_at'              => now(),
                    'updated_at'              => now(),
                ]);
                $sent++;
                $this->line(sprintf('  sent: %s%s', $user->email, $messageId ? " (mid=$messageId)" : ''));
            } catch (Throwable $e) {
                $failed++;
                DB::table('notification_dispatch_log')->insert([
                    'notification_kind'       => $kind,
                    'user_id'                 => $user->id,
                    'recipient_email_at_send' => $user->email,
                    'status'                  => 'failed',
                    'failure_reason'          => substr($e->getMessage(), 0, 1000),
                    'triggered_by_user_id'    => $triggerWebId,
                    'triggered_by_os_user'    => $triggerOsUser,
                    'triggered_via'           => 'artisan',
                    'created_at'              => now(),
                    'updated_at'              => now(),
                ]);
                Log::error('breach:notify dispatch failed', [
                    'user_id' => $user->id,
                    'error'   => $e->getMessage(),
                ]);
                $this->error(sprintf('  FAILED: %s — %s', $user->email, $e->getMessage()));
            }
        }

        $this->newLine();
        $this->info(sprintf('Summary: sent=%d skipped(already-sent)=%d failed=%d', $sent, $skipped, $failed));
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Refuse to dispatch if en/zh files for $langFile disagree on key set.
     * Translation drift between EN and ZH is the most common pre-dispatch bug.
     *
     * Simplified vs original: the original had early `trans()`-based guards
     * that didn't actually catch missing zh keys (Laravel falls back to en
     * silently), so they gave false confidence. The array_diff against
     * the file contents is the real check.
     */
    private function verifyLangFileParity(string $langFile): bool
    {
        $enFile = base_path('lang/en/' . $langFile . '.php');
        $zhFile = base_path('lang/zh/' . $langFile . '.php');

        if (!file_exists($enFile)) {
            $this->error("lang/en/{$langFile}.php missing");
            return false;
        }
        if (!file_exists($zhFile)) {
            $this->error("lang/zh/{$langFile}.php missing");
            return false;
        }

        $enKeys = array_keys(require $enFile);
        $zhKeys = array_keys(require $zhFile);
        sort($enKeys); sort($zhKeys);

        $missingInZh = array_diff($enKeys, $zhKeys);
        $missingInEn = array_diff($zhKeys, $enKeys);

        if (!empty($missingInZh) || !empty($missingInEn)) {
            $this->error('Lang file key drift detected — refusing to dispatch.');
            if (!empty($missingInZh)) {
                $this->error('  Missing in zh/: ' . implode(', ', $missingInZh));
            }
            if (!empty($missingInEn)) {
                $this->error('  Missing in en/: ' . implode(', ', $missingInEn));
            }
            return false;
        }

        $this->info(sprintf('Lang parity OK: %d keys across en/zh', count($enKeys)));
        return true;
    }

    /**
     * Capture the OS user that owns the PHP process running this command.
     * For Railway deploys this'll be the container user (typically 'www-data'
     * or similar); for local dev it's the developer's username. Either is
     * meaningful audit data for "who ran the dispatch" — which auth()->user()
     * cannot answer in CLI context.
     */
    private function captureOsUser(): ?string
    {
        // get_current_user() is the cleanest cross-platform option. May
        // return false on some restricted environments; treat null as fine.
        $os = @get_current_user();
        if ($os === false || $os === '') {
            // Fallback to environment variables (set on most Linux systems
            // and on Windows). Returns whichever is set first.
            $os = $_SERVER['USER'] ?? $_SERVER['USERNAME'] ?? null;
        }
        return $os ? substr((string) $os, 0, 64) : null;
    }

    /**
     * Pull the mailer's message-id from a SentMessage instance when present.
     * For Resend this is the Resend-assigned id; for other drivers it's the
     * RFC-822 Message-ID header. Returns null when unavailable (some drivers
     * — array, log — don't issue one).
     */
    private function extractMessageId($sentMessage): ?string
    {
        if ($sentMessage === null) {
            return null;
        }

        try {
            // Laravel's PendingMail::send() returns Illuminate\Mail\SentMessage
            // which wraps Symfony\Component\Mailer\SentMessage. The Symfony
            // SentMessage exposes getMessageId() on getOriginalMessage() but
            // the cleaner accessor is on the wrapper itself.
            if (method_exists($sentMessage, 'getMessageId')) {
                return $sentMessage->getMessageId();
            }
            if (method_exists($sentMessage, 'getSymfonySentMessage')) {
                $sym = $sentMessage->getSymfonySentMessage();
                if ($sym && method_exists($sym, 'getMessageId')) {
                    return $sym->getMessageId();
                }
            }
        } catch (Throwable $e) {
            // Best-effort; never let message-id capture failure interrupt
            // the dispatch path. Log for later diagnosis.
            Log::info('breach:notify could not capture message-id', [
                'error' => $e->getMessage(),
            ]);
        }
        return null;
    }
}
