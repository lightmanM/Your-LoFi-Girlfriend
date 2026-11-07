"""Prepare licensed music for the web player.

Reads scripts/music/tracks.json, encodes every included track to a small MP3
(audio untouched apart from the format change, which the CC licences allow),
measures loudness so the player can level tracks at runtime, and writes
playlist.json plus CREDITS.md next to the audio.

    python3 scripts/music/prepare_music.py --src <folder with the source files> [--out web/public/music]
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
TARGET_LUFS = -16.0      # common loudness for web/streaming playback
PEAK_CEILING_DB = -1.0   # never let runtime gain push true peaks above this
VBR_QUALITY = "5"        # LAME V5, about 130 kbps: transparent enough for soft lofi
REQUIRED = ("artist", "license", "source_url")


def slugify(artist: str, title: str) -> str:
    text = f"{artist} {title}".lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def title_from_member(name: str, artist: str) -> str:
    stem = Path(name).stem
    stem = re.sub(r"^\d+\s+", "", stem)
    prefix = f"{artist} - "
    return stem[len(prefix):] if stem.startswith(prefix) else stem


def gain_db(integrated_lufs: float, true_peak_db: float,
            target: float = TARGET_LUFS, ceiling: float = PEAK_CEILING_DB) -> float:
    return round(min(target - integrated_lufs, ceiling - true_peak_db), 2)


def validate_source(src: dict) -> None:
    missing = [k for k in REQUIRED if not src.get(k)]
    lic = src.get("license") or {}
    if not lic.get("name") or not lic.get("url"):
        missing.append("license.name/url")
    if not (src.get("file") or src.get("zip")):
        missing.append("file or zip")
    if missing:
        raise ValueError(f"{src.get('artist', '?')}: missing {', '.join(sorted(set(missing)))}")


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {result.stderr.strip()[-400:]}")
    return result


def measure(path: Path) -> dict:
    """Integrated loudness and true peak from ffmpeg's loudnorm analysis pass."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a",
               "-af", "loudnorm=print_format=json", "-f", "null", "-"]).stderr
    block = err[err.rindex("{"):err.rindex("}") + 1]
    data = json.loads(block)
    return {"lufs": float(data["input_i"]), "peak_db": float(data["input_tp"])}


def duration(path: Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(path)]).stdout
    return round(float(out.strip()), 2)


def encode(src: Path, dst: Path, artist: str, title: str) -> None:
    # audio stream only (drops embedded cover art), metadata reduced to artist/title
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-map", "0:a:0", "-map_metadata", "-1", "-c:a", "libmp3lame", "-q:a", VBR_QUALITY,
         "-metadata", f"artist={artist}", "-metadata", f"title={title}", str(dst)])


def expand(src: dict, folder: Path, scratch: Path) -> list[tuple[Path, str]]:
    """(audio path, title) pairs for one manifest entry."""
    if src.get("file"):
        return [(folder / src["file"], src.get("title") or Path(src["file"]).stem)]
    target = scratch / slugify(src["artist"], "pack")
    with zipfile.ZipFile(folder / src["zip"]) as z:
        members = sorted(m for m in z.namelist()
                         if m.lower().endswith(".mp3") and not m.startswith("__MACOSX"))
        for m in members:
            z.extract(m, target)
    return [(target / m, title_from_member(m, src["artist"])) for m in members]


def prepare(sources: list[dict], folder: Path, out: Path) -> list[dict]:
    tracks: list[dict] = []
    with tempfile.TemporaryDirectory() as tmp:
        for src in sources:
            validate_source(src)
            if not src.get("include"):
                print(f"skip  {src['artist']}: {src.get('notes', 'excluded')}")
                continue
            for path, title in expand(src, folder, Path(tmp)):
                if not path.exists():
                    raise FileNotFoundError(path)
                track_id = slugify(src["artist"], title)
                dst = out / f"{track_id}.mp3"
                encode(path, dst, src["artist"], title)
                level = measure(dst)
                tracks.append({
                    "id": track_id, "file": dst.name, "title": title, "artist": src["artist"],
                    "duration": duration(dst), "gain_db": gain_db(level["lufs"], level["peak_db"]),
                    "license": src["license"], "source": src["source_url"],
                })
                print(f"ok    {dst.name}  {dst.stat().st_size / 1e6:.2f} MB  {level['lufs']:.1f} LUFS")
    return tracks


def credits(tracks: list[dict]) -> str:
    lines = ["# Music credits", "",
             "Tracks are played unmodified (re-encoded for the web only). Generated by",
             "`scripts/music/prepare_music.py` from `scripts/music/tracks.json`.", ""]
    for t in tracks:
        lic = t["license"]
        lines.append(f"- \"{t['title']}\" by {t['artist']} ({t['source']}), "
                     f"licensed under [{lic['name']}]({lic['url']})")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", type=Path, default=REPO / "assets" / "music")
    ap.add_argument("--out", type=Path, default=REPO / "web" / "public" / "music")
    ap.add_argument("--manifest", type=Path, default=HERE / "tracks.json")
    args = ap.parse_args()
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            print(f"{tool} not found on PATH", file=sys.stderr)
            return 1
    sources = json.loads(args.manifest.read_text())["sources"]
    if args.out.exists():
        for old in args.out.glob("*.mp3"):
            old.unlink()
    args.out.mkdir(parents=True, exist_ok=True)
    tracks = prepare(sources, args.src, args.out)
    playlist = {"version": 1, "target_lufs": TARGET_LUFS, "tracks": tracks}
    (args.out / "playlist.json").write_text(json.dumps(playlist, indent=2, ensure_ascii=False) + "\n")
    (args.out / "CREDITS.md").write_text(credits(tracks))
    total = sum((args.out / t["file"]).stat().st_size for t in tracks)
    minutes = sum(t["duration"] for t in tracks) / 60
    print(f"{len(tracks)} tracks, {minutes:.1f} min, {total / 1e6:.1f} MB -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
