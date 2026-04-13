<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $q = DB::table('audit_logs')
            ->leftJoin('users', 'audit_logs.user_id', '=', 'users.id')
            ->select('audit_logs.*', 'users.email as user_email', 'users.role as user_role');

        if ($action = $request->query('action')) {
            $q->where('audit_logs.action', 'like', "%{$action}%");
        }
        if ($userId = $request->query('user_id')) {
            $q->where('audit_logs.user_id', $userId);
        }
        if ($from = $request->query('from')) {
            $q->where('audit_logs.created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('audit_logs.created_at', '<=', $to . ' 23:59:59');
        }

        return response()->json(
            $q->orderByDesc('audit_logs.created_at')->paginate(50)
        );
    }
}
