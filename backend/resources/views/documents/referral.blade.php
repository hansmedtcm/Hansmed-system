<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Referral Letter · 轉介信</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI', 'Noto Sans SC', sans-serif; font-size: 12pt; color: #333; margin: 0; padding: 30px; }
  .header { text-align: center; border-bottom: 2px solid #b8965a; padding-bottom: 15px; margin-bottom: 30px; }
  .clinic-name { font-size: 20pt; font-weight: 600; }
  .title { font-size: 16pt; text-align: center; margin: 20px 0; text-transform: uppercase; letter-spacing: 3px; color: #b8965a; }
  .body-text { line-height: 1.8; font-size: 11pt; }
  .section { margin: 15px 0; }
  .label { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #b8965a; margin-bottom: 3px; }
  .signature { margin-top: 50px; border-top: 1px solid #333; width: 250px; padding-top: 8px; }
  @media print { button { display: none !important; } }
</style>
</head>
<body>
<div class="header">
  <div class="clinic-name">HansMed Modern TCM · 漢方現代中醫</div>
  <div style="font-size: 9pt; color: #7a7068;">Traditional Chinese Medicine · Telehealth & Clinic</div>
</div>

<div class="title">Referral Letter · 轉介信</div>

<div style="margin-bottom: 20px;">
  <div class="label">Date · 日期</div>
  {{ now()->format('d M Y') }}
</div>

<div class="body-text">
  <div class="section">
    <div class="label">To · 致</div>
    <strong>{{ $data['referred_to'] }}</strong>
    @if(!empty($data['specialty'])) — {{ $data['specialty'] }} @endif
  </div>

  <div class="section">
    <div class="label">Re: Patient · 患者</div>
    <strong>{{ $patient->full_name ?? $patient->nickname ?? 'Patient' }}</strong>
    (IC: {{ $patient->ic_number ?? 'N/A' }}, DOB: {{ $patient->birth_date?->format('d M Y') ?? 'N/A' }})
  </div>

  <p>Dear Colleague,</p>

  <p>I am writing to refer the above-named patient for your expert opinion and management.</p>

  <div class="section">
    <div class="label">Diagnosis · 診斷</div>
    {{ $data['diagnosis'] }}
  </div>

  <div class="section">
    <div class="label">Reason for Referral · 轉介原因</div>
    {{ $data['reason'] }}
  </div>

  @if(!empty($data['clinical_notes']))
  <div class="section">
    <div class="label">Clinical Notes · 臨床記錄</div>
    {{ $data['clinical_notes'] }}
  </div>
  @endif

  <p>Thank you for seeing this patient. Please do not hesitate to contact me if you require further information.</p>
</div>

<div class="signature">
  <strong>{{ $doctor->full_name ?? 'Doctor' }}</strong><br>
  {{ $doctor->specialties ?? 'TCM Practitioner' }}<br>
  License: {{ $doctor->license_no ?? 'N/A' }}<br>
  HansMed Modern TCM
</div>

<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 25px;background:#1a1612;color:#f5f0e8;border:none;cursor:pointer;">PRINT · 列印</button>
</body>
</html>
