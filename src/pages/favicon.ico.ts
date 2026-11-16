import type { APIRoute } from 'astro';

// Serves a real favicon at /favicon.ico instead of letting the request fall
// through to the [lang] route (which used to 302 it to /zh).
// The icon is a 16x16 32bpp ICO (teal square, white "A") embedded as base64:
// a binary .ico cannot be stored as a static file in this repo's push flow,
// which only carries UTF-8 text content.
const FAVICON_ICO_BASE64 = 'AAABAAEAEBAAAAEAIABIBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAACIlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3///////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3///////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3///////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3///////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3//////////////////////////////////////////////////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN//////////////////////////////////////////////////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3///////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3///////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf///////////4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf////////////////////////////////+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/////////////////////////////////iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/iJQN/4iUDf+IlA3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const GET: APIRoute = async () => {
  return new Response(decodeBase64(FAVICON_ICO_BASE64), {
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
};
