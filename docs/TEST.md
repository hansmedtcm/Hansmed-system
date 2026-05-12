# HansMed v2 — Test Matrix

Manual smoke tests. Run through this before promoting `/v2/` to root.

## Golden paths (do these every release)

| # | Role     | Journey                                              | Expected result                                  |
|---|----------|------------------------------------------------------|--------------------------------------------------|
| 1 | public   | Land on index.html → open Login modal → submit       | Redirects to correct portal based on role        |
| 2 | patient  | Register → complete profile wall                     | Profile locks, overview dashboard loads          |
| 3 | patient  | Browse doctors → view detail → book slot → pay       | Appointment appears in Appointments panel        |
| 4 | patient  | Upload tongue image                                  | Analysis returns, entry appears in history       |
| 5 | patient  | Join video consultation                              | Jitsi loads in iframe, can leave gracefully      |
| 6 | doctor   | See today's queue → start consult → issue Rx         | Prescription appears in patient's Prescriptions  |
| 7 | doctor   | Request withdrawal → check status                    | Shows "pending" until admin reviews              |
| 8 | pharmacy | See new order in inbox → dispense → ship             | Order status progresses correctly                |
| 9 | pharmacy | Run POS sale (cash + card) → complete                | Sale recorded, daily summary updates             |
| 10| admin    | Approve pending doctor → doctor can now log in       | Doctor appears in doctors list                   |
| 11| admin    | Approve withdrawal → doctor earnings decrement       | Withdrawal status changes to approved            |
| 12| admin    | Export orders CSV → open in Excel                    | File downloads, all rows present                 |

## Edge cases

- [ ] Session expired (manually delete localStorage token) → next API call redirects to login
- [ ] Network offline → shows error state with retry button
- [ ] Slow network (throttle to 3G) → loading states visible, no UI flash
- [ ] Double-click submit → button disables, no duplicate submissions
- [ ] Back button after navigation → returns to previous panel state
- [ ] Deep link (e.g. `portal.html#/appointments/123`) → opens correct panel on load

## Cross-browser

Test on at least one of each:
- [ ] Chrome (latest)
- [ ] Safari (desktop)
- [ ] Safari (iOS)
- [ ] Firefox
- [ ] Chrome Android

## Responsive

- [ ] 375px (iPhone SE) — sidebar collapses to hamburger
- [ ] 768px (iPad) — sidebar visible, cards reflow
- [ ] 1280px (laptop) — full layout

## Accessibility

- [ ] Tab key reaches every interactive element
- [ ] Enter submits forms
- [ ] Esc closes modals
- [ ] Focus rings visible on all inputs and buttons
- [ ] Screen reader (VoiceOver/NVDA) announces page changes
- [ ] Color contrast passes WCAG AA

## Bilingual

- [ ] Language switcher toggles EN ↔ ZH
- [ ] All error messages have both languages
- [ ] Date/currency formats correct for Malaysia (RM, DD/MM/YYYY)
