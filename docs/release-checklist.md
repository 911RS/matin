# Release checklist

Developer document. Work through the steps in order before the first store release.

1. **EAS project.** An Apple Developer account (paid) and a Google Play Console account are required. Run `npx eas login`, then `npx eas init` in `apps/mobile`. It writes `extra.eas.projectId` into `app.json`; commit it. Push registration reads this projectId, and without it the app never asks Expo for a push token. Build profiles are already in `apps/mobile/eas.json` (`development`, `preview`, `production` with remote app versions and auto-increment). For an iOS development build on a real iPhone: `npx eas device:create`, then `npx eas build --profile development --platform ios`.

2. **Supabase project.** Follow [backend.md](backend.md) end to end: link the project, set `CRON_SECRET`, store the vault secrets, `supabase db push`, deploy the functions. Check that the `daily-suggest` cron job runs (Database > Cron) and that the `items` storage bucket exists.

3. **Auth URL settings.** In Authentication > URL Configuration, add `matin://auth/callback` to the redirect URLs. Google sign-in comes back through it. The email code does not use the redirect: the user types the code from the email into the app, which calls `verifyOtp`.

4. **Apple sign-in.**
   - In the Apple Developer account, enable "Sign in with Apple" for the App ID `com.matinwear.app`.
   - In Supabase, enable the Apple provider and add `com.matinwear.app` as an authorized client ID (native sign-in uses the ID token).
   - A Services ID, key and secret are needed only if Apple sign-in is ever offered on the web.

5. **Google sign-in.**
   - In Google Cloud, create an OAuth client of type "Web application" with the redirect URI `https://<ref>.supabase.co/auth/v1/callback`.
   - In Supabase, enable the Google provider with that client ID and secret.
   - The app opens the Supabase OAuth URL in the browser and returns to `matin://auth/callback`.

6. **Email code.** Enable the Email provider and set **Email OTP Length** to 6 (Authentication > Providers > Email). The code field accepts exactly 6 digits, so a longer code can never be entered. In Authentication > Email Templates, edit both "Confirm signup" and "Magic Link" so each body shows the 6-digit code with `{{ .Token }}` (the app asks for a code, not a link). "Confirm signup" is what first-time users receive, because the app calls `signInWithOtp` with `shouldCreateUser: true`; "Magic Link" is what returning users receive. If either template lacks `{{ .Token }}`, that group of users gets an email with no code. Set a custom SMTP sender before launch; the built-in sender has a low hourly limit.

7. **Environment variables.** EAS environment variables are set per environment, and each build profile in `eas.json` names its environment (`development`, `preview`, `production`). Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in every environment you build (`npx eas env:create --environment production`, then the same for `preview` and `development`). A build whose environment lacks them has no Supabase config and runs as guest only, with no sign-in. Leave `EXPO_PUBLIC_DEMO` unset in production; a value of `1` turns the build into demo mode.

8. **Push notifications.**
   - Android: create a Firebase project, add the Android app `com.matinwear.app`, upload the FCM V1 service account key to EAS (`npx eas credentials`), and add `google-services.json` through `android.googleServicesFile` in `app.json`.
   - iOS: let EAS create the APNs key.
   - Send a test push to a real device before release.

9. **Privacy policy.** Publish a policy at a public URL and link it in both store listings. It must cover:
   - Camera and photo library: photos of clothes, processed on the device for the cut-out; the cut-out and a re-encoded original are stored in the user's Supabase storage folder when signed in, and only on the phone in guest mode.
   - Location: when-in-use only, rounded to two decimals, used for the weather; a typed city instead of GPS is possible.
   - City search: the typed city name is sent to OpenStreetMap Nominatim.
   - Weather: rounded coordinates are sent to MET Norway (api.met.no).
   - Push: the Expo push token is stored on the profile and sent to Expo's push service with the daily outfit text.
   - Account deletion: in Settings, removes the profile, items, outfits, stored images and the auth user.
   - No ads, no analytics, no tracking.

10. **Store listings.** Prepare for both stores: app name, subtitle or short description, full description in English and French, keywords (App Store), category (Lifestyle), support URL, privacy policy URL, age rating questionnaire, App Store privacy "nutrition label" and Google Play Data safety form (both based on step 9), screenshots for each required device size (demo mode gives a populated closet), and a demo account or note for review (the app works without an account, say so in the review notes).

11. **App icon and splash.** Done: the icon, adaptive layers, splash mark and web icons are generated from `assets/brand/icon.svg` by `scripts/make-brand-assets.mjs`. Check them on a real device before building for the stores.

12. **Real-device photo check.** Run [manual-photo-checklist.md](manual-photo-checklist.md) on one real iPhone and one real Android phone and fill in the tables. Fix any crash before release.

13. **First iOS build.** The Swift code in `modules/tenue-photo/ios` has never been compiled (no Mac was available). On a Mac, run `npx expo run:ios`, fix any compile errors, then go through the main flows on a simulator and a device: sign in with Apple, add a piece, Today, Wear, History, Settings, account deletion.

14. **Release builds.** Build with `npx eas build --platform all --profile production`, install both builds on real devices, and repeat the main flows in guest mode and signed in, including airplane mode (the outfit and closet must still show) and the daily push at a time set a few minutes ahead.

15. **Export compliance.** `app.json` sets `ios.config.usesNonExemptEncryption: false`: the app only uses the HTTPS built into iOS, so App Store Connect does not ask the encryption question for each build. Change it only if custom encryption is ever added.

16. **Submit.** `npx eas submit` for each platform, starting with internal testing (TestFlight and a Play internal track).

## Web

Details are in [web.md](web.md).

1. **Build.** `pnpm --filter @tenue/mobile build:web` with the production `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set (leave `EXPO_PUBLIC_DEMO` unset). Check that `dist-web/sw.js` exists and that `dist-web/mediapipe/<version>/` holds the two `.tflite` models and the wasm files.

2. **Local preview.** `npx serve dist-web -s -l 4173` in `apps/mobile`, then open `http://localhost:4173`. Reload once so the service worker takes control, turn the network off in the browser tools and check that the app, the closet and Today still load.

3. **Supabase redirect.** Add `${origin}/auth/callback` (for example `https://matin.example.com/auth/callback`) to the redirect URLs in Authentication > URL Configuration, and set the Site URL to the origin. Test Google sign-in and the email code on the deployed site.

4. **Hosting.** Deploy `dist-web` to Cloudflare Pages or Netlify as described in web.md. Check the response headers: `/sw.js` and `/index.html` must be `no-cache`, `/mediapipe/*` and `/assets/*` must be `immutable`.

5. **Install on iPhone.** Open the site in Safari, tap Share, then Add to Home Screen. Open it from the home screen, add a piece with the camera, and check that background removal works and that the closet survives closing and reopening the app.

6. **Install on Android.** In Chrome, use "Install the app" in Settings or the browser prompt, then repeat the same check.

7. **Limits.** Confirm that Settings explains there are no push reminders on the web and that the reminder time is hidden. Mention in the privacy policy that web guest data stays in the browser.
