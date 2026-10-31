interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface GroundingChunk {
  web?: { uri?: string; title?: string; domain?: string };
}

interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
    groundingMetadata?: GroundingMetadata;
    finishReason?: string;
  }>;
  error?: { message: string; code: number };
}

/**
 * A source Google Search actually retrieved during grounding. `redirectUrl` is the
 * Vertex `vertexaisearch.cloud.google.com/grounding-api-redirect/...` link; `domain`
 * comes from the chunk title (usually the site host). `resolvedUrl` is the final URL
 * after following the redirect, when resolution succeeds.
 */
export interface GroundingSource {
  redirectUrl: string;
  domain: string;
  resolvedUrl: string | null;
}

export interface GroundedResult {
  text: string;
  groundingSources: GroundingSource[];
  webSearchQueries: string[];
}

export interface VertexAIConfig {
  project: string;
  location: string;
  serviceAccountKey?: ServiceAccountKey;
  /** When set, calls the Gemini Developer API (generativelanguage.googleapis.com) with this key instead of Vertex AI. */
  apiKey?: string;
  /** Overrides the model chosen per category (e.g. a free-tier Gemini API model). */
  modelOverride?: string;
}

function base64url(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createSignedJwt(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput)));

  return `${signingInput}.${base64url(signature)}`;
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const jwt = await createSignedJwt(sa);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface GenerateContentOptions {
  temperature?: number;
  maxOutputTokens?: number;
  useGrounding?: boolean;
}

// Models only available on the global endpoint (not regional)
const GLOBAL_ONLY = new Set(['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash']);

function getEndpoint(project: string, location: string, model: string, method: string): string {
  const loc = GLOBAL_ONLY.has(model) ? 'global' : location;
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:${method}`;
}

async function callGenerate(
  config: VertexAIConfig,
  model: string,
  prompt: string,
  options: GenerateContentOptions,
): Promise<{ text: string; candidate: NonNullable<GenerateContentResponse['candidates']>[number] | undefined }> {
  const modelName = config.modelOverride || model;
  const useApiKey = Boolean(config.apiKey);
  const url = useApiKey
    ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
    : getEndpoint(config.project, config.location, modelName, 'generateContent');
  const authHeaders: Record<string, string> = useApiKey
    ? { 'x-goog-api-key': config.apiKey! }
    : { Authorization: `Bearer ${await getAccessToken(config.serviceAccountKey!)}` };
  const providerLabel = useApiKey ? 'Gemini API' : 'Vertex AI';

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  };

  // Google Search grounding and responseMimeType: 'application/json' cannot be used together
  if (!options.useGrounding) {
    generationConfig.responseMimeType = 'application/json';
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };

  if (options.useGrounding) {
    body.tools = [useApiKey ? { url_context: {} } : { googleSearch: {} }];
  }

  const doFetch = (target: string) =>
    fetch(target, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch(url);
  if (useApiKey && (res.status === 503 || res.status === 429 || res.status === 500)) {
    // Free tier: retry busy/limited models, then fall back to lighter models.
    const fallbacks = [modelName, 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
    for (const [i, m] of fallbacks.entries()) {
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
      res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`);
      if (res.ok || (res.status !== 503 && res.status !== 429 && res.status !== 500)) break;
    }
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${providerLabel} ${res.status}: ${errorText.slice(0, 1500)}`);
  }

  const responseText = await res.text();
  let data: GenerateContentResponse;
  try {
    data = JSON.parse(responseText) as GenerateContentResponse;
  } catch (parseErr) {
    throw new Error(`${providerLabel} response body is not valid JSON (${(parseErr as Error).message}). Body prefix: ${responseText.slice(0, 300)}`);
  }
  if (data.error) {
    throw new Error(`${providerLabel} error: ${data.error.message}`);
  }

  const candidate = data.candidates?.[0];
  // Gemini 2.5 models return thinking in parts with thought=true;
  // extract only the actual response parts (non-thought)
  const parts = candidate?.content?.parts ?? [];
  const responseParts = parts.filter(p => !p.thought);
  const text = (responseParts.length > 0 ? responseParts : parts)
    .map(p => p.text ?? '')
    .join('');
  return { text, candidate };
}

export async function generateContent(config: VertexAIConfig, model: string, prompt: string, options: GenerateContentOptions = {}): Promise<string> {
  const { text } = await callGenerate(config, model, prompt, options);
  return text;
}

/**
 * Like generateContent, but also returns the real sources Google Search grounded on
 * (from candidates[].groundingMetadata). Always runs with grounding enabled.
 */
export async function generateGroundedContent(
  config: VertexAIConfig,
  model: string,
  prompt: string,
  options: GenerateContentOptions = {},
): Promise<GroundedResult> {
  const { text, candidate } = await callGenerate(config, model, prompt, { ...options, useGrounding: true });
  const meta = candidate?.groundingMetadata;
  const seen = new Set<string>();
  const groundingSources: GroundingSource[] = [];
  for (const chunk of meta?.groundingChunks ?? []) {
    const redirectUrl = String(chunk.web?.uri ?? '').trim();
    const domain = String(chunk.web?.domain ?? chunk.web?.title ?? '').trim().toLowerCase();
    if (!redirectUrl && !domain) continue;
    const key = redirectUrl || domain;
    if (seen.has(key)) continue;
    seen.add(key);
    groundingSources.push({ redirectUrl, domain, resolvedUrl: null });
  }
  return { text, groundingSources, webSearchQueries: meta?.webSearchQueries ?? [] };
}

/**
 * Follow a Vertex grounding redirect to recover the real destination URL.
 * Returns null if the redirect can't be resolved (network error, no Location, etc.).
 */
export async function resolveGroundingRedirect(redirectUrl: string): Promise<string | null> {
  if (!redirectUrl) return null;
  try {
    // Prefer a HEAD with manual redirect so we can read the Location header without
    // downloading the target page.
    const res = await fetch(redirectUrl, { method: 'HEAD', redirect: 'manual' });
    const location = res.headers.get('location');
    if (location) return location;
    // Some environments auto-follow; res.url then holds the final URL.
    if (res.url && res.url !== redirectUrl) return res.url;
  } catch {
    // fall through
  }
  try {
    const res = await fetch(redirectUrl, { method: 'GET', redirect: 'follow' });
    if (res.url && res.url !== redirectUrl) return res.url;
  } catch {
    // give up
  }
  return null;
}

export function parseServiceAccountKey(json: string): ServiceAccountKey {
  const parsed = JSON.parse(json) as ServiceAccountKey;
  if (!parsed.client_email || !parsed.private_key || !parsed.token_uri) {
    throw new Error('Invalid service account key: missing required fields');
  }
  return parsed;
}
