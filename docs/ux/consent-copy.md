# Consent Modal UX Copy — HansMed

**Version:** 1.0
**Date:** 2026-04-21
**Purpose:** Explicit, granular consent flow satisfying PDPA 2010 § 6 (consent) and § 7 (notice and choice)

## Principles

- **Granular:** User consents to each processing purpose separately. No bundled consent.
- **Explicit:** Checkboxes are unchecked by default. No pre-ticked boxes.
- **Revocable:** User can revoke any consent at any time from Account Settings. Revocation applies going forward.
- **Auditable:** Every consent grant/revoke stored with `user_id`, `purpose`, `consent_version`, `timestamp`, `ip_address`, `user_agent`.
- **Versioned:** Changes to consent wording trigger a new `consent_version` and require re-consent.

## Consent Purposes (Master List)

Each purpose has an ID used in database `consent_grants` table.

| ID | Purpose | Required for service? |
|---|---|---|
| `core_account` | Create and operate your HansMed account | YES — if declined, cannot sign up |
| `tongue_image` | Upload and process tongue images for wellness analysis | NO — feature is optional |
| `questionnaire` | Store questionnaire answers for wellness analysis | NO — feature is optional |
| `ai_processing` | Use AI models (third-party) to generate wellness insights | NO — if declined, only practitioner-reviewed output |
| `practitioner_share` | Share your records with practitioners you book | Conditional — needed per booking |
| `marketing_email` | Receive newsletters and promotional content | NO — opt-in only |
| `analytics` | Anonymized usage analytics for product improvement | NO — opt-in only |

## Modal Copy — by Purpose

### M1 — Tongue Wellness Scan upload consent

**Trigger:** When user clicks "Upload tongue photo" for the first time (or if `consent_version` has changed).

**Modal Title:** Consent to tongue image processing

**Body:**

> To generate your wellness analysis, HansMed needs your permission to:
>
> • **Store your tongue photo** on our secure servers (encrypted, retained for up to 90 days unless you request earlier deletion)
> • **Send the photo to our AI wellness analysis service** (operated by [vendor name]) to produce insights
> • **Share the photo with your chosen practitioner** only if you book a consultation
>
> **This is not a medical diagnosis.** Insights are educational only.
>
> You can revoke this consent anytime from **Account → Privacy**. Revocation stops future processing but does not remove photos already analyzed within the retention window.

**Checkboxes (unchecked by default):**

- [ ] I agree to image storage and AI processing (required to continue)
- [ ] I agree to share with a practitioner if I book a consultation (optional — you can decide per booking)

**Buttons:**
- Primary: **Continue** (disabled until required checkbox ticked)
- Secondary: **Cancel**
- Tertiary link: **Read full Privacy Notice**

### M2 — Health questionnaire consent

**Trigger:** First time user opens questionnaire.

**Modal Title:** Consent to questionnaire processing

**Body:**

> Your answers help HansMed produce a general wellness profile. By continuing:
>
> • Your answers are stored confidentially on our servers
> • Your answers may be reviewed by a registered practitioner if you book a consultation
> • Anonymous aggregated data may be used to improve the service (you can opt out below)
>
> **This is not a medical assessment.**

**Checkboxes:**
- [ ] I agree to store and use my answers for wellness analysis (required)
- [ ] I agree to anonymized use for service improvement (optional)

**Buttons:** **Start questionnaire** / **Cancel**

### M3 — Booking a practitioner consultation (data share)

**Trigger:** At checkout of a consultation booking.

**Modal Title:** Share your records with [Practitioner Name]?

**Body:**

> To prepare for your consultation, [Practitioner Name] will need access to:
>
> • Your uploaded tongue photo(s) from the last 30 days
> • Your questionnaire answers
> • Your consultation history on HansMed
>
> [Practitioner Name] is bound by T&CM Council confidentiality standards and by the HansMed Practitioner Agreement.
>
> You can revoke this access after the consultation ends.

**Checkbox:**
- [ ] I agree to share the items above with [Practitioner Name] for this consultation

**Buttons:** **Confirm and pay** (disabled until ticked) / **Back**

### M4 — Revocation / data export screen (Account → Privacy)

**Heading:** Your data and consents

**Body:**

> You control your data. From here you can:
>
> • **See what consents you've given** (with dates)
> • **Revoke any consent** (future processing only)
> • **Download a copy of your data** (PDPA § 30 — we'll email a ZIP within 21 days)
> • **Request deletion of your account and data** (PDPA § 34 — subject to legal retention requirements, e.g. tax records kept 7 years)

**Controls:**
- Table: one row per consent purpose. Columns: Purpose, Given on, Version, [Revoke] button
- **Request data export** button (triggers `GET /patient/data-export` → email ZIP)
- **Delete my account** button (double-confirmation modal)

### M5 — Re-consent prompt (version bump)

**Trigger:** On login, if `user.consent_version < current_consent_version`

**Modal Title:** We've updated our Privacy Notice

**Body:**

> Since you last agreed, we've updated how we describe our data practices. Nothing about what we do with your data has fundamentally changed — we've just made the notice clearer.
>
> Please review and re-confirm to continue.

**Buttons:** **Review Privacy Notice** / **I agree, continue** / **Log out**

## Database Shape (for coder)

```sql
CREATE TABLE consent_grants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  purpose_id VARCHAR(64) NOT NULL,
  granted BOOLEAN NOT NULL,
  consent_version VARCHAR(16) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64),
  user_agent TEXT,
  INDEX idx_user_purpose (user_id, purpose_id)
);
```

Insert a new row on every grant AND every revoke (revoke = `granted: false`). Query latest row per `(user_id, purpose_id)` to determine current state.

## Acceptance Criteria for Coder

- [ ] `consent_grants` table migrated
- [ ] Modals M1–M5 implemented and triggered correctly
- [ ] Checkboxes unchecked by default; no pre-ticked consent
- [ ] Audit row written on every grant and revoke
- [ ] Account → Privacy screen lists active consents with revoke button
- [ ] `GET /patient/data-export` endpoint exists, returns 202 and queues export
- [ ] Current `consent_version` stored in `config/privacy.php` or env
- [ ] E2E test: user can grant, revoke, re-grant, export, and delete
