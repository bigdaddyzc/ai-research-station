import { defineMiddleware } from 'astro:middleware';
import { DbUnavailableError } from './lib/db';

// Public pages are cached at the edge so crawler bursts don't re-run D1 list queries
// (each uncached article view scanned ~2,700 D1 rows; free tier is 5M rows/day).
// 2026-11-26: raised from 600s after D1 hit 86% of its daily limit — our own
// monitors plus per-colo cache misses were the biggest consumer.
const EDGE_TTL_SECONDS = 3600;
const CONTENT_CACHE_CONTROL = 'public, max-age=600, s-maxage=3600';

// Sitemap/RSS/llms.txt change at most once a day (publish), but crawlers
// re-fetch them from every colo, so give them a much longer edge TTL.
const SLOW_CACHE_PATHS = new Set(['/sitemap.xml', '/rss.xml', '/llms.txt']);
const SLOW_EDGE_TTL_SECONDS = 86400;
const SLOW_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

// /v1/* paths are internal list-cache paths (acp-list-cache.internal/v1/<key>)
// that must never be served from the public host. Return 404.
function isInternalApiPath(pathname: string): boolean {
  return pathname === '/v1' || pathname.startsWith('/v1/');
}

function isContentPath(pathname: string): boolean {
  return pathname === '/zh' || pathname.startsWith('/zh/') || pathname === '/en' || pathname.startsWith('/en/');
}

function isAdminOrApiPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/');
}

function isCacheablePath(pathname: string): boolean {
  return !isAdminOrApiPath(pathname);
}

function unavailable(): Response {
  return new Response(
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>暂时不可用 · ACP AI Research</title></head>' +
      '<body><main><h1>服务暂时不可用</h1><p>数据库连接失败，请稍后再试。 / The database is temporarily unavailable. Please try again later.</p></main></body></html>',
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' },
    },
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  const pathname = url.pathname;

  if (isInternalApiPath(pathname)) {
    return new Response('Not Found', { status: 404 });
  }

  // One canonical host for search engines: send workers.dev page views to acp.dpdns.org.
  if (url.hostname.endsWith('.workers.dev') && !pathname.startsWith('/api/')) {
    return Response.redirect(`https://acp.dpdns.org${pathname}${url.search}`, 301);
  }

  const request = context.request;
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const hasSession = (request.headers.get('cookie') ?? '').includes('admin');
  const cacheable = Boolean(cache) && request.method === 'GET' && isCacheablePath(pathname) && !hasSession;

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

  let response: Response;
  try {
    response = await next();
  } catch (error) {
    // A missing D1 binding is a service outage, not a reason to serve sample articles.
    if (error instanceof DbUnavailableError) return unavailable();
    throw error;
  }

  // Fold landing page security headers (previously in cloudflare/pages/_headers)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (isAdminOrApiPath(pathname)) {
    response.headers.set('Cache-Control', 'no-store');
  } else if (response.status === 200 && isContentPath(pathname) && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', CONTENT_CACHE_CONTROL);
  } else if (response.status === 200 && SLOW_CACHE_PATHS.has(pathname) && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', SLOW_CACHE_CONTROL);
  }

  if (cacheable && cacheKey && response.status === 200 && !response.headers.has('Set-Cookie')) {
    const toStore = response.clone();
    const stored = new Response(toStore.body, toStore);
    const edgeTtl = SLOW_CACHE_PATHS.has(pathname) ? SLOW_EDGE_TTL_SECONDS : EDGE_TTL_SECONDS;
    stored.headers.set('Cache-Control', `public, max-age=${edgeTtl}`);
    const put = cache!.put(cacheKey, stored);
    // Astro v6+ removed locals.runtime.ctx (reading it throws, which turned every cache miss into a 500/redirect).
    let ctx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    try { ctx = (context.locals as { cfContext?: { waitUntil?: (p: Promise<unknown>) => void } }).cfContext; } catch { ctx = undefined; }
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
    response.headers.set('X-Edge-Cache', 'MISS');
  }

  return response;
});
