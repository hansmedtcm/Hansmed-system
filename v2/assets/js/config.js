/**
 * HansMed Config
 * Single source of truth for environment-dependent values.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};
  window.HM.config = {
    API_BASE: 'https://hansmed-system-production.up.railway.app/api',

    JITSI_DOMAIN: 'meet.jit.si',

    // Feature flags
    FEATURES: {
      chat: true,
      video: true,
      pos: true,
      multilang: true,
    },

    // Notification polling interval (ms)
    NOTIF_POLL_INTERVAL: 60000,

    // API request timeout (ms)
    API_TIMEOUT: 15000,

    // Default language
    DEFAULT_LANG: 'en',

    // Storage keys
    STORAGE: {
      token: 'hm_token',
      user: 'hm_user',
      lang: 'hm_lang',
    },

    // Emergency contact (Malaysia)
    EMERGENCY: {
      number: '999',
      text: 'If you are experiencing a medical emergency, please call 999 immediately. HansMed is not for emergency care.',
      textZh: '如遇緊急醫療情況，請立即撥打 999。漢方現代中醫不提供緊急醫療服務。',
    },

    // Clinic info (will be loaded from /api/admin/configs when available)
    CLINIC: {
      name: 'HansMed Modern TCM',
      nameZh: '漢方現代中醫',
      email: 'support@hansmed.com.my',
      phone: '+60 3-1234 5678',
      // WhatsApp for appointment booking — used by the landing CTA.
      // Format: country code + number, NO '+' prefix, no spaces or dashes.
      // e.g. Malaysia +60 12-345 6789 → '60123456789'
      whatsapp: '60123456789',
      whatsappMessage: 'Hi HansMed, I would like to book an appointment. 您好，我想預約。',
    },
  };
})();
