# Myo 1.10.0 (build 40) — release notes

Released 27 November 2026 · live at https://merakinetics-inc.github.io/Myokinetics-OS-/

Myo, built on Myokinetics OS, is a physician-optional wellness and performance system. It measures, scores and
optimises physiology toward peak ranges and runs the member's protocol. It does not diagnose or treat disease, and it
does not start, stop or dose prescription medicines or hormones. Dangerous values pause optimisation and send the
member to care.

## What is in this release

56 pages on the public site, installable as an app (PWA) and working offline. (X-ray Mirror, the 57th, stays out of the public site until its author grants permission.)

| Area | Pages |
|---|---|
| Today and Myo | Today command center, Myo hub, Myo Score, Myo Mode, digital twin, Insights and experiments, Coach (Myo AI) |
| Body | 3D body, body atlas, heart, blood flow and Doppler monitor, body composition, biology (labs), biochemistry, sleep, looks, recovery, wave therapy, rehab, surgery companion and OR board, imaging, live ultrasound, function, longevity, wearables |
| Training | training sessions, Motion Lab, athlete builder, AR-Vision, machines, gym designer |
| Life | Fuel, Kitchen, food system, life and habits, mind, cycle health, pregnancy, environment, log book, stack |
| Sensors and devices | live sensors, face and voice, BCI lab, Myo chip (concept), integrations |
| Care and safety | emergency (SOS, first aid, CPR coach, seizure timer, medical ID), care and calendar, report |
| Providers | case assessment (with Myo AI drafting inside fixed limits, PubMed and openFDA evidence), Myo Academy (training and certificate) |
| Account | intro and setup, profile, data rights, evidence review, system |

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

## Verified for this release

- Every page loads with no errors and no broken values, for the sample member and for a new empty account.
- Every page fits a 375 px phone screen; dark mode checked on the new pages.
- Case-assessment engine: 15 of 15 on the Academy's practice cases.
- Signal processing checked against known answers: Doppler velocities, pregnancy formulas, camera pulse, cycle predictions, insights statistics, silent-command recognition, noise reduction.

## Not yet switched on, or waiting on others

- **Oura and WHOOP live sync**: built and its database is in place; needs the Oura and WHOOP developer agreements, then `supabase/deploy.ps1` with their keys and `supabase/cron-live-sync.sql`. File import works today.
- **Hosted Myo AI**: built, not deployed; needs an Anthropic API key and `supabase/deploy.ps1`. Inside Claude, Myo AI works through Claude.
- **Ingest API meals endpoint**: built; the deployed ingest function predates it.
- **Staff roles**: provider tools (case assessment, Academy) are open to anyone with the app.
- **Camera features** (silent commands, face scan) were tested on synthetic signals; they need a check on real phones.
- **Compliance**: cloud sync stores lab values; Supabase signs a BAA only with its HIPAA add-on. Privacy policy and terms are drafts for counsel.
- **X-ray Mirror** stays out of the public site until its author grants permission.

## Not affiliated

Myo names other companies only to identify devices or services: Oura, WHOOP, Hume, StemWave, Medivis, Q.ai, QAI. Myo is not affiliated with any of them.
