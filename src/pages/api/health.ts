import type { APIRoute } from 'astro';

// Lightweight liveness probe for uptime monitors (Uptime Kuma, status space).
// Deliberately touches no D1/database, so monitoring never consumes rows_read
// against the 5M/day free-tier limit (see 2026-11-26 D1 investigation).
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: 'ok', service: 'acp-ai-research' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
