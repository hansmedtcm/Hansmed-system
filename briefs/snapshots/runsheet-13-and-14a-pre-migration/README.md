# Runsheet snapshot — Brief #13 + #14a (2026-05-04)

Covers both briefs. Files reconstructed from git history (the runsheet was
recognised retroactively after both briefs had already shipped):

  · `services.html`          — v3/services.html as of commit 928935c (pre-Brief #13)
  · `patients.js`            — v2/.../doctor/patients.js as of commit 1db0859 (pre-Brief #14a)
  · `ai-diagnosis.js`        — v2/.../patient/ai-diagnosis.js as of commit 1db0859 (pre-Brief #14a)
  · `v2-doctor.html`         — v2/doctor.html as of commit 1db0859 (pre-Brief #14a)
  · `v2-portal.html`         — v2/portal.html as of commit 1db0859 (pre-Brief #14a)
  · `v3-index.html`          — v3/index.html as of commit 1db0859 (pre-Brief #14a)
  · `v3-about.html`          — v3/about.html as of commit 1db0859 (pre-Brief #14a)
  · `v3-practitioners.html`  — v3/practitioners.html as of commit 1db0859 (pre-Brief #14a)

The Brief-#14a-only snapshot at `briefs/snapshots/brief-14a-pre-migration/`
also exists from the original Brief #14a execution; the two snapshots can
coexist (the runsheet says they should).

## Rollback Brief #13 only

```bash
SNAP=briefs/snapshots/runsheet-13-and-14a-pre-migration
cp $SNAP/services.html v3/services.html
git add -A && git commit -m "Rollback Brief #13" && git push
```

## Rollback Brief #14a only (keep #13 pricing changes)

```bash
SNAP=briefs/snapshots/runsheet-13-and-14a-pre-migration
cp $SNAP/patients.js         v2/assets/js/panels/doctor/patients.js
cp $SNAP/ai-diagnosis.js     v2/assets/js/panels/patient/ai-diagnosis.js
cp $SNAP/v2-doctor.html      v2/doctor.html
cp $SNAP/v2-portal.html      v2/portal.html
cp $SNAP/v3-index.html       v3/index.html
cp $SNAP/v3-about.html       v3/about.html
cp $SNAP/v3-practitioners.html v3/practitioners.html
# v3/services.html: keep Brief #13's pricing changes; revert only the
#   ../v2/portal.html → ../portal.html clean-URL rewrite manually.
rm v2/assets/js/components/constitution-card.js
rm portal.html doctor.html pharmacy.html admin.html
git add -A && git commit -m "Rollback Brief #14a (keep #13)" && git push
```

## Rollback BOTH

```bash
SNAP=briefs/snapshots/runsheet-13-and-14a-pre-migration
cp $SNAP/services.html         v3/services.html
cp $SNAP/v3-index.html         v3/index.html
cp $SNAP/v3-about.html         v3/about.html
cp $SNAP/v3-practitioners.html v3/practitioners.html
cp $SNAP/patients.js           v2/assets/js/panels/doctor/patients.js
cp $SNAP/ai-diagnosis.js       v2/assets/js/panels/patient/ai-diagnosis.js
cp $SNAP/v2-doctor.html        v2/doctor.html
cp $SNAP/v2-portal.html        v2/portal.html
rm v2/assets/js/components/constitution-card.js
rm portal.html doctor.html pharmacy.html admin.html
git add -A && git commit -m "Rollback Brief #13 + #14a runsheet" && git push
```

Or simpler — `git revert 7b7d229 1db0859` reverses both commits cleanly.

## Original commits

  · Brief #13:  1db0859  v3 services: finalize pricing (RM 35 / RM 55 launch promo) + remove in-person
  · Brief #14a: 7b7d229  Constitution Card component (Brief #14a) + clean portal URLs
