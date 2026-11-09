"""Generate her spoken lines with a local VOICEVOX engine.

Reads scripts/voice/lines.json, asks the engine (the VOICEVOX app must be running) for each line's audio query,
applies the line's tweaks, synthesises it, and writes next to the page:

- <id>.wav: the audio, exactly as the engine made it (WAV, so playback starts on the first sample: lip sync stays exact)
- lines.json: every line's subtitle, duration, per-mora timing (consonant and vowel) and a loudness envelope, which
  the page turns into mouth shapes
- CREDITS.md: the credit the voice's terms require

    python3 scripts/voice/generate_lines.py [--out web/public/voice] [--only okaeri]
"""
from __future__ import annotations

import argparse
import copy
import itertools
import json
import math
import sys
import urllib.error
import urllib.parse
import urllib.request
import wave
from array import array
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
ENVELOPE_FPS = 50          # loudness samples per second
ENVELOPE_CURVE = 0.6       # < 1 lifts quiet speech so soft endings still move the mouth
DURATION_TOLERANCE = 0.03  # s: the computed timeline must match the synthesised audio this closely
ENGINE_FPS = 24000 / 256   # the engine renders each sound as whole frames of 256 samples at 24 kHz
SENTENCE_PAUSE = 0.7       # s (before speedScale): the pause between two sentences of a line (VOICEVOX's own is ~0.35)


def find_style_id(speakers: list[dict], speaker: str, style: str) -> int:
    for s in speakers:
        if s["name"] == speaker:
            for st in s["styles"]:
                if st["name"] == style:
                    return st["id"]
    installed = ", ".join(f"{s['name']} ({'/'.join(st['name'] for st in s['styles'])})" for s in speakers)
    raise SystemExit(f"voice {speaker} / {style} is not installed in VOICEVOX. Installed: {installed}")


def timeline(query: dict) -> dict:
    """Per-mora timing (s) of a VOICEVOX audio query, as the engine will render it.

    The engine divides each sound's length by speedScale and rounds it to whole frames (halves up), so the timing is
    built the same way; summing the raw lengths drifts tens of milliseconds over a sentence.
    """
    speed = query.get("speedScale", 1.0) or 1.0
    pause_scale = query.get("pauseLengthScale", 1.0) or 1.0

    def frames(seconds: float) -> float:
        return math.floor(seconds * ENGINE_FPS / speed + 0.5) / ENGINE_FPS

    t = frames(query.get("prePhonemeLength", 0.0))
    moras = []

    def add(m: dict) -> None:
        nonlocal t
        c = frames(m.get("consonant_length") or 0.0) if m.get("consonant") else 0.0
        v = frames(m.get("vowel_length") or 0.0)
        moras.append({"text": m["text"], "consonant": m.get("consonant"), "vowel": m["vowel"],
                      "start": t, "vowelStart": t + c, "end": t + c + v})
        t += c + v

    for phrase in query["accent_phrases"]:
        for m in phrase["moras"]:
            add(m)
        pause = phrase.get("pause_mora")
        if pause:   # the engine uses a fixed pauseLength when given, otherwise the pause's own length times its scale
            fixed = query.get("pauseLength")
            length = fixed if fixed is not None else (pause.get("vowel_length") or 0.0) * pause_scale
            add({**pause, "vowel": "pau", "vowel_length": length})
    duration = t + frames(query.get("postPhonemeLength", 0.0))
    r = lambda x: round(x, 3)  # noqa: E731
    return {"duration": r(duration),
            "moras": [{**m, "start": r(m["start"]), "vowelStart": r(m["vowelStart"]), "end": r(m["end"])} for m in moras]}


def envelope(samples, rate: int, fps: int = ENVELOPE_FPS) -> list[int]:
    """Loudness per frame, 0..100 relative to the loudest frame (RMS, gently companded)."""
    step = max(1, rate // fps)
    rms = []
    for i in range(0, len(samples) - step + 1, step):
        chunk = samples[i:i + step]
        rms.append(math.sqrt(sum(s * s for s in chunk) / len(chunk)))
    peak = max(rms, default=0.0)
    if peak <= 0:
        return [0] * len(rms)
    return [round(100 * (x / peak) ** ENVELOPE_CURVE) for x in rms]


def credits(voice: dict, lines: list[dict]) -> str:
    said = "\n".join(f"- `{line['id']}`: {line['text']}" for line in lines)
    return (f"# Voice credits\n\nHer voice: **{voice['credit']}**. Generated with the VOICEVOX engine "
            f"(https://voicevox.hiroshiba.jp/) by `scripts/voice/generate_lines.py` from `scripts/voice/lines.json`.\n"
            f"Terms of use: {voice['terms']}\n\nLines:\n\n{said}\n")


def call(engine: str, path: str, params: dict | None = None, body: dict | None = None) -> bytes:
    url = f"{engine}{path}" + (f"?{urllib.parse.urlencode(params)}" if params else "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if params is not None or body is not None else "GET",
                                 headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.URLError as e:
        raise SystemExit(f"VOICEVOX engine at {engine} did not answer ({e}). Start the VOICEVOX app and try again.") from e


def read_wav(path: Path) -> tuple[array, int, float]:
    with wave.open(str(path)) as w:
        if w.getsampwidth() != 2:
            raise SystemExit(f"{path.name}: expected 16-bit audio, got {8 * w.getsampwidth()}-bit")
        frames = w.readframes(w.getnframes())
        samples = array("h", frames)
        if w.getnchannels() > 1:
            samples = samples[::w.getnchannels()]
        return samples, w.getframerate(), w.getnframes() / w.getframerate()


KINDS = {"greeting": {}, "talk": {"to": {"you", "self"}, "about": {"life", "thought", "book"}, "mood": {"light", "dark"}}}


def check_line(line: dict) -> None:
    """A line's kind, and for small talk who it is to, what it is about and its mood, must be known values."""
    kind = line.get("kind")
    if kind not in KINDS:
        raise SystemExit(f"{line.get('id')}: kind must be one of {sorted(KINDS)}, not {kind!r}")
    for field, allowed in KINDS[kind].items():
        if line.get(field) not in allowed:
            raise SystemExit(f"{line.get('id')}: {field} must be one of {sorted(allowed)}, not {line.get(field)!r}")


def split_subtitle(subtitle: dict) -> tuple[dict, list[dict] | None]:
    """A subtitle given in parts (lists) becomes its joined whole plus the parts; a plain one has no parts."""
    ja, en = subtitle["ja"], subtitle.get("en", "")
    if isinstance(ja, str):
        return {"ja": ja, "en": en}, None
    if not isinstance(en, list) or len(en) != len(ja):
        raise SystemExit(f"subtitle parts do not match: {ja} / {en}")
    return {"ja": "".join(ja), "en": " ".join(en)}, [{"ja": j, "en": e} for j, e in zip(ja, en)]


def spoken_count(moras: list[dict]) -> int:
    """Moras with a sound (pauses left out)."""
    return sum(1 for m in moras if m["vowel"] != "pau")


def part_starts(moras: list[dict], counts: list[int]) -> list[float]:
    """When each subtitle part starts in the audio (s): part k at its first spoken mora, counts being the spoken
    moras of each part."""
    if sum(counts) != spoken_count(moras):
        raise SystemExit(f"subtitle parts have {sum(counts)} moras but the line has {spoken_count(moras)}")
    starts, seen, k = [], 0, 0
    for m in moras:
        if m["vowel"] == "pau":
            continue
        if k < len(counts) and seen == sum(counts[:k]):
            starts.append(m["start"])
            k += 1
        seen += 1
    return starts


def sentences(text: str) -> list[str]:
    """A line's sentences, each keeping its full stop (。)."""
    pieces = text.split("。")
    out = [p + "。" for p in pieces[:-1]] + ([pieces[-1]] if pieces[-1] else [])
    return out or [text]


def lengthen_sentence_pauses(query: dict, counts: list[int], length: float) -> dict:
    """A copy of the query in which the pause between sentences lasts at least `length` s (pauses after 、 inside a
    sentence are left as they are). counts: the spoken moras of each sentence."""
    if len(counts) < 2:
        return query
    q = copy.deepcopy(query)
    bounds, seen = set(itertools.accumulate(counts[:-1])), 0
    for phrase in q["accent_phrases"]:
        seen += spoken_count(phrase["moras"])
        pause = phrase.get("pause_mora")
        if pause and seen in bounds:
            pause["vowel_length"] = max(pause.get("vowel_length") or 0.0, length)
            bounds.discard(seen)
    if bounds or seen != sum(counts):
        raise SystemExit(f"sentences of {counts} moras do not match the line's pauses")
    return q


def generate(line: dict, style_id: int, engine: str, out: Path) -> dict:
    check_line(line)
    subtitle, parts = split_subtitle(line["subtitle"])
    query = json.loads(call(engine, "/audio_query", {"speaker": style_id, "text": line["text"]}))
    query.update(line.get("query", {}))
    spoken = lambda text: spoken_count(timeline(json.loads(call(engine, "/audio_query", {"speaker": style_id, "text": text})))["moras"])  # noqa: E731
    if len(sentences(line["text"])) > 1:   # a breath between two sentences
        query = lengthen_sentence_pauses(query, [spoken(x) for x in sentences(line["text"])], SENTENCE_PAUSE)
    wav = out / f"{line['id']}.wav"
    wav.write_bytes(call(engine, f"/synthesis?speaker={style_id}", body=query))
    samples, rate, seconds = read_wav(wav)
    t = timeline(query)
    if abs(t["duration"] - seconds) > DURATION_TOLERANCE:
        raise SystemExit(f"{line['id']}: timeline says {t['duration']} s but the audio is {seconds:.3f} s")
    made = {"id": line["id"], "kind": line["kind"], "text": line["text"], "subtitle": subtitle, "audio": wav.name,
            "duration": round(seconds, 3), "kana": query.get("kana"), "moras": t["moras"],
            "envelope": {"fps": ENVELOPE_FPS, "values": envelope(samples, rate)}}
    made.update({k: line[k] for k in ("to", "about", "mood") if k in line})
    if parts:   # where each part starts: the spoken moras of each part's text, counted on its own
        counts = [spoken(x["ja"]) for x in parts]
        made["parts"] = [{**x, "start": s} for x, s in zip(parts, part_starts(t["moras"], counts))]
    return made


def previous_lines(index_path: Path, only: str | None) -> dict[str, dict]:
    """The lines already generated, by id, kept when regenerating only one (--only); none for a full run."""
    if not only:
        return {}
    if not index_path.exists():
        raise SystemExit(f"--only {only} needs the existing {index_path}; run without --only first")
    return {x["id"]: x for x in json.loads(index_path.read_text())["lines"]}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--manifest", type=Path, default=HERE / "lines.json")
    ap.add_argument("--out", type=Path, default=REPO / "web" / "public" / "voice")
    ap.add_argument("--only", help="regenerate one line id, keeping the others")
    args = ap.parse_args()
    manifest = json.loads(args.manifest.read_text())
    engine, voice = manifest["engine"].rstrip("/"), manifest["voice"]
    lines = [line for line in manifest["lines"] if not args.only or line["id"] == args.only]
    if not lines:
        raise SystemExit(f"no line with id {args.only}")
    args.out.mkdir(parents=True, exist_ok=True)
    style_id = find_style_id(json.loads(call(engine, "/speakers")), voice["speaker"], voice["style"])
    index_path = args.out / "lines.json"
    old = previous_lines(index_path, args.only)
    made = {x["id"]: x for x in (generate(line, style_id, engine, args.out) for line in lines)}
    ordered = [made.get(line["id"]) or old.get(line["id"]) for line in manifest["lines"]]
    index = {"voice": {"credit": voice["credit"], "speaker": voice["speaker"], "style": voice["style"]},
             "lines": [x for x in ordered if x]}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n")
    (args.out / "CREDITS.md").write_text(credits(voice, manifest["lines"]))
    for x in made.values():
        print(f"{x['id']}: {x['duration']} s, {len(x['moras'])} moras -> {args.out / x['audio']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
