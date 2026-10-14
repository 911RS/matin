# Decisions

Each line: what was decided, why, and what it costs if wrong.

## Engine
- Two accents of the same family (green + green) count as one accent, not a "pair". Avoids the reason line "green + green match". Cost: one reason string.
- The 50 ms budget was kept; the engine got streaming top-K ranking with sound pruning instead. Budget targets Hermes on mid-range Android. Cost: more code in score.ts.
- Swapping a piece of an outfit whose shape no longer fits today's weather reshapes it (e.g. drops the jacket at 18°C). Same behaviour as before; revisit in the app UI if it surprises users.
- Non-finite temperature replaces the whole weather with the 18°C fallback, so a rain flag is lost too.
- Item ids containing ',' could confuse tie-break pruning, and input dates with trailing junk are accepted. Ids are UUIDs and dates come from our own code.

## Backend
- SQL is tested with PGlite (no Docker on the dev machine) against a stub of Supabase's auth and storage schemas.
- Push reasons for an existing outfit row describe the stored pieces (`reasonFor`), not a re-pick, so swaps stay accurate.
- `outfits.pushed_at` prevents double pushes (DST repeated hour, retried invocations). It is stamped after Expo accepts the push; two overlapping runs in one 15-minute window could still double-push (cron never overlaps itself).
- Edge Function sources are vendored into `supabase/functions/_vendor` before check/deploy, because older Supabase CLIs only bundle files inside `supabase/functions`.
- Stored weather is the engine `Weather` shape plus an optional `condition` (MET symbol code nearest local noon).
- One push token per profile: `claim_push_token(token)` moves a token from any other profile to the caller; `claim_push_token(null)` clears the caller's token (use on sign-out).
- If Expo hangs instead of failing, per-message retries can exceed the Edge Function time limit and that window's pushes are lost. Accepted for v1.

## App shell and photo module
- Android declares the ML Kit install-time model download only in the release manifest (debug conflicts with expo-dev-launcher). Debug builds download the model on first use: the first call returns ERR_MODEL_DOWNLOADING, and `prepareModels()` at app start triggers the download early.
- iOS decodes photos through the ImageIO thumbnail API (≤2048 px, EXIF applied), so 48 MP photos are never decoded at full size.
- The native module returns a PNG cut-out; JS resizes to ≤1024 px WebP. The PNG is deleted after conversion and the native side deletes its own files older than one hour.
- Labels are optional: if the labeler fails, the cut-out still succeeds with no labels.
- The iOS Swift code has never been compiled (no Mac available). The first Mac build may need small fixes.
- Right after the Android model download there can be about a minute of ERR_PROCESS; the add-item screen retries it.

## Name
- The product is named Matin (French for "morning"). The repo folder, the `@tenue/*` package scope, the `tenue-photo` module directory, the `TenuePhoto` native module name and the `tenue-*` storage key prefixes keep the old name: they are internal and renaming them has no user benefit.
- App id `com.matinwear.app` (iOS bundle id and Android package); the local native module package is `com.matinwear.photo`; URL scheme `matin`.

## App
- The app is called Matin (renamed from Tenue on the user's request). App id `com.matinwear.app`, scheme `matin://`. Internal package names (`@tenue/*`) and storage prefixes keep "tenue".
- Visual design follows docs/DESIGN.md (paper and ink, system font, iOS controls, garments on a `tile` shelf); it replaced earlier directions on the user's request.
- Guest mode: the app works without an account (local store, local daily reminder). "Create an account" migrates local data; settings are copied only into a fresh cloud account.
- A build without Supabase configuration runs as guest instead of showing a "not configured" screen.
- Mutations pause offline for Supabase and run immediately for local repos; all writes share one ordered queue, and uploads self-heal after restarts.
- Caches and queued writes are cleared when the signed-in user changes, so one user's offline writes never run under another account.
- The onboarding flag is stored per user and set automatically when an existing user's items are seen.
- City search uses OpenStreetMap Nominatim (Open-Meteo geocoding is non-commercial); an explicit language choice on the profile wins over the device language.
- Notification permission is only requested from onboarding or the Settings toggle, never in the background.
- The app runs in Expo Go with graceful degradation (no background removal, local reminder only).
- The first-launch native crash (React Native mounting, react-native-screens listener) only reproduces in debug dev builds; release builds launched cleanly 20+ times. Re-check on real devices.

## Web (PWA)
- Matin also ships as a PWA from the same codebase (Expo web). Web is guest-first; Google sign-in uses a full-page redirect; Apple sign-in and reminders are native-only.
- Background removal on web uses MediaPipe Tasks Vision (Apache-2.0), loaded from self-hosted files by a script tag, because Metro rejects the package's dynamic import. Model and wasm files are downloaded at build time (versioned path /mediapipe/1.1.0/) and never committed.
- The service worker precaches only the app shell (~3 MB); models are cached on first use. Signed storage images are cached by path, ignoring the rotating token.
- No hosting yet (user's choice); docs/web.md has the steps.
- Browser QA was skipped on the user's request; the reviewer exercised the core flow in headless Chromium. iPhone Safari is untested.

## Extras
- "In the wash": items get `unavailable_until`; the engine excludes them before that date; the cron reads it too.
- Occasion (casual / work / going out) is an optional engine input with a per-piece formality penalty; with no occasion the pick is byte-identical to before (digest test against the old engine).
- Shuffle and swap keep the chosen occasion; it is remembered per day and carried over on guest → account migration.
- Wear stats use their own cached query; "Forgotten" means created and last worn more than 30 days ago (local dates).
- Tomorrow preview is read-only and uses the same seed and history window as the morning job, so it shows what the push will pick if nothing changes.
- Known flaky test: useToday "clears the failure when Wear starts" (timing) — rerun if it fails once.
