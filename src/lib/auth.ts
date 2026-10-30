export async function isAdminAuthenticated(request: Request, envPassword?: string): Promise<boolean> {
  if (!envPassword) return false;
  const cookie = request.headers.get('cookie') ?? '';
  const token = getCookie(cookie, 'acp_admin');
  if (!token) return false;
  const expected = await hashForCookie(envPassword);
  return token === expected;
}

export async function adminCookie(password: string): Promise<string> {
  const token = await hashForCookie(password);
  return `acp_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
}

export function clearAdminCookie(): string {
  return 'acp_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

async function hashForCookie(password: string): Promise<string> {
  const data = new TextEncoder().encode('acp_admin_v1::' + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(cookie: string, key: string): string | null {
  const parts = cookie.split(';').map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${key}=`));
  return pair ? decodeURIComponent(pair.slice(key.length + 1)) : null;
}
