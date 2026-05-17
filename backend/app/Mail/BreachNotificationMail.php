<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Patient breach notification — bilingual (EN canonical · ZH appended).
 *
 * Part of the HM-BR-2026-001 dispatch infrastructure. Dispatched by
 * `php artisan breach:notify --role=patient` (see DispatchBreachNotification).
 *
 * Subject line is bilingual stacked, mirroring the body. The view renders
 * English first then 繁體中文 in a single email — matches the platform's
 * existing privacy-policy.html and portal.html pattern.
 *
 * This Mailable is intentionally lean: it carries the patient User
 * instance and two static config strings. Dispatch logging happens
 * outside this class (in DispatchBreachNotification) so the Mailable
 * remains testable in isolation.
 */
class BreachNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public User $patient;
    public string $resetUrl;
    public string $privacyEmail;

    public function __construct(User $patient, string $resetUrl, string $privacyEmail)
    {
        $this->patient      = $patient;
        $this->resetUrl     = $resetUrl;
        $this->privacyEmail = $privacyEmail;
    }

    public function envelope(): Envelope
    {
        // Subject is bilingual stacked (English · 中文) — most mail clients
        // render Unicode subject lines correctly and the bilingual form
        // matches the body convention.
        $en = __('breach_notification.subject', [], 'en');
        $zh = __('breach_notification.subject', [], 'zh');

        return new Envelope(
            subject: $en . ' · ' . $zh,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.breach_notification',
            with: [
                'patient'      => $this->patient,
                'resetUrl'     => $this->resetUrl,
                'privacyEmail' => $this->privacyEmail,
            ],
        );
    }
}
