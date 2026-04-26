<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use Aws\S3\S3Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Image uploads for the blog editor — pushes the file to a
 * Cloudflare R2 bucket via the S3-compatible API and returns
 * the public URL.
 *
 * Required env vars (set on Railway):
 *   R2_ACCOUNT_ID       — Cloudflare account ID (top-right of dashboard)
 *   R2_ACCESS_KEY_ID    — generated under R2 → API tokens
 *   R2_SECRET_ACCESS_KEY— generated under R2 → API tokens
 *   R2_BUCKET           — bucket name, e.g. 'hansmed-blog'
 *   R2_PUBLIC_URL       — public URL prefix, e.g. 'https://blog-cdn.hansmed.my'
 *                         (set up via R2 → Settings → Public access → custom domain)
 *
 * Without these env vars the endpoint returns 503 with a clear
 * setup message — author can paste a public image URL directly
 * in the editor as a workaround until R2 is configured.
 */
class BlogImageController extends Controller
{
    /** POST /api/admin/blog/upload-image — multipart form, field 'image' */
    public function upload(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['admin', 'doctor'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:8192'], // 8 MB
        ]);

        $r2 = $this->resolveR2();
        if (! $r2) {
            return response()->json([
                'message' => 'Image upload is not configured. Paste an image URL into the editor instead, or ask the admin to set R2_* env vars on Railway.',
            ], 503);
        }

        $file = $request->file('image');
        $ext  = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $key  = 'blog/' . now()->format('Y/m') . '/' . Str::uuid()->toString() . '.' . $ext;

        try {
            $r2['client']->putObject([
                'Bucket'      => $r2['bucket'],
                'Key'         => $key,
                'Body'        => fopen($file->getRealPath(), 'rb'),
                'ContentType' => $file->getMimeType(),
                'CacheControl'=> 'public, max-age=31536000, immutable',
            ]);
        } catch (\Throwable $e) {
            Log::error('blog_image_upload_failed', ['err' => $e->getMessage(), 'key' => $key]);
            return response()->json([
                'message' => 'Upload failed: ' . $e->getMessage(),
            ], 502);
        }

        $url = rtrim($r2['public_url'], '/') . '/' . $key;
        return response()->json([
            'url'  => $url,
            'key'  => $key,
            'size' => $file->getSize(),
        ]);
    }

    /**
     * Build an S3 client pointed at Cloudflare R2's S3-compatible
     * endpoint. Returns null if any required env var is missing —
     * caller surfaces a setup message in that case.
     */
    private function resolveR2(): ?array
    {
        $accountId = env('R2_ACCOUNT_ID');
        $accessKey = env('R2_ACCESS_KEY_ID');
        $secret    = env('R2_SECRET_ACCESS_KEY');
        $bucket    = env('R2_BUCKET');
        $publicUrl = env('R2_PUBLIC_URL');
        if (! $accountId || ! $accessKey || ! $secret || ! $bucket || ! $publicUrl) {
            return null;
        }

        if (! class_exists(S3Client::class)) {
            // aws-sdk-php not installed — log once and abort gracefully.
            Log::warning('R2 configured but aws/aws-sdk-php composer package is missing. Run composer require aws/aws-sdk-php.');
            return null;
        }

        $client = new S3Client([
            'version'                 => 'latest',
            'region'                  => 'auto',
            'endpoint'                => "https://{$accountId}.r2.cloudflarestorage.com",
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key'    => $accessKey,
                'secret' => $secret,
            ],
        ]);

        return [
            'client'     => $client,
            'bucket'     => $bucket,
            'public_url' => $publicUrl,
        ];
    }
}
