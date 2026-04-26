<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * One-shot seeder that imports the three hand-built articles
 * (TCM treatment types / online consultation / tongue diagnosis)
 * that previously shipped as static HTML pages at /v2/blog/*.html
 * into the blog_posts table so the new dynamic article viewer
 * can render them.
 *
 * The article body HTML lives in
 *   backend/database/seed-articles/<slug>.html
 *
 * Idempotent — uses updateOrCreate keyed on slug, so re-running
 * just refreshes the body content. Safe to call any number of times.
 *
 * Triggered from the admin blog panel via the "Seed legacy articles"
 * button, or directly: POST /api/admin/migrate/blog-seed-articles
 */
class BlogSeedController extends Controller
{
    /** Hard-coded metadata for each legacy article — matches the original
     *  hero blocks that used to live in the static HTML pages. */
    private const ARTICLES = [
        [
            'slug'             => 'tcm-treatment-types',
            'title'            => 'Understanding TCM Treatment Types: Acupuncture, Herbal Medicine & Manipulation',
            'title_zh'         => '認識中醫療法：針灸、中藥與推拿',
            'subtitle'         => 'A beginner-friendly walk through the three core modalities of Traditional Chinese Medicine.',
            'subtitle_zh'      => '針灸、中藥、推拿——中醫三大療法入門指南。',
            'excerpt'          => 'When people say they are "going for TCM," they often mean something different each time. Understanding which modality does what — and when each is most appropriate — helps you have a better conversation with your practitioner.',
            'excerpt_zh'       => '中醫不是單一療法，而是針灸、中藥、推拿等多種療法組合而成的完整體系。了解每一種療法的作用，能幫助你與醫師更好地溝通。',
            'thumb_initial'    => '醫',
            'thumb_label'      => 'TREATMENTS',
            'reading_time_min' => 5,
            'category_slug'    => 'treatments',
            'author_name'      => 'Mr. Siew Kuen Xian · Co-Founder, Head Practitioner',
            'published_at'     => '2026-03-15 09:00:00',
        ],
        [
            'slug'             => 'online-tcm-consultation',
            'title'            => 'The Pros of Online TCM Consultation — And When to Come In Person',
            'title_zh'         => '線上問診的優勢，以及何時需要親身到診',
            'subtitle'         => 'How modern teleconsultation expands access to TCM — and the cases where in-person care is still essential.',
            'subtitle_zh'      => '線上中醫如何讓中醫服務觸手可及，以及哪些情況下仍需親自到診。',
            'excerpt'          => 'Online consultation has reshaped how patients access TCM in Malaysia — but it is not a one-size-fits-all replacement for in-person care. Here is when teleconsult shines, and when you should still come in.',
            'excerpt_zh'       => '線上中醫問診讓更多患者能夠便捷地獲得中醫服務，但並非所有情況都適合線上問診。本文為您詳細說明。',
            'thumb_initial'    => '線',
            'thumb_label'      => 'TELECONSULT',
            'reading_time_min' => 4,
            'category_slug'    => 'teleconsult',
            'author_name'      => 'Mr. Lim Gao Hong · Co-Founder, Head Practitioner',
            'published_at'     => '2026-02-08 09:00:00',
        ],
        [
            'slug'             => 'tongue-diagnosis-guide',
            'title'            => 'How Practitioners Read Your Tongue: The Ancient Art of 舌診',
            'title_zh'         => '中醫如何通過舌診了解您的健康狀況',
            'subtitle'         => 'A 2,000-year-old diagnostic art, decoded for modern patients.',
            'subtitle_zh'      => '兩千年的舌診藝術，現代患者也能理解。',
            'excerpt'          => 'In Chinese medicine, the tongue is a window into the body. Its shape, colour, coating, and moisture all reveal information about your internal organ systems — and a trained practitioner can read those signals at a glance.',
            'excerpt_zh'       => '中醫認為舌頭是身體的縮影。透過觀察舌的形狀、顏色、舌苔與濕潤度，醫師能夠了解您的內臟健康狀況。',
            'thumb_initial'    => '舌',
            'thumb_label'      => 'DIAGNOSIS',
            'reading_time_min' => 6,
            'category_slug'    => 'tongue',
            'author_name'      => 'Mr. Siew Kuen Xian · Co-Founder, Head Practitioner',
            'published_at'     => '2026-01-12 09:00:00',
        ],
    ];

    /** POST /api/admin/migrate/blog-seed-articles — admin only */
    public function seed(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $seedDir = base_path('database/seed-articles');
        $results = [];

        foreach (self::ARTICLES as $meta) {
            $bodyPath = $seedDir . '/' . $meta['slug'] . '.html';
            if (! is_file($bodyPath)) {
                $results[] = ['slug' => $meta['slug'], 'status' => 'skipped', 'reason' => 'body file missing: ' . $bodyPath];
                continue;
            }

            $bodyHtml = file_get_contents($bodyPath);
            if ($bodyHtml === false) {
                $results[] = ['slug' => $meta['slug'], 'status' => 'error', 'reason' => 'could not read body file'];
                continue;
            }

            $categoryId = null;
            if (! empty($meta['category_slug'])) {
                $cat = BlogCategory::where('slug', $meta['category_slug'])->first();
                if ($cat) $categoryId = $cat->id;
            }

            // Use updateOrCreate so re-running refreshes the body without
            // duplicating posts. Author_id is intentionally null — these
            // are legacy articles without a real owning user; the
            // displayed byline comes from author_name instead.
            $post = BlogPost::updateOrCreate(
                ['slug' => $meta['slug']],
                [
                    'title'            => $meta['title'],
                    'title_zh'         => $meta['title_zh'] ?? null,
                    'subtitle'         => $meta['subtitle'] ?? null,
                    'subtitle_zh'      => $meta['subtitle_zh'] ?? null,
                    'excerpt'          => $meta['excerpt'] ?? null,
                    'excerpt_zh'       => $meta['excerpt_zh'] ?? null,
                    'body_html'        => $bodyHtml,
                    'body_zh_html'     => null,
                    'thumb_initial'    => $meta['thumb_initial'] ?? null,
                    'thumb_label'      => $meta['thumb_label'] ?? null,
                    'reading_time_min' => $meta['reading_time_min'] ?? null,
                    'category_id'      => $categoryId,
                    'author_id'        => null,
                    'author_name'      => $meta['author_name'],
                    'status'           => 'published',
                    'published_at'     => $meta['published_at'],
                ]
            );

            $results[] = ['slug' => $post->slug, 'status' => $post->wasRecentlyCreated ? 'created' : 'updated', 'id' => $post->id];

            $this->audit($request->user()->id, 'blog.seed.imported', $post->id, ['slug' => $post->slug]);
        }

        return response()->json([
            'message' => 'Legacy articles seeded',
            'results' => $results,
        ]);
    }

    private function audit(int $userId, string $action, int $postId, array $payload): void
    {
        try {
            DB::table('audit_logs')->insert([
                'user_id'     => $userId,
                'action'      => $action,
                'target_type' => 'blog_post',
                'target_id'   => $postId,
                'payload'     => json_encode($payload),
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) { /* ignore */ }
    }
}
