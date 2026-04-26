<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BlogCategory extends Model
{
    protected $table = 'blog_categories';
    public $timestamps = false; // only created_at on this table

    protected $fillable = ['slug', 'name', 'name_zh', 'display_order'];

    protected $casts = [
        'display_order' => 'integer',
        'created_at'    => 'datetime',
    ];

    public function posts() { return $this->hasMany(BlogPost::class, 'category_id'); }
}
