from pathlib import Path
from urllib.request import Request, urlopen
import shutil

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "android" / "app" / "src" / "main" / "assets"
WEB = ROOT / "web" / "index.html"
SHAKA = ROOT / "node_modules" / "shaka-player" / "dist" / "shaka-player.compiled.js"
PLAYLIST_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u"

ASSETS.mkdir(parents=True, exist_ok=True)

if not WEB.exists():
    raise SystemExit(f"Missing {WEB}")
if not SHAKA.exists():
    raise SystemExit("Shaka Player is missing. Run: npm install")

shutil.copy2(WEB, ASSETS / "index.html")
shutil.copy2(SHAKA, ASSETS / "shaka-player.compiled.js")

req = Request(PLAYLIST_URL, headers={"User-Agent": "LiveTV-build/0.1"})
with urlopen(req, timeout=30) as response:
    data = response.read()
if not data.startswith(b"#EXTM3U"):
    raise SystemExit("Downloaded playlist is not an M3U file")
(ASSETS / "M3UPT.m3u").write_bytes(data)
print(f"Prepared assets: Shaka + {len(data):,} byte M3UPT snapshot")
