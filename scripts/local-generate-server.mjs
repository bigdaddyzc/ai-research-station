import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const port = Number(process.env.LOCAL_GENERATE_PORT || 8790);

function json(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function runGenerate(searchParams) {
  return new Promise((resolve, reject) => {
    const args = ['scripts/local-generate.mjs'];
    const category = searchParams.get('category');
    const topic = searchParams.get('topic');
    const dryRun = searchParams.get('dryRun') === '1';

    if (category) args.push(`--category=${category}`);
    if (topic) args.push(`--topic=${topic}`);
    if (dryRun) args.push('--dry-run');

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HTTP_PROXY: process.env.HTTP_PROXY || 'http://127.0.0.1:7897',
        HTTPS_PROXY: process.env.HTTPS_PROXY || 'http://127.0.0.1:7897',
        ALL_PROXY: process.env.ALL_PROXY || 'http://127.0.0.1:7897',
        NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1',
      },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`local generation exited with ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (error) {
        reject(new Error(`local generation returned invalid JSON: ${String(error)}; output=${stdout.slice(0, 500)}`));
      }
    });
  });
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    json(res, 400, { ok: false, message: 'Missing URL.' });
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/health') {
    json(res, 200, { ok: true, service: 'local-generate-server' });
    return;
  }

  if (url.pathname !== '/generate') {
    json(res, 404, { ok: false, message: 'Not found.' });
    return;
  }

  try {
    const result = await runGenerate(url.searchParams);
    json(res, 200, { ...result, via: 'local-generate-server' });
  } catch (error) {
    json(res, 500, {
      provider: 'vertex-ai',
      createdDrafts: 0,
      message: error instanceof Error ? error.message : String(error),
      via: 'local-generate-server',
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`local-generate-server ready on http://127.0.0.1:${port}`);
});
