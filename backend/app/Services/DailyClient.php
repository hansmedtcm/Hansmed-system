<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Daily.co REST API wrapper for video consultations.
 *
 * Daily is the third video provider option (alongside jitsi + google_meet).
 * Picked over Agora/Twilio for HansMed because:
 *   - Generous free tier (10k participant-min/month) covers pilot
 *   - Singapore edge servers — minimal latency for Malaysian patients
 *   - HIPAA + SOC 2 + GDPR-ready (matches our PDPA posture)
 *   - Recording available out-of-the-box (no Jibri to host)
 *   - Drop-in iframe OR full-control SDK both supported
 *
 * Configuration (Railway env vars):
 *   DAILY_API_KEY    — from dashboard.daily.co → Developers → API keys
 *   DAILY_DOMAIN     — your daily subdomain, e.g. 'hansmed' for hansmed.daily.co
 *
 * Plus admin must set system_configs.video_provider = 'daily' to activate.
 */
class DailyClient
{
    private const BASE = 'https://api.daily.co/v1';

    public function __construct(
        private readonly string $apiKey,
        private readonly string $domain
    ) {}

    /**
     * Build from env. Returns null if env vars missing — caller falls back
     * to the previous provider so a misconfiguration never silently breaks
     * a live appointment.
     */
    public static function fromConfig(): ?self
    {
        $key = env('DAILY_API_KEY');
        $dom = env('DAILY_DOMAIN');
        if (! $key || ! $dom) return null;
        return new self($key, $dom);
    }

    /**
     * Idempotent — fetch the room if it exists, create if it doesn't.
     * We name rooms deterministically per appointment so doctor + patient
     * always join the same room without coordination.
     */
    public function getOrCreateRoom(string $roomName, array $properties = []): ?array
    {
        try {
            $existing = Http::withToken($this->apiKey)
                ->timeout(10)
                ->get(self::BASE . '/rooms/' . $roomName);
            if ($existing->successful()) {
                return $existing->json();
            }
        } catch (\Throwable $e) {
            Log::warning('daily_room_fetch_failed', ['err' => $e->getMessage()]);
        }

        // Defaults tuned for a clinical consultation:
        //  - private + token-gated so randoms can't guess the URL
        //  - 24h expiry on the room itself (rebuilt on next consult)
        //  - no prejoin screen so doctor & patient land straight in
        //  - chat + screenshare enabled
        $defaults = [
            'name' => $roomName,
            'privacy' => 'private',
            'properties' => [
                'enable_chat' => true,
                'enable_screenshare' => true,
                'enable_prejoin_ui' => false,
                'enable_knocking' => false,
                'start_video_off' => false,
                'start_audio_off' => false,
                'exp' => time() + 86400,
                'lang' => 'en',
            ],
        ];
        $payload = array_replace_recursive($defaults, ['properties' => $properties]);

        try {
            $created = Http::withToken($this->apiKey)
                ->timeout(10)
                ->post(self::BASE . '/rooms', $payload);
            if (! $created->successful()) {
                Log::error('daily_room_create_failed', [
                    'status' => $created->status(),
                    'body' => $created->body(),
                ]);
                return null;
            }
            return $created->json();
        } catch (\Throwable $e) {
            Log::error('daily_room_create_exception', ['err' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Mint a short-lived meeting token so a specific user can join a
     * private room. Token carries display name + owner flag.
     *
     * Owner = doctor (can mute others, end call). Non-owner = patient.
     */
    public function createMeetingToken(
        string $roomName,
        string $userName,
        bool $isOwner = false,
        int $ttlSeconds = 7200
    ): ?string {
        try {
            $res = Http::withToken($this->apiKey)
                ->timeout(10)
                ->post(self::BASE . '/meeting-tokens', [
                    'properties' => [
                        'room_name' => $roomName,
                        'user_name' => $userName,
                        'is_owner' => $isOwner,
                        'exp' => time() + $ttlSeconds,
                        // Auto eject patients after 4h so a forgotten
                        // session doesn't accumulate participant-minutes.
                        'eject_after_elapsed' => 14400,
                    ],
                ]);
            if (! $res->successful()) {
                Log::warning('daily_token_failed', [
                    'status' => $res->status(),
                    'body' => $res->body(),
                ]);
                return null;
            }
            return $res->json('token');
        } catch (\Throwable $e) {
            Log::error('daily_token_exception', ['err' => $e->getMessage()]);
            return null;
        }
    }

    public function domain(): string { return $this->domain; }
}
