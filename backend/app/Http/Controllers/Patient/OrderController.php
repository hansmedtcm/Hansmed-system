<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PharmacyProfile;
use App\Models\Prescription;
use App\Models\Product;
use App\Services\StripeClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(private StripeClient $stripe) {}

    // C-12: view own prescriptions
    public function prescriptions(Request $request)
    {
        return response()->json(
            Prescription::where('patient_id', $request->user()->id)
                ->with('items')
                ->orderByDesc('created_at')
                ->paginate(20)
        );
    }

    // C-13: place order from a prescription at a chosen pharmacy
    public function store(Request $request)
    {
        $data = $request->validate([
            'prescription_id' => ['required', 'integer'],
            'pharmacy_id'     => ['required', 'integer'],
            'address_id'      => ['required', 'integer'],
        ]);

        $rx = Prescription::where('patient_id', $request->user()->id)
            ->with('items')
            ->findOrFail($data['prescription_id']);
        if ($rx->status !== 'issued') {
            throw ValidationException::withMessages(['prescription_id' => 'Prescription not available for ordering.']);
        }

        $pharmacy = PharmacyProfile::where('user_id', $data['pharmacy_id'])
            ->where('verification_status', 'approved')
            ->firstOrFail();

        $address = Address::where('user_id', $request->user()->id)
            ->findOrFail($data['address_id']);

        return DB::transaction(function () use ($rx, $pharmacy, $address, $request) {
            $subtotal = 0;
            $lines    = [];

            foreach ($rx->items as $item) {
                // Try to match by product_id first, then by name within this pharmacy
                $product = null;
                if ($item->product_id) {
                    $product = Product::where('id', $item->product_id)
                        ->where('pharmacy_id', $pharmacy->user_id)
                        ->first();
                }
                if (! $product) {
                    $product = Product::where('pharmacy_id', $pharmacy->user_id)
                        ->where('name', $item->drug_name)
                        ->where('is_listed', true)
                        ->first();
                }
                if (! $product) {
                    throw ValidationException::withMessages([
                        'items' => "Pharmacy does not carry: {$item->drug_name}",
                    ]);
                }

                $lineTotal = (float) $product->unit_price * (float) $item->quantity;
                $subtotal += $lineTotal;

                $lines[] = [
                    'product_id'    => $product->id,
                    'drug_name'     => $product->name,
                    'specification' => $product->specification,
                    'unit_price'    => $product->unit_price,
                    'quantity'      => $item->quantity,
                    'unit'          => $item->unit,
                    'line_total'    => $lineTotal,
                ];
            }

            $shipping = 0; // TODO: distance / flat-rate rule
            $total    = $subtotal + $shipping;

            $order = Order::create([
                'order_no'        => 'HM' . now()->format('YmdHis') . strtoupper(Str::random(4)),
                'patient_id'      => $request->user()->id,
                'pharmacy_id'     => $pharmacy->user_id,
                'prescription_id' => $rx->id,
                'address_id'      => $address->id,
                'status'          => 'pending_payment',
                'subtotal'        => $subtotal,
                'shipping_fee'    => $shipping,
                'total'           => $total,
                'currency'        => 'CNY',
            ]);

            foreach ($lines as $line) {
                $order->items()->create($line);
            }

            $intent = $this->stripe->createPaymentIntent(
                amountMinor: (int) round($total * 100),
                currency: 'cny',
                metadata: ['order_id' => $order->id, 'patient_id' => $request->user()->id],
            );

            $payment = Payment::create([
                'user_id'      => $request->user()->id,
                'payable_type' => 'order',
                'payable_id'   => $order->id,
                'provider'     => 'stripe',
                'provider_ref' => $intent['id'] ?? null,
                'amount'       => $total,
                'currency'     => 'CNY',
                'status'       => 'pending',
                'raw_payload'  => $intent,
            ]);

            $order->update(['payment_id' => $payment->id]);

            return response()->json([
                'order'                => $order->load('items'),
                'payment'              => $payment,
                'stripe_client_secret' => $intent['client_secret'] ?? null,
            ], 201);
        });
    }

    // C-16: order list / detail
    public function index(Request $request)
    {
        $q = Order::where('patient_id', $request->user()->id)->with('items', 'shipment');
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        return response()->json($q->orderByDesc('created_at')->paginate(20));
    }

    public function show(Request $request, int $id)
    {
        $order = Order::where('patient_id', $request->user()->id)
            ->with(['items', 'shipment', 'address', 'prescription.items'])
            ->findOrFail($id);
        return response()->json(['order' => $order]);
    }
}
