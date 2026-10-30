import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ redirect }) => redirect('/privacy', 301);
