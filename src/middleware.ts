import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // One canonical host for search engines: send workers.dev page views to acp.dpdns.org.
  const url = context.url;
  if (url.hostname.endsWith('.workers.dev') && !url.pathname.startsWith('/api/')) {
    return Response.redirect(`https://acp.dpdns.org${url.pathname}${url.search}`, 301);
  }

  const response = await next();

  // Fold landing page security headers (previously in cloudflare/pages/_headers)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
});
