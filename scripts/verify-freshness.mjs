import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  generation: read('src/lib/generation.ts'),
  localGenerate: read('scripts/local-generate.mjs'),
  db: read('src/lib/db.ts'),
};

const checks = [
  {
    name: 'Worker generation enforces a 7-day news window',
    pass: files.generation.includes("category === 'news'") && files.generation.includes('setUTCDate(date.getUTCDate() - 7)'),
  },
  {
    name: 'Worker generation enforces category-specific month windows',
    pass:
      files.generation.includes("category === 'resources'") &&
      files.generation.includes("category === 'prompts'") &&
      files.generation.includes('setUTCMonth(date.getUTCMonth() - 4)') &&
      files.generation.includes('setUTCMonth(date.getUTCMonth() - 3)') &&
      files.generation.includes('setUTCMonth(date.getUTCMonth() - 6)'),
  },
  {
    name: 'Local generation matches the worker freshness windows',
    pass:
      files.localGenerate.includes("category === 'news'") &&
      files.localGenerate.includes('setUTCDate(date.getUTCDate() - 7)') &&
      files.localGenerate.includes('setUTCMonth(date.getUTCMonth() - 4)') &&
      files.localGenerate.includes('setUTCMonth(date.getUTCMonth() - 3)') &&
      files.localGenerate.includes('setUTCMonth(date.getUTCMonth() - 6)'),
  },
  {
    name: 'Freshness prompts mention category-specific windows',
    pass: files.generation.includes('sources from within ${freshnessWindow.label}') && files.localGenerate.includes('sources from within ${freshnessWindow.label}'),
  },
  {
    name: 'Published article listing filters stale content and stale sources',
    pass:
      files.db.includes("date('now', '-7 days')") &&
      files.db.includes("date('now', '-4 months')") &&
      files.db.includes("date('now', '-3 months')") &&
      files.db.includes("date('now', '-6 months')") &&
      files.db.includes('NOT EXISTS (SELECT 1 FROM sources s') &&
      files.db.includes('(SELECT COUNT(*) FROM sources s WHERE s.content_group_id = g.id) >= 2'),
  },
  {
    name: 'Article lists are ordered by newest publish/create date first',
    pass: files.db.includes('ORDER BY COALESCE(g.published_at, g.created_at) DESC') && files.db.includes('compareArticlesByDateDesc'),
  },
  {
    name: 'Publish validation uses category-specific freshness windows',
    pass: files.db.includes("WHEN g.category = 'prompts' THEN date('now', '-3 months')") && files.db.includes('getFreshnessLabel(category)'),
  },
  {
    name: 'Prompt content uses the documented 3-month window',
    pass:
      files.generation.includes("category === 'prompts'") &&
      files.localGenerate.includes("category === 'prompts'") &&
      files.db.includes("g.category = 'prompts'"),
  },
  {
    name: 'Article-body reference dates are guarded in both generation paths',
    pass:
      files.generation.includes('assertArticleReferencesFresh') &&
      files.localGenerate.includes('assertArticleReferencesFresh') &&
      files.generation.includes('MUST cite ONLY the fact-pack sources') &&
      files.localGenerate.includes('MUST cite ONLY the fact-pack sources'),
  },
];

const failed = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} freshness verification check(s) failed.`);
  process.exit(1);
}

console.log('\nFreshness verification passed.');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}
