import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const distClient = path.join(root, "dist", "client");
const distServer = path.join(root, "dist", "server");
const deployDir = path.join(root, ".codex-pages-deploy");

const wranglerDeployConfig = path.join(root, '.wrangler', 'deploy', 'config.json');
if (fs.existsSync(wranglerDeployConfig)) {
  fs.rmSync(wranglerDeployConfig, { force: true });
}

const distWranglerJson = path.join(distServer, 'wrangler.json');
if (fs.existsSync(distWranglerJson)) {
  fs.rmSync(distWranglerJson, { force: true });
}

if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });

for (const entry of fs.readdirSync(distClient, { withFileTypes: true })) {
  const src = path.join(distClient, entry.name);
  const dest = path.join(deployDir, entry.name);
  fs.cpSync(src, dest, { recursive: true, force: true });
}

fs.cpSync(path.join(distServer, "entry.mjs"), path.join(deployDir, "_worker.js"), { force: true });
fs.cpSync(path.join(distServer, "chunks"), path.join(deployDir, "chunks"), { recursive: true, force: true });
fs.cpSync(path.join(distServer, "virtual_astro_middleware.mjs"), path.join(deployDir, "virtual_astro_middleware.mjs"), { force: true });

fs.writeFileSync(
  path.join(deployDir, "_worker-scheduled.js"),
  [
    'import worker from "./_worker.js";',
    '',
    'export default {',
    '  fetch(request, env, ctx) {',
    '    return worker.fetch(request, env, ctx);',
    '  },',
    '  async scheduled(event, env, ctx) {',
    '    // Generation runs as many small steps (free-plan subrequest limit); the last trigger publishes.',
    '    const mode = event.cron === "0 2 * * *" ? "publish=1" : "step=1";',
    '    const request = new Request("https://acp.dpdns.org/api/cron/daily-generate?" + mode, { headers: { "x-cron-secret": env.CRON_SECRET || "" } });',
    '    const promise = worker.fetch(request, env, ctx)',
    '      .then(r => r.text())',
    '      .then(body => console.log("[cron] daily-generate result:", body))',
    '      .catch(err => console.error("[cron] daily-generate error:", err));',
    '    ctx.waitUntil(promise);',
    '  }',
    '};',
    '',
  ].join('\n'),
  'utf8',
);

fs.writeFileSync(
  path.join(deployDir, "wrangler.toml"),
  [
    "name = \"acp-ai-research\"",
    "compatibility_date = \"2026-07-04\"",
    "",
    "[[d1_databases]]",
    "binding = \"DB\"",
    "database_name = \"acp_ai_research\"",
    "database_id = \"9769d3ba-3081-49ad-bb28-01fb2002df6f\"",
    "",
    "[vars]",
    "PUBLIC_SITE_URL = \"https://acp.dpdns.org\"",
    "AI_PROVIDER = \"gemini-api\"",
    "GEMINI_MODEL = \"gemini-3.5-flash\"",
    "AUTO_PUBLISH_DAILY_LIMIT = \"5\"",
    "GOOGLE_CLOUD_PROJECT = \"direct-beacon-501110-u7\"",
    "GOOGLE_CLOUD_LOCATION = \"us-central1\"",
    "",
  ].join("\n"),
  "utf8",
);

console.log("Pages deploy directory prepared at " + deployDir);