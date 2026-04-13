<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SecurityController extends Controller
{
    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password'     => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password_hash)) {
            return response()->json(['message' => 'Current password is incorrect. · 目前密碼不正確。'], 422);
        }

        $user->update(['password_hash' => Hash::make($data['new_password'])]);

        DB::table('audit_logs')->insert([
            'user_id'    => $user->id,
            'action'     => 'password.changed',
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Password changed successfully. · 密碼已更改。']);
    }

    public function deleteAccount(Request $request)
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
            'confirm'  => ['required', 'in:DELETE'],
        ]);

        $user = $request->user();
        if (! Hash::check($data['password'], $user->password_hash)) {
            return response()->json(['message' => 'Password incorrect. · 密碼不正確。'], 422);
        }

        DB::table('audit_logs')->insert([
            'user_id'     => $user->id,
            'action'      => 'account.deleted',
            'target_type' => 'user',
            'target_id'   => $user->id,
            'created_at'  => now(),
        ]);

        // Soft delete — mark as deleted, don't actually remove data
        $user->currentAccessToken()->delete();
        $user->update(['status' => 'deleted']);

        return response()->json(['message' => 'Account deleted. · 帳號已刪除。']);
    }
}
