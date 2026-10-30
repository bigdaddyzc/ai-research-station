import { env as cfEnv } from "cloudflare:workers";

type RuntimeEnv = Record<string, unknown>;

export type AppEnv = {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  AI_PROVIDER?: string;
  PUBLIC_SITE_URL?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_CLOUD_PROJECT?: string;
  GOOGLE_CLOUD_LOCATION?: string;
  GOOGLE_SA_KEY_JSON?: string;
  GOOGLE_APPLICATION_CREDENTIALS?: string;
};

export async function getRuntimeEnv(locals?: App.Locals): Promise<AppEnv> {
  if (import.meta.env.DEV) {
    return {
      ...((locals?.runtime?.env ?? {}) as RuntimeEnv),
      ADMIN_PASSWORD: import.meta.env.ADMIN_PASSWORD ?? locals?.runtime?.env?.ADMIN_PASSWORD,
      AI_PROVIDER: import.meta.env.AI_PROVIDER ?? locals?.runtime?.env?.AI_PROVIDER,
      PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL ?? locals?.runtime?.env?.PUBLIC_SITE_URL,
      GEMINI_API_KEY: import.meta.env.GEMINI_API_KEY ?? locals?.runtime?.env?.GEMINI_API_KEY,
      GOOGLE_CLOUD_PROJECT: import.meta.env.GOOGLE_CLOUD_PROJECT ?? locals?.runtime?.env?.GOOGLE_CLOUD_PROJECT,
      GOOGLE_CLOUD_LOCATION: import.meta.env.GOOGLE_CLOUD_LOCATION ?? locals?.runtime?.env?.GOOGLE_CLOUD_LOCATION,
      GOOGLE_SA_KEY_JSON: import.meta.env.GOOGLE_SA_KEY_JSON ?? locals?.runtime?.env?.GOOGLE_SA_KEY_JSON,
      GOOGLE_APPLICATION_CREDENTIALS: import.meta.env.GOOGLE_APPLICATION_CREDENTIALS ?? locals?.runtime?.env?.GOOGLE_APPLICATION_CREDENTIALS,
    } as AppEnv;
  }

  return (cfEnv as Record<string, unknown>) as AppEnv;
}
