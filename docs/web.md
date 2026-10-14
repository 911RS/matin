# Web build

The web app is an installable, offline-ready PWA built from `apps/mobile`.

## Build

```
pnpm --filter @tenue/mobile build:web
```

This runs three steps:

1. `scripts/fetch-web-models.sh` copies the MediaPipe script and wasm runtime from `@mediapipe/tasks-vision` and downloads the two models into `public/mediapipe/<version>/` (for example `public/mediapipe/1.1.0/`). Folders for other versions are removed.
2. `expo export --platform web --output-dir dist-web`.
3. `workbox generateSW` (config in `workbox-config.cjs`) writes `dist-web/sw.js`.

Preview it locally with `npx serve dist-web -s -l 4173` and open `http://localhost:4173`. The service worker only registers in this production build, not in `expo start --web`.

## MediaPipe files

About 50 MB of models and wasm live in `public/mediapipe/<version>/`. They are not in git; only `LICENSE` and `README.md` are. The fetch script is idempotent and skips files that already exist with the expected size. Run it by hand if you only want to start the dev server.

The version in the path comes from the installed `@mediapipe/tasks-vision` package and must match `MEDIAPIPE_VERSION` in `src/photo/mediapipe.ts` (a test checks this). When you upgrade the package, update the constant. A new version gets a new URL, so the files can be cached forever.

Native builds do not use these files. `expo export` copies `public/` into native output folders, but the files are gitignored and EAS native builds never ship `public/`.

## Service worker

- Precaches the app shell only: HTML, JavaScript, CSS, fonts, icons and the manifest. MediaPipe files are not precached.
- Runtime caching:
  - `/mediapipe/*`: CacheFirst in `mediapipe-v1`, only 200 responses. The models are first downloaded when the user opens the add-piece screen, not at app start.
  - Signed Supabase Storage URLs (`/storage/v1/object/sign/`): CacheFirst in `supabase-images`, keyed without the `token` query parameter, so a fresh signed URL for the same file still hits the cache offline.
  - Other Supabase requests: NetworkOnly.
  - MET Norway: StaleWhileRevalidate.
  - Other images: CacheFirst.
- `skipWaiting` is off. A new version waits until the user taps "Update ready" in Settings, which posts `SKIP_WAITING` and reloads. The app checks for a new version each time the page becomes visible again.
- It registers only on web and only in production builds (`src/pwa/pwa.web.ts`).

## Install

- Browsers that fire `beforeinstallprompt` get an "Install the app" row that opens the prompt. The listener is attached when the app script loads, so an early prompt is not lost.
- iOS Safari gets a row with the steps (Share, then Add to Home Screen). The row is hidden once the app runs standalone.
- The manifest is `public/manifest.json`; the iOS meta tags are in `public/index.html`, which Expo uses as the page template for the single-page output. Expo adds the theme colour and favicon tags from `app.json`.
- Icons come from `scripts/make-brand-assets.mjs` (192, 512, maskable 512, and the 180 px `apple-touch-icon.png`).

## Storage limits

Guest data (closet, outfits and photos) lives in the browser: settings in local storage, photos in IndexedDB. The app asks for persistent storage, but browsers can still clear it.

On iOS Safari, a site that is not installed to the home screen loses its script-writable storage after 7 days without a visit. A guest who only uses Matin in a Safari tab can lose the whole closet that way. Tell guests to either install the app (Share, then Add to Home Screen), which exempts it from this rule, or sign in so the closet is stored in their account.

## Limits on the web

- No push reminders. Settings and onboarding explain that reminders need the iPhone or Android app, and the reminder time is hidden.
- No Apple sign-in. Google sign-in and the email code work when Supabase is configured.
- Background removal needs WebAssembly and `createImageBitmap`. Without them the user can still save the photo as is.

## Supabase setup for the web

In Authentication > URL Configuration:

- Set the Site URL to the web origin, for example `https://matin.example.com`.
- Add `https://matin.example.com/auth/callback` to the redirect URLs (the general form is `${origin}/auth/callback`). Add `http://localhost:4173/auth/callback` too if you test sign-in on a local preview.

Google sign-in returns to `/auth/callback`. If the provider returns an error, the app goes back to the sign-in screen with a message.

## Hosting

`.github/workflows/pages.yml` deploys `main` to GitHub Pages. `public/_headers` is copied into `dist-web` and sets:

- `/mediapipe/*`, `/_expo/static/*` and `/assets/*`: `public, max-age=31536000, immutable` (versioned or hashed paths).
- `/index.html`, `/`, `/sw.js` and `/manifest.json`: `no-cache`.

Hosts serve `.wasm` as `application/wasm` by default.

### GitHub Pages

The workflow builds with `EXPO_PUBLIC_BASE_PATH=/<repo name>`, so the app, service worker, manifest and MediaPipe files live under that subfolder (for example `https://911rs.github.io/matin/`). It also sets `WEB_404_FALLBACK=1`, which copies `index.html` to `404.html` so deep links such as `/matin/closet` load the app. GitHub Pages ignores `_headers`.

1. In the repository settings, set Pages > Source to GitHub Actions.
2. The build runs in guest mode. To change that, add repository variables (Settings > Secrets and variables > Actions > Variables): `EXPO_PUBLIC_DEMO=1` for demo mode, or `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for sign-in. With sign-in, add `https://911rs.github.io/matin/auth/callback` to the Supabase redirect URLs.

To serve the build from any other subfolder, set `EXPO_PUBLIC_BASE_PATH` when running `build:web`.

### Cloudflare Pages

1. Create a Pages project from the repository, or upload `dist-web` with `npx wrangler pages deploy apps/mobile/dist-web`.
2. For a Git build: build command `pnpm install && pnpm --filter @tenue/mobile build:web`, output directory `apps/mobile/dist-web`, and `NODE_VERSION=24`.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as build variables if you want sign-in.
4. Cloudflare Pages reads `_headers`. It serves `index.html` for unknown paths on its own when the output has no `404.html`, so no redirect rule is needed.

### Netlify

1. Base directory `apps/mobile`, build command `pnpm build:web`, publish directory `dist-web` (relative to the base directory), and `NODE_VERSION=24`.
2. Set the same `EXPO_PUBLIC_*` variables.
3. Netlify reads `_headers`. It needs a rewrite for client-side routes: add this to a `netlify.toml` in `apps/mobile`:

   ```toml
   [[redirects]]
   from = "/*"
   to = "/index.html"
   status = 200
   ```

### Other hosts

Reproduce the headers above and rewrite unknown paths to `/index.html` with status 200.
