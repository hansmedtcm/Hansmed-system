<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

class ContentPageController extends Controller
{
    /** Public endpoint — anyone can view published content pages */
    public function show(string $slug)
    {
        $page = DB::table('content_pages')->where('slug', $slug)->first();
        if (!$page) abort(404, 'Page not found');
        return response()->json(['page' => $page]);
    }

    public function index()
    {
        $pages = DB::table('content_pages')
            ->select('slug', 'title', 'locale')
            ->orderBy('slug')
            ->get();
        return response()->json(['pages' => $pages]);
    }
}
