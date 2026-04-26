<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Blog post — admin/doctor-managed article. Replaces the three
 * hardcoded /v2/blog/*.html files with a database-backed CMS.
 *
 * Status workflow:
 *   draft           — author still working on it (any author can edit)
 *   pending_review  — doctor submitted; admin must approve
 *   published       — live on the public blog (only when published_at <= NOW)
 *   archived        — hidden but kept for history
 */
class BlogPost extends Model
{
    protected $table = 'blog_posts';

    protected $fillable = [
        'slug',
        'title', 'title_zh',
        'subtitle', 'subtitle_zh',
        'excerpt', 'excerpt_zh',
        'body_html', 'body_zh_html',
        'cover_image_url',
        'thumb_initial', 'thumb_label',
        'author_id', 'author_name',
        'category_id',
        'reading_time_min',
        'status', 'published_at',
        'view_count',
    ];

    protected $casts = [
        'published_at'    => 'datetime',
        'reading_time_min' => 'integer',
        'view_count'      => 'integer',
    ];

    public function author()   { return $this->belongsTo(User::class, 'author_id'); }
    public function category() { return $this->belongsTo(BlogCategory::class, 'category_id'); }

    /** Posts visible on the public site right now. */
    public function scopeLive($q)
    {
        return $q->where('status', 'published')
                 ->where(function ($w) {
                     $w->whereNull('published_at')->orWhere('published_at', '<=', now());
                 });
    }
}
