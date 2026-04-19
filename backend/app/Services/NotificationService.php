<?php

namespace App\Services;

use App\Models\DoctorProfile;
use App\Models\Notification;
use App\Models\PharmacyProfile;

/**
 * Central place to fan out in-app notifications on state changes.
 * Push / email channels can be layered on here later without touching callers.
 */
class NotificationService
{
    public function notify(int $userId, string $type, string $title, ?string $body = null, array $data = []): void
    {
        Notification::create([
            'user_id'    => $userId,
            'type'       => $type,
            'title'      => $title,
            'body'       => $body,
            'data'       => $data,
            'created_at' => now(),
        ]);
    }

    // --- domain helpers ------------------------------------------------

    public function appointmentConfirmed(int $patientId, int $doctorId, int $appointmentId): void
    {
        $this->notify($patientId, 'appointment.confirmed',
            'Appointment confirmed',
            'Your payment was received and the appointment is confirmed.',
            ['appointment_id' => $appointmentId]);
        $this->notify($doctorId, 'appointment.booked',
            'New appointment',
            'A patient has booked and paid for an appointment.',
            ['appointment_id' => $appointmentId]);
    }

    /**
     * A patient has booked a pool appointment (no specific doctor yet).
     * Fan out to every approved+accepting doctor so whoever's available
     * picks it up first. Type = 'appointment.pool.new' — the doctor
     * portal subscribes this type to the review-sound cue.
     */
    public function appointmentPoolCreated(int $patientId, int $appointmentId, ?string $concernLabel = null, ?string $specialty = null): void
    {
        $title = 'New pool appointment · 新候診預約';
        $bits = [];
        if ($concernLabel) $bits[] = $concernLabel;
        if ($specialty)    $bits[] = $specialty;
        $suffix = $bits ? ' (' . implode(' · ', $bits) . ')' : '';
        $body  = 'A patient just booked and is waiting for a doctor to pick up' . $suffix . '.';

        // Fan out broadly: approved+accepting first, but if none exist
        // (single-doctor clinic still in pilot, or approvals not yet
        // processed), fall back to any doctor user so the clinic never
        // misses a booking alert.
        $doctorIds = DoctorProfile::where('verification_status', 'approved')
            ->where('accepting_appointments', true)
            ->pluck('user_id');
        if ($doctorIds->isEmpty()) {
            $doctorIds = \App\Models\User::where('role', 'doctor')->pluck('id');
        }

        foreach ($doctorIds as $uid) {
            $this->notify((int) $uid, 'appointment.pool.new', $title, $body, [
                'appointment_id' => $appointmentId,
                'patient_id'     => $patientId,
                'route'          => '#/queue',
            ]);
        }
    }

    public function prescriptionIssued(int $patientId, int $prescriptionId): void
    {
        $this->notify($patientId, 'prescription.issued',
            'Prescription ready',
            'Your doctor has issued a new prescription.',
            ['prescription_id' => $prescriptionId]);

        // Fan out to every approved pharmacy so they see the Rx in
        // their inbox + hear the dispense cue, even before the
        // patient places an order. Fall back to any pharmacy user
        // if no approvals exist yet — avoids a silent inbox on a
        // clinic still completing verification paperwork.
        $pharmacyIds = PharmacyProfile::where('verification_status', 'approved')
            ->pluck('user_id');
        if ($pharmacyIds->isEmpty()) {
            $pharmacyIds = \App\Models\User::where('role', 'pharmacy')->pluck('id');
        }
        foreach ($pharmacyIds as $uid) {
            $this->notify((int) $uid, 'prescription.incoming',
                'New prescription in inbox · 新處方進來',
                'A doctor has just issued a prescription. Check your inbox to pre-check stock.',
                ['prescription_id' => $prescriptionId, 'route' => '#/inbox']);
        }
    }

    public function orderPaid(int $patientId, int $pharmacyId, int $orderId, string $orderNo): void
    {
        $this->notify($patientId, 'order.paid',
            'Order placed',
            "Order {$orderNo} has been paid and sent to the pharmacy.",
            ['order_id' => $orderId]);
        $this->notify($pharmacyId, 'order.incoming',
            'New order to dispense',
            "Order {$orderNo} is awaiting dispensing.",
            ['order_id' => $orderId]);
    }

    public function orderShipped(int $patientId, int $orderId, string $orderNo, string $carrier, string $trackingNo): void
    {
        $this->notify($patientId, 'order.shipped',
            'Order shipped',
            "Order {$orderNo} shipped via {$carrier} ({$trackingNo}).",
            ['order_id' => $orderId, 'carrier' => $carrier, 'tracking_no' => $trackingNo]);
    }

    public function withdrawalReviewed(int $userId, int $withdrawalId, string $decision): void
    {
        $this->notify($userId, 'withdrawal.' . $decision,
            'Withdrawal ' . $decision,
            "Your withdrawal request was {$decision}.",
            ['withdrawal_id' => $withdrawalId]);
    }

    public function tongueReviewed(int $patientId, int $diagnosisId, string $decision): void
    {
        if ($decision === 'approved') {
            $this->notify($patientId, 'tongue.approved',
                'Tongue diagnosis approved · 舌診審核通過',
                'A doctor has reviewed your tongue analysis. Check your report for personalised advice. · 醫師已完成審核，請查看您的報告與建議。',
                ['diagnosis_id' => $diagnosisId, 'route' => '#/tongue/' . $diagnosisId]);
        } else {
            $this->notify($patientId, 'tongue.changes',
                'Tongue diagnosis — more info needed · 舌診需補充資料',
                'The reviewing doctor has added notes to your tongue analysis. Please read them and consider booking a consultation. · 醫師已留下備註，請查看。',
                ['diagnosis_id' => $diagnosisId, 'route' => '#/tongue/' . $diagnosisId]);
        }
    }

    /**
     * Fan out a "new review in the queue" alert to every approved +
     * accepting doctor so the one who's online picks it up first.
     * Used when a patient submits a tongue diagnosis or constitution
     * questionnaire. The frontend plays a sound cue on these.
     *
     * $kind: 'tongue' | 'constitution'
     */
    public function reviewPendingForDoctors(string $kind, int $refId, int $patientId): void
    {
        $title = $kind === 'tongue'
            ? 'New tongue diagnosis to review · 新舌診待審核'
            : 'New constitution report to review · 新體質報告待審核';
        $body  = $kind === 'tongue'
            ? 'A patient has submitted a tongue analysis for your review.'
            : 'A patient has submitted a constitution questionnaire for your review.';
        $type  = 'review.pending.' . $kind;
        $route = $kind === 'tongue'
            ? '#/reviews/tongue/' . $refId
            : '#/reviews/constitution/' . $refId;

        $doctorIds = DoctorProfile::where('verification_status', 'approved')
            ->where('accepting_appointments', true)
            ->pluck('user_id');
        if ($doctorIds->isEmpty()) {
            $doctorIds = \App\Models\User::where('role', 'doctor')->pluck('id');
        }

        foreach ($doctorIds as $uid) {
            $this->notify((int) $uid, $type, $title, $body, [
                'ref_id'     => $refId,
                'patient_id' => $patientId,
                'kind'       => $kind,
                'route'      => $route,
            ]);
        }
    }

    public function constitutionReviewed(int $patientId, int $questionnaireId, string $decision): void
    {
        if ($decision === 'approved') {
            $this->notify($patientId, 'constitution.approved',
                'Constitution report approved · 體質報告已批准',
                'Your AI constitution report has been reviewed and approved. View your personalised herb, food and lifestyle plan. · 您的 AI 體質報告已審核批准，請查看個人化建議。',
                ['questionnaire_id' => $questionnaireId, 'route' => '#/ai-diagnosis/' . $questionnaireId]);
        } else {
            $this->notify($patientId, 'constitution.changes',
                'Constitution report — more info needed · 體質報告需補充',
                'The reviewing doctor has requested clarification on your constitution report. Please read the comment and consider booking a consultation. · 醫師已要求補充資料或建議您預約問診。',
                ['questionnaire_id' => $questionnaireId, 'route' => '#/ai-diagnosis/' . $questionnaireId]);
        }
    }
}
