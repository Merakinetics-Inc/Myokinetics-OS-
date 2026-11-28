# Myo 1.11.0 (build 41) — release notes

Released 27 November 2026 · live at https://merakinetics-inc.github.io/Myokinetics-OS-/

Myo, built on Myokinetics OS, is a physician-optional wellness and performance system. It measures, scores and
optimises physiology toward peak ranges and runs the member's protocol. It does not diagnose or treat disease, and it
does not start, stop or dose prescription medicines or hormones. Dangerous values pause optimisation and send the
member to care.

## What is in this release

58 pages on the public site, installable as an app (PWA) and working offline. (X-ray Mirror, the 59th, stays out of the public site until its author grants permission.)

| Area | Pages |
|---|---|
| Today and Myo | Today command center, Myo hub, Myo Score, Myo Mode, digital twin, Insights and experiments, Coach (Myo AI) |
| Body | 3D body, body atlas, Learn biology, heart, blood flow and Doppler monitor, body composition, biology (labs), biochemistry, sleep, looks, recovery, wave therapy, rehab, surgery companion and OR board, imaging, live ultrasound, function, longevity, wearables |
| Training | training sessions, Motion Lab, athlete builder, AR-Vision, machines, gym designer |
| Life | Fuel, Kitchen, food system, life and habits, mind, cycle health, pregnancy, environment, log book, stack |
| Sensors and devices | live sensors, face and voice, BCI lab, Myo chip (concept), integrations |
| Care and safety | emergency (SOS, first aid, CPR coach, seizure timer, medical ID), care and calendar, cancer screening, report |
| Providers (staff only) | case assessment (with Myo AI drafting inside fixed limits, PubMed and openFDA evidence), Myo Academy (training and certificate) |
| Account | intro and setup, profile and access, data rights, evidence review, system |

## New in 1.11 (build 41)

- **Staff roles and access control.** Four roles: member, coach, clinician, admin. Case assessment and Myo Academy need coach or higher; they are hidden from menus, the hub and search for members, and show a locked page if opened directly. Admins grant and remove roles by email on Profile → Your access; every change records who made it, and admins can't change their own role. Roles live in `public.staff_roles` (migration `20261128090000_staff_roles.sql`, tested on PGlite). Inside Claude, the owner of the Myo copy is admin. See `supabase/STAFF_ROLES.md`.
- **Cancer screening.** Early-detection support, not detection: a screening plan from age, organs and risk (USPSTF 2018 to 2024, ACS for higher risk), with due dates from the member's own results on the Care calendar; 14 warning signs that need a clinician within two weeks and 3 that need emergency care; patterns in Myo data worth raising (iron-deficiency anemia, weight loss without trying, new diabetes with weight loss after 50, persistent inflammation), each with its source; the tests explained, including the limits of multi-cancer blood tests; a results log. Warning signs go to the Log book and Visit prep.
- **Learn biology.** Twelve units from cells to aging and cancer biology, 34 quiz questions, and a unit written from the member's own labs. Missed questions come back after 1, 3, 7 and 21 days.
- **Lesson attention test (admins).** Tests Myo's own lesson videos with Sapient's neural response prediction through a new server function, `content-scan`, which checks the admin role on every call, accepts only listed lesson-video hosts, and returns attention, memory and effort only. Shows an example readout until deployed. See `supabase/CONTENT_SCAN.md`.
- **Header fit.** The top bar no longer runs off the screen between 900 and 1080 px wide.

### Deliberately left out of the Sapient integration

Face or beauty ratings; any use on members' photos, faces, voices or video; and purchase-intent ("buy moment") or persuasion scoring. These conflict with Myo's rules that Looks never rates faces and that Myo doesn't manipulate members. The server drops those fields.

## Builds since production

| Build | Version | Date | Highlights |
|---|---|---|---|
| 29 | 1.0 | 24–25 Nov | Production: Myo hub, PWA, data rights, report, search |
| 30–31 | 1.1 | 25–26 Nov | Myo Mode, Myo Score with QR sharing, Motion Lab, Kitchen, Mind; lab-import fix |
| 32 | 1.2 | 26 Nov | Lifespan dashboard |
| 33 | 1.3 | 26 Nov | Heart, live sensors, log book, more scan formats |
| 34 | 1.4 | 26 Nov | Body composition (smart scales, Hume via Apple Health, DEXA), BCI lab |
| 35 | 1.5 | 26–27 Nov | Oura and WHOOP live sync (built), digital twin, surgery, body atlas |
| 36 | 1.6 | 27 Nov | Blood flow and Doppler monitor, live ultrasound, pregnancy, wave therapy |
| 37 | 1.7 | 27 Nov | Food system, emergency and SOS, Myo chip concept |
| 38 | 1.8 | 27 Nov | Insights and experiments, cycle health, environment, care and calendar, neuromorphic chip sensing |
| 39 | 1.9 | 27 Nov | Case assessment, Myo Academy |
| 40 | 1.10 | 27 Nov | Face and voice: silent commands, face scan, voice in noise |
| 41 | 1.11 | 27 Nov | Staff roles and access control, cancer screening, Learn biology, lesson attention test (Sapient) |

## Verified for this release

- Every page loads with no errors and no broken values, for the sample member and for a new empty account.
- Every page fits a 375 px phone screen; the new pages checked in light and dark mode.
- The staff lock: a member sees no provider pages in menus, the hub, search or System, and gets the locked page by address; a coach gets case assessment; only admins see the lesson attention tab.
- Cancer screening rules checked on ten test profiles (ages 25 to 80, smoking, family history, BRCA, Lynch, liver disease, a result needing follow-up).
- Staff roles database: grants, reads and refusals tested on PGlite against the real migration. `content-scan`: 5 tests with a fake Sapient (admins only, only the video address sent, only learning signals returned).
- Case-assessment engine: 15 of 15 on the Academy's practice cases.

## Not yet switched on, or waiting on others

- **Staff roles on the hosted site**: deploy migration `20261128090000_staff_roles.sql` and add the first admin (`supabase/STAFF_ROLES.md`). Until then, signed-in accounts on the public site are members, so case assessment and the Academy are locked there; inside Claude, the owner has full access.
- **Lesson attention test**: needs a Sapient subscription and key, `CONTENT_SCAN_HOSTS`, and `supabase functions deploy content-scan` (`supabase/CONTENT_SCAN.md`). Sapient's response fields come from its public API description; check them on the first real scan.
- **Oura and WHOOP live sync**: built and its database is in place; needs the Oura and WHOOP developer agreements, then `supabase/deploy.ps1` with their keys and `supabase/cron-live-sync.sql`. File import works today.
- **Hosted Myo AI**: built, not deployed; needs an Anthropic API key and `supabase/deploy.ps1`. Inside Claude, Myo AI works through Claude.
- **Ingest API meals endpoint**: built; the deployed ingest function predates it.
- **Camera features** (silent commands, face scan) were tested on synthetic signals; they need a check on real phones.
- **Cancer detection** itself would need a regulated diagnostic test or device (FDA clearance or approval). Myo stays on the wellness side: screening reminders, warning signs, questions for a clinician.
- **Compliance**: cloud sync stores lab values; Supabase signs a BAA only with its HIPAA add-on. Privacy policy and terms are drafts for counsel.
- **X-ray Mirror** stays out of the public site until its author grants permission.

## Not affiliated

Myo names other companies only to identify devices or services: Oura, WHOOP, Hume, StemWave, Medivis, Q.ai, QAI, Sapient. Myo is not affiliated with any of them.
