# Brief #14a — Pre-migration snapshot

These files are the working state of the doctor and patient views BEFORE
the constitution-card component refactor. If the new component breaks
something:

1. Copy `patients.js` back to `v2/assets/js/panels/doctor/patients.js`
2. Copy `ai-diagnosis.js` back to `v2/assets/js/panels/patient/ai-diagnosis.js`
3. Remove the `<script src="assets/js/components/constitution-card.js"></script>` line from `v2/doctor.html` and `v2/portal.html`
4. Optionally delete `v2/assets/js/components/constitution-card.js`
5. Commit, push.

Date: 2026-05-04
Brief: #14a
