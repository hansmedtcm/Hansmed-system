<?php

namespace App\Services;

use App\Models\Notification;

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

    public function prescriptionIssued(int $patientId, int $prescriptionId): void
    {
        $this->notify($patientId, 'prescription.issued',
            'Prescription ready',
            'Your doctor has issued a new prescription.',
            ['prescription_id' => $prescriptionId]);
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
