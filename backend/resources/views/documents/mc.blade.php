<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Medical Certificate · 醫療證明</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI', 'Noto Sans SC', sans-serif; font-size: 12pt; color: #333; margin: 0; padding: 30px; }
  .header { text-align: center; border-bottom: 2px solid #b8965a; padding-bottom: 15px; margin-bottom: 30px; }
  .clinic-name { font-size: 20pt; font-weight: 600; }
  .title { font-size: 16pt; text-align: center; margin: 20px 0; text-transform: uppercase; letter-spacing: 3px; color: #b8965a; }
  .body-text { line-height: 2; font-size: 12pt; margin: 20px 0; }
  .signature { margin-top: 60px; border-top: 1px solid #333; width: 250px; padding-top: 8px; }
  @media print { button { display: none !important; } }
</style>
</head>
<body>
<div class="header">
  <div class="clinic-name">HansMed Modern TCM · 漢方現代中醫</div>
  <div style="font-size: 9pt; color: #7a7068;">Traditional Chinese Medicine · Telehealth & Clinic</div>
</div>

<div class="title">Medical Certificate · 醫療證明書</div>

<div class="body-text">
  This is to certify that <strong>{{ $patient->full_name ?? $patient->nickname ?? 'the patient' }}</strong>
  (IC: {{ $patient->ic_number ?? 'N/A' }}) has been examined
  @if(isset($data['appointment_id'])) (Ref: HM-APT-{{ str_pad($data['appointment_id'], 6, '0', STR_PAD_LEFT) }})@endif
  and is certified unfit for duty for a period of <strong>{{ $data['days'] }} day(s)</strong>,
  from <strong>{{ \Carbon\Carbon::parse($data['start_date'])->format('d M Y') }}</strong>
  to <strong>{{ \Carbon\Carbon::parse($data['start_date'])->addDays($data['days'] - 1)->format('d M Y') }}</strong> (inclusive).

  <br><br>
  <strong>Diagnosis · 診斷:</strong> {{ $data['diagnosis'] }}

  @if(!empty($data['remarks']))
  <br><br>
  <strong>Remarks · 備註:</strong> {{ $data['remarks'] }}
  @endif
</div>

<div class="signature">
  <strong>{{ $doctor->full_name ?? 'Doctor' }}</strong><br>
  {{ $doctor->specialties ?? 'TCM Practitioner' }}<br>
  License: {{ $doctor->license_no ?? 'N/A' }}<br>
  Date: {{ now()->format('d M Y') }}
</div>

<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 25px;background:#1a1612;color:#f5f0e8;border:none;cursor:pointer;">PRINT · 列印</button>
</body>
</html>
