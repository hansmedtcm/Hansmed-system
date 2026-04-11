<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\PharmacyProfile;
use Illuminate\Http\Request;

class PharmacyBrowseController extends Controller
{
    // C-14: pharmacy list, optionally near lat/lng
    public function index(Request $request)
    {
        $lat = $request->query('lat');
        $lng = $request->query('lng');

        $q = PharmacyProfile::where('verification_status', 'approved');

        if ($lat !== null && $lng !== null) {
            // Haversine in km — fine for MVP; move to spatial index later
            $q->selectRaw(
                'pharmacy_profiles.*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance_km',
                [$lat, $lng, $lat]
            )->whereNotNull('latitude')->whereNotNull('longitude')
             ->orderBy('distance_km');
        }

        return response()->json($q->paginate(20));
    }
}
