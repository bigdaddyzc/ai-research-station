const ADMIN_COOKIE_MAX_AGE_SECONDS = 7200;

export async function isAdminAuthenticated(request: Request, envPassword?: string): Promise<boolean> {
  if (!envPassword) return false;
  const cookie = request.headers.get('cookie') ?? '';
  const token = getCookie(cookie, 'acp_admin');
  if (!token) return false;

  // Cookie format: "<issuedAtSeconds>.<sha256('acp_admin_v1::' + password + '::' + issuedAtSeconds)>".
  // Cookies minted before this change have no timestamp and are rejected;
  // the admin simply logs in again.
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const issuedAt = Number(token.slice(0, dot));
  if (!Number.isFinite(issuedAt)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (issuedAt > nowSeconds + 60) return false; // issued in the future (beyond clock skew)
  if (nowSeconds - issuedAt > ADMIN_COOKIE_MAX_AGE_SECONDS) return false; // expired server-side

  const expected = await hashForCookie(envPassword, issuedAt);
  return token.slice(dot + 1) === expected;
}

export async function adminCookie(password: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = `${issuedAt}.${await hashForCookie(password, issuedAt)}`;
  return `acp_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_COOKIE_MAX_AGE_SECONDS}`;
}

export function clearAdminCookie(): string {
  return 'acp_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

async function hashForCookie(password: string, issuedAt: number): Promise<string> {
  const data = new TextEncoder().encode(`acp_admin_v1::${password}::${issuedAt}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(cookie: string, key: string): string | null {
  const parts = cookie.split(';').map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${key}=`));
  return pair ? decodeURIComponent(pair.slice(key.length + 1)) : null;
}
