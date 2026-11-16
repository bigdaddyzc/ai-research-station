import { defineMiddleware } from 'astro:middleware';
import { DbUnavailableError } from './lib/db';

const CONTENT_CACHE_CONTROL = 'public, max-age=300, s-maxage=1800';

// /v1/* paths are internal list-cache paths (acp-list-cache.internal/v1/<key>)
// that must never be served from the public host. They used to fall through
// to the [lang] route and 302 to /zh; return 404 instead.
function isInternalApiPath(pathname: string): boolean {
  return pathname === '/v1' || pathname.startsWith('/v1/');
}

function isContentPath(pathname: string): boolean {
  return pathname === '/zh' || pathname.startsWith('/zh/') || pathname === '/en' || pathname.startsWith('/en/');
}

function isAdminOrApiPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  if (isInternalApiPath(pathname)) {
    return new Response('Not Found', { status: 404 });
  }

  let response: Response;
  try {
    response = await next();
  } catch (error) {
    // A missing D1 binding is a service outage, not a reason to serve the
    // built-in sample articles. Surface a 503 error page instead.
    if (error instanceof DbUnavailableError) {
      return new Response(
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>暂时不可用 · ACP AI Research</title></head>' +
          '<body><main><h1>服务暂时不可用</h1><p>数据库连接失败，请稍后再试。 / The database is temporarily unavailable. Please try again later.</p></main></body></html>',
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        },
      );
    }
    throw error;
  }

  // Fold landing page security headers (previously in cloudflare/pages/_headers)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Edge-cache content pages at the app level instead of relying only on
  // Cloudflare cache rules. Never cache admin pages or admin API responses.
  if (isAdminOrApiPath(pathname)) {
    response.headers.set('Cache-Control', 'no-store');
  } else if (response.status === 200 && isContentPath(pathname) && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', CONTENT_CACHE_CONTROL);
  }

  return response;
});
