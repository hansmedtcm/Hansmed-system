<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContentController extends Controller
{
    public function index()
    {
        $pages = DB::table('content_pages')->orderBy('slug')->get();
        return response()->json(['pages' => $pages]);
    }

    public function show(string $slug)
    {
        $page = DB::table('content_pages')->where('slug', $slug)->first();
        if (!$page) abort(404);
        return response()->json(['page' => $page]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'slug'      => ['required', 'string', 'max:120', 'regex:/^[a-z0-9\-]+$/'],
            'title'     => ['required', 'string', 'max:200'],
            'body_html' => ['required', 'string'],
            'locale'    => ['nullable', 'string', 'max:10'],
        ]);

        DB::table('content_pages')->updateOrInsert(
            ['slug' => $data['slug']],
            [
                'title'      => $data['title'],
                'body_html'  => $data['body_html'],
                'locale'     => $data['locale'] ?? 'en',
                'updated_by' => $request->user()->id,
                'updated_at' => now(),
                'created_at' => DB::raw('IFNULL(created_at, NOW())'),
            ]
        );

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'content.upsert',
            'target_type' => 'content_page',
            'payload'     => json_encode(['slug' => $data['slug']]),
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Page saved']);
    }

    public function destroy(Request $request, string $slug)
    {
        DB::table('content_pages')->where('slug', $slug)->delete();
        return response()->json(['ok' => true]);
    }
}
