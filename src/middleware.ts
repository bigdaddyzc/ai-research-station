import { defineMiddleware } from 'astro:middleware';

// Public pages are cached at the edge so crawler bursts don't re-run D1 list queries
// (each uncached article view scanned ~2,700 D1 rows; free tier is 5M rows/day).
const EDGE_TTL_SECONDS = 600;

function isCacheablePath(pathname: string): boolean {
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) return false;
  return true;
}

export const onRequest = defineMiddleware(async (context, next) => {
  // One canonical host for search engines: send workers.dev page views to acp.dpdns.org.
  const url = context.url;
  if (url.hostname.endsWith('.workers.dev') && !url.pathname.startsWith('/api/')) {
    return Response.redirect(`https://acp.dpdns.org${url.pathname}${url.search}`, 301);
  }

  const request = context.request;
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const hasSession = (request.headers.get('cookie') ?? '').includes('admin');
  const cacheable = Boolean(cache) && request.method === 'GET' && isCacheablePath(url.pathname) && !hasSession;

  // Cache key ignores tracking params (utm_*), so ?utm_source=wechat shares the cached page.
  let cacheKey: Request | undefined;
  if (cacheable) {
    const keyUrl = new URL(url.toString());
    for (const k of [...keyUrl.searchParams.keys()]) if (k.startsWith('utm_') || k === 'fbclid' || k === 'gclid') keyUrl.searchParams.delete(k);
    cacheKey = new Request(keyUrl.toString(), { method: 'GET' });
    const hit = await cache!.match(cacheKey);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set('X-Edge-Cache', 'HIT');
      return res;
    }
  }

  const response = await next();

  // Fold landing page security headers (previously in cloudflare/pages/_headers)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (cacheable && cacheKey && response.status === 200 && !response.headers.has('Set-Cookie')) {
    const toStore = response.clone();
    const stored = new Response(toStore.body, toStore);
    stored.headers.set('Cache-Control', `public, max-age=${EDGE_TTL_SECONDS}`);
    const put = cache!.put(cacheKey, stored);
    const ctx = (context.locals as { runtime?: { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } }).runtime?.ctx;
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
    response.headers.set('X-Edge-Cache', 'MISS');
  }

  return response;
});
