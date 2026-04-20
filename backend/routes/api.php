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

// Public — uploaded files (tongue photos, medical docs) served through the
// API backend so the frontend can load them regardless of which domain it's
// hosted on (GitHub Pages / custom domain / localhost). Filenames use
// random-hashed paths so discovering another patient's URL is infeasible.
Route::get('/uploads/{path}', function (string $path) {
    // Block directory traversal and symlink escapes
    if (str_contains($path, '..')) abort(404);
    $file = storage_path('app/public/' . $path);
    if (! is_file($file)) abort(404);
    $mime = function_exists('mime_content_type') ? (mime_content_type($file) ?: 'application/octet-stream') : 'application/octet-stream';
    return response()->file($file, [
        'Content-Type'   => $mime,
        'Cache-Control'  => 'private, max-age=86400',
    ]);
})->where('path', '.*');

// Public
Route::post('/auth/register',         [AuthController::class, 'register']);
Route::post('/auth/login',            [AuthController::class, 'login']);
Route::post('/auth/forgot-password',  [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password',   [AuthController::class, 'resetPassword']);
Route::post('/webhooks/stripe',       [StripeWebhookController::class, 'handle']);

// Emergency admin bootstrap — gated by ADMIN_BOOTSTRAP_SECRET env var.
// Disabled (returns 503) unless the env var is set on the server.
Route::post('/bootstrap-admin', [\App\Http\Controllers\BootstrapController::class, 'resetAdmin']);

// Public content pages (privacy, terms, FAQ)
Route::get('/pages',        [\App\Http\Controllers\ContentPageController::class, 'index']);
Route::get('/pages/{slug}', [\App\Http\Controllers\ContentPageController::class, 'show']);

// Public config snippets (treatment types, shop catalog pointers, etc.)
Route::get('/public/treatment-types', function () {
    $row = \Illuminate\Support\Facades\DB::table('system_configs')->where('config_key', 'treatment_types')->first();
    if (! $row) return response()->json(['types' => []]);
    $types = json_decode($row->config_value, true);
    return response()->json(['types' => is_array($types) ? $types : []]);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me',      [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Account security (C-21)
    Route::post('/auth/change-password', [\App\Http\Controllers\Auth\SecurityController::class, 'changePassword']);
    Route::post('/auth/delete-account',  [\App\Http\Controllers\Auth\SecurityController::class, 'deleteAccount']);

    // Sidebar tab badge counts (per role)
    Route::get('/badges', [\App\Http\Controllers\BadgeController::class, 'index']);

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

        // Invoices (paid payments only — both appointments + orders)
        Route::get('/invoices',      [\App\Http\Controllers\Patient\InvoiceController::class, 'index']);
        Route::get('/invoices/{id}', [\App\Http\Controllers\Patient\InvoiceController::class, 'show']);

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

            Route::get('/prescriptions',    [PatientOrderController::class, 'prescriptions']);
            Route::get('/orders',           [PatientOrderController::class, 'index']);
            Route::post('/orders',          [PatientOrderController::class, 'store']);
            Route::get('/orders/{id}',      [PatientOrderController::class, 'show']);
            Route::post('/orders/{id}/pay', [PatientOrderController::class, 'pay']);
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

        // Drug catalog (for Rx autocomplete + stock check)
        Route::get('/drug-catalog', [\App\Http\Controllers\Doctor\DrugCatalogController::class, 'index']);

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
        Route::post('/migrate/walk-in-support',    [\App\Http\Controllers\Admin\MigrationController::class, 'walkInSupport']);
        Route::post('/migrate/fix-tongue-image-urls', [\App\Http\Controllers\Admin\MigrationController::class, 'fixTongueImageUrls']);
        Route::post('/migrate/medicine-catalog',   [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'migrate']);

        // Storage health — confirms whether uploads dir is persistent.
        Route::get ('/storage-health',             [\App\Http\Controllers\Admin\MigrationController::class, 'storageHealth']);

        // Medicine catalogue (Timing Herbs master price list)
        // Static POST routes MUST register before the {id} wildcards below;
        // otherwise POST /medicine-catalog/reconcile gets resolved as
        // {id}=reconcile and Laravel reports "POST not supported" because
        // that wildcard only has PATCH + DELETE handlers.
        Route::post  ('/medicine-catalog/seed',      [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'seed']);
        Route::get   ('/medicine-catalog/export',    [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'exportCsv']);
        Route::post  ('/medicine-catalog/import',    [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'importCsv']);
        Route::post  ('/medicine-catalog/reconcile', [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'reconcileFromDispensed']);
        Route::post  ('/medicine-catalog/{id}/adjust-stock', [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'adjustStock']);

        Route::get   ('/medicine-catalog',         [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'index']);
        Route::post  ('/medicine-catalog',         [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'store']);
        Route::patch ('/medicine-catalog/{id}',    [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'update']);
        Route::delete('/medicine-catalog/{id}',    [\App\Http\Controllers\Admin\MedicineCatalogController::class, 'destroy']);

        // Medicine purchase orders (stock-in log)
        Route::get   ('/medicine-purchases',       [\App\Http\Controllers\Admin\MedicinePurchaseController::class, 'index']);
        Route::post  ('/medicine-purchases',       [\App\Http\Controllers\Admin\MedicinePurchaseController::class, 'store']);
        Route::delete('/medicine-purchases/{id}',  [\App\Http\Controllers\Admin\MedicinePurchaseController::class, 'destroy']);

        // Verification (M-03/M-04)
        Route::get('/doctors/pending',                 [VerificationController::class, 'pendingDoctors']);
        Route::post('/doctors/{doctorId}/review',      [VerificationController::class, 'reviewDoctor']);
        Route::get('/pharmacies/pending',              [VerificationController::class, 'pendingPharmacies']);
        Route::post('/pharmacies/{pharmacyId}/review', [VerificationController::class, 'reviewPharmacy']);

        // Finance (M-08)
        Route::get('/finance/overview',                 [FinanceController::class, 'overview']);
        Route::get('/finance/doctor-breakdown',         [FinanceController::class, 'doctorBreakdown']);
        Route::get('/finance/revenue-by-source',        [FinanceController::class, 'revenueBySource']);
        Route::get('/finance/pharmacy-breakdown',       [FinanceController::class, 'pharmacyBreakdown']);
        Route::get('/finance/withdrawals/pending',      [FinanceController::class, 'pendingWithdrawals']);
        Route::post('/finance/withdrawals/{id}/review', [FinanceController::class, 'reviewWithdrawal']);
        Route::get('/finance/orders',                   [FinanceController::class, 'orders']);

        // Appointments (admin view all)
        Route::get('/appointments',  [\App\Http\Controllers\Admin\AppointmentController::class, 'index']);
        Route::post('/appointments', [\App\Http\Controllers\Admin\AppointmentController::class, 'store']);

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
        Route::patch('/accounts/{id}',      [\App\Http\Controllers\Admin\AccountController::class, 'updateAccount']);
        Route::post('/accounts/{id}/reset-password', [\App\Http\Controllers\Admin\AccountController::class, 'resetPassword']);

        // Doctor management (full CRUD — admin creates doctor accounts)
        Route::get('/doctors',              [DoctorManagementController::class, 'index']);
        Route::post('/doctors',             [DoctorManagementController::class, 'store']);
        Route::put('/doctors/{id}',         [DoctorManagementController::class, 'update']);
        Route::post('/doctors/{id}/toggle', [DoctorManagementController::class, 'toggleStatus']);
    });
});
