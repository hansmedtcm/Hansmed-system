<?php

use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\PrescriptionOversightController;
use App\Http\Controllers\Admin\ReportsController;
use App\Http\Controllers\Admin\SystemConfigController;
use App\Http\Controllers\Admin\VerificationController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\Doctor\AppointmentController as DoctorAppointmentController;
use App\Http\Controllers\Doctor\EarningsController as DoctorEarningsController;
use App\Http\Controllers\Doctor\PrescriptionController as DoctorPrescriptionController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Patient\AddressController;
use App\Http\Controllers\Patient\AppointmentController as PatientAppointmentController;
use App\Http\Controllers\Patient\DoctorBrowseController;
use App\Http\Controllers\Patient\OrderController as PatientOrderController;
use App\Http\Controllers\Patient\PharmacyBrowseController;
use App\Http\Controllers\Patient\ProfileController as PatientProfileController;
use App\Http\Controllers\Patient\TongueDiagnosisController;
use App\Http\Controllers\PayPalController;
use App\Http\Controllers\Pharmacy\OrderController as PharmacyOrderController;
use App\Http\Controllers\Pharmacy\ProductController as PharmacyProductController;
use App\Http\Controllers\Pharmacy\ReconciliationController as PharmacyReconController;
use App\Http\Controllers\StripeWebhookController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/auth/register',   [AuthController::class, 'register']);
Route::post('/auth/login',      [AuthController::class, 'login']);
Route::post('/webhooks/stripe', [StripeWebhookController::class, 'handle']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me',      [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Notifications (all roles)
    Route::get('/notifications',              [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read',   [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all',    [NotificationController::class, 'markAllRead']);

    // Consultation video join — both patient & doctor, permission enforced inside
    Route::get('/consultations/{appointmentId}/join',   [ConsultationController::class, 'joinToken']);
    Route::post('/consultations/{appointmentId}/finish', [ConsultationController::class, 'finish']);

    // Tongue diagnosis knowledge base (public glossary, no role restriction)
    Route::get('/tongue-knowledge', [TongueDiagnosisController::class, 'knowledgeBase']);

    // PayPal (patient initiates + captures)
    Route::post('/payments/paypal/create',  [PayPalController::class, 'create']);
    Route::post('/payments/paypal/capture', [PayPalController::class, 'capture']);

    // ================== PATIENT ==================
    Route::middleware('role:patient')->prefix('patient')->group(function () {
        Route::get('/profile', [PatientProfileController::class, 'show']);
        Route::put('/profile', [PatientProfileController::class, 'update']);

        Route::apiResource('addresses', AddressController::class)->except(['show']);

        Route::get('/tongue-diagnoses',         [TongueDiagnosisController::class, 'index']);
        Route::post('/tongue-diagnoses',        [TongueDiagnosisController::class, 'store']);
        Route::get('/tongue-diagnoses/{id}',    [TongueDiagnosisController::class, 'show']);
        Route::delete('/tongue-diagnoses/{id}', [TongueDiagnosisController::class, 'destroy']);

        Route::get('/doctors',            [DoctorBrowseController::class, 'index']);
        Route::get('/doctors/{doctorId}', [DoctorBrowseController::class, 'show']);
        Route::get('/pharmacies',         [PharmacyBrowseController::class, 'index']);

        Route::get('/appointments',              [PatientAppointmentController::class, 'index']);
        Route::post('/appointments',             [PatientAppointmentController::class, 'store']);
        Route::post('/appointments/{id}/cancel', [PatientAppointmentController::class, 'cancel']);

        Route::get('/prescriptions', [PatientOrderController::class, 'prescriptions']);
        Route::get('/orders',        [PatientOrderController::class, 'index']);
        Route::post('/orders',       [PatientOrderController::class, 'store']);
        Route::get('/orders/{id}',   [PatientOrderController::class, 'show']);
    });

    // ================== DOCTOR ==================
    Route::middleware('role:doctor')->prefix('doctor')->group(function () {
        Route::get('/appointments',                [DoctorAppointmentController::class, 'index']);
        Route::get('/appointments/{id}',           [DoctorAppointmentController::class, 'show']);
        Route::post('/appointments/{id}/start',    [DoctorAppointmentController::class, 'start']);
        Route::post('/appointments/{id}/complete', [DoctorAppointmentController::class, 'complete']);

        Route::get('/prescriptions',              [DoctorPrescriptionController::class, 'index']);
        Route::post('/prescriptions',             [DoctorPrescriptionController::class, 'store']);
        Route::get('/prescriptions/{id}',         [DoctorPrescriptionController::class, 'show']);
        Route::post('/prescriptions/{id}/revoke', [DoctorPrescriptionController::class, 'revoke']);
        Route::post('/prescriptions/{id}/revise', [DoctorPrescriptionController::class, 'revise']);

        Route::get('/earnings/summary', [DoctorEarningsController::class, 'summary']);
        Route::get('/earnings/history', [DoctorEarningsController::class, 'history']);
        Route::get('/withdrawals',      [DoctorEarningsController::class, 'withdrawals']);
        Route::post('/withdrawals',     [DoctorEarningsController::class, 'requestWithdrawal']);
    });

    // ================== PHARMACY ==================
    Route::middleware('role:pharmacy')->prefix('pharmacy')->group(function () {
        Route::get('/products',             [PharmacyProductController::class, 'index']);
        Route::post('/products',            [PharmacyProductController::class, 'store']);
        Route::put('/products/{id}',        [PharmacyProductController::class, 'update']);
        Route::post('/products/{id}/stock', [PharmacyProductController::class, 'adjustStock']);

        Route::get('/orders',                       [PharmacyOrderController::class, 'index']);
        Route::get('/orders/{id}',                  [PharmacyOrderController::class, 'show']);
        Route::post('/orders/{id}/dispense/start',  [PharmacyOrderController::class, 'startDispensing']);
        Route::post('/orders/{id}/dispense/finish', [PharmacyOrderController::class, 'markDispensed']);
        Route::post('/orders/{id}/ship',            [PharmacyOrderController::class, 'ship']);

        Route::get('/reconciliation/summary', [PharmacyReconController::class, 'summary']);
        Route::get('/reconciliation/daily',   [PharmacyReconController::class, 'dailyBreakdown']);
    });

    // ================== ADMIN ==================
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        // Verification (M-03/M-04)
        Route::get('/doctors/pending',                 [VerificationController::class, 'pendingDoctors']);
        Route::post('/doctors/{doctorId}/review',      [VerificationController::class, 'reviewDoctor']);
        Route::get('/pharmacies/pending',              [VerificationController::class, 'pendingPharmacies']);
        Route::post('/pharmacies/{pharmacyId}/review', [VerificationController::class, 'reviewPharmacy']);

        // Finance (M-08)
        Route::get('/finance/overview',                 [FinanceController::class, 'overview']);
        Route::get('/finance/withdrawals/pending',      [FinanceController::class, 'pendingWithdrawals']);
        Route::post('/finance/withdrawals/{id}/review', [FinanceController::class, 'reviewWithdrawal']);
        Route::get('/finance/orders',                   [FinanceController::class, 'orders']);

        // Prescription oversight (M-06)
        Route::get('/prescriptions',                  [PrescriptionOversightController::class, 'index']);
        Route::get('/prescriptions/{id}',             [PrescriptionOversightController::class, 'show']);
        Route::post('/prescriptions/{id}/revoke',     [PrescriptionOversightController::class, 'forceRevoke']);

        // System config (M-09)
        Route::get('/configs',  [SystemConfigController::class, 'index']);
        Route::post('/configs', [SystemConfigController::class, 'upsert']);

        // Reports (M-13)
        Route::get('/reports/dashboard',        [ReportsController::class, 'dashboard']);
        Route::get('/reports/export/{entity}',  [ReportsController::class, 'exportCsv']);
    });
});
