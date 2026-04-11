<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\DoctorProfile;
use Illuminate\Http\Request;

class DoctorBrowseController extends Controller
{
    // C-09: doctor list (qualification, specialty, rating, volume)
    public function index(Request $request)
    {
        $q = DoctorProfile::query()
            ->where('verification_status', 'approved')
            ->where('accepting_appointments', true);

        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('full_name', 'like', "%{$s}%")
                  ->orWhere('specialties', 'like', "%{$s}%");
            });
        }

        $sort = $request->query('sort', 'rating'); // rating | consultations
        $q->orderByDesc($sort === 'consultations' ? 'consultation_count' : 'rating');

        return response()->json($q->paginate(20));
    }

    public function show(int $doctorId)
    {
        $d = DoctorProfile::where('user_id', $doctorId)
            ->where('verification_status', 'approved')
            ->firstOrFail();
        return response()->json(['doctor' => $d]);
    }
}
