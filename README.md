# Myo — the peak-physiology app, built on Myokinetics OS v4

The Merakinetics health and performance operating system. Builds on the v3.2 prototype
(`../Myokinetics-os_app.html`), restyled in v4.1 with a clinical white / navy / cobalt palette and original holographic anatomy art (`js/anatomy.js`), and adds a FitScript-style biology layer (labs → score → protocol → retest)
underneath the machine ecosystem, AR form correction, gym floor planning, an AI coach and life management.

## Run locally
```
python -m http.server 8742
```
Then open http://localhost:8742. No build step, no dependencies.

## Files
| File | Layer | What it holds |
|---|---|---|
| `index.html` | Shell | Styles (brand tokens, dark + light), header, nav, script order |
| `js/anatomy.js` | Visuals | Original SVG holographic body: biomarker body map and muscle-activation map |
| `js/ar.js` | Performance | AR-Vision: MoveNet pose tracking (camera, uploaded video, demo) and the form rules engine |
| `js/scan.js` | Body | Body scan: progress photos (on-device IndexedDB) → MoveNet pose → Camera / Hologram / Anatomy-layer modes on the Today command center, posture metrics, Myo scan insight (sends measurements only, never the photo) |
| `js/athlete.js` | Performance | Athlete builder: CrossFitter, runner, bodybuilder, powerlifter, climber. Fit and capacity radar from DNA (11 SNPs parsed on-device from 23andMe / AncestryDNA), labs, wearables, machine loads, body scan and Lumen-style breath readings; 12-week path, fuel, stack, benchmarks, Myo-written plan, adopt into Today |
| `js/enhance.js` | Performance | Stack: 17 evidence-graded supplements (dose, timing, WADA, matched to athlete type, labs, DNA; add to protocol), PED reference (10 classes: legal and WADA status, risks; no doses), harm-reduction monitoring panel that feeds red flags |
| `js/longevity.js` | Longevity | Biological age (Levine PhenoAge from 9 labs + fitness age from VO₂max vs FRIEND norms), 7 healthspan pillars, 13-item evidence-graded longevity protocol (add to Today), peak longevity targets, age/sex screening timeline, geroprotector reference (no Rx doses), Myo 12-month plan |
| `js/wearables.js` | Health | Wearables: Oura Ring + WHOOP. Import the member's own exports (CSV/JSON, incl. saved API responses), sync via the Merakinetics proxy (Oura API v2, WHOOP API v2; OAuth tokens server-side) or a WHOOP developer token. Normalised daily rows (readiness/recovery, HRV, RHR, sleep, strain, temp, SpO₂) drive vitals → readiness across the OS; 30-day charts and table; Myo analysis. Oura API refuses browser calls (CORS), so proxy only |
| `js/imaging.js` | Health | Imaging: on-device DICOM parser (uncompressed CT/MRI/DEXA; patient identifiers never read), axial/coronal/sagittal planes, ray-marched 3D hologram (MIP / structures), CT tissue areas + muscle index, demo phantom, Medivis partner card (pending partnership; no public API) |
| `js/videos.js` | Performance | YMove Exercise API: "Video" on every exercise + searchable library. Key kept in this browser only, or a proxy URL (YMove requires server-side keys in production). Signed video URLs fetched fresh, never stored |
| `js/xray.js` | Health | X-ray Mirror, integrated from Hashem Al-Ghaili's X-Ray Mirror (github.com/Hashem-Al-Ghaili/xray-mirror): MediaPipe face + hand landmarkers pin BodyParts3D skull, brain, muscles, eyes and hand bones to the live face; x-ray and solid looks, labels, reveal cuts and fingertip lens. Myo adds a video-file source and camera-free demo. Meshes in models/xray (CC BY-SA 2.1 JP). Upstream code has no licence file: get permission before commercial release v24 adds a MedTech overlay (Vielight Neuro module and EEG 10–20 electrode positions pinned to the tracked head), snapshots, full screen and a Learn card linked to the coach and 3D body |
| `js/function.js` | Health | Human Function: reaction time, finger tapping, digit span, balance tests; daily mood/energy/stress/focus check-ins; movement, cognition, mind, behaviour, recovery scores; Myo analysis; 988 crisis banner |
| `js/augment.js` | Performance | Ascend: Baseline → Peak Human → Exo-Augmented → Neural-Linked → Integrated tiers from real data; exoskeleton, BCI, neuro-link, prosthetics and implant reference with stage and Myo integration status; device/implant registry; integration protocols; Exo-Sync and EEG sample feeds. No surgical, DIY implant or elective-amputation guidance |
| `js/avatar.js` | Intelligence | Myo avatar drawn as a living cell: membrane bilayer, mitochondria, vesicles, ER, and a nucleus whose neural network and nucleolus are Myo's mind (idle, listening, thinking, speaking); header orb; dictation and TTS via the `dictation` and `tts` capabilities |
| `js/anatomy3d.js` | Experience | Real 3D anatomy from BodyParts3D (models/anatomy, CC BY-SA 2.1 JP, built by tools/build.js from the PART-OF set plus 252 muscles from the IS-A set): skin, skeleton, muscles, heart and vessels, brain and nerves, airways, digestive organs, kidneys, glands; about 615k triangles loaded per system. Hologram and Clinical looks, orbit and zoom, organ hotspots coloured by the member's markers, tap to pop a structure out with its biomarkers. The Body page, Welcome, Today's command centre, Biology and Ascend |
| `js/welcome.js` | Experience | Intro to Myo (first item in the navigation): welcome hero with the live 3D body, Meet Myo (cell avatar, sample questions), the core loop, everything Myo runs, a first-week plan and a six-step setup that ticks itself off. Opens on first run |
| `js/recovery.js` | Body | Recovery: today's prescription from readiness, HRV and training; Sonosphere sound studio (Web Audio tones, singing bowls, pink noise, binaural option, breath pacer, frequency program table); evidence-graded heat, cold, cryochamber, red light and tool protocols; safety screen; weekly dose tracking |
| `js/pt.js` | Body | Physical therapy: red-flag screen, seven regions with a four-phase rehab plan and progression criteria, traffic-light pain monitoring, daily check-ins, 3D muscle highlight, AR-Vision and ISO Flow links |
| `js/sleep.js` | Body | Sleep: 14-night study (7 baseline nights, 7 with chosen changes, compared on diary and wearable measures), morning sleep diary with total sleep, efficiency, latency and WASO, uploads read on the device (sleep study PDF reports: AHI, RDI, ODI, SpO2 nadir, T90, stages; EDF/EDF+ recordings: SpO2 trace and stats, sleep-stage annotations to a hypnogram; CSV exports), apnea warning signs and when to see a sleep clinician |
| `js/looks.js` | Body | Looks: 7-stage build (baseline tape measurements with body fat, FFMI and ratios; six target builds; now-vs-target blueprint drawing with a 12-month projection, phase timeline, weekly sets and 3D muscle emphasis; Fitzpatrick-aware skin routine; face and grooming levers with harmful trends called out; procedures and implants with risks, consult checklist and an appearance-distress self-check; before/after photo slider) |
| `js/connect.js` | More | Integrations: MedTech catalogue (26 sources and where their data lands), Vielight session log with before/after ratings and outcome comparison, live Web Bluetooth for the standard health profiles (heart rate with RMSSD, blood pressure, weight, pulse oximeter, thermometer), Myo Ingest API v1 reference with curl/JS/Python samples, and a Console that validates and applies Myo JSON, FHIR R4, HL7 v2 ORU and CSV (LibreView too) with LOINC mapping and unit conversion |
| `js/auth.js` | Services | Myo account: Supabase Auth sign-in (email one-time code; Google and Apple on the hosted app), session JWT for the wearables proxy, cloud sync of member state to `public.member_state` (RLS: own row only) with a keep-which-copy choice when device and account differ. Claude's viewer blocks outside connections, so inside Claude the Claude account sync stays in charge |
| `js/config.js` | Services | Hosted-build config: `window.MYO_CONFIG = { supabaseUrl, supabaseKey }` (publishable key only). Empty = members enter it on the Profile page |
| `js/look.js` | Experience | Appearance: seven colour schemes (Electric default, Cobalt, Aurora, Synapse, Biolume, Solar, Graphite) x Auto/Light/Dark, Full/Calm motion; header palette picker; saved per device in `myo-look` |
| `supabase/schema.sql` | Services | Run once in the Supabase SQL editor: `member_state` table + RLS policies |
| `supabase/functions/wearables/` | Services | Wearables proxy (Supabase Edge Function): Oura and WHOOP OAuth with PKCE and single-use state, AES-256-GCM token storage, refresh under a row lock, allowlisted passthrough, rate limits and vendor back-off, signed WHOOP webhooks, audit log. Migration in `supabase/migrations`, 19 tests in `supabase/tests`, deploy guide `supabase/WEARABLES_PROXY.md` |
| `supabase/functions/ingest/` | Services | Myo Ingest API (Supabase Edge Function): member-issued integration keys (hashed, scoped, revocable), Myo JSON / FHIR R4 / HL7 v2 / CSV / LibreView intake with LOINC mapping and unit conversion, per-member inbox the app pulls and acknowledges, idempotency, rate and size limits, signed webhooks with SSRF guards. Guide: `supabase/INGEST_API.md`; 14 tests in `supabase/tests/ingest.test.ts` |
| `oauth-done.html` | Services | Page the proxy returns members to after vendor sign-in; tells the Myo tab and closes |
| `supabase/deploy.ps1` | Services | One-time deploy of the wearables proxy and the Ingest API, run by you (keeps an existing TOKEN_KEY on re-runs): Supabase sign-in, link, migrations, vendor redirect URLs, secrets (typed, never saved; generates TOKEN_KEY), function deploy, smoke test, then writes `js/config.js` |
| `supabase/redeploy.ps1` | Services | Redeploys both functions to the linked project; `-Origins "https://a,https://b"` resets the allowed browser origins from the command line (both functions also serve GET …/health listing the origins they accept) |
| `supabase/config.toml`, `supabase/migrations/` | Services | CLI project settings (`verify_jwt = false` for the proxy) and the three migrations: member_state, wearables schema, phase 2 |
| `tools/schemes.js` | Dev | Scheme palettes: WCAG contrast checks for all 14 looks (Electric also against its blue field), regenerates the scheme token CSS and picker swatches |
| `tools/build-site.ps1` | Dev | Builds the public Myo into `../MERAKINETICS-site/myo/` (served at https://merakinetics-inc.github.io/MERAKINETICS/myo/): index.html, oauth-done.html, js/, models/ only; X-ray Mirror left out unless `-IncludeXray`; writes ATTRIBUTION.txt. Then commit and push in the site folder |
| `models/movenet-lightning/` | Model | Google MoveNet SinglePose Lightning v4 weights for TensorFlow.js (4.8 MB) |
| `js/core.js` | Kernel | State store, sample member data, MK Score engine, protocol engine, persistence, router |
| `js/health.js` | Health | Today, Biology (biomarkers, lab import, wearables), Fuel, Life, Profile |
| `js/train.js` | Performance | Training log + adaptive load + muscle map, Machines (fleet, telemetry, pairing) |
| `js/gym.js` | Facility | Gym Designer: drag/rotate floor plan, clearance + reachability checks, flow score, JSON/CSV export |
| `js/coach.js` | Intelligence | Myo AI coach with tools that read the health graph and write to protocol/schedule |
| `js/system.js` | Architecture | In-app map of the five layers, core loop, data model, topology |
| `js/boot.js` | Boot | Event delegation, capability wiring, load order |

## What's real vs sample
- **Working now:** scoring, protocol rules, lab import (CSV/text), training log with e1RM and +2.5% progression,
  meal/water/habit/goal/schedule tracking, floor planner analysis and export, AI coach (when opened in Claude).
- **Sample feeds:** wearable vitals and machine telemetry. AR-Vision now tracks real people from a camera or uploaded
  video; its reference demo animates a model athlete through the same rules engine. These are the integration points for BLE 5.0 / MQTT machine
  data, Oura/WHOOP/Apple Health APIs and the AR-Vision LiDAR + RGB pose pipeline.
- **Planned:** machine HMI, coach and facility consoles, FTMS bridge, clinician review, PDF/FHIR lab ingest.

Optimal biomarker ranges and protocol rules live in `core.js` (`seed()` and `RULES`). They are educational and
should be reviewed by a licensed clinician before any member-facing launch.
