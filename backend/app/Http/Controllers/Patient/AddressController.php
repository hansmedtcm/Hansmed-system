<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\Address;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddressController extends Controller
{
    // C-15
    public function index(Request $request)
    {
        return response()->json(
            Address::where('user_id', $request->user()->id)
                ->orderByDesc('is_default')
                ->orderByDesc('id')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $data = $this->rules($request);
        return DB::transaction(function () use ($data, $request) {
            if (! empty($data['is_default'])) {
                Address::where('user_id', $request->user()->id)->update(['is_default' => false]);
            }
            $addr = Address::create(['user_id' => $request->user()->id] + $data);
            return response()->json(['address' => $addr], 201);
        });
    }

    public function update(Request $request, int $id)
    {
        $addr = Address::where('user_id', $request->user()->id)->findOrFail($id);
        $data = $this->rules($request);
        return DB::transaction(function () use ($addr, $data, $request) {
            if (! empty($data['is_default'])) {
                Address::where('user_id', $request->user()->id)->update(['is_default' => false]);
            }
            $addr->update($data);
            return response()->json(['address' => $addr]);
        });
    }

    public function destroy(Request $request, int $id)
    {
        Address::where('user_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    private function rules(Request $request): array
    {
        return $request->validate([
            'recipient'   => ['required', 'string', 'max:120'],
            'phone'       => ['required', 'string', 'max:40'],
            'country'     => ['required', 'string', 'max:80'],
            'state'       => ['nullable', 'string', 'max:80'],
            'city'        => ['required', 'string', 'max:80'],
            'line1'       => ['required', 'string', 'max:255'],
            'line2'       => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'is_default'  => ['nullable', 'boolean'],
        ]);
    }
}
