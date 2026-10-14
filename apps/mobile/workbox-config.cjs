const base = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  globDirectory: 'dist-web',
  globPatterns: ['**/*.{html,js,css,json,png,ico,ttf,otf,woff,woff2}'],
  globIgnores: ['_headers', '404.html', 'sw.js', 'workbox-*.js', 'mediapipe/**'],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  swDest: 'dist-web/sw.js',
  skipWaiting: false,
  clientsClaim: false,
  navigateFallback: `${base}/index.html`,
  navigateFallbackDenylist: [new RegExp(`^${escaped}/mediapipe/`)],
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: new RegExp(`^https?://[^/]+${escaped}/mediapipe/`),
      handler: 'CacheFirst',
      options: { cacheName: 'mediapipe-v1', cacheableResponse: { statuses: [200] } },
    },
    {
      urlPattern: ({ url }) =>
        (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) &&
        url.pathname.startsWith('/storage/v1/object/sign/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-images',
        expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [200] },
        plugins: [
          {
            cacheKeyWillBeUsed: async ({ request }) => {
              const url = new URL(request.url);
              url.searchParams.delete('token');
              return url.href;
            },
          },
        ],
      },
    },
    {
      urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ url }) => url.hostname === 'api.met.no',
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'met-norway', expiration: { maxEntries: 20, maxAgeSeconds: 6 * 60 * 60 } },
    },
    {
      urlPattern: ({ request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
};
