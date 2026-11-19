// Generate public/search-index-{zh,en}.json from the remote D1 (published articles only).
//
// Runs as part of `npm run build`. Requires CLOUDFLARE_API_TOKEN (the same credential
// the deploy uses). If the token is absent, the build keeps the previously generated
// files and warns instead of failing — the index goes stale rather than breaking the build.
// The generated files are committed so a token-less build still ships a recent index.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ACCOUNT_ID = 'f0c8d394517ba9f344072219a4b99dbf';
const DATABASE_ID = '9769d3ba-3081-49ad-bb28-01fb2002df6f';

const SQL = `SELECT a.language AS language, a.title AS title, a.summary AS summary, a.slug AS slug,
  g.category AS category, substr(g.published_at, 1, 10) AS date
  FROM articles a JOIN content_groups g ON a.content_group_id = g.id
  WHERE g.status = 'published' ORDER BY g.published_at DESC LIMIT 2000`;

function plain(value) {
  return String(value ?? '')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.warn('[search-index] CLOUDFLARE_API_TOKEN not set — keeping existing index files (may be stale).');
    return;
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: SQL }),
    },
  );
  if (!res.ok) throw new Error(`D1 query failed: HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  const rows = body?.result?.[0]?.results ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('D1 query returned no rows — refusing to overwrite the index.');
  }
  for (const lang of ['zh', 'en']) {
    const items = rows
      .filter((row) => row.language === lang)
      .map((row) => ({
        t: plain(row.title),
        s: plain(row.summary).slice(0, 120),
        u: `/${lang}/${row.category}/${row.slug}`,
        c: row.category,
        d: row.date ?? '',
      }));
    const target = path.join(ROOT, 'public', `search-index-${lang}.json`);
    fs.writeFileSync(target, JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }), 'utf8');
    console.log(`[search-index] wrote ${target} (${items.length} articles)`);
  }
}

main().catch((err) => {
  console.error('[search-index] FAILED:', err.message);
  process.exit(1);
});
