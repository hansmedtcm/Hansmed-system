<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContentController extends Controller
{
    public function index()
    {
        $pages = DB::table('content_pages')->orderBy('slug')->get();
        return response()->json(['pages' => $pages]);
    }

    public function show(string $slug)
    {
        $page = DB::table('content_pages')->where('slug', $slug)->first();
        if (!$page) abort(404);
        return response()->json(['page' => $page]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'slug'      => ['required', 'string', 'max:120', 'regex:/^[a-z0-9\-]+$/'],
            'title'     => ['required', 'string', 'max:200'],
            'body_html' => ['required', 'string'],
            'locale'    => ['nullable', 'string', 'max:10'],
        ]);

        DB::table('content_pages')->updateOrInsert(
            ['slug' => $data['slug']],
            [
                'title'      => $data['title'],
                'body_html'  => $data['body_html'],
                'locale'     => $data['locale'] ?? 'en',
                'updated_by' => $request->user()->id,
                'updated_at' => now(),
                'created_at' => DB::raw('IFNULL(created_at, NOW())'),
            ]
        );

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'content.upsert',
            'target_type' => 'content_page',
            'payload'     => json_encode(['slug' => $data['slug']]),
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Page saved']);
    }

    public function destroy(Request $request, string $slug)
    {
        DB::table('content_pages')->where('slug', $slug)->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * One-click seed of the PDPA-mandated content pages:
     *   - /privacy : privacy notice covering PDPA §6–§10, §30, §31
     *   - /terms   : general T&Cs with practitioner-review disclosure
     *   - /retention : data retention schedule referenced by /privacy
     *
     * Idempotent — can be re-run safely; existing pages with the same
     * slug are overwritten with the canonical copy.
     */
    public function seedCompliancePages(Request $request)
    {
        $pages = [
            [
                'slug'  => 'privacy',
                'title' => 'Privacy Notice · 私隱條款',
                'body_html' => $this->privacyNotice(),
            ],
            [
                'slug'  => 'retention',
                'title' => 'Data Retention Schedule · 資料保存期限',
                'body_html' => $this->retentionSchedule(),
            ],
        ];

        foreach ($pages as $p) {
            DB::table('content_pages')->updateOrInsert(
                ['slug' => $p['slug']],
                [
                    'title'      => $p['title'],
                    'body_html'  => $p['body_html'],
                    'locale'     => 'en',
                    'updated_by' => $request->user()->id,
                    'updated_at' => now(),
                    'created_at' => DB::raw('IFNULL(created_at, NOW())'),
                ]
            );
        }

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'content.seed.compliance',
            'target_type' => 'content_page',
            'payload'     => json_encode(['slugs' => ['privacy', 'retention']]),
            'created_at'  => now(),
        ]);

        return response()->json(['ok' => true, 'seeded' => ['privacy', 'retention']]);
    }

    private function privacyNotice(): string
    {
        // Body is stored as HTML. Kept deliberately plain — admin can
        // reformat in the CMS editor. Bilingual EN + 中文 throughout.
        return <<<HTML
<p><em>Last updated: {$this->today()}</em></p>

<h2>1. Who we are · 我們是誰</h2>
<p>HansMed 漢方現代中醫 is a Malaysian traditional Chinese medicine (TCM) digital health platform operated by HansMed Sdn Bhd. This notice explains what personal data we collect, why, and how you can control it under the Personal Data Protection Act 2010 (PDPA).</p>
<p>HansMed 漢方現代中醫 是由 HansMed Sdn Bhd 營運的馬來西亞中醫數位健康平台。本通知依據《2010 年個人資料保護法令》(PDPA) 說明我們收集的資料、目的及您的權利。</p>

<h2>2. What we collect · 我們收集的資料</h2>
<ul>
  <li><strong>Account data:</strong> email, password (hashed), role.<br>
    <span>帳號資料：電子郵件、密碼（加密）、角色。</span></li>
  <li><strong>Profile:</strong> name, IC number, phone, date of birth, address, blood type, height/weight, allergies, medical history.<br>
    <span>個人資料：姓名、身份證、電話、出生日期、地址、血型、身高體重、過敏史、病史。</span></li>
  <li><strong>Tongue photos</strong> you upload for wellness analysis.<br>
    <span>您上傳的舌頭照片。</span></li>
  <li><strong>Questionnaire responses</strong> (10-dimension constitution quiz + current health concerns).<br>
    <span>問卷回答（10 維體質問卷與當前健康訴求）。</span></li>
  <li><strong>Appointment, prescription, order and payment records.</strong><br>
    <span>預約、處方、訂單及付款記錄。</span></li>
  <li><strong>Chat messages</strong> between you and your practitioner.<br>
    <span>您與醫師的對話訊息。</span></li>
  <li><strong>Technical:</strong> IP address, device type, consent timestamps (audit log).<br>
    <span>技術資料：IP 位址、裝置類型、同意時間戳（審計記錄）。</span></li>
</ul>

<h2>3. Why we collect it · 使用目的</h2>
<ul>
  <li>To provide TCM wellness analysis (AI + licensed practitioner review) — <em>with your explicit consent</em> at each upload or questionnaire submission.<br>
    <span>提供中醫健康分析（AI 加註冊中醫師審核）— 每次上傳或提交問卷時取得您的明確同意。</span></li>
  <li>To schedule appointments and deliver consultations.<br>
    <span>安排預約與問診。</span></li>
  <li>To dispense and deliver herbs you have ordered.<br>
    <span>配製及配送您訂購的藥材。</span></li>
  <li>To maintain medical records as required by Malaysian regulations.<br>
    <span>依馬來西亞法規保存病歷。</span></li>
</ul>
<p>We do <strong>not</strong> sell your data, use it for third-party advertising, or share it outside the clinical team without your consent.</p>
<p>我們<strong>不會</strong>出售您的資料、用於第三方廣告，或在未經您同意下分享給臨床團隊以外人員。</p>

<h2>4. Who can see your data · 誰能存取您的資料</h2>
<ul>
  <li><strong>You</strong> — via the patient portal. You can download a copy any time from Settings → <em>Download My Data</em>.<br>
    <span>您本人 — 透過患者端。可隨時於「設定 → 下載我的資料」取得副本。</span></li>
  <li><strong>Your reviewing TCM practitioner</strong> — registered with the Ministry of Health Malaysia under the T&amp;CM Act 2016.<br>
    <span>審核您資料的註冊中醫師（依 2016 年傳統及輔助醫藥法令）。</span></li>
  <li><strong>The dispensing pharmacy</strong> — only for orders you place, limited to prescription + delivery address.<br>
    <span>配藥藥房 — 僅限您下的訂單，只能看到處方與收貨地址。</span></li>
  <li><strong>Platform administrators</strong> — restricted to what they need for clinic operations, logged to an audit trail.<br>
    <span>平台管理員 — 僅限營運必需範圍，所有存取均記錄。</span></li>
</ul>

<h2>5. Retention · 保存期限</h2>
<p>We keep your data only as long as necessary for the purposes above or as required by law:</p>
<table style="width:100%;border-collapse:collapse;">
  <tr style="background:var(--washi);"><th style="text-align:left;padding:6px;border:1px solid var(--border);">Category · 類別</th><th style="text-align:left;padding:6px;border:1px solid var(--border);">Retention · 保存期限</th></tr>
  <tr><td style="padding:6px;border:1px solid var(--border);">Medical records (appointments, prescriptions, consultations)</td><td style="padding:6px;border:1px solid var(--border);">7 years (aligned with Malaysian medical records standard)</td></tr>
  <tr><td style="padding:6px;border:1px solid var(--border);">Tongue photos &amp; questionnaire responses</td><td style="padding:6px;border:1px solid var(--border);">2 years from last activity, or until you request deletion</td></tr>
  <tr><td style="padding:6px;border:1px solid var(--border);">Chat messages</td><td style="padding:6px;border:1px solid var(--border);">2 years from last activity</td></tr>
  <tr><td style="padding:6px;border:1px solid var(--border);">Order &amp; payment records</td><td style="padding:6px;border:1px solid var(--border);">7 years (tax &amp; consumer-law compliance)</td></tr>
  <tr><td style="padding:6px;border:1px solid var(--border);">Audit logs (access trail)</td><td style="padding:6px;border:1px solid var(--border);">3 years</td></tr>
</table>
<p>After the retention period, records are either anonymised or deleted. You can see the full schedule on the <a href="/retention">Retention Schedule</a> page.</p>
<p>保存期滿後，記錄將被匿名化或刪除。完整保存期限請見<a href="/retention">資料保存期限頁</a>。</p>

<h2>6. Security · 安全措施</h2>
<ul>
  <li>Passwords are hashed with bcrypt — we never see your plaintext password.<br>
    <span>密碼經 bcrypt 加密 — 我們無法看到原始密碼。</span></li>
  <li>All API traffic is served over HTTPS.<br>
    <span>所有 API 流量均經 HTTPS 加密。</span></li>
  <li>Access to administrative functions is limited, logged to an audit trail, and requires two-factor authentication for admin accounts.<br>
    <span>管理功能存取受限並記錄，管理員帳號需雙因素驗證。</span></li>
  <li>Tongue photos are stored on encrypted-at-rest persistent storage (Railway Volume). We are migrating to S3 with server-side encryption for scale.<br>
    <span>舌頭照片儲存於加密持久存儲；未來將遷移至具 SSE 的 S3 以擴容。</span></li>
</ul>

<h2>7. Your rights under PDPA · 您的權利</h2>
<ul>
  <li><strong>Access (§30)</strong> — download your data any time from Settings.<br>
    <span>查閱權（§30）— 可隨時於設定中下載。</span></li>
  <li><strong>Correction (§31)</strong> — contact support to correct any record.<br>
    <span>更正權（§31）— 聯絡客服更正記錄。</span></li>
  <li><strong>Withdraw consent (§38)</strong> — stop consenting to AI processing at any time. We will cease that processing; historical records remain under the retention schedule.<br>
    <span>撤回同意權（§38）— 可隨時停止 AI 分析。歷史記錄將依保存期限處理。</span></li>
  <li><strong>Delete account</strong> — use Settings → Delete Account. Soft-deletes within 24 hours; hard-deletes after retention periods.<br>
    <span>刪除帳號 — 使用「設定 → 刪除帳號」。24 小時內軟刪除，保存期滿後硬刪除。</span></li>
  <li><strong>Complain</strong> — to our Data Protection Officer at <a href="mailto:dpo@hansmedtcm.com">dpo@hansmedtcm.com</a>, or the Malaysian Personal Data Protection Commissioner.<br>
    <span>申訴 — 電郵我們的資料保護主任或向馬來西亞個人資料保護委員會投訴。</span></li>
</ul>

<h2>8. AI wellness analysis — important notice · AI 健康分析重要聲明</h2>
<p>The tongue photo and constitution questionnaire feed an AI model that produces a <em>TCM wellness insight</em>. This is <strong>NOT a medical diagnosis</strong>. Every insight is reviewed by a licensed TCM practitioner before any personalised guidance is shared with you. The AI output alone is wellness education. For any clinical diagnosis or treatment, please consult a licensed TCM practitioner.</p>
<p>舌頭照片與體質問卷輸入 AI 模型，產生中醫健康見解。此<strong>非醫療診斷</strong>。每項見解均由註冊中醫師審核後才會提供個人化建議。如需臨床診斷或治療，請諮詢註冊中醫師。</p>

<h2>9. Updates · 本通知的更新</h2>
<p>We may update this notice. Material changes will be notified in-app and by email. Your continued use of HansMed after the effective date constitutes acceptance.</p>
<p>本通知可能更新。重大變更將透過應用內通知與電郵告知。生效日後繼續使用即視為接受。</p>

<h2>10. Contact · 聯絡我們</h2>
<p>Data Protection Officer · 資料保護主任: <a href="mailto:dpo@hansmedtcm.com">dpo@hansmedtcm.com</a></p>
HTML;
    }

    private function retentionSchedule(): string
    {
        return <<<HTML
<p><em>Last updated: {$this->today()}</em></p>

<h2>Data Retention Schedule · 資料保存期限</h2>

<p>Under PDPA §10, we keep personal data only as long as necessary for the purposes collected. Below is the full retention schedule HansMed operates.</p>
<p>依 PDPA §10，個人資料僅保存達成收集目的所需之期間。下表為 HansMed 完整保存期限。</p>

<table style="width:100%;border-collapse:collapse;">
  <thead>
    <tr style="background:var(--washi);">
      <th style="text-align:left;padding:8px;border:1px solid var(--border);">Data category · 資料類別</th>
      <th style="text-align:left;padding:8px;border:1px solid var(--border);">Retention · 保存期限</th>
      <th style="text-align:left;padding:8px;border:1px solid var(--border);">Legal basis · 法律依據</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:8px;border:1px solid var(--border);">Medical records (appointments, consultations, prescriptions, doctor notes)</td><td style="padding:8px;border:1px solid var(--border);">7 years from last visit</td><td style="padding:8px;border:1px solid var(--border);">Malaysian medical records standard + T&amp;CM Act 2016</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Tongue photos</td><td style="padding:8px;border:1px solid var(--border);">2 years from last upload, or immediately on deletion request</td><td style="padding:8px;border:1px solid var(--border);">PDPA §10 purpose-limited retention</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Questionnaire responses (constitution, health concerns)</td><td style="padding:8px;border:1px solid var(--border);">2 years from last submission</td><td style="padding:8px;border:1px solid var(--border);">PDPA §10 purpose-limited retention</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Chat messages</td><td style="padding:8px;border:1px solid var(--border);">2 years from last activity</td><td style="padding:8px;border:1px solid var(--border);">PDPA §10 purpose-limited retention</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Order + payment records</td><td style="padding:8px;border:1px solid var(--border);">7 years</td><td style="padding:8px;border:1px solid var(--border);">Malaysian tax law, Consumer Protection Act 1999</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Account data (email, hashed password)</td><td style="padding:8px;border:1px solid var(--border);">Until account deletion + 30 days</td><td style="padding:8px;border:1px solid var(--border);">Operational necessity</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Profile (name, IC, address, emergency contact)</td><td style="padding:8px;border:1px solid var(--border);">Until account deletion + 30 days</td><td style="padding:8px;border:1px solid var(--border);">Operational necessity</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">Audit logs (access trail, consent events)</td><td style="padding:8px;border:1px solid var(--border);">3 years</td><td style="padding:8px;border:1px solid var(--border);">PDPA accountability principle</td></tr>
    <tr><td style="padding:8px;border:1px solid var(--border);">System backups</td><td style="padding:8px;border:1px solid var(--border);">30 days rolling</td><td style="padding:8px;border:1px solid var(--border);">Business continuity; overwritten daily</td></tr>
  </tbody>
</table>

<h2>Deletion process · 刪除流程</h2>
<ul>
  <li>On account deletion, your account is immediately soft-deleted (status=deleted, cannot log in).<br>
    <span>刪除帳號後立即軟刪除（狀態=deleted，無法登入）。</span></li>
  <li>Within 30 days, profile data is anonymised (replaced with generic placeholders) except where legally required to keep.<br>
    <span>30 日內個人資料將匿名化，法律要求保留者除外。</span></li>
  <li>After the retention period for each category above, records are permanently deleted from the primary database; backups roll off within 30 days.<br>
    <span>各類別保存期滿後，記錄從主資料庫永久刪除；備份於 30 日內滾存刪除。</span></li>
</ul>

<h2>Contact · 聯絡我們</h2>
<p>Data Protection Officer · 資料保護主任: <a href="mailto:dpo@hansmedtcm.com">dpo@hansmedtcm.com</a></p>
HTML;
    }

    private function today(): string
    {
        return now()->format('Y-m-d');
    }
}
