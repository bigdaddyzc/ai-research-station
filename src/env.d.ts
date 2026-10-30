/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

declare namespace App {
  interface Locals {
    runtime?: {
      env: {
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
    };
  }
}
