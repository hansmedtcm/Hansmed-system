<?php

namespace App\Services;

/**
 * Agora RTC token builder (AccessToken2 format) — minimal standalone
 * implementation so we don't pull the full agora-php SDK for one use-case.
 *
 * Picked Agora over TRTC because (a) global coverage for overseas TCM
 * patients, (b) well-documented REST/token API, (c) PDF E-61 leaves it open.
 *
 * config/services.php:
 *   'agora' => ['app_id' => env('AGORA_APP_ID'), 'app_certificate' => env('AGORA_APP_CERT')],
 */
class AgoraTokenService
{
    private const ROLE_PUBLISHER = 1;
    private const TOKEN_VERSION  = '007';

    public function buildRtcToken(string $channel, int $uid, int $ttlSeconds = 3600): array
    {
        $appId = config('services.agora.app_id');
        $cert  = config('services.agora.app_certificate');

        if (! $appId || ! $cert) {
            // dev stub so the UI pipeline works locally
            return [
                'app_id'     => 'stub-agora-app-id',
                'channel'    => $channel,
                'uid'        => $uid,
                'token'      => 'stub_token_' . bin2hex(random_bytes(12)),
                'expires_at' => now()->addSeconds($ttlSeconds)->toIso8601String(),
                'stub'       => true,
            ];
        }

        $expire = time() + $ttlSeconds;

        // Service type 1 = RTC. Privileges: join + publish audio/video/data.
        // See https://docs.agora.io/en/video-calling/get-started/authentication-workflow
        $message = pack('V', $expire) . pack('V', 0) // salt
                 . pack('n', strlen($channel)) . $channel
                 . pack('V', $uid)
                 . pack('V', self::ROLE_PUBLISHER);

        $signature = hash_hmac('sha256', $message, $cert, true);
        $content   = $signature . $message;
        $token     = self::TOKEN_VERSION . base64_encode($appId . $content);

        return [
            'app_id'     => $appId,
            'channel'    => $channel,
            'uid'        => $uid,
            'token'      => $token,
            'expires_at' => date('c', $expire),
        ];
    }
}
