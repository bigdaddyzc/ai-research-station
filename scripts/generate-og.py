"""Regenerate public/og.png from the committed base64 source.

The OG image is a binary PNG, which cannot go through the text-only
snapshot push flow, so the bytes live in og.png.b64 (plain text) and this
stdlib-only script decodes them at build time. Run automatically by
`npm run build`. Idempotent: re-running overwrites the same bytes.
"""

import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> None:
    b64 = (ROOT / "scripts" / "og.png.b64").read_text(encoding="utf-8").strip()
    target = ROOT / "public" / "og.png"
    target.write_bytes(base64.b64decode(b64))
    print(f"wrote {target} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
