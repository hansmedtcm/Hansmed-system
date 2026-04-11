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
}
