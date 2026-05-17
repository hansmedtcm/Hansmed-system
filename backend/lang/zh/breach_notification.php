<?php

/*
 * 患者通知 — 繁體中文翻譯（key-for-key 對應 en/breach_notification.php）
 *
 * 配合 App\Mail\BreachNotificationMail 使用，由 Artisan 指令
 * `php artisan breach:notify-patients` 觸發。所有用語必須與
 * en/breach_notification.php 完全對應；任一鍵的英文文字更動，
 * 此檔案對應鍵的中文翻譯必須在同一 commit 內更新。
 * DispatchBreachNotification 指令於執行時驗證兩個語言檔的鍵集
 * 完全一致，否則拒絕發送。
 *
 * 用語依平台既有繁體中文用語（私隱政策、個人資料、中醫師、處方、
 * 患者、身份證號碼 (NRIC)、舌像、體質分析等）。
 */

return [

    'subject' => '影響閣下 HansMed 帳戶之保安事故 — 請細閱',

    'salutation' => '尊敬的 :email：',

    'opening' => '本公司謹此通知閣下，HansMed Modern TCM 平台發生保安事故，影響閣下之帳戶。本通知乃依據馬來西亞法律所要求發出，亦因本公司認為閣下有權確切知悉事件之始末。',

    'heading_what_happened' => '事件經過',

    'what_happened' => '本公司於 2026 年 5 月 15 日進行內部程式碼倉庫審查時，發現一個載有平台管理員登入憑證之設定檔案被放置於本公司軟件程式碼倉庫之公開可讀範圍內。該檔案自 2026 年 4 月 14 日起一直存在 — 共計 30 日。倘有外人取得並使用該等憑證，即可存取本系統內所載之患者資料。本公司於發現當日即將該檔案自公開範圍移除，更改所有受影響之密碼，並撤銷平台上所有有效之登入工作階段 (session)。',

    'heading_what_was_reachable' => '可被存取之資料範圍',

    'what_was_reachable_intro' => '倘該等憑證被人使用，可存取本公司持有閣下之個人資料，包括：',

    'what_was_reachable_pii' => '閣下之姓名、電郵地址、電話號碼、馬來西亞身份證號碼 (NRIC)、出生日期、住宅地址及性別。',

    'what_was_reachable_health' => '閣下透過平台向中醫師提供之健康資訊，包括病歷、過敏史、目前服用之藥物、家族病史、血型、身高體重、問診紀錄、處方紀錄（包括中藥方劑及劑量）、舌像（舌診影像）及人工智能輔助體質分析結果。',

    'heading_what_we_have_done' => '本公司已採取之行動',

    'what_we_have_done_1' => '於發現事故後數小時內撤銷平台上所有 87 個有效登入權杖 (token)。',
    'what_we_have_done_2' => '更改所有受影響之內部帳戶密碼。',
    'what_we_have_done_3' => '將該檔案自程式碼倉庫之公開可讀範圍移除，並更新本公司設定以防止同類檔案再次被加入。',
    'what_we_have_done_4' => '部署緊急工具，如再發生類似情況可於數秒內撤銷平台所有有效工作階段 (session)。',
    'what_we_have_done_5' => '於資料庫之敏感健康欄位實施應用層級之靜態加密 (encryption-at-rest)，包括住宅地址、緊急聯絡人資料、過敏史、病歷、目前服用之藥物及家族病史。',
    'what_we_have_done_6' => '審查本公司可恢復之伺服器存取紀錄，查找任何外人使用該等憑證之跡象。',
    'what_we_have_done_7' => '依據 2010 年個人資料保護法（2024 年修訂）第 12B 條向個人資料保護專員 (Personal Data Protection Commissioner) 通報本事故。',
    'what_we_have_done_8' => '聘請馬來西亞私隱事務律師檢視本公司之應對措施。',

    'heading_cannot_tell_you' => '本公司坦白未能告知之事項',

    'cannot_tell_you' => '本公司僅能恢復事故 30 日暴露期間約 2.2% 之伺服器存取紀錄。在該可恢復之時段內，本公司未發現任何外人使用該等憑證之跡象。至於其餘 97.8% 之時段，本公司無法確認情況。本公司無法以確定之態度告知閣下並無任何未經授權之人存取閣下之資料。本公司可確認者為：依現有可審查之資料，本公司未發現任何未經授權之存取跡象；該等憑證已被撤銷，現已不能再被使用。',

    'heading_what_you_can_do' => '閣下可採取之行動',

    'what_you_can_do_password' => '更改 HansMed 密碼以作額外防範 — 雖然閣下之患者密碼並不在洩漏之檔案內，但定期更改密碼為良好習慣。請於下列網址更改：:reset_url。',
    'what_you_can_do_phishing' => '提防釣魚訊息。倘有人聲稱代表 HansMed 並要求閣下提供密碼、身份證號碼、銀行資料或一次性驗證碼，請勿回應。本公司絕不會以電郵索取此類資料。可疑訊息請轉發至 :privacy_email。',
    'what_you_can_do_nric' => '留意身份證號碼之冒用。倘發現任何以閣下名義開立之陌生帳戶，或任何身份被冒用之跡象，可向警方及相關機構舉報。',

    'heading_questions' => '查詢、投訴及閣下之權利',

    'questions_dpo' => '倘閣下對本通知或本公司處理閣下個人資料之方式有任何疑問，請聯絡本公司資料保護主任 (Data Protection Officer)：:privacy_email。',

    'questions_pdpc' => '倘閣下擬就本公司處理閣下個人資料之方式提出投訴，閣下有權向個人資料保護專員投訴。聯絡資料載於 https://www.pdp.gov.my。',

    'closing' => '本公司就此事件深表歉意。本通知以最直接坦白之方式撰寫，目的是讓閣下確切知悉事件經過及本公司之應對措施。',

    'signoff' => '謹啟',

    'signatory_name' => 'Hee Chee Koon',
    'signatory_title' => '主席兼董事 (Chairman & Director)',
    'signatory_entity' => 'HANSMED MODERN TCM SDN. BHD.',
    'signatory_company_no' => '（公司註冊號 202601016057 / 1678154-V）',

];
