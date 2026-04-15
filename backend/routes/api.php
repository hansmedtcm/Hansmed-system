<?php

use App\Http\Controllers\Admin\DoctorManagementController;
use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\PatientController as AdminPatientController;
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

// Public content pages (privacy, terms, FAQ)
Route::get('/pages',        [\App\Http\Controllers\ContentPageController::class, 'index']);
Route::get('/pages/{slug}', [\App\Http\Controllers\ContentPageController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me',      [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Account security (C-21)
    Route::post('/auth/change-password', [\App\Http\Controllers\Auth\SecurityController::class, 'changePassword']);
    Route::post('/auth/delete-account',  [\App\Http\Controllers\Auth\SecurityController::class, 'deleteAccount']);

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

    // Chat
    Route::get('/chat/threads',                        [\App\Http\Controllers\ChatController::class, 'threads']);
    Route::post('/chat/thread',                        [\App\Http\Controllers\ChatController::class, 'getOrCreateThread']);
    Route::get('/chat/threads/{threadId}/messages',    [\App\Http\Controllers\ChatController::class, 'messages']);
    Route::post('/chat/threads/{threadId}/messages',   [\App\Http\Controllers\ChatController::class, 'send']);

    // Documents
    Route::get('/documents/prescription/{id}',  [\App\Http\Controllers\DocumentController::class, 'prescriptionPdf']);

    // Available slots (public for booking)
    Route::get('/doctors/{doctorId}/slots',  [\App\Http\Controllers\Doctor\ScheduleController::class, 'availableSlots']);

    // ================== PATIENT ==================
    Route::middleware('role:patient')->prefix('patient')->group(function () {
        // These routes are accessible even before registration is completed
        Route::get('/profile', [PatientProfileController::class, 'show']);
        Route::put('/profile', [PatientProfileController::class, 'update']);
        Route::post('/profile/complete-registration', [PatientProfileController::class, 'completeRegistration']);

        // Everything below requires completed registration
        Route::middleware('registration.complete')->group(function () {
            Route::apiResource('addresses', AddressController::class)->except(['show']);

            Route::get('/tongue-diagnoses',         [TongueDiagnosisController::class, 'index']);
            Route::post('/tongue-diagnoses',        [TongueDiagnosisController::class, 'store']);
            Route::get('/tongue-diagnoses/{id}',    [TongueDiagnosisController::class, 'show']);
            Route::delete('/tongue-diagnoses/{id}', [TongueDiagnosisController::class, 'destroy']);

            // Health questionnaire (C-08)
            Route::post('/questionnaires',      [\App\Http\Controllers\Patient\QuestionnaireController::class, 'store']);
            Route::get('/questionnaires',       [\App\Http\Controllers\Patient\QuestionnaireController::class, 'index']);
            Route::get('/questionnaires/{id}',  [\App\Http\Controllers\Patient\QuestionnaireController::class, 'show']);

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
    });

    // ================== DOCTOR ==================
    Route::middleware('role:doctor')->prefix('doctor')->group(function () {
        // Profile (D-02)
        Route::get('/profile',  [\App\Http\Controllers\Doctor\ProfileController::class, 'show']);
        Route::put('/profile',  [\App\Http\Controllers\Doctor\ProfileController::class, 'update']);

        // Patient list (D-05) + tongue reports (D-06) + consultation history (D-10)
        Route::get('/patients',                          [\App\Http\Controllers\Doctor\PatientListController::class, 'index']);
        Route::get('/patients/{id}/tongue-diagnoses',    [\App\Http\Controllers\Doctor\PatientListController::class, 'tongueDiagnoses']);
        Route::get('/patients/{id}/consultations',       [\App\Http\Controllers\Doctor\PatientListController::class, 'consultationHistory']);

        Route::get('/appointments',                [DoctorAppointmentController::class, 'index']);
        Route::post('/appointments',               [DoctorAppointmentController::class, 'storeForPatient']);
        Route::get('/appointments/{id}',           [DoctorAppointmentController::class, 'show']);
        Route::post('/appointments/{id}/start',    [DoctorAppointmentController::class, 'start']);
        Route::post('/appointments/{id}/complete', [DoctorAppointmentController::class, 'complete']);

        // Patient pool (doctors pick unclaimed pool appointments)
        Route::get('/pool',             [\App\Http\Controllers\Doctor\PoolController::class, 'index']);
        Route::post('/pool/{id}/pick',  [\App\Http\Controllers\Doctor\PoolController::class, 'pick']);

        // Tongue diagnosis doctor review
        Route::get('/tongue-reviews',            [\App\Http\Controllers\Doctor\TongueReviewController::class, 'index']);
        Route::get('/tongue-reviews/{id}',       [\App\Http\Controllers\Doctor\TongueReviewController::class, 'show']);
        Route::post('/tongue-reviews/{id}/review', [\App\Http\Controllers\Doctor\TongueReviewController::class, 'review']);

        // AI constitution questionnaire review
        Route::get('/constitution-reviews',            [\App\Http\Controllers\Doctor\ConstitutionReviewController::class, 'index']);
        Route::get('/patients/{patientId}/constitution-reviews', [\App\Http\Controllers\Doctor\ConstitutionReviewController::class, 'byPatient']);
        Route::get('/constitution-reviews/{id}',       [\App\Http\Controllers\Doctor\ConstitutionReviewController::class, 'show']);
        Route::post('/constitution-reviews/{id}/review', [\App\Http\Controllers\Doctor\ConstitutionReviewController::class, 'review']);

        Route::get('/prescriptions',              [DoctorPrescriptionController::class, 'index']);
        Route::post('/prescriptions',             [DoctorPrescriptionController::class, 'store']);
        Route::get('/prescriptions/{id}',         [DoctorPrescriptionController::class, 'show']);
        Route::post('/prescriptions/{id}/revoke', [DoctorPrescriptionController::class, 'revoke']);
        Route::post('/prescriptions/{id}/revise', [DoctorPrescriptionController::class, 'revise']);

        Route::get('/earnings/summary', [DoctorEarningsController::class, 'summary']);
        Route::get('/earnings/history', [DoctorEarningsController::class, 'history']);
        Route::get('/withdrawals',      [DoctorEarningsController::class, 'withdrawals']);
        Route::post('/withdrawals',     [DoctorEarningsController::class, 'requestWithdrawal']);

        // Off-days (ad-hoc days off on top of the weekly schedule)
        Route::get('/off-days',  [\App\Http\Controllers\Doctor\OffDayController::class, 'index']);
        Route::post('/off-days', [\App\Http\Controllers\Doctor\OffDayController::class, 'toggle']);

        // Schedule management
        Route::get('/schedules',       [\App\Http\Controllers\Doctor\ScheduleController::class, 'index']);
        Route::post('/schedules',      [\App\Http\Controllers\Doctor\ScheduleController::class, 'store']);
        Route::delete('/schedules/{id}',[\App\Http\Controllers\Doctor\ScheduleController::class, 'destroy']);

        // Document generation
        Route::post('/documents/mc',       [\App\Http\Controllers\DocumentController::class, 'medicalCertificate']);
        Route::post('/documents/referral', [\App\Http\Controllers\DocumentController::class, 'referralLetter']);
    });

    // ================== PHARMACY ==================
    Route::middleware('role:pharmacy')->prefix('pharmacy')->group(function () {
        // Profile (P-02)
        Route::get('/profile',  [\App\Http\Controllers\Pharmacy\ProfileController::class, 'show']);
        Route::put('/profile',  [\App\Http\Controllers\Pharmacy\ProfileController::class, 'update']);

        // Prescription inbox (P-03)
        Route::get('/prescriptions', [\App\Http\Controllers\Pharmacy\PrescriptionInboxController::class, 'index']);

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

        // POS (Point of Sale)
        Route::get('/pos/products',       [\App\Http\Controllers\PosController::class, 'products']);
        Route::post('/pos/sale',          [\App\Http\Controllers\PosController::class, 'sale']);
        Route::get('/pos/history',        [\App\Http\Controllers\PosController::class, 'history']);
        Route::get('/pos/sales/{id}',     [\App\Http\Controllers\PosController::class, 'show']);
        Route::get('/pos/daily-summary',  [\App\Http\Controllers\PosController::class, 'dailySummary']);
    });

    // ================== ADMIN ==================
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        // One-shot DB migrations (idempotent)
        Route::post('/migrate/pool-booking',       [\App\Http\Controllers\Admin\MigrationController::class, 'poolBooking']);
        Route::post('/migrate/tongue-review',      [\App\Http\Controllers\Admin\MigrationController::class, 'tongueReview']);
        Route::post('/migrate/doctor-off-days',    [\App\Http\Controllers\Admin\MigrationController::class, 'doctorOffDays']);
        Route::post('/migrate/rx-from-review',     [\App\Http\Controllers\Admin\MigrationController::class, 'rxFromReview']);

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

        // Appointments (admin view all)
        Route::get('/appointments', [\App\Http\Controllers\Admin\AppointmentController::class, 'index']);

        // Prescription oversight (M-06)
        Route::get('/prescriptions',                  [PrescriptionOversightController::class, 'index']);
        Route::get('/prescriptions/{id}',             [PrescriptionOversightController::class, 'show']);
        Route::post('/prescriptions/{id}/revoke',     [PrescriptionOversightController::class, 'forceRevoke']);

        // System config (M-09)
        Route::get('/configs',  [SystemConfigController::class, 'index']);
        Route::post('/configs', [SystemConfigController::class, 'upsert']);

        // Tongue diagnosis config (M-05)
        Route::get('/tongue-config',  [\App\Http\Controllers\Admin\TongueDiagnosisConfigController::class, 'index']);
        Route::post('/tongue-config', [\App\Http\Controllers\Admin\TongueDiagnosisConfigController::class, 'update']);

        // Permission management (M-10)
        Route::get('/permissions',  [\App\Http\Controllers\Admin\PermissionController::class, 'index']);
        Route::post('/permissions', [\App\Http\Controllers\Admin\PermissionController::class, 'update']);

        // Audit logs (M-11)
        Route::get('/audit-logs', [\App\Http\Controllers\Admin\AuditLogController::class, 'index']);

        // Content management (M-12)
        Route::get('/content',              [\App\Http\Controllers\Admin\ContentController::class, 'index']);
        Route::get('/content/{slug}',       [\App\Http\Controllers\Admin\ContentController::class, 'show']);
        Route::post('/content',             [\App\Http\Controllers\Admin\ContentController::class, 'upsert']);
        Route::delete('/content/{slug}',    [\App\Http\Controllers\Admin\ContentController::class, 'destroy']);

        // Reports (M-13)
        Route::get('/reports/dashboard',        [ReportsController::class, 'dashboard']);
        Route::get('/reports/export/{entity}',  [ReportsController::class, 'exportCsv']);

        // Patient management (admin can edit locked profiles)
        Route::get('/patients',          [AdminPatientController::class, 'index']);
        Route::get('/patients/{id}',     [AdminPatientController::class, 'show']);
        Route::put('/patients/{id}',     [AdminPatientController::class, 'update']);

        // Account management (create doctor/pharmacy/admin from one place)
        Route::get('/accounts',             [\App\Http\Controllers\Admin\AccountController::class, 'index']);
        Route::post('/accounts',            [\App\Http\Controllers\Admin\AccountController::class, 'store']);
        Route::post('/accounts/{id}/toggle',[\App\Http\Controllers\Admin\AccountController::class, 'toggleStatus']);

        // Doctor management (full CRUD — admin creates doctor accounts)
        Route::get('/doctors',              [DoctorManagementController::class, 'index']);
        Route::post('/doctors',             [DoctorManagementController::class, 'store']);
        Route::put('/doctors/{id}',         [DoctorManagementController::class, 'update']);
        Route::post('/doctors/{id}/toggle', [DoctorManagementController::class, 'toggleStatus']);
    });
});
