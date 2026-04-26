<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogCategory;
use Illuminate\Http\Request;

/**
 * Public read-only API for the blog. Used by the dynamic
 * v2/blog.html (card grid) and v2/article.html (single viewer).
 *
 * Only returns posts with status='published' and published_at <= NOW
 * — drafts and pending-review posts are invisible to the public.
 */
class PublicBlogController extends Controller
{
    /** GET /api/blog/posts — paginated list of live posts. */
    public function index(Request $request)
    {
        $q = BlogPost::live()->orderByDesc('published_at')->orderByDesc('id');

        if ($cat = $request->query('category')) {
            $catRow = BlogCategory::where('slug', $cat)->first();
            if ($catRow) $q->where('category_id', $catRow->id);
        }

        $perPage = min(50, (int) ($request->query('per_page', 20)));
        $posts = $q->paginate($perPage);

        // Trim payload — listing doesn't need full body
        $posts->getCollection()->transform(function ($p) {
            return [
                'id'              => $p->id,
                'slug'            => $p->slug,
                'title'           => $p->title,
                'title_zh'        => $p->title_zh,
                'subtitle'        => $p->subtitle,
                'subtitle_zh'     => $p->subtitle_zh,
                'excerpt'         => $p->excerpt,
                'excerpt_zh'      => $p->excerpt_zh,
                'cover_image_url' => $p->cover_image_url,
                'thumb_initial'   => $p->thumb_initial,
                'thumb_label'     => $p->thumb_label,
                'author_name'     => $p->author_name,
                'category_id'     => $p->category_id,
                'reading_time_min'=> $p->reading_time_min,
                'published_at'    => $p->published_at,
            ];
        });

        return response()->json($posts);
    }

    /** GET /api/blog/posts/{slug} — full single post. */
    public function show(string $slug)
    {
        $post = BlogPost::live()->where('slug', $slug)->first();
        if (! $post) {
            return response()->json(['message' => 'Article not found'], 404);
        }
        // Async view-count increment — not in a transaction, race
        // conditions are fine for an analytics counter.
        BlogPost::where('id', $post->id)->increment('view_count');

        return response()->json([
            'post' => $post,
            'category' => $post->category,
        ]);
    }

    /** GET /api/blog/categories — public list of categories. */
    public function categories()
    {
        return response()->json([
            'categories' => BlogCategory::orderBy('display_order')->orderBy('name')->get(),
        ]);
    }
}
