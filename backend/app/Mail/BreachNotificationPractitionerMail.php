<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Practitioner breach notification — bilingual (EN canonical · ZH appended).
 *
 * Counterpart to BreachNotificationMail. Sent to users with role='doctor' or
 * role='pharmacy' (the practitioner-side of the platform). Includes additional
 * sections that the patient version does not — specifically the practitioner's
 * independent T&CM Act / T&CM Council reporting obligations and the offer to
 * compile a detailed practitioner-specific scope account on request.
 *
 * Dispatched by `php artisan breach:notify --role=practitioner`.
 */
class BreachNotificationPractitionerMail extends Mailable
{
    use Queueable, SerializesModels;

    public User $practitioner;
    public string $privacyEmail;

    public function __construct(User $practitioner, string $privacyEmail)
    {
        $this->practitioner = $practitioner;
        $this->privacyEmail = $privacyEmail;
    }

    public function envelope(): Envelope
    {
        $en = __('breach_notification_practitioner.subject', [], 'en');
        $zh = __('breach_notification_practitioner.subject', [], 'zh');

        return new Envelope(
            subject: $en . ' · ' . $zh,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.breach_notification_practitioner',
            with: [
                'practitioner' => $this->practitioner,
                'privacyEmail' => $this->privacyEmail,
            ],
        );
    }
}
