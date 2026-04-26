<?php

namespace App\Http\Controllers\Blog;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogCategory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Admin + doctor blog management.
 *
 * Permissions matrix (enforced inside each method, not via middleware,
 * so doctors can self-serve their own posts without needing a separate
 * 'doctor' route group):
 *
 *   role=admin:
 *     - List ALL posts in any status
 *     - Create / edit / delete ANY post
 *     - Approve a doctor's pending_review post (publish or reject back to draft)
 *
 *   role=doctor:
 *     - List + edit ONLY their own posts (any status)
 *     - Create new posts (start as draft)
 *     - Submit own draft → pending_review (admin then approves)
 *     - Cannot publish directly; cannot edit other doctors' posts;
 *       cannot manage categories
 *
 *   role=patient/pharmacy: 403 — no blog access
 */
class BlogAdminController extends Controller
{
    /** GET /api/admin/blog/posts — list all (admin) or own (doctor) */
    public function index(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['admin', 'doctor'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = BlogPost::with('category')->orderByDesc('updated_at');
        if ($user->role === 'doctor') {
            $q->where('author_id', $user->id);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return response()->json($q->paginate(50));
    }

    /** GET /api/admin/blog/posts/{id} — single post (full body) */
    public function show(Request $request, int $id)
    {
        $post = BlogPost::with('category', 'author')->findOrFail($id);
        $this->authorizePostAccess($request->user(), $post, 'view');
        return response()->json(['post' => $post]);
    }

    /** POST /api/admin/blog/posts — create */
    public function store(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['admin', 'doctor'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $this->validatePayload($request, null);

        // Doctors can only create as draft or pending_review.
        if ($user->role === 'doctor' && ! in_array($data['status'] ?? 'draft', ['draft', 'pending_review'], true)) {
            $data['status'] = 'draft';
        }

        $data['slug']         = $this->makeUniqueSlug($data['title'], null);
        $data['author_id']    = $user->id;
        $data['author_name']  = $this->resolveDisplayName($user);
        $data['view_count']   = 0;
        if (($data['status'] ?? null) === 'published' && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        $post = BlogPost::create($data);
        $this->audit($user->id, 'blog.post.created', $post->id, ['title' => $post->title]);
        return response()->json(['post' => $post->fresh(['category'])], 201);
    }

    /** PUT /api/admin/blog/posts/{id} — update */
    public function update(Request $request, int $id)
    {
        $user = $request->user();
        $post = BlogPost::findOrFail($id);
        $this->authorizePostAccess($user, $post, 'edit');

        $data = $this->validatePayload($request, $id);

        // Doctors cannot publish directly — clamp to draft / pending_review.
        if ($user->role === 'doctor') {
            $newStatus = $data['status'] ?? $post->status;
            if (! in_array($newStatus, ['draft', 'pending_review'], true)) {
                $data['status'] = $post->status === 'published' ? 'published' : 'draft';
            }
        }

        // Slug only regenerated if title changed AND admin opted in by
        // not sending an explicit slug. Existing public URLs are
        // preserved by default.
        if (isset($data['title']) && $data['title'] !== $post->title && empty($data['slug'])) {
            $data['slug'] = $this->makeUniqueSlug($data['title'], $post->id);
        }

        // First-publish stamp.
        if (($data['status'] ?? null) === 'published'
            && $post->status !== 'published'
            && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        $post->fill($data)->save();
        $this->audit($user->id, 'blog.post.updated', $post->id, ['title' => $post->title]);
        return response()->json(['post' => $post->fresh(['category'])]);
    }

    /** DELETE /api/admin/blog/posts/{id} */
    public function destroy(Request $request, int $id)
    {
        $user = $request->user();
        $post = BlogPost::findOrFail($id);
        $this->authorizePostAccess($user, $post, 'delete');
        $post->delete();
        $this->audit($user->id, 'blog.post.deleted', $id, ['title' => $post->title]);
        return response()->json(['ok' => true]);
    }

    /** POST /api/admin/blog/posts/{id}/approve — admin only */
    public function approve(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can approve posts'], 403);
        }
        $post = BlogPost::findOrFail($id);
        if ($post->status !== 'pending_review') {
            return response()->json(['message' => 'Post is not pending review'], 422);
        }
        $post->update([
            'status'       => 'published',
            'published_at' => $post->published_at ?? now(),
        ]);
        $this->audit($request->user()->id, 'blog.post.approved', $post->id, ['title' => $post->title]);
        return response()->json(['post' => $post->fresh(['category'])]);
    }

    /** POST /api/admin/blog/posts/{id}/reject — admin only — kicks back to draft */
    public function reject(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can reject posts'], 403);
        }
        $post = BlogPost::findOrFail($id);
        if ($post->status !== 'pending_review') {
            return response()->json(['message' => 'Post is not pending review'], 422);
        }
        $reason = $request->input('reason', '');
        $post->update(['status' => 'draft']);
        $this->audit($request->user()->id, 'blog.post.rejected', $post->id, ['title' => $post->title, 'reason' => $reason]);
        return response()->json(['post' => $post->fresh(['category'])]);
    }

    // ── Categories (admin only) ─────────────────────────────────

    /** GET /api/admin/blog/categories */
    public function categoriesIndex(Request $request)
    {
        if (! in_array($request->user()->role, ['admin', 'doctor'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return response()->json([
            'categories' => BlogCategory::orderBy('display_order')->orderBy('name')->get(),
        ]);
    }

    public function categoryStore(Request $request)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        $data = $request->validate([
            'slug'          => ['required', 'string', 'max:80', 'regex:/^[a-z0-9-]+$/', 'unique:blog_categories,slug'],
            'name'          => ['required', 'string', 'max:120'],
            'name_zh'       => ['nullable', 'string', 'max:120'],
            'display_order' => ['nullable', 'integer'],
        ]);
        return response()->json(['category' => BlogCategory::create($data)], 201);
    }

    public function categoryUpdate(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        $cat = BlogCategory::findOrFail($id);
        $data = $request->validate([
            'name'          => ['nullable', 'string', 'max:120'],
            'name_zh'       => ['nullable', 'string', 'max:120'],
            'display_order' => ['nullable', 'integer'],
        ]);
        $cat->fill(array_filter($data, fn($v) => $v !== null))->save();
        return response()->json(['category' => $cat]);
    }

    public function categoryDestroy(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        BlogCategory::findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    // ── Helpers ─────────────────────────────────────────────────

    private function validatePayload(Request $request, ?int $existingId): array
    {
        $unique = $existingId
            ? "unique:blog_posts,slug,{$existingId}"
            : 'unique:blog_posts,slug';

        return $request->validate([
            'title'            => ['required', 'string', 'max:220'],
            'title_zh'         => ['nullable', 'string', 'max:220'],
            'subtitle'         => ['nullable', 'string', 'max:300'],
            'subtitle_zh'      => ['nullable', 'string', 'max:300'],
            'excerpt'          => ['nullable', 'string', 'max:1000'],
            'excerpt_zh'       => ['nullable', 'string', 'max:1000'],
            'body_html'        => ['nullable', 'string'],
            'body_zh_html'     => ['nullable', 'string'],
            'cover_image_url'  => ['nullable', 'url', 'max:500'],
            'thumb_initial'    => ['nullable', 'string', 'max:8'],
            'thumb_label'      => ['nullable', 'string', 'max:60'],
            'category_id'      => ['nullable', 'integer', 'exists:blog_categories,id'],
            'reading_time_min' => ['nullable', 'integer', 'min:1', 'max:60'],
            'status'           => ['nullable', 'in:draft,pending_review,published,archived'],
            'published_at'     => ['nullable', 'date'],
            'slug'             => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9-]+$/', $unique],
        ]);
    }

    private function authorizePostAccess(User $user, BlogPost $post, string $action): void
    {
        if ($user->role === 'admin') return;
        if ($user->role === 'doctor' && $post->author_id === $user->id) return;
        abort(403, 'You can only ' . $action . ' your own posts.');
    }

    /**
     * Slugify a title and ensure uniqueness by appending -2, -3, … if
     * the base slug already exists. Excluded id lets us call this
     * during update without colliding with the row we're updating.
     */
    private function makeUniqueSlug(string $title, ?int $excludeId): string
    {
        $base = Str::slug($title);
        if ($base === '') $base = 'post-' . now()->format('Ymd-His');
        $slug = $base;
        $i = 2;
        while (true) {
            $q = BlogPost::where('slug', $slug);
            if ($excludeId) $q->where('id', '!=', $excludeId);
            if (! $q->exists()) return $slug;
            $slug = $base . '-' . $i++;
            if ($i > 100) return $base . '-' . now()->timestamp; // give up
        }
    }

    private function resolveDisplayName(User $user): string
    {
        if ($user->role === 'doctor') {
            $name = $user->doctorProfile->full_name ?? null;
            if ($name) return 'Mr. ' . $name; // honorific consistent with article footers
        }
        if ($user->role === 'admin') return 'HansMed Editorial';
        return $user->email;
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
        } catch (\Throwable $e) { /* audit_logs missing? ignore */ }
    }
}
